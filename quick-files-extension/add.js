// Full-tab page where the File System Access picker is available.
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

const channel = new BroadcastChannel("quick-files");
const addedEl = document.getElementById("added");

async function addHandles(handles) {
  const existing = await getAll();
  for (const h of handles) {
    if (h.kind !== "file") continue;
    let dup = false;
    for (const r of existing) if (r.handle && await r.handle.isSameEntry(h)) { dup = true; break; }
    if (!dup) {
      await put({ id: crypto.randomUUID(), name: h.name, handle: h, addedAt: Date.now() });
    }
    const li = document.createElement("li");
    li.textContent = (dup ? "Already saved: " : "Saved: ") + h.name;
    addedEl.append(li);
  }
  channel.postMessage("changed");
}

// Fallback for browsers without the File System Access API (e.g. Brave default):
// saves a copy of the file inside the extension. Re-add a file to update its copy.
async function addFiles(files) {
  const existing = await getAll();
  for (const f of files) {
    const prev = existing.find((r) => r.blob && r.name === f.name);
    await put({
      id: prev ? prev.id : crypto.randomUUID(),
      name: f.name, blob: f, type: f.type, addedAt: prev ? prev.addedAt : Date.now(),
    });
    const li = document.createElement("li");
    li.textContent = (prev ? "Updated copy: " : "Saved copy: ") + f.name;
    addedEl.append(li);
  }
  channel.postMessage("changed");
}

const picker = document.getElementById("picker");
picker.addEventListener("change", async () => {
  await addFiles([...picker.files]);
  picker.value = "";
});

document.getElementById("choose").addEventListener("click", async () => {
  if (!window.showOpenFilePicker) return picker.click();
  try {
    await addHandles(await window.showOpenFilePicker({ multiple: true }));
  } catch (e) {
    if (e.name !== "AbortError") alert("Could not add files: " + e.message);
  }
});

const drop = document.getElementById("drop");
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", async (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  const handles = [];
  for (const it of [...e.dataTransfer.items].filter((i) => i.kind === "file")) {
    const h = await it.getAsFileSystemHandle?.();
    if (h) handles.push(h);
  }
  if (handles.length) await addHandles(handles);
  else await addFiles([...e.dataTransfer.files]);
});
