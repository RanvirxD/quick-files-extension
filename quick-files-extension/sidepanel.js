// Quick Files: stores File System Access handles (not copies) in IndexedDB,
// so you always drag the latest version of the file from its original location.

const $ = (id) => document.getElementById(id);
const listEl = $("list");
const emptyEl = $("empty");
const unlockBar = $("unlockBar");
const overlay = $("dropOverlay");

// ---------- IndexedDB ----------
const dbPromise = new Promise((resolve, reject) => {
  const req = indexedDB.open("quick-files", 1);
  req.onupgradeneeded = () => req.result.createObjectStore("files", { keyPath: "id" });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});
async function tx(mode, fn) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const t = db.transaction("files", mode);
    const r = fn(t.objectStore("files"));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  });
}
const getAll = () => tx("readonly", (s) => s.getAll());
const put = (rec) => tx("readwrite", (s) => s.put(rec));
const del = (id) => tx("readwrite", (s) => s.delete(id));

// ---------- State ----------
// id -> { file: File, url: blobURL } | { status: "locked" | "missing" }
const cache = new Map();
let records = [];

function fmtSize(n) {
  if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
function iconFor(name) {
  const ext = name.split(".").pop().toLowerCase();
  if (["pdf"].includes(ext)) return "📕";
  if (["doc", "docx", "odt", "rtf"].includes(ext)) return "📘";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "🖼️";
  if (["xls", "xlsx", "csv"].includes(ext)) return "📗";
  if (["zip", "rar", "7z"].includes(ext)) return "🗜️";
  return "📄";
}

// ---------- Loading files from handles ----------
async function loadOne(rec, { prompt = false } = {}) {
  if (rec.blob) {
    const file = new File([rec.blob], rec.name, { type: rec.type || rec.blob.type });
    const old = cache.get(rec.id);
    if (old && old.url) URL.revokeObjectURL(old.url);
    cache.set(rec.id, { file, url: URL.createObjectURL(file) });
    return;
  }
  try {
    let perm = await rec.handle.queryPermission({ mode: "read" });
    if (perm !== "granted" && prompt) perm = await rec.handle.requestPermission({ mode: "read" });
    if (perm !== "granted") {
      cache.set(rec.id, { status: "locked" });
      return;
    }
    const file = await rec.handle.getFile();
    const old = cache.get(rec.id);
    if (old && old.url) URL.revokeObjectURL(old.url);
    cache.set(rec.id, { file, url: URL.createObjectURL(file) });
  } catch (e) {
    cache.set(rec.id, { status: e.name === "NotFoundError" ? "missing" : "locked" });
  }
}
async function loadAll(opts) {
  for (const rec of records) await loadOne(rec, opts);
  render();
}

// ---------- Render ----------
function render() {
  listEl.textContent = "";
  emptyEl.hidden = records.length > 0;
  let anyLocked = false;

  for (const rec of records) {
    const c = cache.get(rec.id) || { status: "locked" };
    if (c.status === "locked") anyLocked = true;

    const li = document.createElement("li");
    li.dataset.id = rec.id;
    li.draggable = !!c.file;
    if (c.status) li.classList.add(c.status);

    const icon = Object.assign(document.createElement("span"), { className: "icon", textContent: iconFor(rec.name) });
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = Object.assign(document.createElement("div"), { className: "name", textContent: rec.name, title: rec.name });
    const sub = Object.assign(document.createElement("div"), { className: "sub" });
    sub.textContent = c.file ? fmtSize(c.file.size) : c.status === "missing" ? "File moved or deleted" : "Locked: click Unlock above";
    meta.append(name, sub);

    const x = Object.assign(document.createElement("button"), { className: "del", textContent: "✕", title: "Remove from list" });
    x.addEventListener("click", async () => {
      const cc = cache.get(rec.id);
      if (cc && cc.url) URL.revokeObjectURL(cc.url);
      cache.delete(rec.id);
      await del(rec.id);
      records = records.filter((r) => r.id !== rec.id);
      render();
    });

    // Refresh the snapshot right before a possible drag so edits on disk are picked up.
    li.addEventListener("pointerenter", async () => {
      if (cache.get(rec.id)?.file) await loadOne(rec);
    });

    li.addEventListener("dragstart", (e) => {
      const cur = cache.get(rec.id);
      if (!cur || !cur.file) return e.preventDefault();
      e.dataTransfer.effectAllowed = "copy";
      // Works for dropping into web upload boxes / drop zones.
      try { e.dataTransfer.items.add(cur.file); } catch {}
      // Works for dropping onto the desktop / a folder.
      e.dataTransfer.setData("DownloadURL", `${cur.file.type || "application/octet-stream"}:${cur.file.name}:${cur.url}`);
    });

    li.append(icon, meta, x);
    listEl.append(li);
  }
  unlockBar.hidden = !anyLocked;
}

// ---------- Adding files ----------
async function addHandles(handles) {
  for (const h of handles) {
    if (h.kind !== "file") continue;
    // Skip duplicates (same underlying file).
    let dup = false;
    for (const r of records) if (await r.handle.isSameEntry(h)) { dup = true; break; }
    if (dup) continue;
    const rec = { id: crypto.randomUUID(), name: h.name, handle: h, addedAt: Date.now() };
    await put(rec);
    records.push(rec);
    await loadOne(rec, { prompt: true });
  }
  render();
}

// The file picker isn't available in side panels, so add files from a normal tab.
$("addBtn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("add.html") });
});

// Refresh when files are added from the add page.
async function reloadRecords() {
  records = (await getAll()).sort((a, b) => a.addedAt - b.addedAt);
  render();
  await loadAll();
}
new BroadcastChannel("quick-files").onmessage = reloadRecords;

$("unlockBtn").addEventListener("click", () => loadAll({ prompt: true }));

// Drop a file onto the panel to save it.
let dragDepth = 0;
window.addEventListener("dragenter", (e) => {
  if (e.dataTransfer?.types.includes("Files") && !e.target.closest?.("li")) { dragDepth++; overlay.hidden = false; }
});
window.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.hidden = true; });
window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", async (e) => {
  e.preventDefault();
  dragDepth = 0; overlay.hidden = true;
  const items = [...(e.dataTransfer?.items || [])].filter((i) => i.kind === "file");
  const handles = [];
  for (const it of items) {
    if (it.getAsFileSystemHandle) {
      const h = await it.getAsFileSystemHandle();
      if (h) handles.push(h);
    }
  }
  await addHandles(handles);
});

// Re-read files when the panel regains focus (picks up edits to your resume).
window.addEventListener("focus", reloadRecords);

// ---------- Init ----------
(async () => {
  records = (await getAll()).sort((a, b) => a.addedAt - b.addedAt);
  render();
  await loadAll();
})();
