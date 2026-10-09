# Prototype chrome — `proto-chrome.js` / `proto-chrome.css`

The chrome is part of the prototype: it is published with it. One copy per prototype folder (copied from `templates/prototype/`, updated with `kit.py update-chrome <dir>`). All classes are prefixed `.pc-`; html state classes: `pc-host`, `pc-embed`, `pc-fill`, `pc-resizing*`, `pc-reduced`, `chrome-hidden`.

## API

```js
const pc = ProtoChrome.init({
  id: "slug",                 // storage prefix: <id>:device-sizes (localStorage), <id>:chrome-hidden (sessionStorage)
  title: "Brand prototype",   // device iframe title (web)
  mode: "web" | "mobile",
  frame: "#device",           // mobile: phone element → gets data-inspector-frame
  defaultScreen: "sign-in",
  flows: [{ label, screen, q?: { key: value }, sub?: true }],
  flowKeys: ["open", "state"],              // params a point may set; every other point clears them
  devices: { desktop: [null, null], tablet: [768, null], mobile: [375, 812] },   // web; null = Fill
  hints: { "sign-in": { title, text, rows: [{ label, text, value?, fill? }] } },  // demo hints, see below
});
if (pc.isHost) return;        // web: the top page is only the stage — never boot the app there
// in the router: ProtoChrome.screen(id) on every go()
// ProtoChrome.toggle(force?) — hide/show programmatically
// ProtoChrome.toast(msg) — system message (see below); option soonText overrides the default text
// ProtoChrome.hint(def | null) — show / hide a demo hint from code (see below)
```
Mark any other chrome you add beside the device with `.pc-hideable` so ⌘\ hides it too (the kit's hints already are).

## React / Vite (SPA) projects
Same module, no React port.
1. `python3 ~/.claude/skills/prototype-kit/scripts/kit.py vite <project>` → `public/proto-chrome.js/.css`,
   `src/proto-chrome.d.ts` (types for `window.ProtoChrome`), `vite-inspector.ts` + `inspector.js` at the project root.
2. `index.html`: `<link rel="stylesheet" href="/proto-chrome.css">` in `<head>`; `<script src="/proto-chrome.js"></script>`
   (classic) **before** `<script type="module" src="/src/main.tsx">`.
3. `main.tsx`: `const pc = window.ProtoChrome?.init({...}); if (!pc?.isHost) createRoot(...).render(<App/>)` — the host page
   mounts nothing (`.pc-host body` isn't rendered anyway). Flows list lives in this init.
4. Router: `window.ProtoChrome?.screen(id)` in an effect on the current screen (always `?.` — see "Works without the kit").
5. `vite.config`: `plugins: [react(), inspector("./inspector.js")]` (see `inspector.md`); add `vite-inspector.ts` to
   `tsconfig.node.json` "include" if it lists files.
6. Check: `dist/` has `proto-chrome.*` and no `inspector.js` / `<script src="/inspector.js">` (the chrome only mentions it in comments); dev page shows capsule + device switcher + Inspect pill,
   ⌘\ hides, switching device keeps the app state, inspector works inside the iframe.

## WordPress
Same modules, packaged as a plugin: `python3 ~/.claude/skills/prototype-kit/scripts/kit.py wordpress <wp-content>`
→ `wp-content/plugins/prototype-kit/` = the WP glue (`templates/wordpress/prototype-kit/`) + the kit's
`proto-chrome.js/.css` and `inspector.js` in `kit/` (never edit them there — they're overwritten on the next run;
a fix for everyone goes into the kit). Same command updates it; `--zip <file>` builds the plugin as a zip for servers
without the kit (wp-admin → Plugins → Add new → Upload).
- **Settings → Prototype Kit**: environments (`wp_get_environment_type()`; default all but production — production
  only on purpose, every visitor would see the tools), tools on / off (chrome, inspector), the panel's points:
  label, page (a path on the site), section (an element id, optional), sub-point.
- **Points**: a point on the page that's open scrolls to its section, never reloads (the "One-page flows" behaviour,
  built in); a point on another page opens it, keeps `?device` / `?size` and scrolls there; `?screen=<section>` opens
  a page on a section (jumps again after `load` unless the viewer scrolled); a missing section → the kit's toast.
- **Theme API** (optional): filter `prototype_kit_config` (ProtoChrome.init() options except `flows`: id, devices,
  hints…), filter `prototype_kit_points` (suggested points while the site has no own list). JS: the chrome + boot
  are deferred classic scripts in `<head>`, so they run before the theme's scripts / modules; the theme reads
  `window.ProtoKitWP?.pc` (`pc.isHost` = the stage page: boot nothing) and calls `window.ProtoChrome ?? no-op`.
  The site must work with the plugin off.
- **WordPress glue**: `?embed=1` is WordPress's oEmbed query var (a singular page — a static front page too — would
  render the embed card in the frame) → dropped from the query vars while the chrome is on (value `1` only);
  wp-admin / login opened inside the device frame (admin-bar links) break out to the full window (the chrome samples
  the frame every 150ms; heavy admin screens crashed Chrome inside it). The admin bar inside the frame is left as is.
