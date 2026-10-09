/* proto-chrome.js — prototype chrome: flow starting points + (web) viewport switcher, default sizes,
   resizable device frame. Liquid glass capsule at the left edge. Part of the prototype (published with it).
   Part of the prototype-kit skill; copy per prototype, never link between prototypes.

   Usage (before the app boots its router):
     const pc = ProtoChrome.init({
       id: "slug",                      // storage prefix (localStorage / sessionStorage keys)
       title: "Brand prototype",        // device iframe title (web)
       mode: "web",                     // "web": the prototype runs in a device iframe on a stage
                                        // "mobile": the device (phone) is drawn in the page itself
       frame: "#device",                // mobile: the phone element (gets data-inspector-frame)
       defaultScreen: "sign-in",
       flows: [{ label: "Sign in", screen: "sign-in" },
               { label: "Search", screen: "home", q: { open: "search" }, sub: true }],
       flowKeys: ["open", "state"],     // params a point may set; every other point clears them
       devices: { desktop: [null, null], tablet: [768, null], mobile: [375, 812] },  // web; null = Fill
     });
     if (pc.isHost) return;             // web: this page is only the stage — don't boot the app here
     ... go(params.get("screen") || "sign-in");
   and inside the router's go(): ProtoChrome.screen(id)   // lights the current flow point

   Demo hints (optional): hints: { "sign-in": { title, text, rows: [{ label, text, value?, fill? }] } } in init — a card
   beside the device on screens where the prototype branches (registered vs new email, right vs wrong code); the same
   object on several screens keeps the card still; a row's value is a pill that types itself into `fill` (selector).
   ProtoChrome.hint(def | null) shows / hides one from code (e.g. a state inside a screen).

   ProtoChrome.toast(msg) — system message about the prototype's limits; on elements: data-action="soon" (default
   text) or data-soon="Only page 1 is designed yet" (own text) show it on click.
   ⌘\ / Ctrl+\ hides / shows the chrome (html.chrome-hidden — the local inspector hides its pill too). */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const html = document.documentElement;

  /* Every chrome layer (capsule, device iframe, resizer, hint, toast) lives on <html>, not <body>: a prototype's
     body transform / filter / contain / will-change makes body the containing block of position: fixed (the capsule
     fell down under the layout), and a body re-render (innerHTML, a framework remount) removed it. A MutationObserver
     puts a layer back if something still removes it. z-index 2147483000 for all of them (the inspector is above). */
  const mounted = new Set();
  let keeper = null;
  function mount(el) {
    mounted.add(el);
    html.append(el);
    keeper ??= new MutationObserver(() => mounted.forEach((n) => n.isConnected || html.append(n)));
    keeper.observe(html, { childList: true });
  }

  /* ---------- Motion: Fluid Functionalism springs as CSS linear() (--pc-ease-* / --pc-dur-*) ---------- */
  function spring(visualDuration, bounce = 0) {
    const root = (2 * Math.PI) / (visualDuration * 1.2);
    const stiffness = root * root;
    const damping = 2 * Math.min(Math.max(1 - bounce, 0.05), 1) * Math.sqrt(stiffness);
    const dt = 1 / 600;
    let x = 0, v = 0, t = 0;
    const samples = [0];
    while (t < 3) {
      v += (-stiffness * (x - 1) - damping * v) * dt;
      x += v * dt;
      t += dt;
      samples.push(x);
      if (Math.abs(1 - x) < 0.0005 && Math.abs(v) < 0.005) break;
    }
    const points = [];
    for (let i = 0; i <= 40; i++) points.push(i === 40 ? 1 : +samples[Math.round((i / 40) * (samples.length - 1))].toFixed(4));
    return { easing: `linear(${points.join(", ")})`, duration: Math.round(t * 1000) };
  }
  const tiers = { fast: spring(0.08), "fast-exit": spring(0.06), moderate: spring(0.16), "moderate-exit": spring(0.12), slow: spring(0.24, 0.12), "slow-exit": spring(0.16) };
  if (CSS.supports("transition-timing-function", "linear(0, 1)")) {
    for (const [n, { easing, duration }] of Object.entries(tiers)) {
      html.style.setProperty(`--pc-ease-${n}`, easing);
      html.style.setProperty(`--pc-dur-${n}`, `${duration}ms`);
    }
  }
  if (params.get("motion") === "reduced") html.classList.add("pc-reduced");

  const ICONS = {
    desktop: '<rect x="1.75" y="2.75" width="12.5" height="8.5" rx="1.5"/><path d="M5.5 14h5M8 11.25V14"/>',
    tablet: '<rect x="3" y="1.75" width="10" height="12.5" rx="1.5"/><path d="M7 11.75h2"/>',
    mobile: '<rect x="4.5" y="1.75" width="7" height="12.5" rx="1.5"/><path d="M7.25 11.75h1.5"/>',
    sizes: '<path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.5"/><circle cx="6" cy="11.5" r="1.5"/>',
  };
  const svg = (k) => `<svg width="24" height="24" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>`;

  /* ---------- Liquid glass sampling (shared by the capsule; the local inspector has its own copy) ---------- */
  // Scroll Effect: depth (.is-over) only while content — text glyphs, svg/img/inputs, small painted things
  // (checkboxes, chips, avatars) — is under the glass; a bigger opaque fill is just a surface.
  function contentAt(doc, x, y, skip) {
    for (const e of doc.elementsFromPoint(x, y)) {
      if (skip && skip.contains(e)) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (e.tagName === "IFRAME") {
        try { const r = e.getBoundingClientRect(), k = r.width / e.offsetWidth || 1; return contentAt(e.contentDocument, (x - r.left) / k, (y - r.top) / k); }
        catch { return false; }
      }
      if (e instanceof SVGElement || /^(IMG|VIDEO|CANVAS|INPUT|TEXTAREA)$/.test(e.tagName)) return true;
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        const range = doc.createRange();
        range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
      }
      const cs = getComputedStyle(e);
      const b = e.getBoundingClientRect(), paints = cs.backgroundImage !== "none" || !/rgba\(.*, 0\)|transparent/.test(cs.backgroundColor);
      if (b.width <= 64 && b.height <= 64 && (paints || cs.boxShadow !== "none" || parseFloat(cs.borderTopWidth) > 0)) return true;
      if (paints) return false;
    }
    return false;
  }
  // Adaptive tone (Apple Liquid Glass): background layers under each point composited down to the first
  // opaque one (through iframes; an embed with nothing painted yet shows the frame's own background);
  // media doesn't vote; mean relative luminance with hysteresis → .is-dark.
  function rgbaOf(c) {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  }
  function backdropAt(doc, x, y, skip, base = [255, 255, 255]) {
    const layers = [];
    for (const e of doc.elementsFromPoint(x, y)) {
      if (skip && skip.contains(e)) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (e.tagName === "IFRAME") {
        try {
          const r = e.getBoundingClientRect(), k = r.width / e.offsetWidth || 1, own = rgbaOf(getComputedStyle(e).backgroundColor);
          const inner = backdropAt(e.contentDocument, (x - r.left) / k, (y - r.top) / k, null, own?.[3] >= 0.99 ? own.slice(0, 3) : undefined);
          if (!inner) return null;
          layers.push([...inner, 1]);
        } catch { return null; }
        break;
      }
      if (/^(IMG|VIDEO|CANVAS)$/.test(e.tagName)) return null;
      const c = rgbaOf(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
    }
    if (!layers.length || layers[layers.length - 1][3] < 0.99) layers.push([...base, 1]);
    let [r, g, b] = layers.pop();
    while (layers.length) { const [lr, lg, lb, a] = layers.pop(); r = r * (1 - a) + lr * a; g = g * (1 - a) + lg * a; b = b * (1 - a) + lb * a; }
    return [r, g, b];
  }
  const luminance = ([r, g, b]) => {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  function glassWatch(el) {
    const check = () => {
      const r = el.getBoundingClientRect();
      let over = false, sum = 0, n = 0;
      for (let y = r.top + 4; y < r.bottom - 2 && !over; y += 8)
        for (let x = r.left + 4; x < r.right - 2 && !over; x += 8) over = contentAt(document, x, y, el);
      for (let y = r.top + 4; y < r.bottom - 2; y += 12)
        for (let x = r.left + 4; x < r.right - 2; x += 12) { const c = backdropAt(document, x, y, el); if (c) { sum += luminance(c); n++; } }
      el.classList.toggle("is-over", over);
      if (n) { const l = sum / n; if (l < 0.2) el.classList.add("is-dark"); else if (l > 0.3) el.classList.remove("is-dark"); }
    };
    setInterval(check, 150);   // no document.hidden check: the review pane reports hidden while visible
    // The first tone is instant (the capsule appears in it): check() reads layout, so the light style is already
    // computed when .is-dark lands — without this the capsule fades light → dark on every load.
    el.classList.add("pc-instant");
    check();
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("pc-instant")));
  }
  // Click Effect: press swells (1.15, white bloom, blurred icon), dragging stretches toward the pointer,
  // release springs back on the slow (bouncy) tier.
  function pressGlass(btn) {
    let box = null;
    const set = (tx, ty, sx, sy) => Object.entries({ tx: `${tx}px`, ty: `${ty}px`, sx, sy }).forEach(([k, v]) => btn.style.setProperty(`--pc-${k}`, v));
    const release = () => { if (!box) return; box = null; btn.classList.remove("is-pressed"); set(0, 0, 1, 1); };
    btn.addEventListener("pointerdown", (e) => { box = btn.getBoundingClientRect(); btn.setPointerCapture(e.pointerId); btn.classList.add("is-pressed"); set(0, 0, 1.15, 1.15); });
    btn.addEventListener("pointermove", (e) => {
      if (!box) return;
      const dx = Math.max(-1, Math.min(1, (e.clientX - box.left - box.width / 2) / box.width));
      const dy = Math.max(-1, Math.min(1, (e.clientY - box.top - box.height / 2) / box.height));
      const ax = Math.abs(dx), ay = Math.abs(dy);
      set(dx * 4, dy * 4, 1.15 + 0.12 * ax - 0.06 * ay, 1.15 + 0.12 * ay - 0.06 * ax);
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) => btn.addEventListener(t, release));
  }

  /* ---------- Public API ---------- */
  let cfg = null, rail = null, list = null, isEmbed = false;
  const flowMatches = (f) => cfg.flowKeys.every((k) => (params.get(k) || null) === (f.q?.[k] || null));
  function syncFlows(id) {
    if (!rail) return;
    let i = cfg.flows.findIndex((f) => f.screen === id && flowMatches(f));
    if (i < 0) i = cfg.flows.findIndex((f) => f.screen === id && !f.q);
    if (i < 0) return;
    [rail.children, list.querySelectorAll(".pc-flows__item")].forEach((els) => [...els].forEach((el, j) => el.classList.toggle("is-active", j === i)));
  }

  function toggleChrome(force) {
    const hidden = html.classList.toggle("chrome-hidden", force);
    try { hidden ? sessionStorage.setItem(`${cfg.id}:chrome-hidden`, "1") : sessionStorage.removeItem(`${cfg.id}:chrome-hidden`); } catch {}
  }

  function buildCapsule(withDevices) {
    const cap = document.createElement("div");
    cap.className = "pc-chrome";
    cap.innerHTML = `
      <nav class="pc-flows" aria-label="Flow starting points">
        <div class="pc-flows__rail" aria-hidden="true"></div>
        <div class="pc-panel pc-flows__panel"><p class="pc-panel__head">Flow starting points</p><ul class="pc-flows__list"></ul></div>
      </nav>
      ${withDevices ? `
      <div class="pc-devices" role="group" aria-label="Viewport">
        ${["desktop", "tablet", "mobile"].map((d) => `<button class="pc-btn" type="button" data-device="${d}" title="${d[0].toUpperCase() + d.slice(1)}" aria-label="${d}">${svg(d)}</button>`).join("")}
      </div>
      <div class="pc-dsizes">
        <button class="pc-btn pc-dsizes__btn" type="button" title="Default sizes" aria-label="Default sizes">${svg("sizes")}</button>
        <div class="pc-panel pc-dsizes__panel" role="dialog" aria-label="Default sizes">
          <p class="pc-panel__head">Default sizes</p>
          <div class="pc-dsizes__rows"></div>
          <button class="pc-dsizes__reset" type="button">Reset to defaults</button>
        </div>
      </div>` : ""}`;
    mount(cap);
    rail = cap.querySelector(".pc-flows__rail");
    list = cap.querySelector(".pc-flows__list");
    cfg.flows.forEach((f) => {
      const line = document.createElement("i");
      line.classList.toggle("is-sub", !!f.sub);
      rail.append(line);
      const li = document.createElement("li");
      li.innerHTML = `<button class="pc-flows__item${f.sub ? " is-sub" : ""}" type="button"></button>`;
      li.firstChild.textContent = f.label;
      li.firstChild.addEventListener("click", () => {
        const q = new URLSearchParams(location.search);
        q.set("screen", f.screen);
        cfg.flowKeys.forEach((k) => q.delete(k));
        Object.entries(f.q || {}).forEach(([k, v]) => q.set(k, v));
        location.href = `${location.pathname}?${q}`;   // a starting point = a fresh load (keeps ?device, ?size, ?motion)
      });
      list.append(li);
    });
    glassWatch(cap);
    return cap;
  }

  // The page's own background (body, else html), read before it becomes the stage (same page, same CSS as the embed):
  // the device frame shows it while the embed loads — no white flash before the first paint. null = transparent → white.
  function pageBackground() {
    for (const el of [document.body, html]) {   // body paints over html when both are set
      const c = el && rgbaOf(getComputedStyle(el).backgroundColor);
      if (c?.[3] >= 0.99) return `rgb(${c.slice(0, 3).join(", ")})`;
    }
    return null;
  }

  function initWebHost(cap) {
    const pageBg = pageBackground();
    if (pageBg) html.style.setProperty("--pc-device-bg", pageBg);   // on <html>: Fill resets the frame's inline style
    html.classList.add("pc-host");
    const SIZES_KEY = `${cfg.id}:device-sizes`;
    const DEFAULTS = cfg.devices;
    const DEVICES = { ...DEFAULTS };
    try {
      const saved = JSON.parse(localStorage.getItem(SIZES_KEY) || "{}");
      for (const k of Object.keys(DEFAULTS)) if (k in saved) DEVICES[k] = saved[k] || [null, null];
    } catch {}
    let device = ["tablet", "mobile"].includes(params.get("device")) ? params.get("device") : "desktop";
    const q = new URLSearchParams(location.search);
    ["device", "size"].forEach((k) => q.delete(k));
    q.set("embed", "1");
    const frame = document.createElement("iframe");
    hintAnchor = frame;
    frame.className = "pc-device";
    frame.title = cfg.title;
    frame.src = `${location.pathname}?${q}`;
    mount(frame);
    frame.addEventListener("load", () => { syncTouch(); frame.focus(); });
    // Tablet / Mobile = a touch device: no classic scrollbar eating the screen width (html.pc-touch inside the frame;
    // the embed also reads frame[data-pc-touch] at init, so it's right from the first paint and after its own reloads)
    const syncTouch = () => {
      const touch = device !== "desktop";
      frame.dataset.pcTouch = touch ? "1" : "";
      try { frame.contentDocument?.documentElement.classList.toggle("pc-touch", touch); } catch {}
    };

    // Resizable frame (Chrome responsive mode): stays centred → grows both sides (delta × 2 ÷ scale)
    const SIZE_MIN = [320, 480], SIZE_MAX = [2560, 1600], PAD_X = 80, PAD_Y = 56;
    let custom = null, scale = 1, dragging = false;
    const m = /^(\d+|fill)x(\d+|fill)$/.exec(params.get("size") || "");
    if (m) custom = [m[1] === "fill" ? null : +m[1], m[2] === "fill" ? null : +m[2]];
    const resizer = document.createElement("div");
    resizer.className = "pc-resizer";
    resizer.innerHTML = '<div class="pc-resizer__h pc-resizer__h--r" data-axis="x"><i></i></div><div class="pc-resizer__h pc-resizer__h--b" data-axis="y"><i></i></div><div class="pc-resizer__h pc-resizer__h--rb" data-axis="xy"></div><div class="pc-resizer__size"></div>';
    mount(resizer);
    const sizeLabel = resizer.querySelector(".pc-resizer__size");
    const writeUrl = () => {
      const u = new URLSearchParams(location.search);
      device === "desktop" ? u.delete("device") : u.set("device", device);
      custom ? u.set("size", custom.map((v) => v ?? "fill").join("x")) : u.delete("size");
      history.replaceState(null, "", `${location.pathname}${u.size ? "?" + u : ""}`);
    };
    const spec = () => custom || DEVICES[device];
    const resolve = () => { const [dw, dh] = spec(); return [dw ?? Math.max(SIZE_MIN[0], innerWidth - 2 * PAD_X), dh ?? Math.max(SIZE_MIN[1], innerHeight - 2 * PAD_Y)]; };
    const fit = () => {
      const fill = device === "desktop" && spec().every((v) => v == null);
      html.classList.toggle("pc-fill", fill);
      if (fill) { frame.removeAttribute("width"); frame.removeAttribute("height"); frame.style.cssText = ""; placeHint(); return; }
      const [w, h] = resolve();
      frame.width = w;
      frame.height = h;
      const fitScale = Math.min(1, (innerWidth - 2 * PAD_X) / w, (innerHeight - 2 * PAD_Y) / h);   // never above 100%
      scale = dragging ? Math.min(scale, fitScale) : fitScale;
      const sw = w * scale, sh = h * scale;
      const box = { left: (innerWidth - sw) / 2, top: (innerHeight - sh) / 2, width: sw, height: sh };
      Object.assign(frame.style, { left: `${box.left}px`, top: `${box.top}px`, transform: `scale(${scale})` });
      Object.assign(resizer.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${sw}px`, height: `${sh}px` });
      sizeLabel.textContent = `${w} × ${h}${scale < 1 ? ` · ${Math.round(scale * 100)}%` : ""}`;
      placeHint();
    };
    resizer.querySelectorAll(".pc-resizer__h").forEach((hd) => {
      const axis = hd.dataset.axis;
      let start = null;
      // Move / release are listened on the whole window, not only on the grip: when the frame zooms out (scale < 100%)
      // the grip moves away from the pointer and its pointer capture can be lost — the release then never reached the
      // grip and the drag (+ the resize cursor) stuck. Also ends on window blur or a move with no button held
      // (released outside the browser window).
      const move = (e) => {
        if (!start) return;
        if (!(e.buttons & 1)) return end();
        const clamp = (v, lo, hi) => Math.round(Math.max(lo, Math.min(hi, v)));
        const w = clamp(start.size[0] + (2 * (e.clientX - start.x)) / start.scale, SIZE_MIN[0], SIZE_MAX[0]);
        const h = clamp(start.size[1] + (2 * (e.clientY - start.y)) / start.scale, SIZE_MIN[1], SIZE_MAX[1]);
        custom = [axis.includes("x") ? w : start.spec[0], axis.includes("y") ? h : start.spec[1]];   // the other side keeps Fill
        fit();
      };
      const end = () => {
        if (!start) return;
        start = null;
        dragging = false;
        removeEventListener("pointermove", move);
        removeEventListener("pointerup", end);
        removeEventListener("pointercancel", end);
        removeEventListener("blur", end);
        html.classList.remove("pc-resizing", `pc-resizing-${axis}`);
        if (custom && JSON.stringify(custom) === JSON.stringify(DEVICES[device])) custom = null;
        writeUrl();
        fit();
      };
      hd.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        try { hd.setPointerCapture(e.pointerId); } catch {}
        dragging = true;
        start = { x: e.clientX, y: e.clientY, scale, size: resolve(), spec: [...spec()] };
        html.classList.add("pc-resizing", `pc-resizing-${axis}`);
        addEventListener("pointermove", move);
        addEventListener("pointerup", end);
        addEventListener("pointercancel", end);
        addEventListener("blur", end);
      });
      hd.addEventListener("dblclick", () => { custom = null; writeUrl(); fit(); });
    });

    // Default sizes panel (hover, like the flows list): W × H per device, empty = Fill
    const ds = cap.querySelector(".pc-dsizes"), rows = ds.querySelector(".pc-dsizes__rows");
    const LABELS = { desktop: "Desktop", tablet: "Tablet", mobile: "Mobile" };
    const save = () => {
      const diff = {};
      for (const k of Object.keys(DEFAULTS)) if (JSON.stringify(DEVICES[k]) !== JSON.stringify(DEFAULTS[k])) diff[k] = DEVICES[k];
      try { Object.keys(diff).length ? localStorage.setItem(SIZES_KEY, JSON.stringify(diff)) : localStorage.removeItem(SIZES_KEY); } catch {}
    };
    const render = () => {
      rows.innerHTML = "";
      for (const k of Object.keys(DEFAULTS)) {
        const row = document.createElement("div");
        row.className = `pc-dsizes__row${k === device ? " is-current" : ""}`;
        row.dataset.device = k;
        const [w, h] = DEVICES[k].map((v) => v ?? "");
        row.innerHTML = `<span class="pc-dsizes__label">${LABELS[k]}</span>
          <input class="pc-dsizes__in" type="number" inputmode="numeric" value="${w}" placeholder="Fill" aria-label="${LABELS[k]} width">
          <span class="pc-dsizes__x">×</span>
          <input class="pc-dsizes__in" type="number" inputmode="numeric" value="${h}" placeholder="Fill" aria-label="${LABELS[k]} height">`;
        const [iw, ih] = row.querySelectorAll("input");
        const apply = () => {
          const w = iw.value.trim(), h = ih.value.trim();
          const ok = (v, i) => +v >= SIZE_MIN[i] && +v <= SIZE_MAX[i];
          const badW = !!w && !ok(w, 0), badH = !!h && !ok(h, 1);
          iw.classList.toggle("is-bad", badW);
          ih.classList.toggle("is-bad", badH);
          if (badW || badH) return;
          DEVICES[k] = [w ? Math.round(+w) : null, h ? Math.round(+h) : null];
          save();
          if (k === device) { custom = null; writeUrl(); fit(); }
        };
        iw.addEventListener("input", apply);
        ih.addEventListener("input", apply);
        [iw, ih].forEach((inp) => inp.addEventListener("blur", () => {
          if (!inp.classList.contains("is-bad")) return;
          const cur = DEVICES[k].map((v) => v ?? "");
          iw.value = cur[0]; ih.value = cur[1];
          iw.classList.remove("is-bad"); ih.classList.remove("is-bad");
        }));
        rows.append(row);
      }
    };
    render();
    ds.addEventListener("pointerenter", () => { if (!ds.contains(document.activeElement)) render(); });
    ds.querySelector(".pc-dsizes__btn").addEventListener("focus", render);
    ds.querySelector(".pc-dsizes__reset").addEventListener("click", () => { Object.assign(DEVICES, DEFAULTS); save(); custom = null; writeUrl(); fit(); render(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && ds.contains(document.activeElement)) document.activeElement.blur(); });

    const setDevice = (d) => {
      if (d !== device) custom = null;
      device = d;
      rows.querySelectorAll(".pc-dsizes__row").forEach((r) => r.classList.toggle("is-current", r.dataset.device === d));
      cap.querySelectorAll(".pc-btn[data-device]").forEach((b) => { b.classList.toggle("is-active", b.dataset.device === d); b.setAttribute("aria-pressed", String(b.dataset.device === d)); });
      syncTouch();
      writeUrl();
      fit();
      frame.focus();
    };
    cap.querySelectorAll(".pc-btn[data-device]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.device === device && !custom) return;
      custom = null;   // the active device again = back to its preset
      setDevice(b.dataset.device);
    }));
    cap.querySelectorAll(".pc-btn").forEach(pressGlass);
    setDevice(device);
    addEventListener("resize", () => fit());
    addEventListener("message", (e) => {
      if (e.origin !== location.origin) return;
      if (e.data?.pcScreen) { syncFlows(e.data.pcScreen); syncHint(e.data.pcScreen); }
      if (e.data && "pcHint" in e.data) showHint(e.data.pcHint);
      if (e.data?.pcChrome === "toggle") toggleChrome();
    });
    syncFlows(params.get("screen") || cfg.defaultScreen);
  }

  /* ---------- Demo hints: a card beside the device (top page, never inside the prototype) ----------
     Only for screens where the prototype branches on a rule the viewer can't guess (registered vs new email,
     right vs wrong code) — not for "any value works". Flat #fafafa card, 1.5px white border, no shadow; SF system
     font; title 20 semibold, grey #858585 lines; rows separated by spacing only; a value = soft grey pill on its own
     line that types itself into the screen's field (mousedown prevented so the field keeps focus / the keyboard).
     Placed right of the device (gap 16…40, width ≤ 300, top = device top + 64 of an 832 phone); hidden when there's
     less than 220px of room (narrow windows, web Desktop Fill). .pc-hideable → ⌘\ hides it, the inspector skips it. */
  const HINT_W = 300, HINT_MIN_W = 220;
  let hintEl = null, hintAnchor = null, hintDef = null, hintTimer = 0;
  function placeHint() {
    if (!hintEl || !hintAnchor) return;
    const r = hintAnchor.getBoundingClientRect();
    const grip = hintAnchor.tagName === "IFRAME" ? 16 : 0;   // web: clear the frame's right resize grip
    const room = innerWidth - r.right - grip - 16;
    const gap = Math.max(16, Math.min(40, room - HINT_W));
    const w = Math.min(HINT_W, room - gap);
    hintEl.hidden = w < HINT_MIN_W || html.classList.contains("pc-fill");
    Object.assign(hintEl.style, { left: `${r.right + grip + gap}px`, top: `${r.top + (64 * r.height) / 832}px`, width: `${w}px` });
  }
  function fillTarget(sel) {
    const doc = hintAnchor?.tagName === "IFRAME" ? hintAnchor.contentDocument : document;
    const all = doc ? [...doc.querySelectorAll(sel)] : [];
    return all.find((el) => (el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.offsetParent)) || all[0];
  }
  function buildHint() {
    hintEl = document.createElement("aside");
    hintEl.className = "pc-hint pc-hideable";
    hintEl.setAttribute("aria-live", "polite");
    hintEl.innerHTML = '<p class="pc-hint__title"></p><p class="pc-hint__text"></p><ul class="pc-hint__rows"></ul>';
    mount(hintEl);
    hintEl.addEventListener("mousedown", (e) => e.target.closest(".pc-hint__value") && e.preventDefault());
    hintEl.addEventListener("click", (e) => {
      const btn = e.target.closest(".pc-hint__value");
      const row = btn && hintDef?.rows[btn.dataset.row];
      const input = row?.fill && fillTarget(row.fill);
      if (!input) return;
      if (hintAnchor.tagName === "IFRAME") hintAnchor.focus();
      input.value = row.value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus({ preventScroll: true });
    });
    addEventListener("resize", () => requestAnimationFrame(placeHint));   // after the app has refit the phone
  }
  function showHint(def) {
    if (!hintEl || (def || null) === hintDef) return;   // same hint on the next screen (two OTP screens): keep it still
    hintDef = def || null;
    clearTimeout(hintTimer);
    const fill = () => {
      if (!hintDef) return;
      hintEl.querySelector(".pc-hint__title").textContent = hintDef.title || "";
      const text = hintEl.querySelector(".pc-hint__text");
      text.textContent = hintDef.text || "";
      text.hidden = !hintDef.text;
      const rows = hintEl.querySelector(".pc-hint__rows");
      rows.replaceChildren(...(hintDef.rows || []).map((r, i) => {
        const li = document.createElement("li");
        li.className = "pc-hint__row";
        li.innerHTML = '<span class="pc-hint__label"></span><p class="pc-hint__line"></p>';
        li.children[0].textContent = r.label || "";
        li.children[1].textContent = r.text || "";
        if (!r.text) li.children[1].remove();
        if (r.value != null) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "pc-hint__value";
          b.dataset.row = i;
          b.textContent = r.value;
          if (r.fill) b.title = "Tap to fill in"; else b.disabled = true;
          li.append(b);
        }
        return li;
      }));
      placeHint();
      hintEl.classList.add("is-visible");
    };
    if (!hintEl.classList.contains("is-visible")) return fill();
    hintEl.classList.remove("is-visible");   // swap the content after the quick exit
    hintTimer = setTimeout(fill, tiers["fast-exit"].duration);
  }
  const syncHint = (id) => cfg.hints && showHint(cfg.hints[id]);

  /* ---------- System message (toast): unbuilt screens / actions ----------
     One line whenever it fits, ≥ 40px from the screen edges, centred + balanced when it wraps; dark plate, top
     centre; moderate spring in, moderate-exit out; 2.2s. Shown in the prototype's own document (inside the device
     iframe on web). For every message about the prototype's limits ("isn't designed yet", "only page 1…",
     "isn't part of the prototype"): data-action="soon" (default text) / data-soon="…" (own text), or toast(msg). */
  let toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "pc-toast";
      toastEl.setAttribute("role", "status");
      mount(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.getBoundingClientRect();   // start from the hidden state when it's brand new
    toastEl.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("is-open"), 2200);
  }

  window.ProtoChrome = {
    init(options) {
      cfg = {
        id: "proto", title: "Prototype", mode: "web", frame: null, defaultScreen: "",
        flows: [], flowKeys: [], hints: null, devices: { desktop: [null, null], tablet: [768, null], mobile: [375, 812] },
        soonText: "This part isn't designed yet",
        ...options,
      };
      isEmbed = cfg.mode === "web" && (params.has("embed") || window !== window.top);
      html.classList.toggle("pc-embed", isEmbed);
      try { if (isEmbed && window.frameElement?.dataset.pcTouch === "1") html.classList.add("pc-touch"); } catch {}
      // ⌘\ / Ctrl+\ — Figma's "Show/Hide UI"; unused by browsers / macOS, types nothing
      addEventListener("keydown", (e) => {
        if (!((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.code === "Backslash")) return;
        e.preventDefault();
        if (isEmbed) window.parent.postMessage({ pcChrome: "toggle" }, location.origin);
        else toggleChrome();
      }, true);
      if (!isEmbed) try { if (sessionStorage.getItem(`${cfg.id}:chrome-hidden`)) toggleChrome(true); } catch {}
      if (!(cfg.mode === "web" && !isEmbed)) {
        // [data-action="soon"] → the default text; [data-soon="…"] → its own text ("Only page 1 is designed yet")
        document.addEventListener("click", (e) => {
          const el = e.target.closest?.('[data-action="soon"], [data-soon]');
          if (el) toast(el.dataset.soon || cfg.soonText);
        });
      }
      if (cfg.mode === "web") {
        if (!isEmbed) { buildHint(); initWebHost(buildCapsule(true)); }
      } else {
        const frameEl = typeof cfg.frame === "string" ? document.querySelector(cfg.frame) : cfg.frame;
        frameEl?.setAttribute("data-inspector-frame", "");   // the local inspector puts its card beside the phone
        frameEl?.classList.add("pc-touch");   // a phone: no classic scrollbars inside it
        hintAnchor = frameEl;
        buildHint();
        buildCapsule(false);
        syncFlows(params.get("screen") || cfg.defaultScreen);
      }
      return { isHost: cfg.mode === "web" && !isEmbed, isEmbed };
    },
    // Call from the router's go(id): lights the current flow point (web embed → tells the stage)
    screen(id) {
      if (!cfg) return;
      if (isEmbed) window.parent.postMessage({ pcScreen: id }, location.origin);
      else { syncFlows(id); syncHint(id); }
    },
    // Demo hint from code (def = { title, text, rows }), null hides it; the next screen() goes back to cfg.hints
    hint(def) {
      if (!cfg) return;
      if (isEmbed) window.parent.postMessage({ pcHint: def || null }, location.origin);
      else showHint(def);
    },
    toggle: (force) => cfg && toggleChrome(force),
    // System message for unbuilt screens / actions (same look in every prototype)
    toast,
  };
})();
