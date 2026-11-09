// Runs on web pages. Receives drops coming from the Quick Files side panel and
// hands the page a real File, as if you had dragged it from your computer.
(() => {
  const TYPE = "application/x-quick-files-id";
  const hasOurs = (dt) => !!dt && !!dt.types && [...dt.types].includes(TYPE);

  function toast(msg) {
    const d = document.createElement("div");
    d.textContent = msg;
    d.style.cssText =
      "position:fixed;z-index:2147483647;bottom:20px;left:50%;transform:translateX(-50%);" +
      "background:#222;color:#fff;padding:10px 14px;border-radius:8px;font:14px system-ui,sans-serif;" +
      "box-shadow:0 4px 16px rgba(0,0,0,.3)";
    document.documentElement.append(d);
    setTimeout(() => d.remove(), 3000);
  }

  function toFile(p) {
    const bin = atob(p.b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new File([u8], p.name, { type: p.type || "application/octet-stream", lastModified: Date.now() });
  }

  function setInput(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findInput(near) {
    let el = near;
    while (el && el !== document.documentElement) {
      const i = el.matches && el.matches("input[type=file]") ? el : el.querySelector && el.querySelector("input[type=file]");
      if (i) return i;
      el = el.parentElement;
    }
    return document.querySelector("input[type=file]");
  }

  function fire(target, type, dt, orig) {
    const ev = new DragEvent(type, {
      bubbles: true, cancelable: true, composed: true, dataTransfer: dt,
      clientX: orig.clientX, clientY: orig.clientY, screenX: orig.screenX, screenY: orig.screenY,
    });
    target.dispatchEvent(ev);
    return ev;
  }

  // Let drops from our panel land anywhere on the page.
  document.addEventListener("dragover", (e) => {
    if (hasOurs(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }
  }, true);

  document.addEventListener("drop", async (e) => {
    if (!hasOurs(e.dataTransfer)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const id = e.dataTransfer.getData(TYPE);
    const target = e.target;
    let res;
    try { res = await chrome.runtime.sendMessage({ type: "quickfiles:get", id }); } catch {}
    if (!res || !res.ok) return toast((res && res.error) || "Quick Files panel is not available");
    const file = toFile(res);
    const dt = new DataTransfer();
    dt.items.add(file);
    fire(target, "dragenter", dt, e);
    fire(target, "dragover", dt, e);
    const dropEv = fire(target, "drop", dt, e);
    if (!dropEv.defaultPrevented) {
      const input = findInput(target);
      if (input) setInput(input, file);
      else toast("No upload box found here");
    }
  }, true);

  // "Attach" button in the panel.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "quickfiles:attach") return;
    const input = document.querySelector("input[type=file]");
    if (!input) return; // another frame may have one
    setInput(input, toFile(msg));
    sendResponse({ ok: true });
  });
})();