- Check: the frame shows the site (not an embed card), points scroll / open pages, devices switch, inspector toggles,
  a theme's own JS still boots with the plugin off; tested with a classic theme, Twenty Twenty-One and Twenty
  Twenty-Five (block).

## One-page flows (points = sections of one page)
When the prototype is one long page (landing, long form, article) and the starting points are its sections, a
point must **scroll to the section, never reload** — the kit's default "point = fresh load" is for multi-screen
prototypes. Keep `proto-chrome.js` untouched; do it in the prototype's own init code:
- `flows`: one point per section, `screen` = the section's element `id`; `defaultScreen` = the first one.
- **Web host**: a `click` listener on `document` in the **capture** phase catches `.pc-flows__item` before the kit's own
  handler → `e.stopPropagation()`, index of the item = index in `flows`, `history.replaceState` with `?screen=<id>`
  (keeps `?device`/`?size`; the link stays shareable), then `postMessage({ flowScroll: id }, location.origin)` to
  `iframe.pc-device`'s `contentWindow`. Then `return` (the host boots nothing).
- **Embed** (or mobile, where there's no iframe — do the same in the page itself):
  - on load `?screen=<id>` → `scrollIntoView()` without animation + `ProtoChrome.screen(id)`;
  - on the message (check `e.origin`) → `ProtoChrome.screen(id)` **at once**, then
    `scrollIntoView({ behavior: "smooth" })` (`"auto"` under `prefers-reduced-motion`);
  - an `IntersectionObserver` (`rootMargin: "-45% 0px -55% 0px"` = the section crossing the middle of the viewport)
    calls `ProtoChrome.screen(id)` so the rail follows manual scrolling;
  - while a point's smooth scroll runs, the observer is muted (a `scrollingTo` flag cleared on `scrollend` + a ~1.5s
    timeout, because no `scrollend` fires when the section is already in place) — otherwise the rail flickers through
    every section passed on the way.
- React: all of it in one `useEffect` with a module-level `started` flag (StrictMode runs effects twice; `init` must run once).
- Check: a point keeps the page state (set `window.__marker = 1` on host + iframe, click a point, both still there),
  URL gets `?screen=`, the right point is lit, a fresh load of that URL opens on the section.

```js
const FLOWS = [{ label: "Hero", screen: "top" }, { label: "Pricing", screen: "pricing" }, { label: "FAQ", screen: "faq" }];
const pc = ProtoChrome.init({ id: "slug", title: "Landing", mode: "web", defaultScreen: "top", flows: FLOWS });

if (pc.isHost) {
  document.addEventListener("click", (e) => {
    const item = e.target.closest?.(".pc-flows__item");
    if (!item) return;
    e.stopPropagation();                                   // the kit's handler would reload the page
    const { screen } = FLOWS[[...document.querySelectorAll(".pc-flows__item")].indexOf(item)];
    const q = new URLSearchParams(location.search);
    q.set("screen", screen);
    history.replaceState(null, "", `${location.pathname}?${q}`);
    document.querySelector("iframe.pc-device")?.contentWindow?.postMessage({ flowScroll: screen }, location.origin);
  }, true);
} else {
  const start = new URLSearchParams(location.search).get("screen");
  if (start) document.getElementById(start)?.scrollIntoView();
  ProtoChrome.screen(start || "top");

  let scrollingTo = null;
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || !e.data?.flowScroll) return;
    const el = document.getElementById(e.data.flowScroll);
    if (!el) return;
    scrollingTo = el.id;
    ProtoChrome.screen(el.id);
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    setTimeout(() => { if (scrollingTo === el.id) scrollingTo = null; }, smooth ? 1500 : 0);
  });
  addEventListener("scrollend", () => { scrollingTo = null; });

  const observer = new IntersectionObserver((entries) => {
    if (scrollingTo) return;
    for (const e of entries) if (e.isIntersecting) ProtoChrome.screen(e.target.id);
  }, { rootMargin: "-45% 0px -55% 0px" });
  for (const { screen } of FLOWS) { const el = document.getElementById(screen); if (el) observer.observe(el); }
}
```


## Works without the kit (2026-10-08)

