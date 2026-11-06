/* ============================================================
   Portfolio editor. Sign in at /login (or #login), then edit right on the page:
   click any text to type, hover images for "Change media", drag cards to reorder,
   use the gear for hidden settings, and the blue line to add case-study sections.
   Changes save automatically to:
     - this page's own database (when published as a Claude artifact; only the owner/editors can save)
     - Supabase (when backend.supabaseUrl is set in content.js; Google sign-in, allow-listed emails)
     - this browser only (no backend set up), with "Export" to download a new content.js
   ============================================================ */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clone = o => JSON.parse(JSON.stringify(o));
  const DEFAULTS = clone(window.SITE_DEFAULTS || window.SITE);
  const CACHE = "pf-cache-v1", EDIT = "pf-editor";
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } }, del: k => { try { localStorage.removeItem(k); } catch {} } };
  const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  const merge = (base, over) => { const o = clone(base); for (const k in over) o[k] = over[k]; return o; };
  const LOGIN_PATH = /\/login\/?$/;
  const BASE = () => location.origin + location.pathname.replace(LOGIN_PATH, "/").replace(/[^/]*$/, "");

  /* ---------- storage adapters ---------- */
  async function artifactStore() {
    const [db, user] = await Promise.all([window.claude.use("db"), window.claude.use("user")]);
    if (!db) return { kind: "artifact-off" };
    const assets = await window.claude.use("assets");
    const ref = db.doc("site/content");
    return {
      kind: "artifact",
      signInLabel: "Continue with your Claude account",
      async load() { const s = await withTimeout(ref.get(), 10000); return s.exists ? (s.data() || {}).site || null : null; },
      async canEdit() { return !!(user && (user.isOwner() || user.canEdit())); },
      async who() { return "your account"; },
      async save(site) { await ref.set({ site, updatedAt: new Date().toISOString() }); },
      async upload(file) { if (!assets) throw new Error("Uploads aren't available here"); const r = await assets.upload(file); return r.url; },
      async signIn() { return this.canEdit(); },
      async signOut() {}
    };
  }
  async function supabaseStore(B) {
    const mod = await import(new URL("vendor/supabase.js", document.baseURI).href);
    const sb = mod.createClient(B.supabaseUrl, B.supabaseAnonKey, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true } });
    const table = B.table || "site_content", bucket = B.bucket || "media";
    const allow = (B.editors || []).map(e => String(e).toLowerCase());
    const session = async () => (await sb.auth.getSession()).data.session;
    return {
      kind: "supabase", canExport: true,
      signInLabel: "Continue with Google",
      async load() { const { data, error } = await sb.from(table).select("data").eq("id", "main").maybeSingle(); if (error) throw error; return data ? data.data : null; },
      async canEdit() { const s = await session(); const em = s && s.user && (s.user.email || "").toLowerCase(); return !!em && (!allow.length || allow.includes(em)); },
      async who() { const s = await session(); return s && s.user && s.user.email; },
      async save(site) { const { error } = await sb.from(table).upsert({ id: "main", data: site, updated_at: new Date().toISOString() }); if (error) throw error; },
      async upload(file) {
        const path = `${Date.now()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
        const { error } = await sb.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
        return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
      },
      async signIn() {
        ls.set("pf-login-pending", "1");
        await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: BASE() } });
        return "redirect";
      },
      async signOut() { await sb.auth.signOut(); }
    };
  }
  function localStore() {
    return {
      kind: "local", canExport: true,
      signInLabel: "Edit on this computer",
      async load() { const v = ls.get("pf-site"); return v ? JSON.parse(v) : null; },
      async canEdit() { return true; },
      async who() { return "this browser"; },
      async save(site) { if (!ls.set("pf-site", JSON.stringify(site))) throw new Error("Browser storage is full. Use smaller images, or set up Supabase."); },
      async upload(file) {
        if (file.size > 2.5e6) throw new Error("Over 2.5 MB. Without a backend, images are kept in this browser, so use a smaller file or a link.");
        return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
      },
      async signIn() { return true; },
      async signOut() {}
    };
  }

  /* ---------- boot ---------- */
  let store = null, booted = false;
  const editorStore = () => store;
  const ready = new Promise(r => window.APP ? r() : document.addEventListener("app:ready", r, { once: true }));

  async function boot() {
    await ready;
    const B = (window.SITE && window.SITE.backend) || {};
    try {
      if (window.claude && window.claude.use) store = await artifactStore();
      else if (B.supabaseUrl && B.supabaseAnonKey) store = await supabaseStore(B);
      else store = localStore();
    } catch (e) { console.warn("[editor] backend unavailable", e); store = localStore(); }
    if (store.kind === "artifact-off") store = null;
    booted = true; route();
    if (store) {
      try {
        const saved = await withTimeout(store.load(), 9000);
        if (saved) {
          const next = merge(DEFAULTS, saved);
          next.backend = DEFAULTS.backend;
          ls.set(CACHE, JSON.stringify(saved));
          if (JSON.stringify(next) !== JSON.stringify(window.APP.site)) window.APP.refresh(next);
        }
      } catch (e) { console.warn("[editor] could not load saved content", e); }
    }
    if (/[?&]code=/.test(location.search) && history.replaceState) history.replaceState(null, "", location.pathname + location.hash);
    if (store && ls.get("pf-login-pending")) {
      ls.del("pf-login-pending");
      if (await store.canEdit()) { ls.set(EDIT, "1"); leaveLogin(); }
      else { const who = await store.who(); toast(`${who || "This account"} isn't allowed to edit this site.`); try { await store.signOut(); } catch {} }
    }
    if (store && ls.get(EDIT) === "1" && await store.canEdit()) startEditing();
    route();
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("popstate", route);
  const isLogin = () => location.hash === "#login" || LOGIN_PATH.test(location.pathname);
  function route() { if (isLogin()) showLogin(); else hideLogin(); }
  function leaveLogin() {
    if (LOGIN_PATH.test(location.pathname) && history.replaceState) { history.replaceState(null, "", location.pathname.replace(LOGIN_PATH, "/") + "#work"); route(); window.dispatchEvent(new HashChangeEvent("hashchange")); }
    else location.hash = "work";
  }

  /* ---------- login page ---------- */
  function showLogin() {
    if ($(".ed-login")) return;
    if (!booted) return;
    const el = document.createElement("div");
    el.className = "ed-login";
    const g = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7Z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"/></svg>';
    const person = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
    const label = store ? store.signInLabel : "Sign-in isn't available here";
    el.innerHTML = `<div class="ed-login-card">
      <h1>Editor sign-in</h1><p>Only allow-listed accounts can edit this portfolio.</p>
      <button class="ed-login-btn ptr" ${store ? "" : "disabled"}>${store && store.kind === "supabase" ? g : person}<span>${label}</span></button>
      <p class="ed-login-err" hidden></p>
      ${store && store.kind === "local" ? `<p class="ed-login-note">No login is set up yet, so edits are saved in this browser only. Add your Supabase keys in content.js to sign in with Google.</p>` : ""}
      ${!store && window.claude ? `<p class="ed-login-note">Sign in to Claude to edit this page.</p>` : ""}
      <a class="ed-login-back" href="${LOGIN_PATH.test(location.pathname) ? "./" : ""}#work">← Back to site</a></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add("locked");
    const btn = $(".ed-login-btn", el), err = $(".ed-login-err", el);
    btn.addEventListener("click", async () => {
      btn.disabled = true; $("span", btn).textContent = store.kind === "supabase" ? "Redirecting…" : "Checking…"; err.hidden = true;
      try {
        const ok = await store.signIn();
        if (ok === "redirect") return;
        if (!ok) throw new Error("This account isn't allowed to edit this portfolio.");
        ls.set(EDIT, "1"); startEditing(); leaveLogin();
      } catch (e) {
        err.textContent = e.message || String(e); err.hidden = false;
        btn.disabled = false; $("span", btn).textContent = store.signInLabel;
      }
    });
  }
  function hideLogin() { const el = $(".ed-login"); if (el) { el.remove(); if (!$(".pm")) document.documentElement.classList.remove("locked"); } }

  /* ================================================================
     ON-PAGE EDITOR
     ================================================================ */
  const SVG = (d, vb = 20) => `<svg viewBox="0 0 ${vb} ${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const IC = {
    eye: SVG('<path d="M1.7 10S4.6 4.5 10 4.5 18.3 10 18.3 10 15.4 15.5 10 15.5 1.7 10 1.7 10Z"/><circle cx="10" cy="10" r="2.6"/>'),
    eyeOff: SVG('<path d="M3 3l14 14M8.2 4.7A8.6 8.6 0 0 1 10 4.5c5.4 0 8.3 5.5 8.3 5.5a14 14 0 0 1-2.6 3.3M5.6 6.4C3 8 1.7 10 1.7 10S4.6 15.5 10 15.5c1.3 0 2.5-.3 3.5-.8M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6"/>'),
    pen: SVG('<path d="M13.6 3.6a2 2 0 0 1 2.8 2.8L7 15.8l-3.5.7.7-3.5 9.4-9.4Z"/>'),
    undo: SVG('<path d="M7.5 5 4 8.5 7.5 12"/><path d="M4 8.5h8a4 4 0 0 1 0 8h-2"/>'),
    out: SVG('<path d="M12 4h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-3M8.5 13.5 5 10l3.5-3.5M5 10h9"/>'),
    grip: '<svg viewBox="0 0 20 20" fill="currentColor"><circle cx="7.5" cy="5" r="1.4"/><circle cx="12.5" cy="5" r="1.4"/><circle cx="7.5" cy="10" r="1.4"/><circle cx="12.5" cy="10" r="1.4"/><circle cx="7.5" cy="15" r="1.4"/><circle cx="12.5" cy="15" r="1.4"/></svg>',
    gear: SVG('<circle cx="10" cy="10" r="2.6"/><path d="M10 1.8v2M10 16.2v2M3.9 3.9l1.4 1.4M14.7 14.7l1.4 1.4M1.8 10h2M16.2 10h2M3.9 16.1l1.4-1.4M14.7 5.3l1.4-1.4"/>'),
    trash: SVG('<path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 11a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-11"/>'),
    up: SVG('<path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9"/>'),
    down: SVG('<path d="M10 4.5v11M5.5 11 10 15.5 14.5 11"/>'),
    copy: SVG('<rect x="7" y="7" width="9.5" height="9.5" rx="2"/><path d="M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 4v6.5A1.5 1.5 0 0 0 5 12h.5"/>'),
    plus: SVG('<path d="M10 4v12M4 10h12"/>'),
    x: SVG('<path d="M5 5l10 10M15 5 5 15"/>'),
    media: SVG('<rect x="2.5" y="4" width="15" height="12" rx="2.5"/><circle cx="7" cy="8.2" r="1.4"/><path d="m3 14 4-3.5 3 2.5 3-3 4.5 4"/>'),
    upload: SVG('<path d="M10 13V3.5M6 7.5l4-4 4 4M3.5 13v2a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2"/>'),
    link: SVG('<path d="M8.5 11.5a3.5 3.5 0 0 0 5 0l2.5-2.5a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M11.5 8.5a3.5 3.5 0 0 0-5 0L4 11a3.5 3.5 0 0 0 5 5l1-1"/>'),
    video: SVG('<rect x="2.5" y="5" width="11" height="10" rx="2"/><path d="m13.5 9 4-2.5v7l-4-2.5"/>'),
    play: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M6.5 4.5v11l9-5.5-9-5.5Z"/></svg>',
    check: SVG('<path d="m4.5 10.5 3.5 3.5 7.5-8"/>')
  };
  const YEAR = String(new Date().getFullYear());
  const hue = () => Math.floor(Math.random() * 360);
  const slugify = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const uniqueSlug = (base, list, self) => { let s = slugify(base), n = 2; while (list.some(p => p !== self && p.slug === s)) s = slugify(base) + "-" + n++; return s; };
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const escA = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- data paths ---------- */
  const site = () => window.APP.site;
  const keys = p => String(p).split(".").filter(k => k !== "");
  const get = (o, p) => keys(p).reduce((a, k) => a == null ? a : a[k], o);
  const set = (o, p, v) => { const ks = keys(p); let t = o; ks.slice(0, -1).forEach((k, i) => { if (t[k] == null || typeof t[k] !== "object") t[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; t = t[k]; }); t[ks[ks.length - 1]] = v; };
  const parentOf = p => { const ks = keys(p); return { arr: ks.slice(0, -1).join("."), i: +ks[ks.length - 1] }; };
  const mParse = mp => { const [path, key = "image"] = String(mp).split("|"); return { path, key, vkey: key === "image" ? "video" : key + "Video", pkey: key === "image" ? "poster" : key + "Poster", small: key === "logo" }; };

  /* ---------- state, undo, saving ---------- */
  let editing = false, preview = false, lastFailed = null;
  const live = () => editing && !preview;
  const undoStack = [], redoStack = [];
  const snap = () => { const s = clone(site()); delete s.backend; return JSON.stringify(s); };
  function pushUndo(before) { undoStack.push(before || snap()); if (undoStack.length > 80) undoStack.shift(); redoStack.length = 0; updUndo(); }
  function updUndo() { const b = $(".ed-undo"); if (b) b.disabled = !undoStack.length; }
  function restore(json) {
    closePop(); endText(true);
    const next = JSON.parse(json); next.backend = DEFAULTS.backend;
    const open = window.APP.project();
    window.APP.refresh(next);
    if (open && !next.projects.some(p => p.slug === open) && location.hash.startsWith("#p-")) location.hash = window.APP.route();
    persist();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(snap()); restore(undoStack.pop()); updUndo(); toast("Undone"); }
  function redo() { if (!redoStack.length) return; undoStack.push(snap()); restore(redoStack.pop()); updUndo(); }
  // one-shot change: snapshot, edit, re-render, save
  function change(fn, opts = {}) {
    const before = snap();
    fn(site());
    if (snap() === before) return;
    pushUndo(before);
    if (opts.render !== false) window.APP.refresh(null, opts.refresh);
    persist();
  }
  // popover sessions: many small live edits become one undo step
  let sess = null;
  function sessionStart() { if (!sess) sess = snap(); }
  function sessionEnd() { if (sess && sess !== snap()) pushUndo(sess); sess = null; }
  function liveChange(fn, opts = {}) { sessionStart(); fn(site()); if (opts.render !== false) window.APP.refresh(null, opts.refresh); persist(); }

  let saveT = 0, saving = false, again = false;
  function persist() { setStatus("saving"); clearTimeout(saveT); saveT = setTimeout(flush, 650); }
  async function flush() {
    clearTimeout(saveT);
    if (saving) { again = true; return; }
    saving = true;
    const keep = clone(site()); delete keep.backend;
    ls.set(CACHE, JSON.stringify(keep));
    try { await editorStore().save(keep); lastFailed = null; if (!again) setStatus("saved"); }
    catch (e) { console.error(e); lastFailed = true; setStatus("error"); toast("Couldn't save: " + (e.message || e)); }
    saving = false;
    if (again) { again = false; flush(); }
  }
  let statusNow = "saved";
  function setStatus(s) {
    statusNow = s;
    const el = $(".ed-status"); if (!el) return;
    el.dataset.s = s;
    el.textContent = { saved: "Saved", saving: "Saving…", error: "Not saved · retry" }[s];
  }
  window.addEventListener("beforeunload", e => { if (editing && (statusNow === "saving" || statusNow === "error")) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- toast ---------- */
  let toastEl = null, toastT = 0;
  function toast(msg, undoable) {
    if (toastEl) toastEl.remove();
    const t = toastEl = H(`<div class="ed-toast ed-ui" role="status"><span></span>${undoable ? `<button type="button">Undo</button>` : ""}</div>`);
    $("span", t).textContent = msg;
    if (undoable) $("button", t).onclick = () => { undo(); hideToast(); };
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    clearTimeout(toastT); toastT = setTimeout(hideToast, undoable ? 5000 : 3200);
  }
  function hideToast() { const t = toastEl; if (!t) return; toastEl = null; t.classList.remove("show"); setTimeout(() => t.remove(), 250); }

  /* ---------- start / stop ---------- */
  let mo = null, decoT = 0, bar = null, itb = null, rail = null, tt = null;
  function startEditing() {
    if (editing) return;
    editing = true; preview = false;
    window.__pfEdit = true;
    document.body.classList.add("ed-on", "ed-live");
    bar = H(`<div class="ed-bar ed-ui" role="toolbar" aria-label="Editor">
      <button class="ed-b ed-prev" type="button">${IC.eye}<span>Preview</span></button>
      <span class="ed-status" data-s="saved">Saved</span>
      <button class="ed-b ed-undo" type="button" disabled data-tip="Undo (⌘Z)">${IC.undo}<span>Undo</span></button>
      ${editorStore().kind === "local" ? `<button class="ed-b ed-export" type="button" data-tip="Download content.js with your edits">Export</button>` : ""}
      <span class="ed-sep"></span>
      <button class="ed-b ed-out" type="button">${IC.out}<span>Sign out</span></button></div>`);
    document.body.appendChild(bar);
    $(".ed-prev", bar).onclick = togglePreview;
    $(".ed-undo", bar).onclick = undo;
    $(".ed-out", bar).onclick = signOut;
    $(".ed-status", bar).onclick = () => { if (statusNow === "error") flush(); };
    const ex = $(".ed-export", bar); if (ex) ex.onclick = exportContent;
    itb = H(`<div class="ed-itb ed-ui"></div>`); rail = H(`<div class="ed-rail ed-ui"></div>`); tt = H(`<div class="ed-tt ed-ui"></div>`);
    document.body.append(itb, rail, tt);
    window.APP.refresh();
    decorate();
    mo = new MutationObserver(() => { clearTimeout(decoT); decoT = setTimeout(decorate, 30); });
    mo.observe(document.body, { childList: true, subtree: true });
    updUndo();
  }
  function stopEditing() {
    endText(true); closePop();
    editing = false; preview = false; window.__pfEdit = false;
    document.body.classList.remove("ed-on", "ed-live", "ed-preview");
    if (mo) mo.disconnect();
    [bar, itb, rail, tt].forEach(x => x && x.remove());
    $$(".ed-add, .ed-addline, .ed-pmgear").forEach(x => x.remove());
    window.APP.refresh();
  }
  function togglePreview() {
    endText(); closePop(); hideHover();
    preview = !preview;
    window.__pfEdit = !preview;
    document.body.classList.toggle("ed-preview", preview);
    document.body.classList.toggle("ed-live", !preview);
    $(".ed-prev", bar).innerHTML = preview ? `${IC.pen}<span>Edit</span>` : `${IC.eye}<span>Preview</span>`;
    window.APP.refresh();
  }
  async function signOut() {
    endText(); closePop();
    if (statusNow === "saving") await flush();
    try { await editorStore().signOut(); } catch {}
    ls.del(EDIT); stopEditing();
    toast("Signed out. Your changes are live.");
  }
  function exportContent() {
    const s = clone(site());
    const body = "/* Exported from the editor " + new Date().toLocaleString() + " */\nwindow.SITE = " + JSON.stringify(s, null, 2) + ";\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/javascript" }));
    a.download = "content.js"; document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- decorate the page after every render ---------- */
  const ADD = [
    [/^projects$/, "Add project", "card"],
    [/^artworks$/, "Add artwork", ""],
    [/^experience$/, "Add experience", ""],
    [/^(communities|archive)$/, "Add community", ""],
    [/\.photos$/, "Add photo", "sm after"],
    [/^quotes$/, "Add quote", ""],
    [/^lore$/, "Add lore", ""],
    [/^shelves$/, "Add shelf row", ""],
    [/\.items$/, "Add", ""],
    [/^socials$/, "", "sm"],
    [/^hi\.meta$/, "Add detail", "sm"],
    [/\.facts$/, "Add", "sm"],
    [/\.people$/, "Add person", "sm"],
    [/\.images$/, "Add photo", "sm after"],
    [/\.more$/, "Add image", ""]
  ];
  function decorate() {
    if (!editing) return;
    if (preview) return;
    // dashed "Add" tiles at the end of every list
    $$("[data-lc]").forEach(c => {
      const path = c.dataset.lc, cfg = ADD.find(([re]) => re.test(path));
      if (!cfg) return;
      const after = cfg[2].includes("after");
      const has = after ? (c.nextElementSibling && c.nextElementSibling.classList.contains("ed-add") && c.nextElementSibling.dataset.for === path) : $(":scope > .ed-add", c);
      if (has) { if (!after && c.lastElementChild !== has) c.appendChild(has); return; }
      const t = H(`<button type="button" class="ed-add ed-ui ${cfg[2]}" data-for="${escA(path)}" aria-label="${cfg[1] || "Add"}">${IC.plus}${cfg[1] ? `<span>${cfg[1]}</span>` : ""}</button>`);
      t.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); addItem(path, c); });
      if (after) c.after(t); else c.appendChild(t);
    });
    // hidden items look faded
    $$("[data-li]").forEach(el => { const it = get(site(), el.dataset.li + "." + el.dataset.ix); el.classList.toggle("ed-hid", !!(it && typeof it === "object" && !Array.isArray(it) && it.hidden)); });
    // links shouldn't drag while selecting text
    $$("#view a:not([draggable]), #header a:not([draggable]), #footer a:not([draggable]), .pm a:not([draggable]), #view img:not([draggable]), .pm img:not([draggable])").forEach(a => a.setAttribute("draggable", "false"));
    // case-study "Add section" lines
    $$(".pm-body[data-pb]").forEach(body => {
      const P = body.dataset.pb, p = get(site(), P);
      if (!p || p.type !== "case") return;
      const anchors = [$(":scope > [data-cshead]", body), ...$$(":scope > [data-b]", body)].filter(Boolean);
      anchors.forEach((a, k) => {
        const nx = a.nextElementSibling;
        if (nx && nx.classList.contains("ed-addline")) { nx.dataset.at = k; nx.classList.toggle("empty", !(p.blocks || []).length); return; }
        const ln = H(`<div class="ed-addline ed-ui" data-at="${k}" role="button" aria-label="Add section"><i></i><span>${IC.plus}Add section</span><i></i></div>`);
        ln.addEventListener("click", e => { e.stopPropagation(); openSectionMenu(ln, P, +ln.dataset.at); });
        a.after(ln);
      });
    });
    // gear in an open project window
    const pmEl = window.APP.el && window.APP.el();
    if (pmEl && !$(".ed-pmgear", pmEl)) {
      const tl = $(".pm-tl", pmEl);
      if (tl) {
        tl.style.display = "flex"; tl.style.gap = "8px";
        const g = H(`<button class="pm-exp ptr ed-pmgear ed-ui" type="button" aria-label="Project settings" data-tip="Project settings">${IC.gear}</button>`);
        g.addEventListener("click", e => { e.stopPropagation(); const s = window.APP.project(); const i = site().projects.findIndex(p => p.slug === s); if (i >= 0) openSettings(g, "project", "projects." + i); });
        tl.appendChild(g);
      }
    }
  }

  /* ---------- hover toolbars ---------- */
  let hov = { li: null, media: null, g: null, block: null }, hideT = 0;
  const inUI = el => el && el.closest && el.closest(".ed-ui");
  function onMove(e) {
    if (!live() || dragging) return;
    const t = e.target;
    if (inUI(t)) { clearTimeout(hideT); return; }
    if (!t.closest) return;
    let media = t.closest("[data-m]:not([data-msmall])");
    let li = t.closest("[data-li]:not([data-g=block])");
    const block = t.closest("[data-g=block]");
    if (li && media && !li.contains(media)) li = null;
    if (li && media && media.closest("[data-li]") !== li) media = null;
    if (li && !media && li.matches(".card, .art-item, .s-it, .sp-media, .gi")) media = $$("[data-m]:not([data-msmall])", li).find(m => m.closest("[data-li]") === li) || null;
    const g = !li && !media ? t.closest("[data-g]:not([data-li])") : null;
    const next = { li, media, g, block };
    if (next.li !== hov.li || next.media !== hov.media || next.g !== hov.g) { hov.li = next.li; hov.media = next.media; hov.g = next.g; drawItb(); }
    if (next.block !== hov.block) { hov.block = next.block; drawRail(); }
    clearTimeout(hideT);
    if (!next.li && !next.media && !next.g && !next.block) hideT = setTimeout(hideHover, 180);
  }
  function hideHover() { hov = { li: null, media: null, g: null, block: null }; if (itb) itb.classList.remove("v"); if (rail) rail.classList.remove("v"); }
  const SETTINGS_KINDS = new Set(["project", "artwork", "community", "photo", "social", "lore", "meta", "person", "shelf", "clock", "artsec", "stack", "block"]);
  function gearKind(el) { const g = el && el.dataset.g; if (!g) return null; const [kind, path] = g.split(/:(.+)/); return SETTINGS_KINDS.has(kind) ? { kind, path: path || (el.dataset.li ? el.dataset.li + "." + el.dataset.ix : "") } : null; }
  function drawItb() {
    const { li, media, g } = hov;
    if (!li && !media && !g) { itb.classList.remove("v"); return; }
    let html = "";
    if (media) html += `<button class="ed-pill ed-chg" type="button">${IC.media}Change media</button>`;
    if (li) {
      const it = get(site(), li.dataset.li + "." + li.dataset.ix);
      const obj = it && typeof it === "object" && !Array.isArray(it);
      if (media) html += `<span class="ed-sep"></span>`;
      html += `<button class="ed-ic grip" type="button" aria-label="Drag to reorder" data-tip="Drag to reorder">${IC.grip}</button>`;
      if (gearKind(li) && hasSettings(gearKind(li).kind, li)) html += `<button class="ed-ic ed-gear" type="button" aria-label="Settings" data-tip="Settings">${IC.gear}</button>`;
      if (obj) html += `<button class="ed-ic ed-hide" type="button" aria-label="${it.hidden ? "Show" : "Hide"}" data-tip="${it.hidden ? "Hidden from visitors · show" : "Hide from visitors"}">${it.hidden ? IC.eyeOff : IC.eye}</button>`;
      html += `<button class="ed-ic danger ed-del" type="button" aria-label="Delete" data-tip="Delete">${IC.trash}</button>`;
    } else if (g && gearKind(g)) {
      html += `<button class="ed-ic ed-gear" type="button" aria-label="Settings" data-tip="Settings">${IC.gear}</button>`;
    }
    if (!html) { itb.classList.remove("v"); return; }
    itb.innerHTML = html;
    const chg = $(".ed-chg", itb); if (chg) chg.onclick = () => openMedia(chg, media.dataset.m, media);
    const gear = $(".ed-gear", itb); if (gear) gear.onclick = () => { const k = gearKind(li || g); openSettings(gear, k.kind, k.path, li || g); };
    const hide = $(".ed-hide", itb); if (hide) hide.onclick = () => { const p = li.dataset.li + "." + li.dataset.ix; change(s => { const it = get(s, p); it.hidden = !it.hidden; }); toast(get(site(), p).hidden ? "Hidden from visitors" : "Visible again"); hideHover(); };
    const del = $(".ed-del", itb); if (del) del.onclick = () => removeItem(li);
    const grip = $(".grip", itb); if (grip) grip.addEventListener("pointerdown", e => startDrag(e, li));
    placeItb();
    itb.classList.add("v");
  }
  function placeItb() {
    const { li, media, g } = hov;
    const a = media || li || g; if (!a || !a.isConnected) return hideHover();
    const r = a.getBoundingClientRect(), w = itb.offsetWidth, h = itb.offsetHeight;
    let x = r.right - w - 8, y = r.top + 8;
    if (!media && (r.height < 90 || r.width < 140)) { x = r.right - w; y = r.top - h - 6; if (y < 4) y = r.bottom + 6; }
    if (media && (r.width < w + 16)) { x = r.left + r.width / 2 - w / 2; }
    itb.style.left = Math.max(6, Math.min(innerWidth - w - 6, x)) + "px";
    itb.style.top = Math.max(6, Math.min(innerHeight - h - 6, y)) + "px";
  }
  function drawRail() {
    const b = hov.block;
    if (!b) { rail.classList.remove("v"); return; }
    const blk = get(site(), b.dataset.b);
    const gear = blk && hasSettings("block", b);
    rail.innerHTML = `<button class="ed-ic grip" type="button" aria-label="Drag to move" data-tip="Drag to move">${IC.grip}</button>
      <button class="ed-ic ed-up" type="button" aria-label="Move up" data-tip="Move up" ${+b.dataset.ix === 0 ? "disabled style=opacity:.35" : ""}>${IC.up}</button>
      <button class="ed-ic ed-dup" type="button" aria-label="Duplicate" data-tip="Duplicate">${IC.copy}</button>
      ${gear ? `<button class="ed-ic ed-gear" type="button" aria-label="Section settings" data-tip="Section settings">${IC.gear}</button>` : ""}
      <button class="ed-ic danger ed-del" type="button" aria-label="Delete section" data-tip="Delete section">${IC.trash}</button>`;
    $(".grip", rail).addEventListener("pointerdown", e => startDrag(e, b));
    $(".ed-up", rail).onclick = () => { const i = +b.dataset.ix; if (!i) return; moveTo(b.dataset.li, i, i - 1); };
    $(".ed-dup", rail).onclick = () => { const i = +b.dataset.ix; change(s => { const a = get(s, b.dataset.li); a.splice(i + 1, 0, clone(a[i])); }); flashNew(b.dataset.li, i + 1); };
    const g = $(".ed-gear", rail); if (g) g.onclick = () => openSettings(g, "block", b.dataset.b, b);
    $(".ed-del", rail).onclick = () => removeItem(b, true);
    placeRail();
    rail.classList.add("v");
  }
  function placeRail() {
    const b = hov.block; if (!b || !b.isConnected) return;
    const inner = b.firstElementChild ? b.firstElementChild.firstElementChild || b : b;
    const r = inner.getBoundingClientRect(), w = rail.offsetWidth, h = rail.offsetHeight;
    const card = b.closest(".pm-card"), cr = card ? card.getBoundingClientRect() : { left: 0, top: 0, bottom: innerHeight };
    let x = r.left - w - 10; if (x < cr.left + 6) x = r.left + 6;
    let y = Math.max(r.top + 8, cr.top + 8); y = Math.min(y, r.bottom - h, cr.bottom - h - 8);
    rail.style.left = x + "px"; rail.style.top = Math.max(cr.top + 6, y) + "px";
  }
  const reposition = () => { if (!live()) return; if (itb && itb.classList.contains("v")) placeItb(); if (rail && rail.classList.contains("v")) placeRail(); if (tt && tt.classList.contains("v")) placeTT(); if (pop) placePop(); };
  document.addEventListener("scroll", () => requestAnimationFrame(reposition), { capture: true, passive: true });
  window.addEventListener("resize", reposition);
  document.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerdown", e => { if (e.pointerType && e.pointerType !== "mouse") onMove(e); }, { passive: true });
  document.addEventListener("app:render", () => { hideHover(); });

  /* ---------- list operations ---------- */
  function moveTo(path, from, to) {
    change(s => { const a = get(s, path); const [x] = a.splice(from, 1); a.splice(to, 0, x); });
    flashNew(path, to, true);
  }
  function itemEl(path, i) { return $$(`[data-li="${CSS.escape(path)}"]`).find(el => +el.dataset.ix === i); }
  function flashNew(path, i, quiet) {
    requestAnimationFrame(() => {
      const el = itemEl(path, i); if (!el) return;
      if (!quiet) { el.classList.remove("ed-new"); el.offsetWidth; el.classList.add("ed-new"); setTimeout(() => el.classList.remove("ed-new"), 600); }
      const sc = el.closest(".pm-scroll"), r = el.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight - 80) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    });
  }
  async function removeItem(el, isBlock) {
    hideHover();
    const path = el.dataset.li, i = +el.dataset.ix;
    const it = get(site(), path + "." + i);
    const name = isBlock ? "Section" : (it && (it.title || it.name || it.org)) ? `“${String(it.title || it.name || it.org).slice(0, 30)}”` : "Item";
    if (!reduced()) {
      if (isBlock) { const h = el.offsetHeight; el.style.height = h + "px"; el.offsetHeight; el.classList.add("ed-shrink"); el.style.height = "0px"; el.style.marginTop = el.style.marginBottom = "0px"; await wait(260); }
      else { el.classList.add("ed-leave"); await wait(210); }
    }
    change(s => { get(s, path).splice(i, 1); });
    toast(`${name} deleted`, true);
  }
  function startDrag(e, item) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    const list = item.dataset.li, container = item.parentElement;
    const sibs = () => [...container.children].filter(c => c.dataset && c.dataset.li === list);
    const before = sibs().map(s => +s.dataset.ix);
    if (before.length < 2) { toast("Add another item to reorder"); return; }
    dragging = true; hideHover(); endText();
    const base = new Map(sibs().map(s => [s, s.style.transform || ""]));
    const r0 = item.getBoundingClientRect(), grab = { x: e.clientX - r0.left, y: e.clientY - r0.top };
    let px = e.clientX, py = e.clientY, lastSwap = 0, raf = 0;
    const scroller = item.closest(".pm-scroll");
    item.classList.add("ed-dragging"); document.body.classList.add("ed-is-dragging");
    const layout = () => { const t = item.style.transform; item.style.transform = base.get(item); const r = item.getBoundingClientRect(); item.style.transform = t; return r; };
    let lr = layout();
    const place = () => { item.style.transform = `translate(${px - grab.x - lr.left}px, ${py - grab.y - lr.top}px) ${base.get(item)} scale(1.02)`; };
    const check = () => {
      if (performance.now() - lastSwap < 90) return;
      const others = sibs().filter(s => s !== item);
      const target = others.find(s => { const r = s.getBoundingClientRect(); return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom; });
      if (!target) return;
      const all = sibs(), ti = all.indexOf(target), ii = all.indexOf(item);
      const first = new Map(others.map(s => [s, s.getBoundingClientRect()]));
      container.insertBefore(item, ii < ti ? target.nextSibling : target);
      lastSwap = performance.now();
      lr = layout(); place();
      others.forEach(s => {
        const a = first.get(s), b = s.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
        if (!dx && !dy) return;
        s.style.transition = "none"; s.style.transform = `translate(${dx}px,${dy}px) ${base.get(s)}`; s.offsetWidth;
        s.style.transition = reduced() ? "none" : "transform .28s cubic-bezier(.2,0,0,1)"; s.style.transform = base.get(s);
      });
    };
    const tick = () => {
      const edge = 70, sp = py < edge ? -(edge - py) / 4 : py > innerHeight - edge ? (py - (innerHeight - edge)) / 4 : 0;
      if (sp) { if (scroller) scroller.scrollTop += sp; else window.scrollBy(0, sp); lr = layout(); place(); check(); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const mv = ev => { px = ev.clientX; py = ev.clientY; place(); check(); };
    const up = async () => {
      window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      cancelAnimationFrame(raf);
      item.style.transition = reduced() ? "none" : "transform .22s cubic-bezier(.2,0,0,1)";
      item.style.transform = base.get(item);
      await wait(reduced() ? 0 : 220);
      item.classList.remove("ed-dragging"); document.body.classList.remove("ed-is-dragging");
      sibs().forEach(s => { s.style.transition = ""; s.style.transform = base.get(s); });
      dragging = false;
      const order = sibs().map(s => +s.dataset.ix);
      if (order.join() !== before.join()) {
        change(s => { const a = get(s, list), orig = a.slice(), slots = [...order].sort((x, y) => x - y); slots.forEach((slot, k) => { a[slot] = orig[order[k]]; }); });
      }
    };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    place();
  }
  let dragging = false;

  function newItem(path, container) {
    const s = site();
    if (/^projects$/.test(path)) return { slug: uniqueSlug("new-project", s.projects), type: "case", title: "New project", year: YEAR, description: "", image: "", hue: hue(), logo: "", facts: [["Year", YEAR], ["Role", ""]], blocks: [{ type: "mission", label: "The Mission", statement: "", body: [""] }] };
    if (/^artworks$/.test(path)) return { cat: container && container.dataset.cat || "", title: "Untitled", medium: "", year: YEAR, image: "", ratio: 0.78, hue: hue() };
    if (/^experience$/.test(path)) return { org: "New company", years: YEAR, logo: "", hue: hue() };
    if (/^(communities|archive)$/.test(path)) return { name: "New community", link: "", logo: "", desc: "", photos: [{ caption: "", shape: "tall" }, { caption: "", shape: "wide" }] };
    if (/\.photos$/.test(path)) return { caption: "", shape: "wide" };
    if (/^quotes$/.test(path)) return { emoji: "✦", title: "", text: "", author: "" };
    if (/^lore$/.test(path)) return { title: "New", year: YEAR, desc: "", href: "", image: "", hue: hue() };
    if (/^shelves$/.test(path)) return { name: "New shelf", shape: "book", link: { label: "", href: "" }, filters: [{ label: "★ Favorites", items: ["New title"] }] };
    if (/\.items$/.test(path)) return "New title";
    if (/^socials$/.test(path)) return { icon: "linkedin", href: "https://" };
    if (/^hi\.meta$/.test(path)) return { icon: "pin", text: "" };
    if (/\.facts$/.test(path)) return ["Label", ""];
    if (/\.people$/.test(path)) return { name: "Name", href: "" };
    if (/\.images$/.test(path)) return {};
    if (/\.more$/.test(path)) return { image: "", ratio: 1.5 };
    return {};
  }
  function addItem(path, container) {
    const it = newItem(path, container);
    let at = 0;
    change(s => { let a = get(s, path); if (!Array.isArray(a)) { a = []; set(s, path, a); } a.push(it); at = a.length - 1; });
    requestAnimationFrame(() => {
      flashNew(path, at);
      const el = itemEl(path, at); if (!el) return;
      if (/^socials$/.test(path)) { openSettings(el, "social", `${path}.${at}`, el); return; }
      const m = $("[data-m]", el), tx = $("[data-e]", el);
      if (/\.(photos|images|more)$/.test(path) && m) { openMedia(m, m.dataset.m, m); return; }
      if (tx) setTimeout(() => { startText(tx, true); }, 60);
    });
  }

  /* ---------- inline text ---------- */
  const RICH = /^tagline\.|^credit$|^hi\.photoCaption$|^hi\.paragraphs\.\d+$|\.desc$|\.sub$|\.statement$|\.body\.\d+$|\.text$|\.subtitle$|blocks\.\d+\.(title|caption)$|\.facts\.\d+\.1$/;
  let act = null; // { el, path, before, rich, t }
  function ser(node) {
    let out = "";
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/ /g, " "); return; }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === "BR") { out += "\n"; return; }
      const inner = ser(n);
      if (tag === "B" || tag === "STRONG") out += inner.trim() ? `**${inner}**` : inner;
      else if (tag === "I" || tag === "EM") out += inner.trim() ? `*${inner}*` : inner;
      else if (tag === "A") out += inner.trim() ? `[${inner}](${n.getAttribute("href") || "#"})` : inner;
      else if (tag === "DIV" || tag === "P") out += (out && !out.endsWith("\n") ? "\n" : "") + inner;
      else out += inner;
    });
    return out;
  }
  const valueOf = el => { const v = ser(el).replace(/\n+$/, ""); return v.trim() ? v : ""; };
  function startText(el, selectAll) {
    if (act && act.el === el) return;
    endText();
    const path = el.dataset.e;
    act = { el, path, before: snap(), rich: RICH.test(path), t: 0 };
    el.contentEditable = "true"; el.spellcheck = true;
    el.addEventListener("input", onInput); el.addEventListener("keydown", onKey); el.addEventListener("paste", onPaste); el.addEventListener("blur", onBlur);
    el.focus({ preventScroll: true });
    if (selectAll) { const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    showTT();
  }
  function onInput() { if (!act) return; clearTimeout(act.t); setStatus("saving"); act.t = setTimeout(() => { if (!act) return; set(site(), act.path, valueOf(act.el)); persist(); }, 700); }
  function onPaste(e) { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData("text/plain"); document.execCommand("insertText", false, t); }
  function onBlur(e) { if (inUI(e.relatedTarget) && tt.contains(e.relatedTarget)) return; setTimeout(() => { if (act && document.activeElement !== act.el && !tt.contains(document.activeElement)) endText(); }, 0); }
  function caretAtStart(el) { const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false; const r = document.createRange(); r.setStart(el, 0); r.setEnd(s.anchorNode, s.anchorOffset); return r.toString().length === 0 && !r.cloneContents().querySelector("br"); }
  function placeCaret(el, n) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let node, left = n;
    while ((node = w.nextNode())) { if (left <= node.length) { const r = document.createRange(); r.setStart(node, left); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); return; } left -= node.length; }
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  function onKey(e) {
    if (!act) return;
    const el = act.el, para = el.dataset.para;
    if ((e.metaKey || e.ctrlKey) && /^[bik]$/i.test(e.key)) {
      e.preventDefault();
      if (!act.rich) return;
      if (/k/i.test(e.key)) linkUI(); else { document.execCommand(/b/i.test(e.key) ? "bold" : "italic"); syncTT(); }
      return;
    }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); el.blur(); endText(); return; }
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); document.execCommand("insertLineBreak"); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (!para) { endText(); el.blur(); return; }
      const s = getSelection(); if (!s.rangeCount) return;
      const tail = document.createRange(); const r = s.getRangeAt(0); r.deleteContents();
      tail.setStart(r.endContainer, r.endOffset); tail.setEnd(el, el.childNodes.length);
      const tmp = document.createElement("div"); tmp.appendChild(tail.extractContents());
      const after = valueOf(tmp), beforeTxt = valueOf(el), i = parentOf(act.path).i, prev = act.before;
      detach();
      pushUndo(prev);
      const arr = get(site(), para) || []; arr[i] = beforeTxt; arr.splice(i + 1, 0, after); set(site(), para, arr);
      window.APP.refresh(null, { modalOnly: !!el.closest(".pm") }); persist();
      const nx = $(`[data-e="${CSS.escape(para + "." + (i + 1))}"]`); if (nx) { startText(nx); placeCaret(nx, 0); }
      return;
    }
    if (e.key === "Backspace" && para && caretAtStart(el)) {
      const i = parentOf(act.path).i; if (i < 1) return;
      e.preventDefault();
      const cur = valueOf(el), prev = act.before; detach();
      pushUndo(prev);
      const arr = get(site(), para); const pv = arr[i - 1] || ""; arr[i - 1] = pv + cur; arr.splice(i, 1);
      window.APP.refresh(null, { modalOnly: !!el.closest(".pm") }); persist();
      const pe = $(`[data-e="${CSS.escape(para + "." + (i - 1))}"]`);
      if (pe) { startText(pe); const tmp = document.createElement("div"); tmp.innerHTML = window.APP.md(pv); placeCaret(pe, tmp.textContent.length); }
    }
  }
  function detach() {
    if (!act) return;
    const el = act.el; clearTimeout(act.t);
    el.removeEventListener("input", onInput); el.removeEventListener("keydown", onKey); el.removeEventListener("paste", onPaste); el.removeEventListener("blur", onBlur);
    el.removeAttribute("contenteditable");
    act = null; hideTT();
  }
  function endText(silent) {
    if (!act) return;
    const { el, path, before, rich } = act;
    const v = valueOf(el);
    detach();
    if (silent && silent === true && !el.isConnected) return;
    const old = get(site(), path);
    set(site(), path, v);
    const html = rich ? window.APP.md(v) : escA(v);
    $$(`[data-e="${CSS.escape(path)}"]`).forEach(x => { if (rich) x.innerHTML = html; else x.textContent = v; });
    if (path === "name") document.title = document.title.replace(/[^|]*$/, " " + v).replace(/^ /, "");
    if (snap() !== before) { pushUndo(before); persist(); }
    else if (old !== v) persist();
  }
  // text toolbar
  function showTT() {
    if (!act) return;
    if (!act.rich) { hideTT(); return; }
    tt.innerHTML = `<button type="button" data-c="bold" aria-label="Bold"><b>B</b></button><button type="button" data-c="italic" aria-label="Italic"><i style="font-family:Georgia,serif">I</i></button><button type="button" data-c="link" aria-label="Link">${IC.link}</button>`;
    $$("button", tt).forEach(b => {
      b.addEventListener("pointerdown", e => e.preventDefault());
      b.addEventListener("click", () => { if (b.dataset.c === "link") linkUI(); else { document.execCommand(b.dataset.c); syncTT(); act && onInput(); } });
    });
    placeTT(); tt.classList.add("v"); syncTT();
  }
  function syncTT() { $$("button[data-c]", tt).forEach(b => b.classList.toggle("on", b.dataset.c !== "link" && document.queryCommandState(b.dataset.c))); }
  document.addEventListener("selectionchange", () => { if (act && act.rich && tt.classList.contains("v")) syncTT(); });
  function placeTT() { if (!act) return; const r = act.el.getBoundingClientRect(), w = tt.offsetWidth, h = tt.offsetHeight; let y = r.top - h - 10; if (y < 6) y = r.bottom + 10; tt.style.left = Math.max(6, Math.min(innerWidth - w - 6, r.left)) + "px"; tt.style.top = y + "px"; }
  function hideTT() { if (tt) tt.classList.remove("v"); }
  function linkUI() {
    if (!act) return;
    const el = act.el, s = getSelection(); if (!s.rangeCount) return;
    const range = s.getRangeAt(0).cloneRange();
    const a = (s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement)).closest("a");
    tt.innerHTML = `<div class="ed-tt-link">${IC.link}<input type="url" placeholder="Paste a link and press Enter" value="${escA(a ? a.getAttribute("href") : "")}"><button type="button" data-ok aria-label="Apply">${IC.check}</button>${a ? `<button type="button" data-rm aria-label="Remove link">${IC.x}</button>` : ""}</div>`;
    placeTT();
    const inp = $("input", tt); inp.focus();
    const back = () => { el.focus({ preventScroll: true }); const s2 = getSelection(); s2.removeAllRanges(); s2.addRange(range); };
    const apply = () => {
      let url = inp.value.trim();
      back();
      if (url) { if (!/^(https?:|mailto:|#|\/)/.test(url)) url = (/@/.test(url) ? "mailto:" : "https://") + url; if (range.collapsed && !a) document.execCommand("insertHTML", false, `<a href="${escA(url)}">${escA(url)}</a>`); else if (a) a.setAttribute("href", url); else document.execCommand("createLink", false, url); }
      onInput(); showTT();
    };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); apply(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); back(); showTT(); } });
    inp.addEventListener("blur", () => setTimeout(() => { if (act && !tt.contains(document.activeElement) && document.activeElement !== act.el) endText(); }, 0));
    $("[data-ok]", tt).addEventListener("pointerdown", e => e.preventDefault()); $("[data-ok]", tt).onclick = apply;
    const rm = $("[data-rm]", tt); if (rm) { rm.addEventListener("pointerdown", e => e.preventDefault()); rm.onclick = () => { back(); a.replaceWith(...a.childNodes); onInput(); showTT(); }; }
  }

  /* ---------- global input routing ---------- */
  const PASS = "[data-route], [data-proj], .pm-exp, .pm-bd, .pm-info, .archive-btn, .f-pill, .s-item, .tab, .ed-ui";
  document.addEventListener("pointerdown", e => {
    if (!live()) return;
    if (pop && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) closePop();
    if (inUI(e.target)) return;
    const el = e.target.closest && e.target.closest("[data-e]");
    if (el && e.button === 0) { if (act && act.el === el) return; startText(el); }
  }, true);
  document.addEventListener("click", e => {
    if (!live()) return;
    const t = e.target;
    if (!t.closest || inUI(t)) return;
    const logo = t.closest("[data-logo]");
    if (logo) { e.preventDefault(); e.stopPropagation(); openLogo(logo); return; }
    if (t.closest("[data-e]")) { e.preventDefault(); e.stopPropagation(); return; }
    const sm = t.closest("[data-msmall]");
    if (sm) { e.preventDefault(); e.stopPropagation(); openMedia(sm, sm.dataset.m, sm); return; }
    if (t.closest(PASS)) return;
    // no lightboxes or leaving the page while editing
    if (t.closest(".art-btn, .photo, #hiPhoto, [data-lb], .cs-gal .media, a[href]")) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  window.addEventListener("keydown", e => {
    if (!editing) return;
    const typing = act || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    if (e.key === "Escape" && pop) { e.preventDefault(); e.stopPropagation(); closePop(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (act) endText(); flush(); return; }
    if (!typing && !preview && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) redo(); else undo(); return; }
    if (!typing && !preview && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
  }, true);
  // drag & drop files straight onto any image
  document.addEventListener("dragover", e => {
    if (!live() || !e.dataTransfer || ![...e.dataTransfer.types].includes("Files")) return;
    const m = e.target.closest && e.target.closest("[data-m]");
    $$(".ed-dropping").forEach(x => x !== m && x.classList.remove("ed-dropping"));
    if (m) { e.preventDefault(); m.classList.add("ed-dropping"); }
  });
  document.addEventListener("dragleave", e => { const m = e.target.closest && e.target.closest("[data-m]"); if (m && !m.contains(e.relatedTarget)) m.classList.remove("ed-dropping"); });
  document.addEventListener("drop", e => {
    if (!live()) return;
    const m = e.target.closest && e.target.closest("[data-m]");
    $$(".ed-dropping").forEach(x => x.classList.remove("ed-dropping"));
    if (!m || !e.dataTransfer.files.length) return;
    e.preventDefault();
    uploadInto(m.dataset.m, m, e.dataTransfer.files[0]);
  });

  /* ---------- popover engine ---------- */
  let pop = null, popAnchor = null;
  function openPop(anchor, html, cls = "") {
    closePop();
    popAnchor = anchor;
    pop = H(`<div class="ed-pop ed-ui ${cls}" role="dialog">${html}</div>`);
    document.body.appendChild(pop);
    placePop();
    requestAnimationFrame(() => pop && pop.classList.add("v"));
    const x = $("[data-close]", pop); if (x) x.onclick = closePop;
    hideHover();
    return pop;
  }
  let lastRect = null;
  function placePop() {
    if (!pop) return;
    const a = popAnchor && popAnchor.isConnected ? popAnchor.getBoundingClientRect() : lastRect || { left: innerWidth / 2, right: innerWidth / 2, top: innerHeight / 3, bottom: innerHeight / 3, width: 0 };
    lastRect = { left: a.left, right: a.right, top: a.top, bottom: a.bottom, width: a.width };
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = a.left + (a.width || 0) / 2 - w / 2, y = a.bottom + 8;
    if (y + h > innerHeight - 8) y = a.top - h - 8;
    if (y < 8) y = Math.max(8, innerHeight - h - 8);
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + "px";
    pop.style.top = y + "px";
  }
  function closePop() {
    if (!pop) return;
    const p = pop; pop = null; popAnchor = null;
    if (p._onClose) p._onClose();
    p.classList.remove("v"); setTimeout(() => p.remove(), 160);
    sessionEnd();
  }
  const head = t => `<h5><span>${t}</span><button type="button" data-close aria-label="Close">${IC.x}</button></h5>`;
  const tog = (k, label, on) => `<label class="ed-tog ${on ? "on" : ""}" data-k="${k}"><span>${label}</span><i></i></label>`;
  const seg = (k, opts, cur) => `<div class="ed-seg" data-k="${k}">${opts.map(([v, l]) => `<button type="button" data-v="${escA(v)}" class="${String(cur) === String(v) ? "on" : ""}">${l}</button>`).join("")}</div>`;
  const inp = (k, val, ph, type = "text") => `<input class="ed-in" data-k="${k}" type="${type}" value="${escA(val ?? "")}" placeholder="${escA(ph || "")}">`;
  function wire(root, on) {
    $$("[data-k].ed-tog", root).forEach(t => t.addEventListener("click", e => { e.preventDefault(); const v = !t.classList.contains("on"); t.classList.toggle("on", v); on(t.dataset.k, v, t); }));
    $$(".ed-seg[data-k]", root).forEach(sg => $$("button", sg).forEach(b => b.addEventListener("click", () => { $$("button", sg).forEach(x => x.classList.toggle("on", x === b)); on(sg.dataset.k, b.dataset.v, b); })));
    $$("input.ed-in[data-k], select.ed-in[data-k]", root).forEach(i => {
      let t = 0;
      if (i.dataset.commit === "change") { i.addEventListener("change", () => on(i.dataset.k, i.value, i)); return; }
      i.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => on(i.dataset.k, i.value, i), i.tagName === "SELECT" ? 0 : 380); });
    });
  }

  /* ---------- media: upload, link, video ---------- */
  async function uploadFile(file) {
    if (!file) throw new Error("No file");
    if (!/^(image|video)\//.test(file.type)) throw new Error("Please choose an image or a video file.");
    return editorStore().upload(file);
  }
  function setMedia(s, mp, v) {
    const m = mParse(mp);
    let obj = m.path ? get(s, m.path) : s;
    if (typeof obj === "string") { obj = { title: obj }; set(s, m.path, obj); }
    if (obj == null) { obj = {}; set(s, m.path, obj); }
    if ("image" in v) obj[m.key] = v.image;
    if (!m.small) {
      if ("video" in v) obj[m.vkey] = v.video;
      if ("poster" in v) obj[m.pkey] = v.poster;
    }
  }
  function mediaOf(mp) { const m = mParse(mp), o = get(site(), m.path) || {}; return typeof o === "string" ? {} : { image: o[m.key] || "", video: m.small ? "" : o[m.vkey] || "", poster: m.small ? "" : o[m.pkey] || "", o }; }
  async function uploadInto(mp, el, file) {
    const small = mParse(mp).small;
    if (small && !/^image\//.test(file.type)) { toast("Logos need an image file"); return; }
    let veil = null;
    if (el && el.isConnected) { veil = H(`<div class="ed-upl ed-ui"><span>Uploading…</span><i></i></div>`); if (getComputedStyle(el).position === "static") el.style.position = "relative"; el.appendChild(veil); }
    setStatus("saving");
    try {
      const url = await uploadFile(file);
      const isVid = /^video\//.test(file.type);
      change(s => setMedia(s, mp, isVid ? { image: "", video: url, poster: "" } : { image: url, video: "", poster: "" }));
      if (isVid) afterVideo(mp);
    } catch (e) { console.error(e); if (veil) veil.remove(); setStatus(lastFailed ? "error" : "saved"); toast("Upload failed: " + (e.message || e)); }
  }
  function afterVideo(mp) {
    requestAnimationFrame(() => setTimeout(() => {
      const sel = `[data-m="${CSS.escape(mp)}"]`, pmEl = window.APP.el && window.APP.el();
      const el = (pmEl && $(sel, pmEl)) || $(sel);
      if (el) openVideo(el, mp);
    }, 120));
  }
  // what is this link?
  async function sniff(url) {
    url = url.trim();
    if (!url) return null;
    if (!/^https?:\/\//i.test(url) && !/^data:/.test(url)) url = "https://" + url;
    url = url.replace(/^(https?:\/\/(?:www\.)?dropbox\.com\/.*?)([?&])dl=0/, "$1$2raw=1");
    const g = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/); if (g) return { kind: "image", url: `https://drive.google.com/thumbnail?id=${g[1]}&sz=w2000`, label: "Google Drive image", thumb: `https://drive.google.com/thumbnail?id=${g[1]}&sz=w400` };
    const v = window.APP.vlink(url);
    if (v) {
      let thumb = v.thumb || "";
      const name = { youtube: "YouTube", vimeo: "Vimeo", loom: "Loom" }[v.kind];
      if (!thumb) {
        try {
          const api = v.kind === "vimeo" ? `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=1280` : `https://www.loom.com/v1/oembed?url=${encodeURIComponent(url)}`;
          const r = await withTimeout(fetch(api), 6000); if (r.ok) { const j = await r.json(); thumb = j.thumbnail_url || ""; }
        } catch {}
      }
      return { kind: "embed", url, label: `${name} video found`, thumb, vk: v };
    }
    if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(url)) return { kind: "video", url, label: "Video file found" };
    if (/\.(jpe?g|png|gif|webp|avif|svg|bmp)(\?|#|$)/i.test(url)) return { kind: "image", url, label: "Image found", thumb: url };
    const img = await new Promise(res => { const i = new Image(); const t = setTimeout(() => res(false), 7000); i.onload = () => { clearTimeout(t); res(true); }; i.onerror = () => { clearTimeout(t); res(false); }; i.src = url; });
    if (img) return { kind: "image", url, label: "Image found", thumb: url };
    const vid = await new Promise(res => { const v2 = document.createElement("video"); const t = setTimeout(() => res(false), 7000); v2.muted = true; v2.preload = "metadata"; v2.onloadedmetadata = () => { clearTimeout(t); res(true); }; v2.onerror = () => { clearTimeout(t); res(false); }; v2.src = url; });
    if (vid) return { kind: "video", url, label: "Video found" };
    return { kind: "none" };
  }
  function openMedia(anchor, mp, el) {
    const small = mParse(mp).small;
    const cur = mediaOf(mp);
    const isVid = !!cur.video;
    const p = openPop(anchor, `${head(small ? "Change image" : "Change media")}
      <div class="ed-tabs"><button type="button" class="on" data-tab="up">${IC.upload}Upload</button><button type="button" data-tab="ln">${IC.link}Paste link</button></div>
      <div data-pane="up"><label class="ed-drop"><input type="file" accept="${small ? "image/*" : "image/*,video/*"}" hidden>${IC.upload}<span>${small ? "Drop an image or click to choose" : "Drop an image or video, or click to choose"}</span><small>${small ? "PNG, JPG, SVG or GIF" : "JPG, PNG, GIF, WebP, MP4 or MOV"}</small></label></div>
      <div data-pane="ln" hidden><input class="ed-in" type="url" placeholder="${small ? "https://… image link" : "YouTube, Vimeo, Loom, image or MP4 link"}"><div class="ed-res"></div></div>
      ${cur.image || cur.video ? `<div class="ed-foot">${isVid ? `<button type="button" class="ed-btn soft ed-vs">${IC.video}Video settings</button>` : "<span></span>"}<button type="button" class="ed-btn danger ed-rm">Remove</button></div>` : ""}`);
    $$("[data-tab]", p).forEach(b => b.onclick = () => { $$("[data-tab]", p).forEach(x => x.classList.toggle("on", x === b)); $$("[data-pane]", p).forEach(x => x.hidden = x.dataset.pane !== b.dataset.tab); placePop(); if (b.dataset.tab === "ln") $("[data-pane=ln] input", p).focus(); });
    const drop = $(".ed-drop", p), file = $("input[type=file]", p);
    file.onchange = () => { if (file.files[0]) { closePop(); uploadInto(mp, el, file.files[0]); } };
    drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); const f = e.dataTransfer.files[0]; if (f) { closePop(); uploadInto(mp, el, f); } });
    const li = $("[data-pane=ln] input", p), res = $(".ed-res", p);
    let seq = 0, t = 0;
    const check = async () => {
      const my = ++seq, val = li.value.trim();
      if (!val) { res.innerHTML = ""; placePop(); return; }
      res.innerHTML = `<p class="ed-note">Looking…</p>`;
      const r = await sniff(val); if (my !== seq || !pop) return;
      if (!r || r.kind === "none" || (small && r.kind !== "image")) { res.innerHTML = `<p class="ed-err">${small ? "Couldn't find an image at this link." : "Couldn't find an image or video at this link."}</p>`; placePop(); return; }
      res.innerHTML = `<div class="ed-found"><div class="th" style="${r.thumb ? `background-image:url('${escA(r.thumb)}')` : ""}">${r.thumb ? "" : (r.kind === "image" ? IC.media : IC.play)}</div><div><b>${r.label}</b><small>${r.kind === "embed" ? (r.thumb ? "Thumbnail fetched" : "Pick a thumbnail next") : r.kind === "video" ? "Plays muted on loop" : "Ready to use"}</small></div><button type="button" class="ed-btn">Use</button></div>`;
      placePop();
      $(".ed-btn", res).onclick = () => {
        closePop();
        change(s => setMedia(s, mp, r.kind === "image" ? { image: r.url, video: "", poster: "" } : { image: "", video: r.url, poster: r.vk && r.vk.kind === "youtube" ? "" : (r.thumb || "") }));
        if (r.kind !== "image") afterVideo(mp);
      };
    };
    li.addEventListener("input", () => { clearTimeout(t); t = setTimeout(check, 450); });
    li.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(t); check(); } });
    const rm = $(".ed-rm", p); if (rm) rm.onclick = () => { closePop(); change(s => setMedia(s, mp, { image: "", video: "", poster: "" })); };
    const vs = $(".ed-vs", p); if (vs) vs.onclick = () => openVideo(anchor, mp);
  }
  function openVideo(anchor, mp) {
    const m = mParse(mp), cur = mediaOf(mp), o = cur.o || {};
    const v = window.APP.vlink(cur.video);
    const frames = v && v.kind === "youtube" ? ["maxresdefault", "hqdefault", "hq1", "hq2", "hq3", "sddefault"].map(n => `https://i.ytimg.com/vi/${v.id}/${n}.jpg`) : null;
    const p = openPop(anchor, `${head("Video settings")}
      <span class="ed-lbl">Thumbnail</span>
      <div class="ed-tabs"><button type="button" class="on" data-tab="fr">Pick a frame</button><button type="button" data-tab="im">Upload image</button></div>
      <div data-pane="fr">${frames ? `<div class="ed-frames">${frames.map(f => `<button type="button" data-f="${f}" class="${(cur.poster || frames[1]) === f ? "on" : ""}" style="background-image:url('${f}')"></button>`).join("")}</div><p class="ed-note">Frames from your YouTube video.</p>`
        : v ? `<div class="ed-frames" style="grid-template-columns:1fr"><button type="button" class="on" style="background-image:url('${escA(cur.poster)}');aspect-ratio:16/9"></button></div><p class="ed-note">${cur.poster ? "Thumbnail fetched from the video." : "This site doesn't share frames. Upload an image instead."}</p>`
        : `<div class="ed-scrub"><video src="${escA(cur.video)}" muted playsinline preload="auto" crossorigin="anonymous"></video><input type="range" min="0" max="100" step="0.1" value="0"><button type="button" class="ed-btn" style="width:100%">${IC.check}Use this frame</button><p class="ed-err" hidden></p></div>`}</div>
      <div data-pane="im" hidden><label class="ed-drop" style="min-height:90px"><input type="file" accept="image/*" hidden>${IC.upload}<span>Drop or choose an image</span></label></div>
      <span class="ed-lbl">Playback</span>
      ${tog("vAuto", "Autoplay", o.vAuto !== false)}${tog("vLoop", "Loop", o.vLoop !== false)}${tog("vSound", "Sound (shows controls)", !!o.vSound)}${tog("vHover", "Play only on hover", !!o.vHover)}`);
    $$("[data-tab]", p).forEach(b => b.onclick = () => { $$("[data-tab]", p).forEach(x => x.classList.toggle("on", x === b)); $$("[data-pane]", p).forEach(x => x.hidden = x.dataset.pane !== b.dataset.tab); placePop(); });
    $$(".ed-frames [data-f]", p).forEach(b => b.onclick = () => { $$(".ed-frames button", p).forEach(x => x.classList.toggle("on", x === b)); liveChange(s => setMedia(s, mp, { poster: b.dataset.f })); });
    const vid = $(".ed-scrub video", p);
    if (vid) {
      const rg = $(".ed-scrub input", p), use = $(".ed-scrub .ed-btn", p), err = $(".ed-scrub .ed-err", p);
      vid.addEventListener("loadedmetadata", () => { rg.max = vid.duration || 0; vid.currentTime = Math.min(0.1, vid.duration || 0); });
      vid.addEventListener("error", () => { if (vid.hasAttribute("crossorigin")) { vid.removeAttribute("crossorigin"); vid.load(); } }, { once: false });
      rg.addEventListener("input", () => { vid.currentTime = +rg.value; });
      use.onclick = async () => {
        use.disabled = true; use.innerHTML = "Saving frame…"; err.hidden = true;
        try {
          const c = document.createElement("canvas"); c.width = vid.videoWidth; c.height = vid.videoHeight;
          c.getContext("2d").drawImage(vid, 0, 0);
          const blob = await new Promise((res, rej) => { try { c.toBlob(b => b ? res(b) : rej(new Error("empty")), "image/jpeg", 0.86); } catch (e) { rej(e); } });
          const url = await uploadFile(new File([blob], "thumbnail.jpg", { type: "image/jpeg" }));
          liveChange(s => setMedia(s, mp, { poster: url }));
          use.innerHTML = `${IC.check}Thumbnail set`;
        } catch (e) { console.warn(e); err.textContent = "This video's host doesn't allow grabbing frames. Upload an image instead."; err.hidden = false; use.innerHTML = `${IC.check}Use this frame`; }
        use.disabled = false; placePop();
      };
    }
    const file = $("[data-pane=im] input", p);
    file.onchange = async () => { const f = file.files[0]; if (!f) return; const lb = $("[data-pane=im] span", p); lb.textContent = "Uploading…"; try { const url = await uploadFile(f); liveChange(s => setMedia(s, mp, { poster: url })); lb.textContent = "Thumbnail set ✓"; } catch (e) { lb.textContent = "Upload failed: " + (e.message || e); } };
    wire(p, (k, val) => liveChange(s => { let ob = get(s, m.path); if (typeof ob !== "object" || !ob) return; if (k === "vAuto" || k === "vLoop") ob[k] = val ? undefined : false; else ob[k] = val || undefined; }));
  }

  /* ---------- logo ---------- */
  const COLORS = ["#d63b2f", "#18181b", "#3b82f6", "#16a34a", "#7c3aed", "#ea580c"];
  function openLogo(anchor) {
    const s = site();
    const tab = s.logo ? (/^data:|supabase|blob:|assets/.test(s.logo) ? "im" : "ln") : "in";
    const cur = s.logoColor || "#d63b2f";
    const p = openPop(anchor, `${head("Logo")}
      <div class="ed-tabs"><button type="button" data-tab="in">Initials</button><button type="button" data-tab="im">${IC.upload}Image</button><button type="button" data-tab="ln">${IC.link}Link</button></div>
      <div data-pane="in"><span class="ed-lbl">Letters</span>${inp("initials", s.initials, "AB")}
        <span class="ed-lbl">Colour</span><div class="ed-row" style="gap:8px;justify-content:flex-start">${COLORS.map(c => `<button type="button" class="ed-swatch ${c === cur ? "on" : ""}" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join("")}<label class="ed-swatch ${COLORS.includes(cur) ? "" : "on"}" style="background:conic-gradient(red,yellow,lime,cyan,blue,magenta,red)" aria-label="Custom colour"><input type="color" value="${escA(cur)}"></label></div>
        <span class="ed-lbl">Shape</span>${seg("logoShape", [["stamp", "Stamp"], ["circle", "Circle"], ["plain", "Plain"]], s.logoShape || "stamp")}</div>
      <div data-pane="im" hidden><label class="ed-drop"><input type="file" accept="image/*" hidden>${IC.upload}<span>Drop or choose your logo</span><small>Square PNG or SVG works best</small></label></div>
      <div data-pane="ln" hidden><input class="ed-in ed-lnk" type="url" placeholder="https://… link to your logo image" value="${escA(tab === "ln" ? s.logo : "")}"><div class="ed-res"></div></div>
      ${s.logo ? `<div class="ed-foot"><span></span><button type="button" class="ed-btn soft ed-useini">Use initials instead</button></div>` : ""}`);
    const show = k => { $$("[data-tab]", p).forEach(x => x.classList.toggle("on", x.dataset.tab === k)); $$("[data-pane]", p).forEach(x => x.hidden = x.dataset.pane !== k); placePop(); };
    $$("[data-tab]", p).forEach(b => b.onclick = () => show(b.dataset.tab));
    show(tab);
    wire($("[data-pane=in]", p), (k, v) => liveChange(s2 => { if (k === "initials") { s2.initials = v.slice(0, 3); s2.logo = ""; } else { s2[k] = v; s2.logo = ""; } }));
    $$(".ed-swatch[data-c]", p).forEach(b => b.onclick = () => { $$(".ed-swatch", p).forEach(x => x.classList.toggle("on", x === b)); liveChange(s2 => { s2.logoColor = b.dataset.c; s2.logo = ""; }); });
    const ci = $("input[type=color]", p); let ct = 0; ci.oninput = () => { $$(".ed-swatch", p).forEach(x => x.classList.toggle("on", x === ci.parentNode)); clearTimeout(ct); ct = setTimeout(() => liveChange(s2 => { s2.logoColor = ci.value; s2.logo = ""; }), 200); };
    const file = $("[data-pane=im] input", p), lab = $("[data-pane=im] span", p);
    const up = async f => { if (!f) return; lab.textContent = "Uploading…"; try { const url = await uploadFile(f); liveChange(s2 => { s2.logo = url; }); lab.textContent = "Logo updated ✓"; } catch (e) { lab.textContent = "Upload failed: " + (e.message || e); } };
    file.onchange = () => up(file.files[0]);
    const dz = $("[data-pane=im] .ed-drop", p); dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("over"); }); dz.addEventListener("dragleave", () => dz.classList.remove("over")); dz.addEventListener("drop", e => { e.preventDefault(); e.stopPropagation(); dz.classList.remove("over"); up(e.dataTransfer.files[0]); });
    const ln = $(".ed-lnk", p), res = $("[data-pane=ln] .ed-res", p); let lt = 0;
    ln.addEventListener("input", () => { clearTimeout(lt); lt = setTimeout(async () => { const r = await sniff(ln.value); if (!pop) return; if (!r || r.kind !== "image") { res.innerHTML = ln.value.trim() ? `<p class="ed-err">Couldn't find an image at this link.</p>` : ""; placePop(); return; } res.innerHTML = `<div class="ed-found"><div class="th" style="background-image:url('${escA(r.thumb)}');background-size:contain;background-repeat:no-repeat"></div><div><b>Image found</b><small>Ready to use</small></div><button type="button" class="ed-btn">Use</button></div>`; placePop(); $(".ed-btn", res).onclick = () => { liveChange(s2 => { s2.logo = r.url; }); closePop(); }; }, 450); });
    const ui = $(".ed-useini", p); if (ui) ui.onclick = () => { liveChange(s2 => { s2.logo = ""; }); closePop(); };
  }

  /* ---------- settings (gear) ---------- */
  function hasSettings(kind, el) {
    if (kind !== "block") return true;
    const b = get(site(), el.dataset.b); return !!b && ["image", "feature", "gallery"].includes(b.type);
  }
  const ICONS_SOCIAL = [["linkedin", "LinkedIn"], ["x", "X"], ["instagram", "Instagram"], ["github", "GitHub"], ["spark", "Luma / other"]];
  const TZ = ["Asia/Kolkata", "America/Los_Angeles", "America/New_York", "America/Chicago", "Europe/London", "Europe/Berlin", "Europe/Paris", "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
  function openSettings(anchor, kind, path, el) {
    const s = site(), o = get(s, path);
    const F = {
      project: () => {
        const t = o.type || "case";
        return `${head("Project settings")}
          <span class="ed-lbl">When someone clicks it</span>${seg("type", [["case", "Case study"], ["side", "Side project"], ["embed", "Live demo"], ["link", "Link"]], t)}
          ${t === "link" ? `<span class="ed-lbl">Opens this link</span>${inp("href", o.href, "https://")}` : `<span class="ed-lbl">Page address</span><div class="ed-in pre"><span>#p-</span><input data-k="slug" class="ed-in" data-commit="change" style="border:0;box-shadow:none" value="${escA(o.slug)}"></div>`}
          ${t === "side" ? `<span class="ed-lbl">Website link (chain icon)</span>${inp("site", o.site, "https://")}` : ""}
          ${t === "embed" ? `<span class="ed-lbl">Live project link (shown inside the window)</span>${inp("embed", o.embed, "https://your-app.com")}` : ""}
          ${t === "side" || t === "embed" ? `<span class="ed-lbl">Blue button</span><div class="ed-row">${inp("viewOn.label", (o.viewOn || {}).label, "View on")}<select class="ed-in" data-k="viewOn.icon">${[["", "No icon"], ...ICONS_SOCIAL].map(([v, l]) => `<option value="${v}" ${((o.viewOn || {}).icon || "") === v ? "selected" : ""}>${l}</option>`).join("")}</select></div><div style="margin-top:6px">${inp("viewOn.href", (o.viewOn || {}).href, "Button link (leave empty to hide)")}</div>` : ""}
          <div class="ed-foot"><div style="flex:1">${tog("hidden", "Hide from visitors", !!o.hidden)}</div><button type="button" class="ed-btn danger ed-delp">Delete project</button></div>`;
      },
      artwork: () => `${head("Artwork")}<span class="ed-lbl">Shape</span>${seg("ratio", [["0.78", "Portrait"], ["1", "Square"], ["1.3", "Landscape"], ["1.6", "Wide"]], String(o.ratio || 0.78))}
          <span class="ed-lbl">Section</span><select class="ed-in" data-k="cat">${s.artGroups.flatMap(g => g.children.map(c => [c.key, `${g.label} · ${c.label}`])).map(([k, l]) => `<option value="${escA(k)}" ${o.cat === k ? "selected" : ""}>${escA(l)}</option>`).join("")}</select>`,
      community: () => `${head("Community")}<span class="ed-lbl">Instagram or website link</span>${inp("link", o.link, "https://")}<p class="ed-note">Click the round logo next to the name to change it.</p>`,
      photo: () => `${head("Photo")}<span class="ed-lbl">Shape</span>${seg("shape", [["tall", "Tall"], ["wide", "Wide"]], o.shape || "tall")}`,
      social: () => `${head("Social link")}<span class="ed-lbl">Icon</span>${seg("icon", ICONS_SOCIAL, o.icon)}<span class="ed-lbl">Link</span>${inp("href", o.href, "https://")}<span class="ed-lbl">Tooltip (optional)</span>${inp("label", o.label, "e.g. LinkedIn")}`,
      lore: () => `${head("Lore card")}<span class="ed-lbl">Opens this link</span>${inp("href", o.href, "https://")}`,
      meta: () => `${head("Detail")}<span class="ed-lbl">Icon</span>${seg("icon", [["pin", "Location"], ["cap", "School"], ["heart", "Heart"], ["", "None"]], o.icon || "")}`,
      person: () => `${head("Person")}<span class="ed-lbl">Name</span>${inp("name", o.name, "Name")}<span class="ed-lbl">Link</span>${inp("href", o.href, "https://")}`,
      clock: () => `${head("Site settings")}<span class="ed-lbl">Clock time zone</span><select class="ed-in" data-k="timezone">${[...new Set([s.timezone, ...TZ])].map(z => `<option ${z === s.timezone ? "selected" : ""}>${escA(z)}</option>`).join("")}</select>
          <span class="ed-lbl">Shown next to your name on the Art page</span>${inp("bornYear", s.bornYear, "b. 2000")}
          <span class="ed-lbl">Domain (Design System page)</span>${inp("domain", s.domain, "yourdomain.com")}
          <span class="ed-lbl">Changelog link</span>${inp("changelog.href", (s.changelog || {}).href, "https://")}`,
      artsec: () => { const grp = get(s, keys(path).slice(0, 2).join(".")); return `${head("Art section")}
          <span class="ed-lbl">Group (left menu)</span>${inp("__group", grp.label, "Group name")}
          ${tog("__link", "Show a link next to the title", !!o.link)}
          ${o.link ? `<div class="ed-row">${inp("link.label", o.link.label, "Link text")}${inp("link.href", o.link.href, "https://")}</div>` : ""}
          <div class="ed-foot"><div class="ed-row" style="flex:none;gap:4px"><button type="button" class="ed-ic ed-up" aria-label="Move up" data-tip="Move up">${IC.up}</button><button type="button" class="ed-ic ed-down" aria-label="Move down" data-tip="Move down">${IC.down}</button><button type="button" class="ed-btn soft ed-addsec">${IC.plus}Section</button></div><button type="button" class="ed-btn danger ed-delsec">Delete</button></div>`; },
      stack: () => `${head("Tools & stack")}<div class="ed-stk">${(o.stack || []).map(([gname, items], i) => `<div class="ed-grp" data-i="${i}"><div class="ed-row">${inp("g" + i, gname, "Group, e.g. Frontend")}<button type="button" class="ed-ic danger" data-rmg="${i}" aria-label="Remove group">${IC.trash}</button></div><div style="margin-top:6px">${inp("t" + i, items.join(", "), "Tools, separated by commas")}</div></div>`).join("")}</div>
          <button type="button" class="ed-btn soft ed-addg" style="margin-top:8px;width:100%">${IC.plus}Add group</button>`,
      shelf: () => `${head("Shelf row")}<span class="ed-lbl">Name (left menu)</span>${inp("name", o.name, "Books")}
          <span class="ed-lbl">Cover shape</span>${seg("shape", [["book", "Book"], ["square", "Square"]], o.shape || "book")}
          <span class="ed-lbl">Link on the right</span><div class="ed-row">${inp("link.label", (o.link || {}).label, "Goodreads")}${inp("link.href", (o.link || {}).href, "https://")}</div>
          <span class="ed-lbl">Filters</span>${(o.filters || []).map((f, i) => `<div class="ed-row" style="margin-bottom:6px">${inp("f" + i, f.label, "Filter name")}<button type="button" class="ed-ic danger" data-rmf="${i}" aria-label="Remove filter">${IC.trash}</button></div>`).join("")}
          <button type="button" class="ed-btn soft ed-addf" style="width:100%">${IC.plus}Add filter</button>`,
      block: () => {
        if (o.type === "image") return `${head("Image section")}<span class="ed-lbl">Shape</span>${seg("ratio", [["1.85", "Wide"], ["1.5", "Classic"], ["1.78", "16:9"], ["1", "Square"]], String(o.ratio || 1.85))}`;
        if (o.type === "feature") return `${head("Highlight section")}${tog("__pic", "Show tilted photo", o.image !== undefined || !!o.video)}${tog("__ppl", "Show team list", !!o.people)}`;
        if (o.type === "gallery") return `${head("Photo row")}<span class="ed-lbl">Photos in the row</span>${seg("__n", [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]], String((o.images || []).length))}`;
        return head("Section");
      }
    };
    if (!F[kind] || o == null) return;
    const draw = () => {
      const p = openPop(anchor, F[kind](), kind === "stack" || kind === "project" ? "wide" : "");
      bind(p);
    };
    const redraw = () => { const keepS = sess; sess = null; closePopQuiet(); sess = keepS; draw(); };
    const bind = p => {
      wire(p, (k, v) => {
        if (kind === "project") {
          if (k === "type") { liveChange(s2 => { const x = get(s2, path); x.type = v; if (v === "side") { x.stack = x.stack || []; x.preview = x.preview || {}; x.more = x.more || []; x.site = x.site || ""; } if (v === "embed") { x.stack = x.stack || []; x.preview = x.preview || {}; x.embed = x.embed || ""; } if (v === "link") x.href = x.href || "https://"; if (v === "case") { x.facts = x.facts || []; x.blocks = x.blocks || []; } }); redraw(); return; }
          if (k === "slug") {
            const old = o.slug, ns = uniqueSlug(v || o.title, s.projects, o);
            const openNow = window.APP.project() === old;
            liveChange(s2 => { get(s2, path).slug = ns; }, { refresh: openNow ? { slug: ns } : undefined });
            if (openNow && history.replaceState) history.replaceState(null, "", "#p-" + ns + (location.hash.endsWith("-full") ? "-full" : ""));
            const inpEl = $("[data-k=slug]", p); if (inpEl) inpEl.value = ns;
            return;
          }
          if (k === "hidden") { liveChange(s2 => { get(s2, path).hidden = v || undefined; }); return; }
        }
        if (kind === "artsec") {
          if (k === "__group") { liveChange(s2 => { get(s2, keys(path).slice(0, 2).join(".")).label = v; }); return; }
          if (k === "__link") { liveChange(s2 => { const x = get(s2, path); if (v) x.link = x.link || { label: "Link", href: "https://" }; else delete x.link; }); redraw(); return; }
        }
        if (kind === "stack") {
          const m = k.match(/^([gt])(\d+)$/); if (m) { liveChange(s2 => { const st = get(s2, path).stack; if (m[1] === "g") st[+m[2]][0] = v; else st[+m[2]][1] = v.split(",").map(x => x.trim()).filter(Boolean); }); }
          return;
        }
        if (kind === "shelf") { const m = k.match(/^f(\d+)$/); if (m) { liveChange(s2 => { get(s2, path).filters[+m[1]].label = v; }); return; } }
        if (kind === "block") {
          if (k === "__pic") { liveChange(s2 => { const x = get(s2, path); if (v) x.image = x.image || ""; else { delete x.image; delete x.video; delete x.poster; } }); return; }
          if (k === "__ppl") { liveChange(s2 => { const x = get(s2, path); if (v) x.people = x.people || [{ name: "Name", href: "" }]; else delete x.people; }); return; }
          if (k === "__n") { liveChange(s2 => { const x = get(s2, path); x.images = x.images || []; const n = +v; while (x.images.length < n) x.images.push({}); x.images.length = n; }); return; }
        }
        if (kind === "clock") { liveChange(s2 => set(s2, k, v)); return; }
        const num = (kind === "artwork" || kind === "block") && k === "ratio";
        liveChange(s2 => set(get(s2, path), k, num ? +v : v), kind === "artwork" && k === "cat" ? {} : undefined);
      });
      const delp = $(".ed-delp", p); if (delp) delp.onclick = () => {
        const i = parentOf(path).i, name = o.title; closePop();
        const wasOpen = window.APP.project() === o.slug;
        change(s2 => { s2.projects.splice(i, 1); });
        if (wasOpen) location.hash = window.APP.route();
        toast(`“${name}” deleted`, true);
      };
      const ag = $(".ed-addg", p); if (ag) ag.onclick = () => { liveChange(s2 => { const x = get(s2, path); x.stack = x.stack || []; x.stack.push(["New group", []]); }); redraw(); };
      $$("[data-rmg]", p).forEach(b => b.onclick = () => { liveChange(s2 => { get(s2, path).stack.splice(+b.dataset.rmg, 1); }); redraw(); });
      const af = $(".ed-addf", p); if (af) af.onclick = () => { liveChange(s2 => { get(s2, path).filters.push({ label: "New filter", items: ["New title"] }); }); redraw(); };
      $$("[data-rmf]", p).forEach(b => b.onclick = () => { if (o.filters.length < 2) { toast("A shelf needs at least one filter"); return; } liveChange(s2 => { get(s2, path).filters.splice(+b.dataset.rmf, 1); }); redraw(); });
      // art section actions
      const sp = parentOf(path);
      const mvS = d => { const a = get(s, sp.arr); const j = sp.i + d; if (j < 0 || j >= a.length) return; closePop(); change(s2 => { const arr = get(s2, sp.arr); const [x] = arr.splice(sp.i, 1); arr.splice(j, 0, x); }); };
      const u = $(".ed-up", p), dn = $(".ed-down", p); if (u) u.onclick = () => mvS(-1); if (dn) dn.onclick = () => mvS(1);
      const as = $(".ed-addsec", p); if (as) as.onclick = () => {
        closePop(); const key = "sec-" + Date.now().toString(36);
        change(s2 => { get(s2, sp.arr).splice(sp.i + 1, 0, { key, label: "New section" }); s2.artworks.push({ cat: key, title: "Untitled", medium: "", year: YEAR, image: "", ratio: 0.78, hue: hue() }); });
        requestAnimationFrame(() => { const el2 = $(`#a-${CSS.escape(key)}`); if (el2) { el2.scrollIntoView({ behavior: "smooth", block: "center" }); el2.classList.add("ed-new"); const t = $("[data-e]", el2); if (t) setTimeout(() => startText(t, true), 350); } });
      };
      const ds = $(".ed-delsec", p); if (ds) ds.onclick = () => {
        closePop(); const key = o.key;
        change(s2 => { get(s2, sp.arr).splice(sp.i, 1); s2.artworks = s2.artworks.filter(a => a.cat !== key); });
        toast("Section deleted", true);
      };
    };
    draw();
  }
  function closePopQuiet() { if (!pop) return; const p = pop; pop = null; popAnchor = null; p.remove(); }

  /* ---------- case-study sections ---------- */
  const thumb = inner => `<svg viewBox="0 0 52 34" fill="none">${inner}</svg>`;
  const L = (x, y, w, o = 1) => `<rect x="${x}" y="${y}" width="${w}" height="2.6" rx="1.3" fill="currentColor" opacity="${o}"/>`;
  const BOX = (x, y, w, h, o = .22, r = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="currentColor" opacity="${o}"/>`;
  const LAYOUTS = [
    ["text", "Text", thumb(L(4, 6, 14, .7) + L(24, 6, 24, .35) + L(24, 12, 22, .35) + L(24, 18, 24, .35) + L(24, 24, 16, .35)), () => ({ type: "text", label: "Section", title: "", body: [""] })],
    ["image", "Wide image", thumb(BOX(4, 5, 44, 20) + L(16, 28, 20, .35)), () => ({ type: "image", image: "", caption: "", ratio: 1.85 })],
    ["gallery", "Photo row", thumb(BOX(4, 8, 9.5, 14) + BOX(15.5, 8, 9.5, 14) + BOX(27, 8, 9.5, 14) + BOX(38.5, 8, 9.5, 14) + L(16, 27, 20, .35)), () => ({ type: "gallery", images: [{}, {}, {}, {}], caption: "" })],
    ["two", "Two images", thumb(BOX(4, 6, 21, 17) + BOX(27, 6, 21, 17) + L(16, 27, 20, .35)), () => ({ type: "gallery", images: [{}, {}], caption: "" })],
    ["feature", "Highlight", thumb(L(4, 5, 10, .5) + L(4, 10, 18, .8) + `<rect x="6" y="15" width="12" height="15" rx="2" transform="rotate(-6 12 22)" fill="currentColor" opacity=".22"/>` + L(28, 8, 20, .35) + L(28, 14, 18, .35) + L(28, 20, 20, .35)), () => ({ type: "feature", label: "Highlight", title: "", subtitle: "", image: "", sideLabel: "Team", people: [], body: [""] })],
    ["mission", "Mission", thumb(L(4, 6, 10, .5) + L(4, 12, 18, .8) + L(4, 17, 16, .8) + L(28, 6, 20, .35) + L(28, 12, 18, .35) + L(28, 18, 20, .35)), () => ({ type: "mission", label: "The Mission", statement: "", body: [""] })],
    ["callout", "Note box", thumb(BOX(4, 7, 44, 20, .14, 5) + `<circle cx="12" cy="17" r="3" fill="currentColor" opacity=".5"/>` + L(19, 13, 22, .45) + L(19, 19, 16, .3)), () => ({ type: "callout", emoji: "✦", text: "", sub: "" })],
    ["divider", "Divider", thumb(`<rect x="4" y="16" width="44" height="1.5" rx=".75" fill="currentColor" opacity=".5"/>`), () => ({ type: "divider" })]
  ];
  function openSectionMenu(line, P, at) {
    line.classList.add("on");
    const p = openPop(line.querySelector("span") || line, `${head("Add a section")}<div class="ed-menu">${LAYOUTS.map(([k, l, svg]) => `<button type="button" data-l="${k}">${svg}<span>${l}</span></button>`).join("")}</div>`, "wide");
    p._onClose = () => line.classList.remove("on");
    $$("[data-l]", p).forEach(b => b.onclick = () => {
      const L2 = LAYOUTS.find(x => x[0] === b.dataset.l);
      closePop();
      change(s => { const pr = get(s, P); pr.blocks = pr.blocks || []; pr.blocks.splice(at, 0, L2[3]()); }, { refresh: { modalOnly: true } });
      requestAnimationFrame(() => {
        const el = $(`[data-b="${CSS.escape(P + ".blocks." + at)}"]`); if (!el) return;
        el.classList.add("ed-new"); setTimeout(() => el.classList.remove("ed-new"), 600);
        const r = el.getBoundingClientRect(); if (r.bottom > innerHeight - 60 || r.top < 60) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
        const t = $$("[data-e]", el).find(x => !/\.(emoji|label)$/.test(x.dataset.e)), m = $("[data-m]", el);
        if (t && b.dataset.l !== "image") setTimeout(() => startText(t), 420);
        else if (m) setTimeout(() => openMedia(m, m.dataset.m, m), 420);
      });
    });
  }

  boot();
})();
