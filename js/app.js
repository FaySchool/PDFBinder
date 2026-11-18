(() => {
  const $ = id => document.getElementById(id);
  const drop = $("drop"), input = $("file-input"), list = $("list"), empty = $("empty");
  const totals = $("totals"), clearBtn = $("clear"), mergeBtn = $("merge"), statusEl = $("status"), outName = $("out-name");

  /** @type {{id:number,name:string,size:number,bytes:ArrayBuffer,pages:number|null,error:string|null}[]} */
  let files = [];
  let nextId = 1, busy = false, dragId = null;

  // In a Claude artifact, saving goes through the downloads capability; as a plain static page, a normal download link works.
  const downloadsReady = window.claude && window.claude.use
    ? window.claude.use("downloads").catch(() => null)
    : Promise.resolve(null);
  const inArtifact = !!(window.claude && window.claude.use);

  const fmtSize = n => n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(0) + " KB" : (n / 1048576).toFixed(1) + " MB";
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");
  const setStatus = (msg, kind) => { statusEl.textContent = msg; statusEl.className = "status" + (kind ? " " + kind : ""); };

  async function addFiles(fileList) {
    const picked = [...fileList].filter(f => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    const skipped = fileList.length - picked.length;
    if (skipped) setStatus(plural(skipped, "file") + " skipped because " + (skipped === 1 ? "it is" : "they are") + " not a PDF.", "err");
    else setStatus("");
    for (const f of picked) {
      const entry = { id: nextId++, name: f.name, size: f.size, bytes: null, pages: null, error: null };
      files.push(entry);
      render();
      try {
        entry.bytes = await f.arrayBuffer();
        const doc = await PDFLib.PDFDocument.load(entry.bytes, { updateMetadata: false });
        entry.pages = doc.getPageCount();
      } catch (e) {
        entry.error = /encrypt/i.test(String(e && e.message))
          ? "Password-protected. Remove the password first, then add it again."
          : "Could not read this file. It may be damaged or not a real PDF.";
      }
      render();
    }
  }

  function move(id, delta) {
    const i = files.findIndex(f => f.id === id), j = i + delta;
    if (i < 0 || j < 0 || j >= files.length) return;
    [files[i], files[j]] = [files[j], files[i]];
    render();
    const btn = list.querySelector(`[data-id="${id}"] .${delta < 0 ? "up" : "down"}`);
    if (btn && !btn.disabled) btn.focus();
  }

  function iconBtn(cls, label, glyph, disabled, onClick) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "icon " + cls; b.textContent = glyph;
    b.setAttribute("aria-label", label); b.title = label; b.disabled = disabled;
    b.addEventListener("click", onClick);
    return b;
  }

  function render() {
    list.textContent = "";
    files.forEach((f, i) => {
      const li = document.createElement("li");
      li.className = "file" + (f.error ? " bad" : "");
      li.dataset.id = f.id;
      li.draggable = true;

      const pos = document.createElement("span");
      pos.className = "pos"; pos.textContent = i + 1; pos.title = "Drag to reorder";

      const meta = document.createElement("div"); meta.className = "meta";
      const name = document.createElement("div"); name.className = "name"; name.textContent = f.name;
      const sub = document.createElement("div"); sub.className = "sub";
      sub.textContent = f.error ? f.error
        : f.pages == null ? "Reading… · " + fmtSize(f.size)
        : plural(f.pages, "page") + " · " + fmtSize(f.size);
      meta.append(name, sub);

      const acts = document.createElement("div"); acts.className = "acts";
      acts.append(
        iconBtn("up", "Move " + f.name + " up", "↑", i === 0, () => move(f.id, -1)),
        iconBtn("down", "Move " + f.name + " down", "↓", i === files.length - 1, () => move(f.id, 1)),
        iconBtn("rm", "Remove " + f.name, "✕", false, () => { files = files.filter(x => x.id !== f.id); render(); })
      );
      li.append(pos, meta, acts);

      li.addEventListener("dragstart", e => {
        dragId = f.id; li.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(f.id));
      });
      li.addEventListener("dragend", () => { dragId = null; render(); });
      li.addEventListener("dragover", e => {
        if (dragId == null || dragId === f.id) return;
        e.preventDefault(); li.classList.add("target");
      });
      li.addEventListener("dragleave", () => li.classList.remove("target"));
      li.addEventListener("drop", e => {
        if (dragId == null) return;
        e.preventDefault(); e.stopPropagation();
        const from = files.findIndex(x => x.id === dragId), to = files.findIndex(x => x.id === f.id);
        if (from < 0 || to < 0) return;
        const [m] = files.splice(from, 1); files.splice(to, 0, m);
        dragId = null; render();
      });
      list.append(li);
    });

    const good = files.filter(f => f.pages != null);
    const pending = files.some(f => f.pages == null && !f.error);
    empty.hidden = files.length > 0;
    clearBtn.hidden = files.length === 0;
    totals.textContent = good.length
      ? plural(good.length, "file") + " · " + plural(good.reduce((s, f) => s + f.pages, 0), "page")
      : "";
    mergeBtn.disabled = busy || pending || good.length < 2;
  }

  function outputName() {
    let n = outName.value.trim().replace(/[\\/:*?"<>|]+/g, "-") || "merged";
    if (!/\.pdf$/i.test(n)) n += ".pdf";
    return n;
  }

  async function merge() {
    const good = files.filter(f => f.pages != null);
    if (good.length < 2 || busy) return;
    busy = true; render();
    try {
      const out = await PDFLib.PDFDocument.create();
      for (let i = 0; i < good.length; i++) {
        setStatus("Merging file " + (i + 1) + " of " + good.length + "…");
        const src = await PDFLib.PDFDocument.load(good[i].bytes);
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach(p => out.addPage(p));
        await new Promise(r => setTimeout(r));
      }
      const bytes = await out.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const filename = outputName();
      const summary = filename + " — " + plural(out.getPageCount(), "page") + ", " + fmtSize(blob.size);

      const downloads = await downloadsReady;
      if (downloads) {
        setStatus("Confirm the save to finish.");
        await downloads.save({ filename, data: blob });
        setStatus("Saved " + summary + ".", "ok");
      } else if (inArtifact) {
        setStatus("Merged, but saving files is not available in this view. Open the page in claude.ai and try again.", "err");
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = filename;
        document.body.append(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 60000);
        setStatus("Saved " + summary + ".", "ok");
      }
    } catch (e) {
      const code = e && e.code;
      if (code === "declined") setStatus("Save cancelled. Your files are still here, so you can try again.");
      else if (code === "rate_limited") setStatus("A save prompt is already open. Answer it, or wait a moment and try again.", "err");
      else if (code) setStatus("Saving is not available in this view right now.", "err");
      else setStatus("Merge failed: " + (e && e.message ? e.message : "one of the files could not be processed") + ".", "err");
    } finally {
      busy = false; render();
    }
  }

  $("pick").addEventListener("click", () => input.click());
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
  clearBtn.addEventListener("click", () => { files = []; setStatus(""); render(); });
  mergeBtn.addEventListener("click", merge);

  const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  ["dragenter", "dragover"].forEach(t => document.addEventListener(t, e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); drop.classList.add("over");
  }));
  document.addEventListener("dragleave", e => { if (!e.relatedTarget) drop.classList.remove("over"); });
  document.addEventListener("drop", e => {
    if (!hasFiles(e)) return;
    e.preventDefault(); drop.classList.remove("over");
    addFiles(e.dataTransfer.files);
  });

  if (!window.PDFLib) setStatus("The PDF library did not load. Reload the page and try again.", "err");
  render();
})();
