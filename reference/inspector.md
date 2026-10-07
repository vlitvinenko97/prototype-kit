# Inspector — `inspector.js` (workspace root)

Figma-style inspector for reviewing prototypes. **Local only**: `serve.py` injects `<script src="/inspector.js">` before `</body>` of every prototype page; it is never copied into a prototype folder, never `<script>`-ed from a prototype, never published with one.

## Features
- `I` or the "Inspect" pill (bottom-right) toggles; remembered in sessionStorage. Off: `I` is handled in the bubble phase so an app's own `i` shortcut (preventDefault) wins.
- Hover = box model overlay + card: size, layout, padding/margin, rendered font, size/LH, letter-spacing, colours with their `:root` token names, border, radius, shadow. Click pins (click a value to copy). Alt+hover = distance lines. Enter / ⇧Enter = child / parent. Esc unpins.
- **Pinned element stays in place on resize** (device switch, frame drag, window resize): the page reflows, so the inspector scrolls the pinned element back to the viewport top it had before (tracked on pin and on every scroll); if it was out of view, it comes in near the top (20% / max 120px). Not pinned → no scroll correction.
- **States**: a pinned element gets tabs Default · Hover · Pressed · Focus (keys 1–4), only states whose CSS changes something. Every `:hover/:active/:focus*` rule gets a twin with the pseudo turned into a class (`.__ins-hover`…), tracked per rule and rescanned on each pin (works with CSS-in-JS / HMR). Forced classes are guarded by a MutationObserver (React/Vue re-renders). Changed rows show "was …".
- **Changes inside**: descendants that visibly change in that state — `color` only on elements with their own text (or inputs), border colours only where the side has width, outline props only with an outline, fill/stroke only on SVG shapes; 4 equal sides → `border-color`; each child named with its text snippet or image file.
- While on, a transparent shield takes the mouse (the page gets no real hover → Default is truly default); wheel is forwarded with `behavior: 'instant'` (with `scroll-behavior: smooth` on the page each wheel event would start its own smooth animation and the next one would cut it off — stuttering scroll). Events on the inspector's own layers are stopped at its shadow root and their mousedown is preventDefault'ed (otherwise "click outside" handlers close dropdowns / blur fields).
- Overlay host is appended to `<html>` (pages may hide body children).
- **Only the prototype is inspected**: the kit's chrome (`.pc-chrome`, frame grips, system toast) and `.pc-hideable` elements (demo hints…) are never picked; with a `[data-inspector-frame]` device in the page (mobile) only elements inside it are — the stage around it isn't. ⇧Enter stops at the frame.
- **Device iframe** (web chrome): the stage (top page: `html.pc-host` / an `iframe.pc-device`, checked live) is **never inspected itself** — turning it on (pill, `I`, a restored session) always goes to the iframe, also before the iframe exists (SPA apps create it after the inspector loads; a session is restored only after `load`). The outer pill and `I` drive the inspector inside the iframe (`window.__inspectorApi`); its card is drawn by the outer page **beside the device frame** (wider side, 300→220px, aligned to the element top; overlaps only if no room).
- **Mobile phone in the page**: the element with `data-inspector-frame` (set by `proto-chrome.js` from `frame:`) is treated the same way — the card goes beside the phone.
- Pill = liquid glass like the chrome: flat at rest, depth while content is under it, smoked when the backdrop is dark, press swells + stretches; **on = fresh mint glass** (gradient `#a0dac6 → #5c9e8a`, white label). Hidden with the chrome (`html.chrome-hidden`).

## Testing it
- In a hidden/background tab rAF doesn't run: override `requestAnimationFrame` with `setTimeout` before toggling it on by script.
- JS-driven states (`aria-pressed`, `.is-open`) aren't forced — toggle them in the prototype, then inspect.

## React / Vue projects (Vite)
`serve.py` can't inject into a Vite dev server → the dev-only plugin `templates/react/vite-inspector.ts`
(`apply: "serve"`: serves `/inspector.js` from the given path + `transformIndexHtml` adds the script; never in the build).
`kit.py vite <project>` puts the plugin and `inspector.js` at the project root (local-only — never `public/`).
The inspector itself is SPA-ready (see States).
