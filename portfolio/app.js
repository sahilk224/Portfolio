(function () {
  "use strict";
  let S = window.SITE;
  const vis = a => (a || []).filter(x => x && !x.hidden);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ext = h => /^https?:/.test(h || "") ? ' target="_blank" rel="noopener"' : "";
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\[(.+?)\]\((.+?)\)/g, (m, t, h) => `<a class="inline-link" href="${h}"${ext(h)}>${t}</a>`);
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------- icons (drawn for this site) ---------- */
  const I = {
    chain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/></svg>',
    arrow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11 11 5M6 5h5v5"/></svg>',
    chev: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 4 4 4-4 4"/></svg>',
    close: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    expand: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 3.5h4v4M7.5 14.5h-4v-4M14.5 3.5 10 8M3.5 14.5 8 10"/></svg>',
    shrink: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8h-4V4M4 10h4v4M10 8l4.5-4.5M8 10l-4.5 4.5"/></svg>',
    info: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="10" cy="10" r="7.25"/><path d="M10 9v4.5"/><circle cx="10" cy="6.5" r=".6" fill="currentColor"/></svg>',
    cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>',
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.3C.4 8.4 2.3 4.5 6 4.5c2.2 0 3.6 1.2 4.4 2.4h3.2c.8-1.2 2.2-2.4 4.4-2.4 3.7 0 5.6 3.9 4 7.2C19.5 16.4 12 21 12 21Z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/></svg>',
    cap: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 1 9l11 6 9-4.9V17h2V9L12 3Zm-6 9.2V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-3.8l-6 3.3-6-3.3Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 7v8h2.5v-8H7Zm1.25-4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM11 10v8h2.5v-4.2c0-1.1.4-1.9 1.5-1.9s1.3.9 1.3 2V18H19v-4.8c0-2.4-1.2-3.4-3-3.4-1.3 0-2.1.6-2.5 1.3V10H11Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 3h3.1l-6.8 7.8 8 10.2h-6.3l-4.9-6.4L5 21H1.9l7.3-8.3L1.5 3h6.4l4.4 5.9L17.5 3Zm-1.1 16.2h1.7L7.2 4.7H5.4l11 14.5Z"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>',
    github: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.6 2.4 1.1 3 .9.1-.7.4-1.1.6-1.4-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.3 4.7-4.6 5 .4.3.7.9.7 1.9V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z"/></svg>'
  };

  const NAMES = { linkedin: "LinkedIn", x: "X", instagram: "Instagram", spark: "Luma", github: "GitHub" };

  /* ---------- media: image / video / gradient placeholder ---------- */
  function media(o, cls = "", style = "", inner = "") {
    o = typeof o === "string" ? { title: o } : (o || {});
    const real = o.image || o.video;
    const st = `--h:${o.hue ?? (Math.abs([...String(o.title || "x")].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)) % 360)};${style}`;
    let el = "";
    if (o.video) el = `<video src="${esc(o.video)}" autoplay muted loop playsinline></video>`;
    else if (o.image) el = `<img src="${esc(o.image)}" alt="${esc(o.title || "")}" loading="lazy" decoding="async">`;
    return `<div class="media ${real ? "" : "ph loaded"} ${o.gray ? "gray" : ""} ${cls}" style="${st}">${real ? '<div class="shimmer"></div>' : ""}${el}${inner}</div>`;
  }
  function wireMedia(root) {
    $$(".media img, .media video", root).forEach(m => {
      const done = () => m.parentNode.classList.add("loaded");
      if (m.tagName === "IMG" ? m.complete && m.naturalWidth : m.readyState >= 2) done();
      else { m.addEventListener(m.tagName === "IMG" ? "load" : "loadeddata", done, { once: true }); m.addEventListener("error", done, { once: true }); }
    });
  }

  /* ---------- scroll reveal ---------- */
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  }), { rootMargin: "0px 0px -40px 0px", threshold: 0.05 }) : null;
  function wireReveal(root) {
    $$(".reveal, .reveal-fade", root).forEach(el => io ? io.observe(el) : el.classList.add("in"));
  }
  const d = (i, step = 0.08, max = 0.8) => `transition-delay:${Math.min(i * step, max).toFixed(2)}s`;

  /* ---------- shell: header + footer ---------- */
  function renderShell() {
  const logo = S.logo ? `<img src="${esc(S.logo)}" alt="">` : `<div class="stamp round">${esc(S.initials)}</div>`;
  $("#header").innerHTML = `
    <div class="hero">
      <div class="topbar"><a class="logo" href="#design-system" data-route="design-system" aria-label="Open the design system">${logo}</a></div>
      <div class="intro">
        <p class="name"><span id="nm">${esc(S.name)}</span><small id="born" hidden>${esc(S.bornYear)}</small></p>
        <div class="tagline" id="tag"></div>
      </div>
    </div>
    <div class="tabs-wrap">
      <nav class="tabs" id="tabs">
        <div class="tab-ind" id="ind"></div>
        <a class="tab" href="#work" data-route="work"><span>Work</span></a>
        <a class="tab" href="#art" data-route="art"><span>Art</span></a>
        <a class="tab" href="#about" data-route="about"><span>About</span></a>
      </nav>
      <div class="rule"></div>
    </div>`;

  const sm = `<div class="foot-bottom reveal-fade" style="transition-delay:.2s">
      <p>${md(S.credit)}</p>
      <a class="cl" href="${esc(S.changelog.href)}"${ext(S.changelog.href)}>${esc(S.changelog.label)}</a></div>`;
  $("#footer").innerHTML = `
    <div class="foot">
      <div class="foot-top reveal">
        <div class="rule"></div>
        <div class="foot-grid">
          <div><a class="f-brand" href="#work" data-route="work">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : `<div class="stamp round">${esc(S.initials)}</div>`}<b>${esc(S.name)}</b></a>
            <p class="f-clock">${I.sun}<span id="clk"></span><span class="city">${esc(S.city)}</span></p></div>
          <div class="f-links"><a href="#work" data-route="work">Work</a><a href="#art" data-route="art">Art</a><a href="#about" data-route="about">About</a></div>
          <div class="f-contact">
            <div><p class="chat">Let's chat!</p><a class="f-mail" href="mailto:${esc(S.email)}"><span>${esc(S.email)}</span>${I.arrow}</a></div>
            <div class="socials">${vis(S.socials).map(s => `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.label || NAMES[s.icon] || s.icon)}" data-tip="${esc(s.label || NAMES[s.icon] || s.icon)}">${I[s.icon] || I.arrow}</a>`).join("")}</div>
          </div>
        </div>
      </div>
      ${sm}
    </div>`;
  tick();
  wireReveal($("#footer"));
  }
  function tick() {
    let t;
    try { t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: S.timezone }); }
    catch { t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
    const [hm, ap] = t.split(" "), [h, m] = hm.split(":");
    $("#clk").innerHTML = `${h}<span class="colon">:</span>${m} ${ap}`;
  }
  renderShell(); setInterval(tick, 10000);

  /* ---------- tab indicator ---------- */
  function moveInd(route, instant) {
    const ind = $("#ind");
    const t = $(`.tab[data-route="${route}"]`);
    if (!t) return;
    if (instant) ind.style.transition = "none";
    ind.style.transform = `translate3d(${t.offsetLeft}px,0,0)`;
    ind.style.width = t.offsetWidth + "px";
    ind.style.height = t.offsetHeight + "px";
    if (instant) { ind.offsetWidth; ind.style.transition = ""; }
    $$(".tab").forEach(x => x.classList.toggle("active", x === t));
  }

  /* ---------- views ---------- */
  const view = $("#view");
  let cleanup = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); cleanup.push(() => el.removeEventListener(ev, fn, o)); };

  function renderWork() {
    view.innerHTML = `<div class="grid">${vis(S.projects).map((p, i) => `
      <${p.type === "link" ? `a href="${esc(p.href || "#")}"${ext(p.href)}` : `a href="#p-${esc(p.slug)}" data-proj="${esc(p.slug)}"`} class="card" data-slug="${esc(p.slug || "")}" style="animation-delay:${(Math.floor(i / 2) * 0.06).toFixed(2)}s">
        <div class="frame">
          ${media(p, "", "", !p.image && !p.video ? `<div class="ph-mark">${esc(p.title)}</div>` : "")}
          <div class="edge"></div>
          <div class="pillwrap"><div class="pill">${esc(p.title)}<i>&nbsp;• ${esc(p.year)}</i></div></div>
        </div>
        <div class="below"><p class="hover-text">${esc(p.description || "")}</p>${p.type !== "case" ? `<span class="ext hover-text">${I.chain}</span>` : ""}</div>
        <div class="mob"><div class="l"><span>${esc(p.title)} <i>• ${esc(p.year)}</i></span>${p.type !== "case" ? `<span class="ext">${I.chain}</span>` : ""}</div>${p.description ? `<p>${esc(p.description)}</p>` : ""}</div>
      </a>`).join("")}</div>`;
  }

  // sidebar: items = [{label, id, count?, children?:[...]}]
  function sideHTML(items, depth = 0) {
    return items.map(it => {
      const pad = depth === 1 ? "sub" : depth >= 2 ? "sub2" : "";
      const ct = it.count != null ? `<span class="ct">${it.count}</span>` : "";
      if (!it.children) return `<button class="s-item ptr ${pad}" data-go="${it.id}"><span>${esc(it.label)}${ct}</span></button>`;
      return `<div class="s-group" data-group="${it.id}">
        <button class="s-item ptr ${pad}" data-go="${it.id}"><span>${esc(it.label)}${ct}</span>${it.chev ? I.chev : ""}</button>
        <div class="collapse"><div><div>${sideHTML(it.children, depth + 1)}</div></div></div></div>`;
    }).join("");
  }
  function wireSide(items) {
    const flat = [];
    const walk = (arr, parents) => arr.forEach(it => { flat.push({ id: it.id, parents }); if (it.children) walk(it.children, [...parents, it.id]); });
    walk(items, []);
    $$("[data-go]", view).forEach(b => on(b, "click", () => {
      const el = document.getElementById(b.dataset.go);
      if (!el) return;
      // open archive if needed
      const arch = el.closest(".archive");
      if (arch && !arch.classList.contains("open")) arch.classList.add("open");
      setTimeout(() => window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 32, behavior: "smooth" }), arch ? 220 : 0);
    }));
    const targets = flat.map(f => ({ ...f, el: document.getElementById(f.id) })).filter(f => f.el);
    const spy = () => {
      const line = Math.min(window.innerHeight * 0.3, 260);
      let cur = targets[0];
      for (const t of targets) if (t.el.offsetParent !== null && t.el.getBoundingClientRect().top - line <= 0) cur = t;
      if (window.innerHeight + scrollY >= document.body.scrollHeight - 4) cur = targets.filter(t => t.el.offsetParent !== null && !t.parents.length).pop() || cur;
      const openIds = new Set([...(cur ? cur.parents : []), cur && cur.id]);
      $$(".s-item", view).forEach(b => b.classList.toggle("on", !!cur && b.dataset.go === cur.id));
      $$(".s-group", view).forEach(g => {
        const id = g.dataset.group;
        g.classList.toggle("open", openIds.has(id));
        g.classList.toggle("on", openIds.has(id) && cur.id !== id);
      });
    };
    on(window, "scroll", spy, { passive: true });
    on(window, "resize", spy);
    spy();
  }

  function renderArt() {
    const count = k => vis(S.artworks).filter(a => a.cat === k).length;
    const side = vis(S.artGroups).map(g => ({ id: "g-" + slug(g.label), label: g.label, children: vis(g.children).map(c => ({ id: "a-" + c.key, label: c.label, count: count(c.key) })) }));
    const list = S.artworks.map(a => a.hidden ? { ...a, cat: "__hidden" } : a);
    view.innerHTML = `<div class="split">
      <aside class="side"><nav>${sideHTML(side)}</nav></aside>
      <div class="content"><div class="art-col">
        ${vis(S.artGroups).map(g => `<div id="g-${slug(g.label)}" style="display:flex;flex-direction:column;gap:48px;scroll-margin-top:32px">${vis(g.children).map(c => `
          <section class="art-sec" id="a-${c.key}">
            <div class="art-head reveal-fade"><p>${esc(c.label)}</p>${c.link ? `<a class="reveal-fade" style="transition-delay:.4s" href="${esc(c.link.href)}"${ext(c.link.href)}>${esc(c.link.label)} ${I.cube}</a>` : ""}</div>
            <div class="art-grid">${list.map((a, i) => a.cat !== c.key ? "" : `
              <div class="art-item reveal"><button class="art-btn ptr" data-i="${i}">
                ${media(a, "", `aspect-ratio:${a.ratio || 0.78}`)}
                <p><b>${esc(a.title)}</b> ${esc(a.medium)}, ${esc(a.year)}</p></button></div>`).join("")}</div>
          </section>`).join("")}</div>`).join("")}
      </div></div></div>`;
    $$(".art-btn", view).forEach(b => on(b, "click", () => {
      const cat = list[b.dataset.i].cat;
      const set = list.map((a, i) => ({ ...a, i })).filter(a => a.cat === cat);
      openLB(set.map(a => ({ ...a, cap: `<b>${esc(a.title)}</b> ${esc(a.medium)}, ${esc(a.year)}` })), set.findIndex(a => a.i == b.dataset.i));
    }));
    wireSide(side);
  }

  const OFFS = [
    [[0, -16, -2], [-8, 48, 2], [0, 64, -1.5], [16, 16, 2.5]],
    [[-8, 24, 1.5], [-24, 8, -2], [-8, 32, 2], [0, -16, -2.5]],
    [[0, 0, -2], [8, 40, 1.5], [0, 0, 2], [0, 16, -1.5]],
    [[-24, 0, 2], [-8, 48, -2], [-8, 24, 1.5], [16, -8, -2]]
  ];
  function commHTML(c, ci, delay) {
    const off = OFFS[ci % OFFS.length];
    return `<div class="comm" id="c-${slug(c.name)}"><div class="reveal" style="${d(delay, 0.1)}"><div class="comm-in">
      <div class="comm-head">
        <div class="comm-name">${c.logo ? `<div class="avatar"><img src="${esc(c.logo)}" alt=""></div>` : `<div class="avatar ph round" style="--h:${ci * 70 + 20}">${esc(c.name[0])}</div>`}
          <h3>${esc(c.name)}</h3>${c.link ? `<a href="${esc(c.link)}"${ext(c.link)} aria-label="Instagram">${I.instagram}</a>` : ""}</div>
        <p>${md(c.desc)}</p>
      </div>
      <div class="photos"><div class="photo-band">${c.photos.map((p, i) => {
        const [x, y, r] = off[i % 4];
        return `<div class="photo ${p.shape === "wide" ? "wide" : "tall"} ptr" data-c="${esc(c.name)}" data-p="${i}" style="transform:translate(${x}px,${y}px)">
          <div class="tilt" style="transform:rotate(${r}deg)"><div class="pf">${media({ ...p, hue: p.hue ?? ci * 70 + i * 25 + 10 })}</div><p>${esc(p.caption)}</p></div></div>`;
      }).join("")}</div></div>
    </div><div class="comm-rule"></div></div></div>`;
  }

  function renderAbout() {
    const H = S.hi;
    const side = [
      { id: "hi", label: "Hi!" },
      { id: "experience", label: "Experience" },
      { id: "community", label: "Community", children: [
        ...vis(S.communities).map(c => ({ id: "c-" + slug(c.name), label: c.name })),
        ...(vis(S.archive).length ? [{ id: "archive", label: "Archive", chev: true, children: vis(S.archive).map(c => ({ id: "c-" + slug(c.name), label: c.name })) }] : [])
      ] },
      { id: "philosophy", label: "Philosophy" },
      { id: "shelf", label: "Shelf", children: vis(S.shelves).map(s => ({ id: "s-" + slug(s.name), label: s.name, count: s.filters.reduce((a, f) => a + f.items.length, 0) })) },
      { id: "lore", label: "Lore" }
    ];
    view.innerHTML = `<div class="split">
      <aside class="side"><nav>${sideHTML(side)}</nav></aside>
      <div class="content"><div class="about-col">
        <section class="sec hi" id="hi">
          <div class="reveal"><div class="hi-left">
            <div class="hi-photo ptr" id="hiPhoto"><div class="pol">${media({ image: H.photo, hue: 280, title: "photo" })}</div></div>
            <div class="hi-cap">${md(H.photoCaption)}</div></div></div>
          <div class="hi-right">
            <div class="reveal-fade"><h2 class="h2">${esc(H.heading)}</h2></div>
            <div class="reveal-fade"><div class="meta">${vis(H.meta).map(m => `<span>${I[m.icon] || ""}<span>${esc(m.text)}</span></span>`).join("")}</div></div>
            <div class="reveal-fade"><div class="prose">${vis(H.paragraphs).map(p => `<p>${md(p)}</p>`).join("")}</div></div>
          </div>
        </section>

        <section class="sec exp" id="experience">
          <div class="reveal-fade"><h2>Experience</h2></div>
          <div class="exp-list">${vis(S.experience).map((x, i) => `<div class="reveal" style="${d(i)}"><div class="exp-item">
            ${x.logo ? `<div class="avatar"><img src="${esc(x.logo)}" alt=""></div>` : `<div class="avatar ph round ${x.gray ? "gray" : ""}" style="--h:${x.hue ?? 0}">${esc(x.org[0])}</div>`}
            <div class="exp-t"><div class="exp-row"><b>${esc(x.org)}</b><span>${esc(x.years)}</span></div>${x.sub ? `<small>${md(x.sub)}</small>` : ""}</div>
          </div></div>`).join("")}</div>
        </section>

        <section class="sec comm-sec" id="community">
          <div class="reveal-fade"><div class="sec-head"><h2>${esc(S.communitiesTitle)}</h2><p>${esc(S.communitiesSub)} ${I.heart}</p></div></div>
          <div class="comm-list">
            ${vis(S.communities).map((c, i) => commHTML(c, i, i)).join("")}
            ${vis(S.archive).length ? `<div class="archive s-group" id="archive">
              <button class="archive-btn ptr" id="archBtn"><span>Archive</span>${I.chev}</button>
              <div class="collapse"><div><div>${vis(S.archive).map((c, i) => commHTML(c, i + S.communities.length, 0)).join("")}</div></div></div></div>` : ""}
          </div>
        </section>

        <section class="sec quotes" id="philosophy">
          <div class="reveal-fade"><div class="sec-head"><h2>${esc(S.quotesTitle)}</h2><p>${esc(S.quotesSub)}</p></div></div>
          <div class="q-grid">${vis(S.quotes).map((q, i) => `<div class="reveal" style="${d(i)};height:100%"><div class="q-card"><div class="q-in">
            <p class="em">${esc(q.emoji)}</p><h4>${esc(q.title)}</h4><div><p class="qt">${md(q.text)}</p><p class="qa">${esc(q.author)}</p></div>
          </div></div></div>`).join("")}</div>
        </section>

        <section class="sec shelf" id="shelf">
          <div class="reveal-fade"><div class="sec-head"><h2>${esc(S.shelfTitle)}</h2><p>${esc(S.shelfSub)}</p></div></div>
          <div class="shelf-rows">${vis(S.shelves).map((s, si) => `<div class="s-row" id="s-${slug(s.name)}"><div class="reveal" style="${d(si + 1, 0.1)}">
            <div class="s-bar"><div class="s-bar-top">
              <div class="f-pills" data-shelf="${si}"><div class="f-ind"></div>${s.filters.map((f, fi) => `<button class="f-pill ptr ${fi ? "" : "active"}" data-f="${fi}"><span>${esc(f.label)} <i>${f.items.length}</i></span></button>`).join("")}</div>
              ${s.link ? `<a class="s-link" href="${esc(s.link.href)}"${ext(s.link.href)}>${esc(s.link.label)} ${I.arrow}</a>` : ""}
            </div><div class="rule"></div></div>
            <div class="s-items" id="si-${si}"></div>
          </div></div>`).join("")}</div>
        </section>

        <section class="sec lore" id="lore">
          <div class="reveal-fade"><div class="sec-head"><h2>${esc(S.loreTitle)}</h2><p>${esc(S.loreSub)}</p></div></div>
          <div class="l-grid">${vis(S.lore).map((l, i) => `<div class="reveal" style="${d(i % 3)}"><a class="l-card" href="${esc(l.href || "#")}"${ext(l.href)}>
            ${media({ hue: l.hue, gray: l.gray, title: l.title }, "", "", l.image ? `<div class="scl" style="background:url('${esc(l.image)}') center/cover"></div>` : `<div class="scl"></div>`)}
            <div class="l-txt"><div class="l-top"><b>${esc(l.title)} <i>• ${esc(l.year)}</i></b>${I.arrow}</div><p>${md(l.desc)}</p></div>
          </a></div>`).join("")}</div>
        </section>
      </div></div></div>`;

    // shelves
    vis(S.shelves).forEach((s, si) => {
      const wrap = $(`.f-pills[data-shelf="${si}"]`, view), fi = $(".f-ind", wrap), box = $("#si-" + si, view);
      const show = (k, first) => {
        const b = $(`.f-pill[data-f="${k}"]`, wrap);
        $$(".f-pill", wrap).forEach(x => x.classList.toggle("active", x === b));
        if (first) fi.style.transition = "none";
        fi.style.transform = `translate3d(${b.offsetLeft}px,0,0)`; fi.style.width = b.offsetWidth + "px";
        if (first) { fi.offsetWidth; fi.style.transition = ""; }
        box.innerHTML = s.filters[k].items.slice(0, 5).map((it, i) => {
          const o = typeof it === "string" ? { title: it } : it;
          return `<div class="s-it ${s.shape === "square" ? "square" : "book"}" style="animation-delay:${(i * 0.04).toFixed(2)}s" title="${esc(o.title)}">${media(o)}<p>${esc(o.title)}</p></div>`;
        }).join("");
        wireMedia(box);
      };
      $$(".f-pill", wrap).forEach(b => on(b, "click", () => show(+b.dataset.f)));
      requestAnimationFrame(() => show(0, true));
    });
    // archive toggle
    const ab = $("#archBtn", view);
    if (ab) on(ab, "click", () => $("#archive", view).classList.toggle("open"));
    // lightboxes
    on($("#hiPhoto", view), "click", () => openLB([{ image: H.photo, hue: 280, ratio: 0.75, cap: md(H.photoCaption) }], 0));
    $$(".photo", view).forEach(p => on(p, "click", () => {
      const c = [...vis(S.communities), ...vis(S.archive)].find(x => x.name === p.dataset.c);
      openLB(c.photos.map((ph, i) => ({ ...ph, ratio: ph.shape === "wide" ? 1.2 : 0.83, hue: ph.hue ?? 30 + i * 25, cap: esc(ph.caption) })), +p.dataset.p);
    }));
    wireSide(side);
  }

  /* ---------- lightbox ---------- */
  let lbEl = null;
  function openLB(items, idx) {
    closeLB(true);
    lbEl = document.createElement("div");
    lbEl.className = "lb";
    const draw = () => {
      const it = items[idx];
      lbEl.innerHTML = `<div class="bd"></div><button class="ghost ptr" aria-label="Close">${I.close}</button>
        <figure>${media(it, "", `aspect-ratio:${it.ratio || 0.78}`)}<figcaption>${it.cap || ""}</figcaption></figure>`;
      wireMedia(lbEl);
      $(".ghost", lbEl).onclick = e => { e.stopPropagation(); closeLB(); };
    };
    draw();
    lbEl.addEventListener("click", e => { if (!e.target.closest(".media")) closeLB(); });
    lbEl._key = e => {
      if (e.key === "Escape") closeLB();
      if (e.key === "ArrowRight" && idx < items.length - 1) { idx++; draw(); }
      if (e.key === "ArrowLeft" && idx > 0) { idx--; draw(); }
    };
    document.addEventListener("keydown", lbEl._key);
    document.body.appendChild(lbEl);
    document.documentElement.style.overflow = "hidden";
  }
  function closeLB(now) {
    if (!lbEl) return;
    const el = lbEl; lbEl = null;
    document.removeEventListener("keydown", el._key);
    document.documentElement.style.overflow = "";
    if (now) return el.remove();
    el.classList.add("out");
    setTimeout(() => el.remove(), 200);
  }

  /* ---------- tooltips ---------- */
  let tipEl = null, tipFor = null;
  document.addEventListener("mouseover", e => {
    const t = e.target.closest("[data-tip]");
    if (t === tipFor) return;
    if (tipEl) { const old = tipEl; old.classList.remove("show"); setTimeout(() => old.remove(), 130); tipEl = null; }
    tipFor = t;
    if (!t || matchMedia("(hover:none)").matches) return;
    tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.textContent = t.dataset.tip;
    document.body.appendChild(tipEl);
    const r = t.getBoundingClientRect(), w = tipEl.offsetWidth;
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
    tipEl.style.top = (r.bottom + 8) + "px";
    requestAnimationFrame(() => tipEl && tipEl.classList.add("show"));
  });
  const hideTip = () => { if (tipEl) { tipEl.remove(); tipEl = null; } tipFor = null; };
  document.addEventListener("pointerdown", () => { if (tipEl) { tipEl.remove(); tipEl = null; } }, true);

  /* ---------- project windows ---------- */
  const host = h => { try { return new URL(h).hostname.replace(/^www\./, ""); } catch { return h; } };
  const paras = arr => (arr || []).map(p => `<p>${md(p)}</p>`).join("");
  const stackHTML = st => `<div class="stack">${(st || []).map(([k, v]) => `<div><b>${esc(k)}</b><div>${v.map(x => `<span>${esc(x)}</span>`).join("")}</div></div>`).join("")}</div>`;
  const viewBtn = v => v ? `<a class="btn-p" href="${esc(v.href)}" target="_blank" rel="noopener"><span>${esc(v.label || "View")}</span>${v.icon && I[v.icon] ? I[v.icon] : ""}${I.arrow}</a>` : "";
  const R_ = (cls, inner, fade) => `<div class="cs"><div class="${fade ? "reveal-fade" : "reveal"}">${`<div class="${cls}">${inner}</div>`}</div></div>`;

  function blockHTML(b) {
    switch (b.type) {
      case "mission": return R_("cs-mission", `<div class="l"><p class="lbl">${esc(b.label || "The Mission")}</p><p class="st">${md(b.statement)}</p></div><div class="cs-prose">${paras(b.body)}</div>`);
      case "divider": return R_("cs-div", `<div class="hline"></div>`);
      case "feature": return R_("cs-feature", `<div class="l"><div class="hd"><p class="lbl">${esc(b.label || "")}</p><h3>${md(b.title)}</h3>${b.subtitle ? `<p>${md(b.subtitle)}</p>` : ""}</div>
          ${b.image !== undefined ? `<div class="pic"><div class="tw ptr" data-lb="1">${media({ image: b.image, hue: 280 })}</div></div>` : ""}</div>
        <div class="r">${b.people ? `<div class="ppl"><p class="lbl">${esc(b.sideLabel || "Team")}</p><div style="display:flex;flex-direction:column">${b.people.map(p => `<div><a href="${esc(p.href || "#")}"${ext(p.href)}>${esc(p.name)}</a></div>`).join("")}</div></div>` : ""}
          <div class="body">${paras(b.body)}</div></div>`);
      case "text": return R_("cs-text", `<div class="l"><p class="lbl">${esc(b.label || "")}</p>${b.title ? `<h3>${md(b.title)}</h3>` : ""}</div><div class="cs-prose">${paras(b.body)}</div>`);
      case "callout": return R_("cs-call", `<div class="panel"><div class="in"><div class="ic">${esc(b.emoji || "✦")}</div><div class="tx"><p>${md(b.text)}</p>${b.sub ? `<p>${md(b.sub)}</p>` : ""}</div></div></div>`);
      case "gallery": return R_("cs-gal", `<div class="g">${(b.images || []).map((im, i) => media({ ...im, hue: im.hue ?? 20 + i * 60 }, "ptr", "", "")).join("")}</div>${b.caption ? `<p>${md(b.caption)}</p>` : ""}`);
      case "image": return R_("cs-img", `${media({ image: b.image, video: b.video, hue: b.hue ?? 200 }, "", `aspect-ratio:${b.ratio || 1.85}`)}${b.caption ? `<p>${md(b.caption)}</p>` : ""}`);
      default: return "";
    }
  }
  function alsoHTML(p) {
    const pool = vis(S.projects).filter(x => x.slug !== p.slug && x.type !== "link");
    const start = S.projects.indexOf(p);
    const pick = [...pool.filter(x => S.projects.indexOf(x) > start), ...pool].slice(0, 2);
    if (!pick.length) return "";
    return `<div class="cs"><div class="reveal-fade"><div class="cs-also"><p>Also check out...</p><div class="g">${pick.map(x => `
      <a class="also" href="#p-${esc(x.slug)}" data-proj="${esc(x.slug)}"><div class="fr">${media(x)}</div>
        <div class="t"><span>${esc(x.title)} <i>• ${esc(x.year)}</i></span><p>${esc(x.description || "")}</p></div></a>`).join("")}</div></div></div></div>`;
  }
  function caseHTML(p) {
    return `<div class="pm-body swap">
      <div class="cs"><div class="cs-head">
        <div class="reveal-fade"><div class="cs-logo ${p.logo ? "" : "ph"}" style="--h:${p.hue ?? 260}">${p.logo ? `<img src="${esc(p.logo)}" alt="">` : esc(p.title[0])}</div></div>
        <div class="cs-tm"><div class="reveal-fade"><h1 class="cs-title">${esc(p.title)}</h1></div>
          <div class="cs-facts">${(p.facts || []).map(([k, v], i) => `<div class="reveal-fade" style="${d(i, .05)}"><b>${esc(k)}</b><span>${md(v)}</span></div>`).join("")}</div></div>
        <div class="reveal-fade"><div class="hline"></div></div>
        <div class="reveal"><div class="cs-hero">${media(p)}</div></div>
      </div></div>
      ${(p.blocks || []).map(blockHTML).join("")}
      ${alsoHTML(p)}
    </div>`;
  }
  function sideHTML_(p) {
    return `<div class="pm-body swap" style="padding:0"><div class="sp"><div class="sp-in">
      <header class="sp-head"><div class="sp-t"><h1>${esc(p.title)} <i>•</i> <i>${esc(p.year)}</i></h1>${p.description ? `<p>${md(p.description)}</p>` : ""}</div>
        <div class="sp-act">${p.site ? `<a class="ic-btn" href="${esc(p.site)}" target="_blank" rel="noopener" aria-label="${esc(host(p.site))}" data-tip="${esc(host(p.site))}">${I.chain}</a>` : ""}${viewBtn(p.viewOn)}</div></header>
      <div class="sp-meta"><div class="hline"></div>${stackHTML(p.stack)}</div>
      ${[p.preview || {}, ...(p.more || [])].map((m, i) => `<div class="sp-media">${media({ ...m, hue: m.hue ?? (p.hue ?? 200) + i * 30 }, "", `aspect-ratio:${m.ratio || 3248 / 2160}`)}</div>`).join("")}
    </div></div></div>`;
  }
  function embedHTML(p) {
    return `<div class="em-wrap">${p.embed ? `<iframe src="${esc(p.embed)}" title="${esc(p.title)}" loading="lazy" allow="fullscreen; clipboard-write"></iframe>`
      : `<div class="em-empty">${media(p)}<p>Set <b>embed</b> for “${esc(p.title)}” in content.js to show your live project here.</p></div>`}</div>`;
  }
  function popHTML(p) {
    return `<div class="pop"><div class="pop-in">
      <div class="pop-hd"><p>${esc(p.title)} <i>•</i> <i>${esc(p.year)}</i></p>${viewBtn(p.viewOn)}</div>
      <div class="hline"></div>${stackHTML(p.stack)}
      ${media({ ...(p.preview || {}), hue: p.hue })}
    </div></div>`;
  }

  let pm = null;
  function openProject(slug, full, fromRoute) {
    const p = S.projects.find(x => x.slug === slug);
    if (!p) return false;
    if (p.type === "link") { window.open(p.href, "_blank", "noopener"); return false; }
    hideTip();
    if (pm && pm.slug === slug) { setFull(full); return true; }
    if (pm) { // swap content in place (from "Also check out")
      pm.slug = slug;
      const sc = pm.el.querySelector(".pm-scroll");
      pm.el.classList.toggle("embed", p.type === "embed");
      fill(p); sc && (sc.scrollTop = 0); setFull(full);
      return true;
    }
    const el = document.createElement("div");
    el.className = "pm" + (p.type === "case" ? "" : " slow") + (p.type === "embed" ? " embed" : "");
    el.innerHTML = `<div class="pm-bd"></div><div class="pm-card" role="dialog" aria-modal="true" aria-label="${esc(p.title)}">
      <div class="pm-fade"></div>
      <div class="pm-tl"><button class="pm-exp ptr" aria-label="Expand" data-tip="Expand">${I.expand}</button></div>
      <div class="pm-tr" style="display:none"><div style="position:relative;display:inline-flex"><button class="pm-info ptr" aria-label="Project info" data-tip="Project info">${I.info}</button></div></div>
      <div class="pm-main" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></div>`;
    document.body.appendChild(el);
    pm = { el, slug, back: fromRoute || "work" };
    document.documentElement.classList.add("locked");
    el.querySelector(".pm-bd").addEventListener("click", () => closeProject());
    el.querySelector(".pm-exp").addEventListener("click", () => { const f = !el.classList.contains("full"); location.hash = "p-" + pm.slug + (f ? "-full" : ""); });
    el.querySelector(".pm-info").addEventListener("click", e => { e.stopPropagation(); togglePop(); });
    el.addEventListener("click", e => {
      const a = e.target.closest("[data-proj]");
      if (a) { e.preventDefault(); location.hash = "p-" + a.dataset.proj; return; }
      if (!e.target.closest(".pop, .pm-info")) togglePop(false);
      const lb = e.target.closest("[data-lb], .cs-gal .media");
      if (lb) { const m = lb.matches(".media") ? lb : lb.querySelector(".media"); openLB([{ image: m.querySelector("img")?.getAttribute("src") || "", hue: 280, ratio: 0.78, cap: "" }], 0); }
    });
    fill(p);
    setFull(full, true);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("show")));
    return true;
  }
  function fill(p) {
    const main = pm.el.querySelector(".pm-main");
    pm.el.querySelector(".pm-tr").style.display = p.type === "embed" ? "" : "none";
    togglePop(false);
    if (p.type === "embed") main.innerHTML = embedHTML(p);
    else main.innerHTML = `<div class="pm-scroll">${p.type === "case" ? caseHTML(p) : sideHTML_(p)}</div>`;
    const sc = main.querySelector(".pm-scroll");
    if (sc) { let t; sc.addEventListener("scroll", () => { sc.classList.add("scrolling"); clearTimeout(t); t = setTimeout(() => sc.classList.remove("scrolling"), 900); }, { passive: true }); }
    wireMedia(main); wireReveal(main);
    pm.el.querySelector(".pm-card").setAttribute("aria-label", p.title);
  }
  function togglePop(force) {
    if (!pm) return;
    const wrap = pm.el.querySelector(".pm-tr > div"), btn = pm.el.querySelector(".pm-info");
    const open = wrap.querySelector(".pop");
    const want = force === undefined ? !open : force;
    if (open && !want) { open.remove(); btn.classList.remove("on"); }
    if (!open && want) { const p = S.projects.find(x => x.slug === pm.slug); wrap.insertAdjacentHTML("beforeend", popHTML(p)); wireMedia(wrap); btn.classList.add("on"); }
  }
  function setFull(full, instant) {
    if (!pm) return;
    const el = pm.el, b = el.querySelector(".pm-exp");
    if (instant) { el.style.transition = "none"; el.querySelector(".pm-card").style.transition = "none"; }
    el.classList.toggle("full", !!full);
    b.innerHTML = full ? I.shrink : I.expand;
    b.dataset.tip = full ? "Collapse" : "Expand"; b.setAttribute("aria-label", b.dataset.tip);
    if (instant) { el.offsetWidth; el.style.transition = ""; el.querySelector(".pm-card").style.transition = ""; }
  }
  function closeProject(fromRouter) {
    if (!pm) return;
    const { el, back } = pm; pm = null; hideTip();
    el.classList.remove("show");
    setTimeout(() => { el.remove(); if (!pm) document.documentElement.classList.remove("locked"); }, el.classList.contains("slow") ? 500 : 400);
    if (!fromRouter) location.hash = back === "work" ? "work" : back;
  }
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || lbEl || !pm) return;
    const pop = pm.el.querySelector(".pop");
    if (pop) togglePop(false); else closeProject();
  });

  /* ---------- design system page ---------- */
  function renderDS() {
    const css = getComputedStyle(document.documentElement);
    const v = n => css.getPropertyValue(n).trim();
    const groups = [
      { name: "Primary", tag: "c", desc: "The neutral backbone (zinc).", items: [["--z900", "Headings, icons"], ["--z700", "Name, section headings"], ["--z600", "Active nav, body copy"], ["--z500", "Secondary body"], ["--z400", "Muted labels, captions"], ["--z300", "Counts, muted icons"], ["--z200", "Shimmer, borders"], ["--z100", "Dividers, pill borders"], ["--z50", "Soft fills"]] },
      { name: "Accent", tag: "c", desc: "Blue is the single accent for links, buttons, active states and selection.", items: [["--blue6", "Link hover"], ["--blue", "Links, buttons, active"], ["#60a5fa", "Button hover"], ["#dbeafe", "Selection background"]] },
      { name: "Header", tag: "o", desc: "The drifting header gradient.", items: [["#d5e0ff", "Gradient top"], ["#f5e2ff", "Gradient middle"], ["#fde9fa", "Gradient pink"]] }
    ];
    const col = c => c.startsWith("--") ? v(c) : c;
    const side = [["overview", "Overview"], ["color", "Color"], ["typography", "Typography"], ["spacing", "Spacing"], ["radius", "Borders"], ["shadows", "Shadows"], ["motion", "Motion"], ["components", "Components"]].map(([id, label]) => ({ id: "ds-" + id, label }));
    view.innerHTML = `<div class="split" style="padding-top:24px"><aside class="side"><nav>${sideHTML(side)}</nav></aside><div class="content"><div class="about-col" style="gap:72px">
      <section class="ds-sec" id="ds-overview"><div class="reveal-fade"><h1 class="ds-h1">Design System<span>${esc(S.domain || "")}</span></h1>
        <p class="ds-lead">The colors, type, space, motion and components behind this site. Everything here is read live from styles.css, so it stays in sync when you change a token.</p>
        <div class="ds-legend"><div><span class="chip c">Canonical</span>Core system</div><div><span class="chip o">One-off</span>Appears once</div><div><span class="chip e">Experiment</span>For an experiment</div></div></div></section>
      <section class="ds-sec" id="ds-color"><h2 class="reveal-fade">Color</h2>
        <div class="reveal"><div class="f-pills" id="dsPills"><div class="f-ind"></div>${["All", ...groups.map(g => g.name)].map((g, i) => `<button class="f-pill ptr ${i ? "" : "active"}" data-g="${g}"><span>${g}</span></button>`).join("")}</div></div>
        <div class="ds-sw reveal" id="dsSw"></div>
        ${groups.map(g => `<div class="ds-group reveal"><h3>${g.name} <span class="chip ${g.tag}">${g.tag === "c" ? "Canonical" : "One-off"}</span></h3><p>${g.desc}</p>
          ${g.items.map(([c, u]) => `<div class="ds-row"><i style="background:${col(c)}"></i><b>${c.startsWith("--") ? c.slice(2) : c}</b><span>${u}</span><code>${col(c).toUpperCase()}</code></div>`).join("")}</div>`).join("")}
      </section>
      <section class="ds-sec" id="ds-typography"><h2 class="reveal-fade">Typography</h2><div class="ds-type reveal">
        ${[["36 / 54 · 500", "font-size:36px;line-height:54px;font-weight:500;color:var(--z700)", "Name"], ["30 / 45 · 500", "font-size:30px;line-height:45px;font-weight:500;color:var(--z600)", "Section heading"], ["24 / 32 · 400", "font-size:24px;line-height:32px;color:var(--z900)", "Project title"], ["18 / 27 · 500", "font-size:18px;font-weight:500;color:var(--z600)", "Navigation"], ["16 / 24 · 400", "font-size:16px;color:var(--z600)", "Body copy"], ["14 / 20 · 400", "font-size:14px;color:var(--z400)", "Captions"], ["12 / 18 · caps", "font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:var(--z400)", "Changelog"]]
          .map(([c, st, t]) => `<div><code>${c}</code><span style="${st}">${t}</span></div>`).join("")}</div></section>
      <section class="ds-sec" id="ds-spacing"><h2 class="reveal-fade">Spacing</h2><div class="ds-bars reveal">${[4, 8, 12, 16, 20, 24, 32, 48, 64, 80, 128].map(n => `<div><code>${n}px</code><i style="width:${n * 3}px"></i></div>`).join("")}</div></section>
      <section class="ds-sec" id="ds-radius"><h2 class="reveal-fade">Borders</h2><div class="ds-tiles reveal">${[["4px", "Photos"], ["8px", "Small"], ["var(--r-art)", "Art, lore"], ["var(--r-quote)", "Quote cards"], ["var(--r-card)", "Cards, windows"], ["999px", "Pills"]].map(([r, l]) => `<div><i style="border-radius:${r}"></i>${l}</div>`).join("")}</div></section>
      <section class="ds-sec" id="ds-shadows"><h2 class="reveal-fade">Shadows</h2><div class="ds-tiles reveal">${[["0 2px 8px #0000000f", "Soft"], ["var(--shadow-media)", "Media"], ["var(--shadow-glass)", "Glass"], ["0 8px 24px #0000001f", "Elevated"]].map(([s, l]) => `<div><i style="box-shadow:${s};border-color:transparent;border-radius:16px"></i>${l}</div>`).join("")}</div></section>
      <section class="ds-sec" id="ds-motion"><h2 class="reveal-fade">Motion</h2><p class="reveal-fade" style="color:var(--z400)">Hover a row to play it.</p><div class="ds-motion reveal">
        ${[["Hover text · 300ms ease-out", ".3s ease-out"], ["Card enter · 450ms", ".45s cubic-bezier(.25,.46,.45,.94)"], ["Tab pill · 300ms ease-out", ".3s cubic-bezier(0,0,.2,1)"], ["Window · 400ms ease-out", ".4s cubic-bezier(0,0,.2,1)"], ["Lightbox · 280ms spring", ".28s cubic-bezier(.16,1,.3,1)"], ["Scroll reveal · 500ms", ".5s ease-out"]]
          .map(([l, t]) => `<div><span style="color:var(--z600)">${l}</span><div class="track"><span class="dot" style="transition:left ${t}"></span></div></div>`).join("")}</div></section>
      <section class="ds-sec" id="ds-components"><h2 class="reveal-fade">Components</h2><div class="ds-comp reveal">
        <a class="btn-p" href="#design-system">View on ${I.arrow}</a>
        <span class="pill">Label <i>&nbsp;• 2026</i></span>
        <button class="ic-btn ptr" data-tip="Tooltip">${I.chain}</button>
        <span class="tab active" style="position:relative;background:rgba(228,228,231,.6);box-shadow:var(--shadow-glass);border:1px solid rgba(255,255,255,.5)"><span>Tab</span></span>
        <span class="chip c">Chip</span></div></section>
    </div></div></div>`;
    const sw = $("#dsSw", view), pills = $("#dsPills", view), ind2 = $(".f-ind", pills);
    const draw = g => {
      const list = groups.filter(x => g === "All" || x.name === g).flatMap(x => x.items);
      sw.innerHTML = list.map(([c, u]) => `<button class="ptr" style="background:${col(c)}" data-tip="${c.startsWith("--") ? c.slice(2) : c} · ${col(c).toUpperCase()}"></button>`).join("");
      const b = $(`[data-g="${g}"]`, pills);
      $$(".f-pill", pills).forEach(x => x.classList.toggle("active", x === b));
      ind2.style.transform = `translate3d(${b.offsetLeft}px,0,0)`; ind2.style.width = b.offsetWidth + "px";
    };
    $$(".f-pill", pills).forEach(b => on(b, "click", () => draw(b.dataset.g)));
    requestAnimationFrame(() => draw("All"));
    wireSide(side);
  }

  /* ---------- router ---------- */
  const TG = () => $("#tag"), BN = () => $("#born");
  let current = null;
  function setTagline(route, first) {
    const html = S.tagline[route].map(md).join("<br>");
    const tag = TG(), born = BN();
    if (first) { tag.innerHTML = html; born.hidden = route !== "art"; return; }
    tag.classList.add("swap");
    setTimeout(() => { tag.innerHTML = html; born.hidden = route !== "art"; tag.classList.remove("swap"); }, 200);
  }
  function parseHash() {
    const h = location.hash.slice(1);
    if (h.startsWith("p-")) { const full = h.endsWith("-full"); return { route: current && current !== "design-system" ? current : "work", proj: full ? h.slice(2, -5) : h.slice(2), full }; }
    return { route: ["art", "about", "design-system"].includes(h) ? h : "work" };
  }
  function routeFromHash() { return parseHash().route; }
  function applyHash(first) {
    const st = parseHash();
    go(st.route, first);
    if (st.proj) { if (!openProject(st.proj, st.full, st.route)) location.hash = st.route; }
    else if (pm) closeProject(true);
  }
  function go(route, first) {
    if (route === current) return;
    const wasDS = current === "design-system";
    current = route;
    document.body.classList.toggle("ds-mode", route === "design-system");
    if (route !== "design-system") { moveInd(route, first || wasDS); setTagline(route, first || wasDS); }
    cleanup.forEach(f => f()); cleanup = [];
    closeLB(true);
    const headerBottom = $(".tabs-wrap").getBoundingClientRect().bottom + scrollY;
    if (scrollY > headerBottom) window.scrollTo(0, 0);
    ({ work: renderWork, art: renderArt, about: renderAbout, "design-system": renderDS })[route]();
    if (route === "design-system") window.scrollTo(0, 0);
    wireMedia(view); wireReveal(view);
    document.title = route === "work" ? S.name : route === "design-system" ? `Design System | ${S.name}` : `${route[0].toUpperCase() + route.slice(1)} | ${S.name}`;
  }
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-route]");
    if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    let r = a.dataset.route;
    if (r === "design-system" && current === "design-system") r = "work";
    if (location.hash !== "#" + r) location.hash = r; else go(r);
  });
  window.addEventListener("hashchange", () => applyHash());
  document.addEventListener("click", e => {
    const a = e.target.closest("[data-proj]");
    if (!a || pm || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    const p = S.projects.find(x => x.slug === a.dataset.proj);
    if (p && p.type === "link") return window.open(p.href, "_blank", "noopener");
    location.hash = "p-" + a.dataset.proj;
  });
  window.addEventListener("resize", () => moveInd(current, true));
  applyHash(true);
  window.APP = {
    get site() { return S; },
    refresh(next) {
      if (next) S = next;
      const y = scrollY, r = current, open = pm && pm.slug, full = pm && pm.el.classList.contains("full");
      renderShell();
      current = null;
      if (pm) { pm.el.remove(); pm = null; }
      go(r, true);
      if (r !== "design-system") { moveInd(r, true); }
      $$(".reveal,.reveal-fade").forEach(el => el.classList.add("in"));
      window.scrollTo(0, y);
      if (open) openProject(open, full, r);
    },
    route: () => current, project: () => pm && pm.slug
  };
  document.dispatchEvent(new Event("app:ready"));
  // fonts can shift tab widths: re-measure once loaded
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => moveInd(current, true));
})();