The prototype must keep working when the kit is removed (`proto-chrome.*` deleted, e.g. code handed to a client): the
app never assumes the module is loaded. Plain JS: the template's `app.js` starts with a local
`const ProtoChrome = window.ProtoChrome ?? { no-op stand-in }`, so `init()` returns `{ isHost: false }` and
`screen` / `toast` / `hint` / `toggle` do nothing. React / Vue: `window.ProtoChrome?.…` (the type is optional).
Without the kit you only lose the kit's own parts (capsule, devices, toasts, hints); no project style or script may
depend on kit classes (`pc-*`, `chrome-hidden`). Check: open the prototype with `proto-chrome.*` removed on a plain
`python3 -m http.server` — no console errors, every flow point's URL still opens its screen.

## What it does

**Capsule** — one vertical pill fixed at left 16px, vertically centred, liquid glass:
- Rest: frosted grey `rgba(236,236,236,.5)` + `blur(12) saturate(160%)`, 1px white rim + three white inner glints (`inset 9 9 6.5 -7.5 #fff`, `inset 6 9 7 -6 #fff`, `inset -6 -6 3 -6 #fff`), whisper shadow.
- **Scroll Effect** (`.is-over`): depth — dark inner edges `inset 3px 0 3px 1px`, `inset 0 -1px 2px 1px` + soft shadow under it — only while *content* is under the glass (text glyphs, svg/img/inputs, small ≤64px painted things like checkboxes/chips/avatars; a bigger opaque fill = surface, stops the probe). Sampled every 150ms on an 8px grid with `elementsFromPoint`, through same-origin iframes.
- **Adaptive tone** (`.is-dark`, like Apple's Liquid Glass): backdrop luminance (background layers composited to the first opaque one; img/video/canvas don't vote; 12px grid) < 0.2 → smoked glass `rgba(30,30,30,.5)`, dimmer rim, light lines/icons; > 0.3 → light; in between keeps the current (hysteresis).
- No `document.hidden` check in the samplers — the review pane reports hidden while visible.

**Flow starting points** — Notion-style rail of short lines (16×2, sub-points 10px indented), active line dark. Hover / focus → dense dark-glass list (`rgba(20,20,20,.94)` + `blur(40)`, radius 16, 232px) covering the rail; "Flow starting points" header; active item white 500. A point = fresh load with `?screen=<id>` + its params (keeps `?device`, `?size`, `?motion`) — except one-page prototypes, where a point scrolls to its section (see "One-page flows"). Light the current point from the router (`ProtoChrome.screen`).

