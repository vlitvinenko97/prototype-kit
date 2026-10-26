/* Prototype Kit for WordPress — boots the kit's chrome (kit/proto-chrome.js) with the config from PHP and runs the
   points: a point on the page that's open scrolls to its section (never reloads — kit "One-page flows"); a point on
   another page opens that page (keeps ?device / ?size) and scrolls there. The stage's address bar follows the page open
   in the device (reload / share land on it). Exposes window.ProtoKitWP = { pc } so the
   theme can tell the stage page (pc.isHost) from the real page. */
(() => {
  "use strict";
  const cfg = window.ProtoKitConfig;
  if (!cfg || !window.ProtoChrome) return;

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pathOf = (url) => new URL(url, location.origin).pathname.replace(/\/?$/, "/");
  let here = pathOf(location.pathname);
  // A point's key = its page path + section; the kit lights points by this key (flow.screen).
  const keyOf = (path, section) => `${pathOf(path)}#${section ?? ""}`;
  const points = (cfg.points ?? []).map((p) => ({ ...p, path: pathOf(p.url), key: keyOf(p.url, p.section) }));
  const keys = new Set(points.map((p) => p.key));

  const pc = window.ProtoChrome.init({
    ...cfg.chrome,
    flows: points.map((p) => ({ label: p.label, screen: p.key, sub: p.sub || undefined })),
  });
  window.ProtoKitWP = { pc };

  // A point whose section isn't on the page (renamed block, typo in Settings → Prototype Kit): the kit's system toast
  const missing = (section) => window.ProtoChrome.toast(String(cfg.i18n?.noSection ?? "").replace("%s", section));

  // the point for a section of this page; falls back to the page's own point (no section)
  const light = (section) => {
    const key = keys.has(keyOf(here, section)) ? keyOf(here, section) : keyOf(here, "");
    if (keys.has(key)) window.ProtoChrome.screen(key);
  };

  if (pc.isHost) {
    // The address bar follows the device: a link clicked inside the frame navigates only the frame, so the embed reports
    // its URL on every load and the stage rewrites its own — the embed's path + query, plus the stage's ?device / ?size.
    // replaceState, not pushState: the frame's navigation already added the history entry (joint session history), so
    // Back / Forward move the frame and its next report fixes the address again; a push would double every step.
    const frame = () => document.querySelector("iframe.pc-device");
    addEventListener("message", (e) => {
      if (e.origin !== location.origin || e.source !== frame()?.contentWindow || typeof e.data?.pkwpPage !== "string") return;
      const url = new URL(e.data.pkwpPage, location.origin);
      if (url.origin !== location.origin) return;
      const own = new URLSearchParams(location.search);
      for (const k of ["device", "size"]) if (own.has(k)) url.searchParams.set(k, own.get(k));
      url.searchParams.delete("embed");
      const next = `${url.pathname}${url.search}`;
      if (next !== `${location.pathname}${location.search}`) history.replaceState(history.state, "", next);
      if (typeof e.data.title === "string" && e.data.title) document.title = e.data.title;
      here = pathOf(url.pathname);
      // a page without a point of its own: nothing stays lit (a page with one lights it through ProtoChrome.screen)
      if (!points.some((p) => p.path === here)) {
        for (const el of document.querySelectorAll(".pc-flows__rail > *, .pc-flows__item")) el.classList.remove("is-active");
      }
    });
    // Stage: the kit's own handler would reload this same page with ?screen — ours picks the point's page / section.
    document.addEventListener("click", (e) => {
      const item = e.target.closest?.(".pc-flows__item");
      if (!item) return;
      e.stopPropagation();
      const point = points[[...document.querySelectorAll(".pc-flows__item")].indexOf(item)];
      if (!point) return;
      const q = new URLSearchParams(location.search);
      // another page: only the stage's own params travel — the open page's query (synced from the device) is its own
      if (point.path !== here) for (const k of [...q.keys()]) if (k !== "device" && k !== "size") q.delete(k);
      q.delete("screen");
      if (point.section) q.set("screen", point.section);
      const qs = q.toString() ? `?${q}` : "";
      if (point.path !== here) {
        location.href = `${point.path}${qs}`;   // another page: a fresh load there (keeps ?device / ?size)
        return;
      }
      history.replaceState(history.state, "", `${location.pathname}${qs}`);
      document.querySelector("iframe.pc-device")?.contentWindow?.postMessage({ flowScroll: point.section || "" }, location.origin);
    }, true);
    return;
  }

  // The page (inside the device, or the page itself without a frame). After the theme's scripts and modules have run
  // (their layout — e.g. a pinned section's height — decides where a section is).
  const start = () => {
    // inside the stage's device frame: tell the stage which page is open (without ?embed), before light() below — the
    // stage clears the points for a page that has none, then this page's point lights up
    if (pc.isEmbed && window.parent !== window) {
      const report = () => {
        const q = new URLSearchParams(location.search);
        q.delete("embed");
        const page = `${location.pathname}${q.size ? `?${q}` : ""}`;
        window.parent.postMessage({ pkwpPage: page, title: document.title }, location.origin);
      };
      report();
      // Back / Forward restoring this page from the bfcache runs no scripts again
      addEventListener("pageshow", (e) => { if (e.persisted) report(); });
    }
    const section = new URLSearchParams(location.search).get("screen");
    const jump = () => {
      document.documentElement.style.scrollBehavior = "auto";
      document.getElementById(section)?.scrollIntoView();
      document.documentElement.style.scrollBehavior = "";
      light(section);
    };
    if (section && !document.getElementById(section)) missing(section);
    else if (section) {
      jump();
      // Fonts / images loading above the section (and the device iframe getting its final size) move it — jump again
      // once everything has loaded, unless the viewer has started scrolling by then.
      let viewerScrolled = false;
      const mark = () => { viewerScrolled = true; };
      for (const type of ["wheel", "touchmove", "keydown"]) addEventListener(type, mark, { once: true, passive: true });
      const again = () => { if (!viewerScrolled) jump(); };
      if (document.readyState === "complete") requestAnimationFrame(again);
      else addEventListener("load", () => requestAnimationFrame(again), { once: true });
    }
    light(section);

    let scrollingTo = null;
    addEventListener("message", (e) => {
      if (e.origin !== location.origin || typeof e.data?.flowScroll !== "string") return;
      const id = e.data.flowScroll;
      const el = id ? document.getElementById(id) : document.documentElement;
      light(id);
      if (!el) { missing(id); return; }
      scrollingTo = id || "top";
      el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth" });
      setTimeout(() => { if (scrollingTo === (id || "top")) scrollingTo = null; }, reduced() ? 0 : 1500);
    });
    addEventListener("scrollend", () => { scrollingTo = null; });

    // the rail follows manual scrolling: the section crossing the middle of the viewport
    const observer = new IntersectionObserver((entries) => {
      if (scrollingTo) return;
      for (const entry of entries) if (entry.isIntersecting) light(entry.target.id);
    }, { rootMargin: "-45% 0px -55% 0px" });
    for (const p of points) {
      if (p.path !== here || !p.section) continue;
      const el = document.getElementById(p.section);
      if (el) observer.observe(el);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
