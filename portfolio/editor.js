/* ============================================================
   Portfolio editor: sign in at  #login , then pencil buttons appear
   on every section. Changes save to:
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
        await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } });
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
  let store = null, editing = false, status = "saved", booted = false;
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
    if (store && ls.get("pf-login-pending")) { ls.del("pf-login-pending"); if (await store.canEdit()) { ls.set(EDIT, "1"); location.hash = "work"; } }
    if (store && ls.get(EDIT) === "1" && await store.canEdit()) startEditing();
    route();
  }
  window.addEventListener("hashchange", route);
  function route() { if (location.hash === "#login") showLogin(); else hideLogin(); }

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
      <a class="ed-login-back" href="#work">← Back to site</a></div>`;
    document.body.appendChild(el);
    document.documentElement.classList.add("locked");
    const btn = $(".ed-login-btn", el), err = $(".ed-login-err", el);
    btn.addEventListener("click", async () => {
      btn.disabled = true; $("span", btn).textContent = store.kind === "supabase" ? "Redirecting…" : "Checking…"; err.hidden = true;
      try {
        const ok = await store.signIn();
        if (ok === "redirect") return;
        if (!ok) throw new Error("This account isn't allowed to edit this portfolio.");
        ls.set(EDIT, "1"); startEditing(); location.hash = "work";
      } catch (e) {
        err.textContent = e.message || String(e); err.hidden = false;
        btn.disabled = false; $("span", btn).textContent = store.signInLabel;
      }
    });
  }
  function hideLogin() { const el = $(".ed-login"); if (el) { el.remove(); if (!$(".pm")) document.documentElement.classList.remove("locked"); } }

  /* ---------- edit mode: bar + pencils ---------- */
  const ICON = {
    pen: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 3.6a2 2 0 0 1 2.8 2.8L7 15.8l-3.5.7.7-3.5 9.4-9.4Z"/></svg>',
    eye: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1.7 10S4.6 4.5 10 4.5 18.3 10 18.3 10 15.4 15.5 10 15.5 1.7 10 1.7 10Z"/><circle cx="10" cy="10" r="2.6"/></svg>',
    eyeOff: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 3l14 14M8.2 4.7A8.6 8.6 0 0 1 10 4.5c5.4 0 8.3 5.5 8.3 5.5a14 14 0 0 1-2.6 3.3M5.6 6.4C3 8 1.7 10 1.7 10S4.6 15.5 10 15.5c1.3 0 2.5-.3 3.5-.8M8.2 8.2a2.6 2.6 0 0 0 3.6 3.6"/></svg>',
    trash: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 11a1 1 0 0 0 1 .9h6.4a1 1 0 0 0 1-.9l.8-11"/></svg>',
    chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>',
    up: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 10 4-4 4 4"/></svg>',
    down: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m4 6 4 4 4-4"/></svg>',
    x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    upload: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10.5V2.5M4.8 5.5 8 2.3l3.2 3.2M2.5 10.5v2a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-2"/></svg>',
    back: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 6 8l4 4"/></svg>',
    plus: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
    check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3.5 8.5 3 3 6-7"/></svg>'
  };
  const ZONES = [
    ["#header .intro", "profile", "Edit profile"],
    ["#view .grid", "projects", "Edit projects"],
    ["#view .card[data-slug]", el => "project:" + el.dataset.slug, "Edit project", ".frame"],
    ["#view .art-col", "art", "Edit art"],
    ["#view #hi", "hi", "Edit intro"],
    ["#view #experience", "experience", "Edit experience"],
    ["#view #community", "communities", "Edit communities"],
    ["#view #philosophy", "quotes", "Edit quotes"],
    ["#view #shelf", "shelf", "Edit shelf"],
    ["#view #lore", "lore", "Edit lore"],
    ["#footer .foot-grid", "contact", "Edit contact & footer"],
    [".pm-card", () => "project:" + window.APP.project(), "Edit this project"]
  ];
  let mo = null, decoTimer = 0;
  function decorate() {
    if (!editing) return;
    for (const [sel, panel, tip, inner] of ZONES) {
      $$(sel).forEach(zone => {
        const host = inner ? $(inner, zone) || zone : zone;
        if ($(":scope > .ed-pen", host)) return;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        host.classList.add("ed-zone");
        const b = document.createElement("button");
        b.className = "ed-pen ptr"; b.innerHTML = ICON.pen; b.dataset.tip = tip; b.setAttribute("aria-label", tip);
        b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); openPanel(typeof panel === "function" ? panel(zone) : panel); }, true);
        host.appendChild(b);
      });
    }
  }
  function startEditing() {
    if (editing) return;
    editing = true;
    document.body.classList.add("ed-on");
    const bar = document.createElement("div");
    bar.className = "ed-bar";
    bar.innerHTML = `<button class="ed-b ed-prev ptr">${ICON.eye}<span>Preview</span></button>
      <span class="ed-status" data-s="saved">Saved</span>
      ${store.canExport ? `<button class="ed-b ed-export ptr" data-tip="Download content.js with your edits">Export</button>` : ""}
      <button class="ed-b ed-out ptr">Sign out</button>`;
    document.body.appendChild(bar);
    $(".ed-prev", bar).addEventListener("click", () => {
      const on = document.body.classList.toggle("ed-preview");
      $(".ed-prev span", bar).textContent = on ? "Edit" : "Preview";
      $(".ed-prev", bar).innerHTML = (on ? ICON.pen : ICON.eye) + `<span>${on ? "Edit" : "Preview"}</span>`;
    });
    $(".ed-out", bar).addEventListener("click", async () => {
      if (status === "unsaved" && !confirm("You have unsaved changes. Sign out anyway?")) return;
      try { await store.signOut(); } catch {}
      ls.del(EDIT); stopEditing();
    });
    const ex = $(".ed-export", bar);
    if (ex) ex.addEventListener("click", exportContent);
    $(".ed-status", bar).addEventListener("click", () => { if (status === "error" && lastFailed) commit(lastFailed); });
    decorate();
    mo = new MutationObserver(() => { clearTimeout(decoTimer); decoTimer = setTimeout(decorate, 40); });
    mo.observe(document.body, { childList: true, subtree: true });
  }
  function stopEditing() {
    editing = false;
    document.body.classList.remove("ed-on", "ed-preview");
    if (mo) mo.disconnect();
    $$(".ed-pen").forEach(b => b.remove());
    $$(".ed-zone").forEach(z => z.classList.remove("ed-zone"));
    const bar = $(".ed-bar"); if (bar) bar.remove();
    closeDrawer(true);
  }
  function setStatus(s, msg) {
    status = s;
    const el = $(".ed-status"); if (!el) return;
    el.dataset.s = s;
    el.textContent = msg || { saved: "Saved", saving: "Saving…", unsaved: "Unsaved", error: "Not saved · retry" }[s];
  }

  /* ---------- save ---------- */
  let lastFailed = null;
  async function commit(next) {
    const keep = clone(next); delete keep.backend;
    window.APP.refresh(merge(next, { backend: DEFAULTS.backend }));
    ls.set(CACHE, JSON.stringify(keep));
    setStatus("saving");
    try { await store.save(keep); lastFailed = null; setStatus("saved"); }
    catch (e) { console.error(e); lastFailed = next; setStatus("error"); toast("Couldn't save: " + (e.message || e)); }
  }
  function exportContent() {
    const site = clone(window.APP.site);
    const body = "/* Exported from the editor " + new Date().toLocaleString() + " */\nwindow.SITE = " + JSON.stringify(site, null, 2) + ";\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/javascript" }));
    a.download = "content.js"; document.body.appendChild(a); a.click(); a.remove();
  }
  function toast(msg) {
    const t = document.createElement("div"); t.className = "ed-toast"; t.textContent = msg;
    document.body.appendChild(t); requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 3600);
  }

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
    return el;
  }
  const get = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
  const set = (o, p, v) => { const ks = p.split("."); let t = o; ks.slice(0, -1).forEach(k => { if (t[k] == null || typeof t[k] !== "object") t[k] = {}; t = t[k]; }); t[ks[ks.length - 1]] = v; };

  /* ---------- drawer ---------- */
  let D = null; // { draft, stack:[{title, build}], dirty }
  function openPanel(name) {
    if (!editing) return;
    const draft = D ? D.draft : clone(window.APP.site);
    if (!D) mountDrawer(draft);
    D.stack = [];
    pushPanel(name);
  }
  function mountDrawer(draft) {
    const shade = h("div", { class: "ed-shade", onclick: () => cancel() });
    const el = h("aside", { class: "ed-drawer", role: "dialog", "aria-modal": "true" },
      h("header", { class: "ed-dh" }, h("button", { class: "ed-back ptr", html: ICON.back, "aria-label": "Back", onclick: () => popPanel() }), h("h2"), h("button", { class: "ed-x ptr", html: ICON.x, "aria-label": "Close", onclick: () => cancel() })),
      h("div", { class: "ed-db" }),
      h("footer", { class: "ed-df" }, h("button", { class: "ed-cancel ptr", onclick: () => cancel() }, "Cancel"), h("button", { class: "ed-save ptr", onclick: () => save() }, "Save changes")));
    document.body.append(shade, el);
    D = { draft, stack: [], dirty: false, el, shade };
    el.addEventListener("input", () => markDirty());
    el.addEventListener("change", () => markDirty());
    requestAnimationFrame(() => { shade.classList.add("show"); el.classList.add("show"); });
  }
  function markDirty() { if (D && !D.dirty) { D.dirty = true; setStatus("unsaved"); } }
  function pushPanel(name) { D.stack.push(name); drawPanel(); }
  function popPanel() { if (D.stack.length > 1) { D.stack.pop(); drawPanel(); } }
  function drawPanel() {
    const name = D.stack[D.stack.length - 1];
    const p = PANELS(name, D.draft);
    if (!p) return;
    $("h2", D.el).textContent = p.title;
    $(".ed-back", D.el).style.display = D.stack.length > 1 ? "" : "none";
    const body = $(".ed-db", D.el);
    body.innerHTML = ""; body.scrollTop = 0;
    body.append(fields(D.draft, p.fields));
  }
  function save() {
    if (!D) return;
    const next = D.draft, wasDirty = D.dirty;
    const proj = window.APP.project();
    (next.projects || []).forEach(p => { p.slug = uniqueSlug(p.slug || p.title, next.projects, p); });
    closeDrawer();
    if (!wasDirty) { if (status === "unsaved") setStatus("saved"); return; }
    if (proj && !next.projects.some(p => p.slug === proj)) location.hash = window.APP.route() || "work";
    commit(next);
  }
  function cancel() {
    if (D && D.dirty && !confirm("Discard your changes?")) return;
    closeDrawer();
    if (status === "unsaved") setStatus("saved");
  }
  function closeDrawer(now) {
    if (!D) return;
    const { el, shade } = D; D = null;
    el.classList.remove("show"); shade.classList.remove("show");
    if (now) { el.remove(); shade.remove(); } else setTimeout(() => { el.remove(); shade.remove(); }, 300);
  }
  window.addEventListener("keydown", e => {
    if (!D) return;
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); cancel(); }
    if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); }
  }, true);

  /* ---------- form fields ---------- */
  function fields(obj, defs) {
    const wrap = h("div", { class: "ed-fields" });
    for (const d of defs) if (d) wrap.append(field(obj, d));
    return wrap;
  }
  function labelled(d, control) {
    return h("label", { class: "ed-f" + (d.wide ? " wide" : "") }, d.label ? h("span", { class: "ed-l" }, d.label) : null, control, d.hint ? h("small", { class: "ed-h" }, d.hint) : null);
  }
  function field(obj, d) {
    switch (d.t) {
      case "row": return h("div", { class: "ed-row" }, d.fields.map(f => field(obj, f)));
      case "note": return h("p", { class: "ed-note", html: d.html });
      case "head": return h("p", { class: "ed-sub" }, d.label);
      case "button": return h("button", { class: "ed-link ptr", type: "button", onclick: d.onclick }, d.label, h("span", { html: "&nbsp;→" }));
      case "text": case "number": {
        const i = h("input", { class: "ed-in", type: d.t === "number" ? "number" : "text", step: d.step || "any", placeholder: d.ph || "" });
        i.value = get(obj, d.k) ?? "";
        i.addEventListener("input", () => { set(obj, d.k, d.t === "number" ? (i.value === "" ? undefined : +i.value) : i.value); d.onInput && d.onInput(i.value); });
        return labelled(d, i);
      }
      case "area": case "paras": case "lines": {
        const v = get(obj, d.k);
        const ta = h("textarea", { class: "ed-in ed-ta", rows: d.rows || 3, placeholder: d.ph || "" });
        ta.value = d.t === "paras" ? (v || []).join("\n\n") : d.t === "lines" ? (v || []).join("\n") : (v ?? "");
        const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight + 2, 420) + "px"; };
        ta.addEventListener("input", () => {
          const x = ta.value;
          set(obj, d.k, d.t === "paras" ? x.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean) : d.t === "lines" ? x.split("\n") : x);
          fit();
        });
        requestAnimationFrame(fit);
        return labelled(d, ta);
      }
      case "select": {
        const sel = h("select", { class: "ed-in ed-sel" }, (typeof d.opts === "function" ? d.opts() : d.opts).map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v }, l); }));
        sel.value = get(obj, d.k) ?? (d.def ?? "");
        sel.addEventListener("change", () => { set(obj, d.k, sel.value); d.onChange && d.onChange(sel.value); });
        return labelled(d, sel);
      }
      case "toggle": {
        const i = h("input", { type: "checkbox", class: "ed-tg" }); i.checked = !!get(obj, d.k);
        i.addEventListener("change", () => set(obj, d.k, i.checked));
        return h("label", { class: "ed-toggle ptr" }, i, h("span", { class: "ed-sw" }), h("span", null, d.label));
      }
      case "image": return imageField(obj, d);
      case "tags": return tagsField(obj, d);
      case "list": return listField(obj, d);
      case "pairs": return pairsField(obj, d);
      case "stack": return stackField(obj, d);
      case "dyn": { const tgt = d.on || obj, box = h("div", { class: "ed-dyn" }); const draw = () => { box.innerHTML = ""; box.append(fields(tgt, d.defs(tgt, draw))); }; draw(); return box; }
    }
    return h("div");
  }
  function imageField(obj, d) {
    const prev = h("div", { class: "ed-thumb" });
    const url = h("input", { class: "ed-in ed-url", placeholder: "or paste an image / video link" });
    const msg = h("small", { class: "ed-h" }, d.hint || "");
    const draw = () => {
      const v = get(obj, d.k) || "";
      prev.innerHTML = ""; url.value = v.startsWith("data:") ? "" : v;
      if (v) prev.append(/\.(mp4|webm|mov)(\?|$)/i.test(v) ? h("video", { src: v, muted: true, autoplay: true, loop: true, playsinline: true }) : h("img", { src: v, alt: "" }));
      rm.style.display = v ? "" : "none";
    };
    const file = h("input", { type: "file", accept: d.accept || "image/*,video/*", hidden: true });
    const up = h("button", { class: "ed-btn ptr", type: "button", onclick: () => file.click() }, h("span", { html: ICON.upload }), d.btn || "Replace image");
    const rm = h("button", { class: "ed-btn ed-ghost ptr", type: "button", onclick: () => { set(obj, d.k, ""); draw(); markDirty(); } }, "Remove");
    file.addEventListener("change", async () => {
      const f = file.files[0]; if (!f) return;
      up.disabled = true; msg.textContent = "Uploading…";
      try { set(obj, d.k, await store.upload(f)); msg.textContent = d.hint || ""; draw(); markDirty(); }
      catch (e) { msg.textContent = e.message || "Upload failed"; msg.classList.add("err"); }
      up.disabled = false; file.value = "";
    });
    url.addEventListener("input", () => { set(obj, d.k, url.value.trim()); clearTimeout(url._t); url._t = setTimeout(draw, 400); });
    const el = h("div", { class: "ed-f" }, h("span", { class: "ed-l" }, d.label || "Image"), h("div", { class: "ed-img" }, prev, h("div", { class: "ed-img-act" }, h("div", { style: "display:flex;gap:8px" }, up, rm), url)), msg, file);
    draw();
    return el;
  }
  const TOOLS = ["Figma", "Framer", "Webflow", "Sketch", "Adobe Illustrator", "Adobe Photoshop", "After Effects", "Adobe XD", "Blender", "Spline", "Rive", "Principle", "ProtoPie", "Notion", "Miro", "FigJam", "Linear", "Jira", "Trello", "Airtable", "Cursor", "Claude", "ChatGPT", "VS Code", "GitHub", "Vercel", "Netlify", "Supabase", "Firebase", "React", "Next.js", "Vue", "Svelte", "TypeScript", "JavaScript", "Tailwind CSS", "Motion", "GSAP", "Three.js", "Vite", "Node.js", "Python", "Swift", "SwiftUI", "Unity", "Shopify", "Stripe", "Amplitude", "Mixpanel", "Zeplin", "Wix", "Substack", "Typeform", "Canva"];
  function tagsField(obj, d) {
    const arr = () => { let v = get(obj, d.k); if (!Array.isArray(v)) { v = []; set(obj, d.k, v); } return v; };
    const search = h("input", { class: "ed-in", placeholder: d.ph || "Search or type and press Enter" });
    const count = h("small", { class: "ed-h" });
    const chips = h("div", { class: "ed-chips" });
    const draw = () => {
      const v = arr(), q = search.value.trim().toLowerCase();
      count.textContent = `${v.length} selected`;
      const all = [...v, ...(d.suggest || TOOLS).filter(t => !v.includes(t))];
      chips.innerHTML = "";
      all.filter(t => !q || t.toLowerCase().includes(q)).forEach(t => {
        const on = v.includes(t);
        chips.append(h("button", { type: "button", class: "ed-chip ptr" + (on ? " on" : ""), onclick: () => { const a = arr(); on ? a.splice(a.indexOf(t), 1) : a.push(t); markDirty(); draw(); } }, t, h("span", { html: on ? ICON.check : ICON.plus })));
      });
      if (q && !all.some(t => t.toLowerCase() === q)) chips.append(h("button", { type: "button", class: "ed-chip add ptr", onclick: () => addCustom() }, `Add “${search.value.trim()}”`, h("span", { html: ICON.plus })));
    };
    const addCustom = () => { const t = search.value.trim(); if (!t) return; const a = arr(); if (!a.includes(t)) a.push(t); search.value = ""; markDirty(); draw(); };
    search.addEventListener("input", draw);
    search.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } });
    draw();
    return h("div", { class: "ed-f" }, d.label ? h("span", { class: "ed-l" }, d.label) : null, search, count, chips);
  }
  function listField(obj, d) {
    const box = h("div", { class: "ed-list" });
    const arr = () => { let v = get(obj, d.k); if (!Array.isArray(v)) { v = []; set(obj, d.k, v); } if (d.norm) v.forEach((x, i) => v[i] = d.norm(x)); return v; };
    let open = new Set(d.openFirst && arr().length ? [arr()[0]] : []);
    const draw = () => {
      box.innerHTML = "";
      const v = arr();
      v.forEach((it, i) => {
        const title = h("span", { class: "ed-it-t" }, d.title(it, i) || "Untitled");
        const isOpen = open.has(it);
        const body = isOpen ? h("div", { class: "ed-it-b" }, fields(it, typeof d.fields === "function" ? d.fields(it, draw) : d.fields)) : null;
        if (body) body.addEventListener("input", () => title.textContent = d.title(it, i) || "Untitled");
        const head = h("div", { class: "ed-it-h" },
          h("button", { type: "button", class: "ed-it-tg ptr" + (isOpen ? " open" : ""), onclick: () => { isOpen ? open.delete(it) : open.add(it); draw(); } }, h("span", { class: "ed-chev", html: ICON.chev }), title),
          h("div", { class: "ed-it-a" },
            d.hide !== false ? h("button", { type: "button", class: "ed-ib ptr" + (it.hidden ? " off" : ""), html: it.hidden ? ICON.eyeOff : ICON.eye, "data-tip": it.hidden ? "Hidden — click to show" : "Hide", onclick: () => { it.hidden = !it.hidden; markDirty(); draw(); } }) : null,
            i > 0 ? h("button", { type: "button", class: "ed-ib ptr", html: ICON.up, "data-tip": "Move up", onclick: () => { v.splice(i - 1, 0, v.splice(i, 1)[0]); markDirty(); draw(); } }) : null,
            i < v.length - 1 ? h("button", { type: "button", class: "ed-ib ptr", html: ICON.down, "data-tip": "Move down", onclick: () => { v.splice(i + 1, 0, v.splice(i, 1)[0]); markDirty(); draw(); } }) : null,
            h("button", { type: "button", class: "ed-ib ptr", html: ICON.trash, "data-tip": "Delete", onclick: () => { if (confirm(`Delete “${d.title(it, i) || "this item"}”?`)) { v.splice(i, 1); markDirty(); draw(); } } })));
        box.append(h("div", { class: "ed-it" + (it.hidden ? " is-hidden" : "") + (isOpen ? " is-open" : "") }, head, body));
      });
      box.append(h("button", { type: "button", class: "ed-add ptr", onclick: () => { const n = d.make(v); v.push(n); open.add(n); markDirty(); draw(); requestAnimationFrame(() => { const last = box.querySelector(".ed-it:last-of-type"); last && last.scrollIntoView({ block: "nearest", behavior: "smooth" }); }); } }, "+ " + (d.add || "Add")));
    };
    draw();
    return h("div", { class: "ed-f" }, d.label ? h("span", { class: "ed-l" }, d.label) : null, d.hint ? h("small", { class: "ed-h", style: "margin-top:-2px" }, d.hint) : null, box);
  }
  function pairsField(obj, d) {
    const box = h("div", { class: "ed-pairs" });
    const draw = () => {
      let v = get(obj, d.k); if (!Array.isArray(v)) { v = []; set(obj, d.k, v); }
      box.innerHTML = "";
      v.forEach((pr, i) => {
        const a = h("input", { class: "ed-in", placeholder: d.ph1 || "Label" }); a.value = pr[0] || "";
        const b = h("textarea", { class: "ed-in ed-ta", rows: 1, placeholder: d.ph2 || "Value (Enter for a new line)" }); b.value = pr[1] || "";
        a.addEventListener("input", () => pr[0] = a.value); b.addEventListener("input", () => pr[1] = b.value);
        box.append(h("div", { class: "ed-pair" }, a, b, h("button", { type: "button", class: "ed-ib ptr", html: ICON.trash, onclick: () => { v.splice(i, 1); markDirty(); draw(); } })));
      });
      box.append(h("button", { type: "button", class: "ed-add ptr", onclick: () => { v.push(["", ""]); markDirty(); draw(); } }, "+ " + (d.add || "Add row")));
    };
    draw();
    return h("div", { class: "ed-f" }, h("span", { class: "ed-l" }, d.label), box);
  }
  function stackField(obj, d) {
    // [[group, [items]]] edited as a list of {group, items}
    let v = get(obj, d.k); if (!Array.isArray(v)) { v = []; set(obj, d.k, v); }
    const proxy = { rows: v.map(([g, items]) => ({ g, items: [...(items || [])] })) };
    const sync = () => set(obj, d.k, proxy.rows.filter(r => !r.hidden).map(r => [r.g || "", r.items]));
    const el = listField(proxy, { k: "rows", label: d.label, hide: false, add: "Add group", title: r => r.g || "Group", make: () => ({ g: "New group", items: [] }), fields: [{ t: "text", k: "g", label: "Group name", ph: "e.g. Frontend" }, { t: "tags", k: "items", label: "Tools" }] });
    el.addEventListener("input", sync); el.addEventListener("click", () => setTimeout(sync));
    return el;
  }

  /* ---------- panels ---------- */
  const YEAR = String(new Date().getFullYear());
  const slugify = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  const uniqueSlug = (base, list, self) => { let s = slugify(base), n = 2; while (list.some(p => p !== self && p.slug === s)) s = slugify(base) + "-" + n++; return s; };
  const ICONS_SOCIAL = [["linkedin", "LinkedIn"], ["x", "X"], ["instagram", "Instagram"], ["github", "GitHub"], ["spark", "Luma / Other"]];
  const viewOnFields = [{ t: "row", fields: [{ t: "text", k: "viewOn.label", label: "Button text", ph: "View on" }, { t: "select", k: "viewOn.icon", label: "Icon", opts: [["", "None"], ...ICONS_SOCIAL] }] }, { t: "text", k: "viewOn.href", label: "Button link", ph: "https://" }];
  const BLOCKS = [["mission", "Mission (statement + text)"], ["text", "Text section"], ["feature", "Highlight (tilted photo + team)"], ["image", "Wide image"], ["gallery", "Photo row (4)"], ["callout", "Grey note box"], ["divider", "Divider line"]];
  function blockFields(b, redraw) {
    const type = { t: "select", k: "type", label: "Section type", opts: BLOCKS, onChange: () => redraw() };
    const by = {
      mission: [{ t: "text", k: "label", label: "Small label", ph: "The Mission" }, { t: "area", k: "statement", label: "Big statement" }, { t: "paras", k: "body", label: "Text", hint: "Leave a blank line between paragraphs.", rows: 5 }],
      text: [{ t: "text", k: "label", label: "Small label" }, { t: "text", k: "title", label: "Title" }, { t: "paras", k: "body", label: "Text", hint: "Blank line = new paragraph.", rows: 5 }],
      feature: [{ t: "text", k: "label", label: "Small label" }, { t: "text", k: "title", label: "Title" }, { t: "text", k: "subtitle", label: "Subtitle" }, { t: "image", k: "image", label: "Photo (tilted)", btn: "Replace photo" },
        { t: "text", k: "sideLabel", label: "People label", ph: "Team" }, { t: "list", k: "people", label: "People", hide: false, add: "Add person", title: p => p.name, make: () => ({ name: "", href: "" }), fields: [{ t: "text", k: "name", label: "Name" }, { t: "text", k: "href", label: "Link" }] },
        { t: "paras", k: "body", label: "Text", hint: "Blank line = new paragraph.", rows: 5 }],
      image: [{ t: "image", k: "image", label: "Image or video", btn: "Replace" }, { t: "number", k: "ratio", label: "Shape (width ÷ height)", hint: "1.85 is wide, 1 is square", step: ".01" }, { t: "text", k: "caption", label: "Caption" }],
      gallery: [{ t: "list", k: "images", label: "Photos", hide: false, add: "Add photo", title: (x, i) => "Photo " + (i + 1), make: () => ({ image: "" }), fields: [{ t: "image", k: "image", label: "Photo" }] }, { t: "text", k: "caption", label: "Caption" }],
      callout: [{ t: "text", k: "emoji", label: "Emoji", ph: "🔒" }, { t: "area", k: "text", label: "Main line" }, { t: "text", k: "sub", label: "Smaller line", hint: "Links: [email me](mailto:you@site.com)" }],
      divider: [{ t: "note", html: "A thin line between sections." }]
    };
    return [type, ...(by[b.type] || [])];
  }
  function projectFields(p, all, redraw) {
    const common = [
      { t: "image", k: "image", label: "Card image or video", btn: "Replace thumbnail", hint: "Shown on the Work page card and at the top of the case study." },
      { t: "row", fields: [{ t: "text", k: "title", label: "Title" }, { t: "text", k: "year", label: "Year" }] },
      { t: "area", k: "description", label: "Short description", hint: "Shows under the card on hover." },
      { t: "select", k: "type", label: "When someone clicks it", opts: [["case", "Open a case study"], ["side", "Open a side-project window"], ["embed", "Open a live demo (embed)"], ["link", "Go straight to a link"]], onChange: () => redraw() },
      { t: "text", k: "slug", label: "Address name", hint: `The page address becomes #p-${p.slug || "name"}. Letters, numbers and dashes.` }
    ];
    const by = {
      case: [
        { t: "image", k: "logo", label: "Logo", btn: "Replace logo" },
        { t: "pairs", k: "facts", label: "Facts row", add: "Add fact", ph1: "e.g. Role", ph2: "e.g. Product Design" },
        { t: "list", k: "blocks", label: "Case study sections", hint: "Shown in this order under the hero image.", add: "Add section", title: b => (BLOCKS.find(x => x[0] === b.type) || ["", "Section"])[1].split(" (")[0] + (b.title || b.label ? " · " + (b.title || b.label) : ""), make: () => ({ type: "text", label: "", title: "", body: [] }), fields: (b, r) => [{ t: "dyn", defs: (o, rr) => blockFields(o, rr) }] }
      ],
      side: [{ t: "text", k: "site", label: "Website link (link icon)", ph: "https://" }, ...viewOnFields, { t: "stack", k: "stack", label: "Tools used" },
        { t: "image", k: "preview.image", label: "Big preview image", btn: "Replace image" }, { t: "number", k: "preview.ratio", label: "Preview shape (width ÷ height)", step: ".01" },
        { t: "list", k: "more", label: "More images", hide: false, add: "Add image", title: (x, i) => "Image " + (i + 1), make: () => ({ image: "", ratio: 1.5 }), fields: [{ t: "image", k: "image", label: "Image" }, { t: "number", k: "ratio", label: "Shape (width ÷ height)", step: ".01" }] }],
      embed: [{ t: "text", k: "embed", label: "Live demo link", ph: "https://your-app.com", hint: "Shown inside the window. The site must allow being embedded." }, ...viewOnFields, { t: "stack", k: "stack", label: "Tools used (info panel)" }, { t: "image", k: "preview.image", label: "Info panel preview", btn: "Replace image" }],
      link: [{ t: "text", k: "href", label: "Link", ph: "https://" }]
    };
    return [...common, ...(by[p.type] || [])];
  }
  function newProject(list) {
    const p = { slug: "", type: "case", title: "New project", year: YEAR, description: "", image: "", hue: Math.floor(Math.random() * 360),
      facts: [["Year", YEAR], ["Role", ""], ["Org", ""], ["With", ""]], blocks: [{ type: "mission", label: "The Mission", statement: "", body: [] }] };
    p.slug = uniqueSlug("new-project", list, p);
    return p;
  }
  function photoListFields() {
    return { t: "list", k: "photos", label: "Photos", hide: false, add: "Add photo", title: (x, i) => x.caption || "Photo " + (i + 1), make: () => ({ caption: "", shape: "tall", image: "" }),
      fields: [{ t: "image", k: "image", label: "Photo" }, { t: "row", fields: [{ t: "text", k: "caption", label: "Caption" }, { t: "select", k: "shape", label: "Shape", opts: [["tall", "Portrait"], ["wide", "Landscape"]] }] }] };
  }
  function communityItem() {
    return [{ t: "image", k: "logo", label: "Logo", btn: "Replace logo" }, { t: "row", fields: [{ t: "text", k: "name", label: "Name" }, { t: "text", k: "link", label: "Instagram link" }] }, { t: "area", k: "desc", label: "Description" }, photoListFields()];
  }
  function PANELS(name, S) {
    if (name.startsWith("project:")) {
      const slug = name.slice(8);
      const p = S.projects.find(x => x.slug === slug);
      if (!p) return { title: "Project", fields: [{ t: "note", html: "This project no longer exists." }] };
      return { title: p.title || "Project", fields: [{ t: "dyn", on: p, defs: (o, r) => projectFields(p, S.projects, r) }] };
    }
    switch (name) {
      case "profile": return { title: "Profile", fields: [
        { t: "image", k: "logo", label: "Logo", btn: "Replace logo", hint: "Square image. Leave empty to show your initials in the stamp." },
        { t: "row", fields: [{ t: "text", k: "name", label: "Name" }, { t: "text", k: "initials", label: "Initials" }] },
        { t: "lines", k: "tagline.work", label: "Intro on Work page", rows: 2, hint: "One line per row. Links: [Company](https://company.com)" },
        { t: "lines", k: "tagline.art", label: "Intro on Art page", rows: 2 },
        { t: "lines", k: "tagline.about", label: "Intro on About page", rows: 2 },
        { t: "row", fields: [{ t: "text", k: "bornYear", label: "Next to name on Art", ph: "b. 2000" }, { t: "text", k: "domain", label: "Your domain", ph: "yourname.com" }] }] };
      case "projects": return { title: "Projects", fields: [
        { t: "list", k: "projects", add: "Add project", openFirst: true, title: p => p.title, make: v => newProject(v),
          fields: (p) => [{ t: "image", k: "image", label: "Thumbnail", btn: "Replace thumbnail" }, { t: "row", fields: [{ t: "text", k: "title", label: "Title" }, { t: "text", k: "year", label: "Year" }] }, { t: "area", k: "description", label: "Short description" },
            { t: "button", label: "Edit full project (case study, links, type)", onclick: () => { if (!p.slug) p.slug = uniqueSlug(p.title, S.projects, p); pushPanel("project:" + p.slug); } }] }] };
      case "art": {
        const cats = () => S.artGroups.flatMap(g => (g.children || []).map(c => [c.key, `${g.label} › ${c.label}`]));
        return { title: "Art", fields: [
          { t: "list", k: "artworks", label: "Artworks", add: "Add artwork", title: a => a.title, make: () => ({ cat: (cats()[0] || [""])[0], title: "Untitled", medium: "", year: YEAR, image: "", ratio: 0.78 }),
            fields: [{ t: "image", k: "image", label: "Image", btn: "Replace image" }, { t: "row", fields: [{ t: "text", k: "title", label: "Title" }, { t: "text", k: "year", label: "Year" }] }, { t: "text", k: "medium", label: "Medium & size", ph: "Oil on Canvas, 30\" x 40\"" },
              { t: "row", fields: [{ t: "select", k: "cat", label: "Section", opts: cats }, { t: "number", k: "ratio", label: "Shape (w ÷ h)", step: ".01" }] }] },
          { t: "list", k: "artGroups", label: "Menu groups & sections", add: "Add group", title: g => g.label, make: () => ({ label: "New group", children: [{ key: "section-" + Date.now().toString(36), label: "New section" }] }),
            fields: [{ t: "text", k: "label", label: "Group name" }, { t: "list", k: "children", label: "Sections", hide: false, add: "Add section", title: c => c.label, make: () => ({ key: "section-" + Date.now().toString(36), label: "New section" }),
              fields: [{ t: "text", k: "label", label: "Section name" }, { t: "row", fields: [{ t: "text", k: "link.label", label: "Corner link text", ph: "3D Gallery" }, { t: "text", k: "link.href", label: "Corner link", ph: "https://" }] }] }] }] };
      }
      case "hi": return { title: "Intro", fields: [
        { t: "image", k: "hi.photo", label: "Photo", btn: "Replace photo" }, { t: "text", k: "hi.photoCaption", label: "Photo caption" },
        { t: "text", k: "hi.heading", label: "Heading" },
        { t: "list", k: "hi.meta", label: "Details row", hide: false, add: "Add detail", title: m => m.text, make: () => ({ icon: "pin", text: "" }), fields: [{ t: "row", fields: [{ t: "select", k: "icon", label: "Icon", opts: [["pin", "Location"], ["cap", "Education"]] }, { t: "text", k: "text", label: "Text" }] }] },
        { t: "paras", k: "hi.paragraphs", label: "Bio", rows: 7, hint: "Blank line = new paragraph. **bold**, [link](https://)" }] };
      case "experience": return { title: "Experience", fields: [
        { t: "list", k: "experience", add: "Add experience", title: x => x.org + (x.years ? " · " + x.years : ""), make: () => ({ org: "New role", years: YEAR + " - Present", logo: "" }),
          fields: [{ t: "image", k: "logo", label: "Logo", btn: "Replace logo" }, { t: "row", fields: [{ t: "text", k: "org", label: "Company" }, { t: "text", k: "years", label: "Dates", ph: "2023 - Present" }] }, { t: "text", k: "sub", label: "Extra line (optional)", hint: "e.g. Clients include [Name](https://)" }] }] };
      case "communities": return { title: "Communities", fields: [
        { t: "row", fields: [{ t: "text", k: "communitiesTitle", label: "Title" }, { t: "text", k: "communitiesSub", label: "Subtitle" }] },
        { t: "list", k: "communities", label: "Communities", add: "Add community", title: c => c.name, make: () => ({ name: "New community", link: "", desc: "", photos: [{ caption: "", shape: "tall" }, { caption: "", shape: "wide" }, { caption: "", shape: "wide" }, { caption: "", shape: "tall" }] }), fields: communityItem() },
        { t: "list", k: "archive", label: "Archive (collapsed)", add: "Add to archive", title: c => c.name, make: () => ({ name: "Old community", link: "", desc: "", photos: [] }), fields: communityItem() }] };
      case "quotes": return { title: "Quotes", fields: [
        { t: "row", fields: [{ t: "text", k: "quotesTitle", label: "Title" }, { t: "text", k: "quotesSub", label: "Subtitle" }] },
        { t: "list", k: "quotes", label: "Cards", add: "Add quote", title: q => q.title, make: () => ({ emoji: "✨", title: "New principle", text: "", author: "" }),
          fields: [{ t: "row", fields: [{ t: "text", k: "emoji", label: "Emoji" }, { t: "text", k: "author", label: "Author" }] }, { t: "text", k: "title", label: "Title" }, { t: "area", k: "text", label: "Quote" }] }] };
      case "shelf": return { title: "Shelf", fields: [
        { t: "row", fields: [{ t: "text", k: "shelfTitle", label: "Title" }, { t: "text", k: "shelfSub", label: "Subtitle" }] },
        { t: "list", k: "shelves", label: "Rows", add: "Add row", title: s => s.name, make: () => ({ name: "New row", shape: "book", link: { label: "", href: "" }, filters: [{ label: "★ Favorites", items: [] }] }),
          fields: [{ t: "row", fields: [{ t: "text", k: "name", label: "Row name" }, { t: "select", k: "shape", label: "Cover shape", opts: [["book", "Tall (books, films)"], ["square", "Square (music)"]] }] },
            { t: "row", fields: [{ t: "text", k: "link.label", label: "Corner link text", ph: "Goodreads" }, { t: "text", k: "link.href", label: "Corner link" }] },
            { t: "list", k: "filters", label: "Filter pills", hide: false, add: "Add pill", title: f => f.label + " · " + (f.items || []).length, make: () => ({ label: YEAR, items: [] }),
              fields: [{ t: "text", k: "label", label: "Pill text" }, { t: "list", k: "items", label: "Covers (first 5 show)", hide: false, add: "Add cover", norm: x => typeof x === "string" ? { title: x } : x, title: x => x.title, make: () => ({ title: "Title", image: "" }), fields: [{ t: "text", k: "title", label: "Title" }, { t: "image", k: "image", label: "Cover", btn: "Replace cover" }] }] }] }] };
      case "lore": return { title: "Lore", fields: [
        { t: "row", fields: [{ t: "text", k: "loreTitle", label: "Title" }, { t: "text", k: "loreSub", label: "Subtitle" }] },
        { t: "list", k: "lore", label: "Cards", add: "Add card", title: l => l.title, make: () => ({ title: "New", year: YEAR, desc: "", href: "", image: "" }),
          fields: [{ t: "image", k: "image", label: "Image", btn: "Replace image" }, { t: "row", fields: [{ t: "text", k: "title", label: "Title" }, { t: "text", k: "year", label: "Year" }] }, { t: "text", k: "desc", label: "One line" }, { t: "text", k: "href", label: "Link" }] }] };
      case "contact": return { title: "Contact & footer", fields: [
        { t: "text", k: "email", label: "Email" },
        { t: "row", fields: [{ t: "text", k: "city", label: "City" }, { t: "text", k: "timezone", label: "Time zone", ph: "Asia/Kolkata", hint: "For the live clock" }] },
        { t: "list", k: "socials", label: "Social links", add: "Add link", title: s => (ICONS_SOCIAL.find(x => x[0] === s.icon) || [, s.icon])[1] + (s.label ? " · " + s.label : ""), make: () => ({ icon: "linkedin", href: "" }),
          fields: [{ t: "row", fields: [{ t: "select", k: "icon", label: "Icon", opts: ICONS_SOCIAL }, { t: "text", k: "label", label: "Tooltip (optional)" }] }, { t: "text", k: "href", label: "Link", ph: "https://" }] },
        { t: "text", k: "credit", label: "Footer line", hint: "Links: [text](https://)" },
        { t: "row", fields: [{ t: "text", k: "changelog.label", label: "Small caps line" }, { t: "text", k: "changelog.href", label: "Its link" }] }] };
    }
    return null;
  }

  boot();
})();