**Web only — the stage:** the top page shows the prototype in ONE iframe (`?embed=1`, same URL); the top page renders nothing else (`html.pc-host body` is `display: none`; the stage's layers sit on `<html>`). Inside the iframe (`pc-embed`) there's no chrome; its `screen()` posts to the stage.
- **Devices** Desktop / Tablet / Mobile (24px icons, stroke 1 in a 16 viewBox, 32px round buttons under the rail, divider above). Active = solid white disc + dark icon on light glass; on dark glass a translucent light plate (white 22% + faint rim) with a white icon — never a solid white disc there. Switching **only resizes the iframe — no reload, the state stays**; `?device` in the URL via replaceState.
- **Frame background while loading** (2026-10-09): the frame is painted with the prototype page's own background (`body`, else `html`, read on the stage before it becomes the stage — same page, same CSS), so a dark site shows no white flash before its first paint (a long preloader made it obvious). The glass tone reads through the iframe; an embed with nothing painted yet counts as that background, not white. The capsule's and the inspector pill's first tone is applied without a fade (`.pc-instant` / `.instant` for two frames) — they appear in it; later changes still fade. No config: a page with a transparent background keeps the white frame. The background must be in CSS loaded before the chrome's `init` (a stylesheet in `<head>` — not CSS injected later by an app bundle).
- **Default sizes** — sliders button under the devices; panel opens **on hover** (focus-within keeps it while typing; Esc blurs) over the capsule's bottom: W × H per device, **empty side = Fill** (takes the stage's room at 100%: window − 80px sides / 56px top-bottom). Defaults: Desktop Fill × Fill (= iframe fills the whole window, no frame), Tablet 768 × Fill, Mobile 375 × 812. Live apply; bad values red, reverted on blur; "Reset to defaults". localStorage, overrides only. Limits 320×480 … 2560×1600.
- **Scale**: a framed device is always shown at the scale that fits the window, never above 100%.
- **Resizable frame** (Chrome responsive mode): grips outside the right / bottom edge + corner; the frame stays centred so it grows on both sides (Δ×2 ÷ scale at drag start); past the window it zooms out live; label above the frame on hover/drag `W × H` (+ ` · N%` when scaled). Custom size `?size=WxH` (`fill` for a Fill side; dragging one axis keeps the other's Fill). Active device again / another device / double-click a grip → preset.
- **Click Effect** on the round buttons: press = swell 1.15 + white bloom + blurred icon; drag stretches toward the pointer (±4px, +12% along the axis); release springs back with a little bounce.

**Chrome layers always on top** (2026-10-08): capsule, device iframe, resizer, hint and toast are appended to `<html>`, not `<body>` (like the inspector), all `position: fixed`, z-index 2147483000 (the inspector's 2147483647 stays above). Reason: a prototype's `body { transform | filter | contain | will-change }` turns body into the containing block of `position: fixed` — the capsule fell down under the layout — and a body re-render removed it. A MutationObserver on `<html>` re-appends a layer if something still removes it. Known limit: a prototype's own top-layer `<dialog>.showModal()` / popover in the page (mobile mode) still paints above everything.

**Touch devices — no classic scrollbars** (2026-10-08): web Tablet / Mobile frames get `html.pc-touch` inside the iframe (set by the stage on load + on device switch; the embed also reads `frame[data-pc-touch]` at init), the mobile phone element gets `.pc-touch`. Under it every scrollbar is `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` (`!important`). With macOS "Always show scrollbars" / a mouse connected a classic scrollbar took ~15px of the device width — a real phone / tablet never does. Desktop keeps the system scrollbar.

**Mobile** — the phone is in the page (`#device`, grey stage `#cbcbcb`, 10px bezel, no drop shadow, scaled to fit). No device switcher. The capsule gets the same glass/tone behaviour.

**Hide chrome: ⌘\ / Ctrl+\** (Figma's own "Show/Hide UI"; unused by browsers/macOS, types nothing, works with focus in inputs) toggles `html.chrome-hidden` on the top page — capsule, grips, `.pc-hideable` fade out; the local inspector hides its pill (it watches that class). Inside the iframe the key is posted up. Per-tab sessionStorage.

**System messages (toast)** — every message about the prototype's own limits goes through the module, never a
local toast: `data-action="soon"` on an element → "This part isn't designed yet"; `data-soon="Only page 1 is designed
yet"` → its own text; from code `ProtoChrome.toast(msg)` (e.g. "Social sign-in isn't part of the prototype yet",
"Legal pages aren't designed yet"). Look: dark `#1c1c1e` plate, radius 12, 13px, top 20px centred, one line when it
fits, ≥ 40px from the edges, centred + balanced when wrapping, moderate spring, 2.2s; shown in the prototype's
document (inside the device iframe on web). Messages that belong to the product itself (e.g. "Promo code copied")
are the design's own UI, not this.

**Demo hints** (`hints` in init, `.pc-hint`) — a card right of the device that explains a prototype rule the viewer
can't guess. **Only on screens where the prototype branches** (registered vs new email, right vs wrong OTP code) — not
for "any value works" cases (passwords). Each hint: title + grey line, then rows `{ label, text, value?, fill? }`
separated by spacing only; `value` = a soft grey pill on its own line, tap types it into the field `fill` (selector,
first visible match in the prototype — inside the device iframe on web) and fires `input`; mousedown is prevented so
the field keeps focus (the phone keyboard stays). The value must be the same constant the code checks, so the hint
stays honest. Same object on several screens → the card stays still between them; another hint → quick exit, new
content, moderate entrance. `ProtoChrome.hint(def | null)` for states inside one screen (the next `screen()` returns
to `hints`).
- Look: flat `#fafafa` card, 1.5px white border, **no gradient / rims / shadow**
  (they read as a shadow); radius 16, padding 22/28, width 300; SF system font; title 20/25 semibold, lines and text
  14/19 `#858585`, row label semibold `#111`; pill 13/18 medium, `rgba(0,0,0,.05)` → hover .08 → press .1 + scale .96;
  `text-wrap: pretty` so no line ends with one orphan word.
- Placement: on the top page (never inside the prototype), left of the card = device right + gap 16…40 (web: + 16 for
  the resize grip), width ≤ 300 shrinking with the room, top = device top + 64 per 832px of device height. Hidden when
  there's < 220px of room (narrow windows) and on web Desktop Fill; the device is never shrunk or moved for it.
  `.pc-hideable` (⌘\ hides it), the inspector skips it.

## Rejected / don't redo
- A separate chrome strip (64px column) that narrows the prototype.
- Moving the capsule glass to `::before` so the dark lists blur the page; the lists stay dense instead.
- Coloured (mint) active items in the capsule (line, list text, device disc / icon); active stays neutral, mint only for the active Inspect pill.
- Opening the sizes panel on click — it opens on hover like the flows list.
- Zoom presets (Fit / 50 / 75 / 100).
- Demo hints with a gradient, glass rims or a drop shadow; divider lines between rows; the value inline in the text
  (it's a pill on its own line).
