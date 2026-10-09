/* Prototype Kit for WordPress — boots the kit's chrome (kit/proto-chrome.js) with the config from PHP and runs the
   points: a point on the page that's open scrolls to its section (never reloads — kit "One-page flows"); a point on
   another page opens that page (keeps ?device / ?size) and scrolls there. Exposes window.ProtoKitWP = { pc } so the
   theme can tell the stage page (pc.isHost) from the real page. */
(() => {
  "use strict";
  const cfg = window.ProtoKitConfig;
  if (!cfg || !window.ProtoChrome) return;

  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pathOf = (url) => new URL(url, location.origin).pathname.replace(/\/?$/, "/");
  const here = pathOf(location.pathname);
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
    // Stage: the kit's own handler would reload this same page with ?screen — ours picks the point's page / section.
    document.addEventListener("click", (e) => {
      const item = e.target.closest?.(".pc-flows__item");
      if (!item) return;
      e.stopPropagation();
      const point = points[[...document.querySelectorAll(".pc-flows__item")].indexOf(item)];
      if (!point) return;
      const q = new URLSearchParams(location.search);
      q.delete("screen");
      if (point.section) q.set("screen", point.section);
      const qs = q.toString() ? `?${q}` : "";
      if (point.path !== here) {
        location.href = `${point.path}${qs}`;   // another page: a fresh load there (keeps ?device / ?size)
        return;
      }
      history.replaceState(null, "", `${location.pathname}${qs}`);
      document.querySelector("iframe.pc-device")?.contentWindow?.postMessage({ flowScroll: point.section || "" }, location.origin);
    }, true);
    return;
  }

  // The page (inside the device, or the page itself without a frame). After the theme's scripts and modules have run
  // (their layout — e.g. a pinned section's height — decides where a section is).
  const start = () => {
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
