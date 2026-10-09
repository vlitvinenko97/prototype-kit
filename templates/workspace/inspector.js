/* Figma-style inspector for local prototype review. Injected by serve.py into every
   prototype page served from localhost:5173 — never part of a prototype or its deploy.

   I                toggle inspect mode (or the "Inspect" pill, bottom right)
   hover            box model (margin orange · padding green · content blue) + properties card
   click            pin the element (click a value in the card to copy it); click again / Esc to unpin
   1–4 / tabs       pinned element: Default · Hover · Pressed · Focus — forces that CSS state
                    (only states that change something are offered; changes vs Default are marked)
   Enter / ⇧Enter   pinned element: select first child / parent
   Alt + hover      distances: pinned element ↔ hovered one, or hovered ↔ its parent if nothing is pinned
   Esc              unpin, then exit

   While on, a transparent shield takes the mouse: the page sees no real hover/clicks (so Default is
   really default), wheel scrolling is passed through to whatever is under the cursor.
*/
(() => {
  if (window.__inspector) return;
  window.__inspector = true;

  const KEY = 'inspector:on';
  const isTop = window === window.top;

  // ---------- Shadow-DOM overlay (immune to the prototype's styles and to itself) ----------
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>
  :host { all: initial; }
  * { box-sizing: border-box; }
  .shield { position: fixed; inset: 0; pointer-events: auto; cursor: crosshair; }
  .shield[hidden] { display: none; }
  .layer { position: fixed; inset: 0; pointer-events: none; }
  .box { position: fixed; }
  .m { border-style: solid; border-color: rgba(246,166,80,.42); }
  .b { border-style: solid; border-color: rgba(250,214,90,.55); }
  .p { border-style: solid; border-color: rgba(120,190,110,.45); }
  .c { background: rgba(100,160,230,.38); }
  .outline { outline: 1px solid #0d99ff; }
  .outline.pinned { outline: 1.5px solid #0d99ff; }
  .tag { position: fixed; padding: 2px 5px; border-radius: 3px; background: #0d99ff; color: #fff;
         font: 500 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }
  .line { position: fixed; background: #f24822; }
  .guide { position: fixed; border: 0 dashed #f24822; }
  .dist { position: fixed; padding: 1px 4px; border-radius: 3px; background: #f24822; color: #fff;
          font: 600 11px/14px ui-monospace, SFMono-Regular, Menlo, monospace; transform: translate(-50%,-50%); white-space: nowrap; }
  .card { position: fixed; width: 300px; max-height: calc(100vh - 16px); overflow: auto; padding: 10px 0 6px;
          border-radius: 10px; background: #1e1e1e; color: #e6e6e6; box-shadow: 0 6px 30px rgba(0,0,0,.35);
          font: 12px/16px -apple-system, BlinkMacSystemFont, system-ui, sans-serif; pointer-events: none; }
  .card.pinned { pointer-events: auto; }
  .card[hidden], .tag[hidden] { display: none; }
  .hd { padding: 0 12px 8px; border-bottom: 1px solid #333; }
  .sel { font: 500 12px/16px ui-monospace, SFMono-Regular, Menlo, monospace; color: #7cc4ff; word-break: break-all; }
  .tabs { display: flex; gap: 2px; margin-top: 8px; padding: 2px; border-radius: 6px; background: #2a2a2a; }
  .tabs button { flex: 1; height: 22px; border: 0; border-radius: 4px; background: none; color: #aaa; cursor: pointer;
                 font: 500 11px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
  .tabs button:hover { color: #fff; }
  .tabs button.on { background: #444; color: #fff; }
  .sec { padding: 6px 12px 4px; border-bottom: 1px solid #2c2c2c; }
  .sec:last-child { border-bottom: 0; }
  .st { color: #8a8a8a; font-size: 11px; margin-bottom: 2px; }
  .row { display: flex; gap: 8px; padding: 2px 0; border-radius: 4px; }
  .card.pinned .row { cursor: copy; }
  .card.pinned .row:hover { background: #2c2c2c; }
  .k { flex: 0 0 min(88px, 30%); color: #999; }
  .v { flex: 1; min-width: 0; font: 11.5px/16px ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-word; }
  .row.chg .k { color: #fbbf24; }
  .row.chg .k::before { content: '● '; font-size: 8px; vertical-align: 1px; }
  .was { display: block; color: #777; font-size: 10.5px; }
  .was::before { content: 'was '; }
  .tok { color: #c792ea; }
  .dim { color: #777; }
  .sw { display: inline-block; width: 10px; height: 10px; margin-right: 5px; vertical-align: -1px;
        border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(255,255,255,.25); }
  .sub { display: block; margin-top: 4px; color: #7cc4ff; font: 11px/15px ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  .sub:first-of-type { margin-top: 0; }
  .ch { display: block; padding-left: 10px; font: 11px/15px ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-word; }
  .ch b { font-weight: 400; color: #999; }
  .hint { padding: 6px 12px 2px; color: #777; font-size: 11px; }
  /* Liquid glass pill: flat frosted glass at
     rest, depth (.over: dark inner edges + shadow) only while page content is under it; press swells it
     (white bloom, blurred label) and it stretches toward the pointer, release springs back. */
  .toggle { position: fixed; right: 24px; bottom: 16px; pointer-events: auto; display: flex; align-items: center; gap: 6px;
            height: 32px; padding: 0 12px; border: 0; border-radius: 300px; color: rgba(0,0,0,.75);
            background: rgba(236,236,236,.5); -webkit-backdrop-filter: blur(12px) saturate(160%); backdrop-filter: blur(12px) saturate(160%);
            --rim: inset 0 0 0 1px rgba(255,255,255,.9), inset 9px 9px 6.5px -7.5px #fff, inset 6px 9px 7px -6px #fff, inset -6px -6px 3px -6px #fff;
            box-shadow: var(--rim), inset 0 0 0 0 transparent, inset 0 0 0 0 transparent,
                        0 1px 42px rgba(0,0,0,.02), 0 4px 29px rgba(0,0,0,.04), 0 16px 56px rgba(0,0,0,.04);
            transform: translate(var(--tx,0px), var(--ty,0px)) scale(var(--sx,1), var(--sy,1));
            transition: box-shadow .12s ease-out, background-color .12s ease-out, color .12s ease-out,
                        transform .24s linear(0, 0.157, 0.48, 0.773, 0.968, 1.067, 1.095, 1.083, 1.056, 1.029, 1.01, 0.998, 0.994, 0.995, 0.998, 1);
            font: 500 12px/1 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; cursor: pointer; }
  .toggle.over { background: rgba(236,236,236,.42); transition-duration: .16s, .16s, .16s, .24s;
                 box-shadow: var(--rim), inset 3px 0 3px 1px rgba(0,0,0,.12), inset 0 -1px 2px 1px rgba(0,0,0,.1),
                             0 1px 42px rgba(0,0,0,.02), 0 4px 29px rgba(0,0,0,.04), 0 14px 26px -6px rgba(0,0,0,.2); }
  /* dark appearance on a dark backdrop (.dark, darkUnder()) — smoked glass, light label */
  .toggle.dark { background: rgba(30,30,30,.5); color: rgba(255,255,255,.88);
                 --rim: inset 0 0 0 1px rgba(255,255,255,.14), inset 9px 9px 6.5px -7.5px rgba(255,255,255,.3), inset 6px 9px 7px -6px rgba(255,255,255,.18), inset -6px -6px 3px -6px rgba(255,255,255,.24); }
  .toggle.dark kbd { background: rgba(255,255,255,.12); }
  .toggle.on { background: linear-gradient(135deg, rgba(160,218,198,.9), rgba(92,158,138,.9)); color: #fff; text-shadow: 0 1px 1px rgba(30,80,66,.25);   /* fresh mint glass */
               --rim: inset 0 0 0 1px rgba(255,255,255,.45), inset 9px 9px 6.5px -7.5px rgba(255,255,255,.7), inset 6px 9px 7px -6px rgba(255,255,255,.6), inset -6px -6px 3px -6px rgba(255,255,255,.7); }
  .toggle > * { transition: filter .12s ease-out; }
  .toggle.pressed { background: radial-gradient(ellipse at 50% 50%, #fff 0 30%, rgba(255,255,255,.6) 75%, rgba(255,255,255,.9) 100%); color: rgba(0,0,0,.75);
                    transition: transform .16s ease-out, box-shadow .16s ease-out; }
  .toggle.pressed .lbl, .toggle.pressed kbd { filter: blur(1.2px); }
  .toggle.hidden { opacity: 0; pointer-events: none; }
  .toggle { transition-property: box-shadow, background-color, color, transform, opacity; }
  .toggle kbd { font: 500 10px/1 ui-monospace, Menlo, monospace; padding: 2px 4px; border-radius: 4px; background: rgba(0,0,0,.07); }
  .toggle.on kbd { background: rgba(255,255,255,.22); }
  .toast { position: fixed; right: 24px; bottom: 52px; padding: 6px 10px; border-radius: 6px; background: #1e1e1e; color: #fff;
           font: 12px/16px -apple-system, system-ui, sans-serif; }
</style>
<div class="shield" hidden></div>
<div class="layer"></div>
<div class="tag" hidden></div>
<div class="card" hidden></div>
<button class="toggle" type="button"><span class="lbl">Inspect</span> <kbd>I</kbd></button>`;
  const shield = root.querySelector('.shield');
  const layer = root.querySelector('.layer');
  const tag = root.querySelector('.tag');
  const card = root.querySelector('.card');
  const toggle = root.querySelector('.toggle');
  if (!isTop) toggle.style.display = 'none';   // device iframe: the outer page has the pill
  // On <html>, outside <body>: pages may hide body children (device mode does)
  document.documentElement.appendChild(host);
  // Like the prototype chrome's layers: if a page re-render removes it from <html>, put it back
  new MutationObserver(() => { if (!host.isConnected) document.documentElement.appendChild(host); })
    .observe(document.documentElement, { childList: true });

  // Freezes transitions while a state is forced / snapshotted, so values are final at once
  const freezeCss = document.createElement('style');
  freezeCss.textContent = '.__ins-frozen *, .__ins-frozen *::before, .__ins-frozen *::after { transition: none !important; }';
  document.head.appendChild(freezeCss);

  let on = false, hovered = null, pinned = null, alt = false, mouse = { x: 0, y: 0 };
  let pinTop = null;   // pinned element's viewport top — kept on resize (device switch / frame drag reflows the page)
  let tokens = null;
  let view = 'default', states = null, forcedUndo = null, cardKey = '';

  // ---------- helpers ----------
  const px = v => { const n = parseFloat(v); return isNaN(n) ? v : `${+n.toFixed(2)}`; };
  const fmt = v => (v === '0px' ? '0' : String(v).replace(/(-?\d*\.?\d+)px/g, (_, n) => +(+n).toFixed(2) + ''));
  const four = (t, r, b, l) => {
    [t, r, b, l] = [t, r, b, l].map(px);
    if (t === r && r === b && b === l) return t;
    if (t === b && r === l) return `${t} ${r}`;
    if (r === l) return `${t} ${r} ${b}`;
    return `${t} ${r} ${b} ${l}`;
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function toHex(c) {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return c;
    const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    const hex = '#' + p.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
    return p.length > 3 && p[3] < 1 ? `${hex} ${Math.round(p[3] * 100)}%` : hex;
  }
  // matrix(a, b, c, d, x, y) → "scale(0.98) translate(0, 4)" when there's no rotation/skew
  function readTransform(t) {
    const m = t.match(/^matrix\(([^)]+)\)$/);
    if (!m) return t;
    const [a, b, c, d, x, y] = m[1].split(',').map(Number);
    if (b || c) return t;
    const out = [];
    if (a !== 1 || d !== 1) out.push(a === d ? `scale(${+a.toFixed(3)})` : `scale(${+a.toFixed(3)}, ${+d.toFixed(3)})`);
    if (x || y) out.push(`translate(${+x.toFixed(2)}, ${+y.toFixed(2)})`);
    return out.join(' ') || 'none';
  }
  const hexAll = s =>String(s).replace(/rgba?\([^)]+\)/g, toHex);
  const transparent = c => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);

  // Element under a point, as if the shield weren't there; invisible layers (opacity 0 /
  // visibility hidden — e.g. cross-faded state images) give way to their visible parent
  function pick(x, y, raw) {
    shield.hidden = true;
    let t = document.elementFromPoint(x, y);
    shield.hidden = !on;
    if (raw) return t;
    while (t && t !== document.body && t.parentElement) {
      const cs = getComputedStyle(t);
      if (cs.opacity !== '0' && cs.visibility !== 'hidden') break;
      t = t.parentElement;
    }
    return t === host || !inspectable(t) ? null : t;
  }
  // Only the prototype is inspected, never the environment around it: the kit's chrome (.pc-chrome, frame grips,
  // system toast) and anything marked .pc-hideable (demo hints…) are skipped; when the page draws a device
  // ([data-inspector-frame], mobile prototypes) only what's inside it counts — not the stage around it.
  function inspectable(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.closest('.pc-chrome, .pc-resizer, .pc-toast, .pc-hideable')) return false;
    const frame = document.querySelector('[data-inspector-frame]');
    return !frame || frame.contains(n);
  }

  // ---------- design tokens ----------
  // CSS custom properties on :root → value → token names, so values show their token
  function buildTokens() {
    tokens = { color: new Map(), len: new Map() };
    const names = new Set();
    const walk = rules => {
      for (const r of rules) {
        if (r.cssRules && !r.selectorText) { walk(r.cssRules); continue; }
        if (!r.selectorText || !/(^|,)\s*(:root|html)\b/.test(r.selectorText)) continue;
        for (const p of r.style) if (p.startsWith('--')) names.add(p);
      }
    };
    for (const s of document.styleSheets) { try { walk(s.cssRules); } catch (_) { /* cross-origin (fonts) */ } }
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;';
    document.documentElement.appendChild(probe);
    const rs = getComputedStyle(document.documentElement);
    const add = (map, k, n) => { if (!map.has(k)) map.set(k, []); map.get(k).push(n); };
    for (const n of names) {
      const raw = rs.getPropertyValue(n).trim();
      if (!raw) continue;
      if (CSS.supports('color', raw) && !/^(inherit|initial|unset|currentcolor)$/i.test(raw)) {
        probe.style.color = raw; add(tokens.color, getComputedStyle(probe).color, n);
      } else if (/^-?[\d.]+(px|rem|em)$/.test(raw)) {
        probe.style.width = raw; add(tokens.len, getComputedStyle(probe).width, n);
      }
    }
    probe.remove();
  }
  const tokFor = (map, v) => {
    const t = tokens && map.get(v);
    return t ? ` <span class="tok">${esc(t[0])}${t.length > 1 ? ` +${t.length - 1}` : ''}</span>` : '';
  };
  const color = c => `<span class="sw" style="background:${esc(c)}"></span>${esc(toHex(c))}${tokFor(tokens.color, c)}`;

  // ---------- forced states ----------
  // Every rule with :hover/:active/:focus… gets a twin right after it (same cascade position)
  // where the pseudo-class is a class: `.btn:hover` → `.btn.__ins-hover`. Adding the class forces it.
  const PSEUDO = /:(hover|active|focus-visible|focus-within|focus)(?![\w-])/g;
  // Tracked per rule, not per sheet: CSS-in-JS (styled-components, emotion) and Vite HMR keep adding
  // rules to sheets already walked, so every call re-walks and twins only the rules not seen yet.
  const doneRules = new WeakSet();
  function prepareStates() {
    const walk = list => {
      for (let i = list.cssRules.length - 1; i >= 0; i--) {
        const r = list.cssRules[i];
        if (r.cssRules) walk(r);
        if (!r.selectorText || doneRules.has(r)) continue;
        doneRules.add(r);
        PSEUDO.lastIndex = 0;
        if (r.selectorText.includes('__ins-') || !PSEUDO.test(r.selectorText)) continue;
        const sel = r.selectorText.replace(PSEUDO, '.__ins-$1');
        try { list.insertRule(`${sel} { ${r.style.cssText} }`, i + 1); doneRules.add(list.cssRules[i + 1]); } catch (_) {}
      }
    };
    for (const s of document.styleSheets) { try { walk(s); } catch (_) { /* cross-origin */ } }
  }

  // Hover and press apply to the element and all its ancestors (as real ones do); focus to the
  // element itself (+ focus-visible), focus-within to it and its ancestors
  const STATES = [
    { id: 'default', label: 'Default' },
    { id: 'hover', label: 'Hover', self: ['hover'], up: ['hover'] },
    { id: 'active', label: 'Pressed', self: ['hover', 'active'], up: ['hover', 'active'] },
    { id: 'focus', label: 'Focus', self: ['focus', 'focus-visible', 'focus-within'], up: ['focus-within'] },
  ];
  function applyState(node, id) {
    const st = STATES.find(s => s.id === id);
    if (!st || !st.self) return () => {};
    const added = [];
    const add = (e, list) => list.forEach(c => { const k = '__ins-' + c; if (!e.classList.contains(k)) { e.classList.add(k); added.push([e, k]); } });
    add(node, st.self);
    for (let a = node.parentElement; a; a = a.parentElement) add(a, st.up);
    // React / Vue rewrite `class` on re-render and would drop the forced classes: put them back
    const mo = new MutationObserver(() => added.forEach(([e, k]) => { if (!e.classList.contains(k)) e.classList.add(k); }));
    new Set(added.map(([e]) => e)).forEach(e => mo.observe(e, { attributes: true, attributeFilter: ['class'] }));
    return () => { mo.disconnect(); added.forEach(([e, k]) => e.classList.remove(k)); };
  }
  const freeze = v => document.documentElement.classList.toggle('__ins-frozen', v);
  function flush() { void document.documentElement.offsetHeight; }

  // Run fn with `node` in state `id` (temporarily lifting the currently forced state)
  function inState(node, id, fn) {
    const wasFrozen = document.documentElement.classList.contains('__ins-frozen');
    freeze(true);
    if (forcedUndo) forcedUndo();
    const undo = applyState(node, id);
    flush();
    const out = fn();
    undo();
    if (view !== 'default' && pinned) forcedUndo = applyState(pinned, view);
    flush();
    if (!wasFrozen) freeze(false);
    return out;
  }

  // Visual props compared between states, for the element and everything inside it
  const PROPS = ['opacity', 'visibility', 'display', 'color', 'backgroundColor', 'backgroundImage', 'borderTopColor', 'borderRightColor',
    'borderBottomColor', 'borderLeftColor', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxShadow', 'outlineStyle', 'outlineColor', 'outlineWidth',
    'outlineOffset', 'transform', 'scale', 'translate', 'filter', 'textDecorationLine', 'fill', 'stroke', 'width', 'height', 'fontWeight'];
  const kebab = p => p.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
  function snap(node) {
    const list = [node, ...node.querySelectorAll('*')].slice(0, 400);
    return list.map(e => { const cs = getComputedStyle(e); return { e, v: PROPS.map(p => cs[p]) }; });
  }
  // Only changes you can see: inherited values that paint nothing are dropped (e.g. an <img> inherits the
  // label's colour but doesn't use it and has no border / outline).
  const SHAPES = /^(path|circle|rect|line|polyline|polygon|ellipse|text|tspan|use)$/i;
  const SIDES = ['Top', 'Right', 'Bottom', 'Left'];
  function visible(e, p, x, y) {
    const v = (vals, prop) => vals.v[PROPS.indexOf(prop)];
    const either = (prop, test) => test(v(x, prop)) || test(v(y, prop));
    if (p === 'color') return /^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) || [...e.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
    const side = /^border(Top|Right|Bottom|Left)Color$/.exec(p);
    if (side) return either(`border${side[1]}Width`, w => parseFloat(w) > 0);
    if (p === 'outlineColor' || p === 'outlineWidth' || p === 'outlineOffset') return either('outlineStyle', st => st !== 'none');
    if (p === 'fill' || p === 'stroke') return e instanceof SVGElement && SHAPES.test(e.tagName);
    return true;
  }
  function diffSnaps(a, b) {
    const out = [];
    a.forEach((x, i) => {
      const y = b[i];
      if (!y || y.e !== x.e) return;
      let ch = [];
      PROPS.forEach((p, j) => { if (x.v[j] !== y.v[j] && visible(x.e, p, x, y)) ch.push([kebab(p), x.v[j], y.v[j]]); });
      // four equal side changes → one line
      const sides = SIDES.map(sd => ch.find(c => c[0] === `border-${sd.toLowerCase()}-color`));
      if (sides.every(c => c && c[1] === sides[0][1] && c[2] === sides[0][2])) {
        ch = ch.filter(c => !sides.includes(c));
        ch.push(['border-color', sides[0][1], sides[0][2]]);
      }
      if (ch.length) out.push({ e: x.e, ch });
    });
    return out;
  }
  // Which states change anything for this element (Pressed is offered only if it differs from Hover)
  function computeStates(node) {
    const base = inState(node, 'default', () => snap(node));
    const res = { default: { diff: [] } };
    let hoverSnap = null;
    for (const st of STATES.slice(1)) {
      const s = inState(node, st.id, () => snap(node));
      const diff = diffSnaps(base, s);
      if (st.id === 'hover') hoverSnap = s;
      if (!diff.length) continue;
      if (st.id === 'active' && hoverSnap && !diffSnaps(hoverSnap, s).length) continue;
      res[st.id] = { diff };
    }
    return res;
  }
  function setView(id) {
    if (forcedUndo) { forcedUndo(); forcedUndo = null; }
    view = id;
    if (pinned && id !== 'default') { freeze(true); forcedUndo = applyState(pinned, id); }
    else { flush(); freeze(false); }
    cardKey = '';
    schedule();
  }
  function setPinned(node) {
    if (forcedUndo) { forcedUndo(); forcedUndo = null; }
    view = 'default';
    flush(); freeze(false);
    pinned = node;
    pinTop = node ? node.getBoundingClientRect().top : null;
    if (node) { prepareStates(); buildTokens(); }   // SPA styles / tokens may have appeared since it was turned on
    states = node ? computeStates(node) : null;
    cardKey = '';
    schedule();
  }

  // ---------- fonts ----------
  // Which family from the font stack is actually rendered
  const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-sans-serif',
    'ui-serif', 'ui-monospace', 'ui-rounded', '-apple-system', 'BlinkMacSystemFont', 'emoji', 'math']);
  const ctx = document.createElement('canvas').getContext('2d');
  const fontCache = new Map();
  function available(f, cs) {
    const key = `${f}|${cs.fontWeight}|${cs.fontStyle}`;
    if (fontCache.has(key)) return fontCache.get(key);
    let ok = [...document.fonts].some(ff => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded');
    if (!ok) {
      const s = 'mmmmmmmmmmlliWW@#0123';
      ok = ['monospace', 'serif'].some(fb => {
        ctx.font = `72px ${fb}`; const a = ctx.measureText(s).width;
        ctx.font = `72px "${f}", ${fb}`; return ctx.measureText(s).width !== a;
      });
    }
    fontCache.set(key, ok);
    return ok;
  }
  function renderedFont(cs) {
    const fams = cs.fontFamily.split(',').map(s => s.trim().replace(/^["']|["']$/g, ''));
    for (const f of fams) {
      if (GENERIC.has(f)) return { name: f === '-apple-system' || f === 'BlinkMacSystemFont' ? 'System (SF Pro)' : f, fallback: f !== fams[0] };
      if (available(f, cs)) return { name: f, fallback: f !== fams[0] };
    }
    return { name: fams[0], fallback: false };
  }

  // ---------- overlay drawing ----------
  const el = (cls, css) => { const d = document.createElement('div'); d.className = cls; Object.assign(d.style, css); layer.appendChild(d); return d; };
  const R = r => ({ left: r.left + 'px', top: r.top + 'px', width: Math.max(0, r.width) + 'px', height: Math.max(0, r.height) + 'px' });

  function drawBoxModel(node) {
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    const n = p => parseFloat(cs[p]) || 0;
    const m = [n('marginTop'), n('marginRight'), n('marginBottom'), n('marginLeft')].map(v => Math.max(0, v));
    const b = [n('borderTopWidth'), n('borderRightWidth'), n('borderBottomWidth'), n('borderLeftWidth')];
    const p = [n('paddingTop'), n('paddingRight'), n('paddingBottom'), n('paddingLeft')];
    const frame = (cls, x, w) => el('box ' + cls, { ...R(x), borderWidth: w.map(v => v + 'px').join(' ') });
    frame('m', { left: r.left - m[3], top: r.top - m[0], width: r.width + m[1] + m[3], height: r.height + m[0] + m[2] }, m);
    frame('b', r, b);
    const pb = { left: r.left + b[3], top: r.top + b[0], width: r.width - b[1] - b[3], height: r.height - b[0] - b[2] };
    frame('p', pb, p);
    el('box c', R({ left: pb.left + p[3], top: pb.top + p[0], width: pb.width - p[1] - p[3], height: pb.height - p[0] - p[2] }));
    el('box outline', R(r));
    return r;
  }

  function showTag(r) {
    tag.hidden = false;
    tag.textContent = `${px(r.width)} × ${px(r.height)}`;
    const w = tag.offsetWidth;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 6;
    if (y + 20 > innerHeight) y = r.top - 24;
    tag.style.left = Math.max(4, Math.min(innerWidth - w - 4, x)) + 'px';
    tag.style.top = Math.max(4, y) + 'px';
  }

  // Red distance lines between two rects (a = reference, b = target), Figma-like
  function measure(a, b) {
    const label = (x, y, v) => { const d = el('dist', { left: x + 'px', top: y + 'px' }); d.textContent = px(v); };
    const hLine = (x1, x2, y) => {
      const l = Math.min(x1, x2), w = Math.abs(x2 - x1);
      if (w < 0.5) return;
      el('line', { left: l + 'px', top: y + 'px', width: w + 'px', height: '1px' });
      label(l + w / 2, y, w);
    };
    const vLine = (y1, y2, x) => {
      const t = Math.min(y1, y2), h = Math.abs(y2 - y1);
      if (h < 0.5) return;
      el('line', { left: x + 'px', top: t + 'px', width: '1px', height: h + 'px' });
      label(x, t + h / 2, h);
    };
    const guideV = (x, y1, y2) => { if (Math.abs(y2 - y1) > 0.5) el('guide', { left: x + 'px', top: Math.min(y1, y2) + 'px', height: Math.abs(y2 - y1) + 'px', borderLeftWidth: '1px' }); };
    const guideH = (y, x1, x2) => { if (Math.abs(x2 - x1) > 0.5) el('guide', { top: y + 'px', left: Math.min(x1, x2) + 'px', width: Math.abs(x2 - x1) + 'px', borderTopWidth: '1px' }); };

    const yOver = [Math.max(a.top, b.top), Math.min(a.bottom, b.bottom)];
    const xOver = [Math.max(a.left, b.left), Math.min(a.right, b.right)];
    const y = yOver[0] < yOver[1] ? (yOver[0] + yOver[1]) / 2 : b.top + b.height / 2;
    const x = xOver[0] < xOver[1] ? (xOver[0] + xOver[1]) / 2 : b.left + b.width / 2;

    // horizontal
    if (b.left >= a.right) { hLine(a.right, b.left, y); if (yOver[0] >= yOver[1]) guideV(a.right, y, y < a.top ? a.top : a.bottom); }
    else if (a.left >= b.right) { hLine(b.right, a.left, y); if (yOver[0] >= yOver[1]) guideV(a.left, y, y < a.top ? a.top : a.bottom); }
    else { hLine(a.left, b.left, y); hLine(a.right, b.right, y); }
    // vertical
    if (b.top >= a.bottom) { vLine(a.bottom, b.top, x); if (xOver[0] >= xOver[1]) guideH(a.bottom, x, x < a.left ? a.left : a.right); }
    else if (a.top >= b.bottom) { vLine(b.bottom, a.top, x); if (xOver[0] >= xOver[1]) guideH(a.top, x, x < a.left ? a.left : a.right); }
    else { vLine(a.top, b.top, x); vLine(a.bottom, b.bottom, x); }
  }

  // ---------- properties card ----------
  function selector(node) {
    let s = node.tagName.toLowerCase();
    if (node.id) s += '#' + node.id;
    const cls = [...(node.classList || [])].filter(c => !c.startsWith('__ins-'));
    if (cls.length) s += '.' + cls.join('.');
    return s;
  }
  // A child in "Changes inside": its selector + what it is (text snippet, image file), so it's clear which one
  function describe(node) {
    let s = selector(node);
    const txt = [...node.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (txt) s += ` "${txt.length > 24 ? txt.slice(0, 23) + '…' : txt}"`;
    else if (node.tagName === 'IMG') s += ` ${(node.getAttribute('src') || '').split('/').pop()}`;
    return s;
  }
  function hasText(node) {
    if (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(node.tagName)) return true;
    return [...node.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
  }

  // Property rows of `node` as currently styled: [{ title, rows: [{ k, html, copy }] }]
  function collect(node) {
    const cs = getComputedStyle(node), r = node.getBoundingClientRect();
    const out = [];
    const sec = (title, list) => { list = list.filter(Boolean); if (list.length) out.push({ title, rows: list }); };
    const row = (k, html, copy) => ({ k, html, copy: copy ?? html.replace(/<[^>]+>/g, '') });
    const len = v => `${fmt(v)}${tokFor(tokens.len, v)}`;

    // Layout size (offset*) ignores transforms, like Figma; fall back to the box for SVG etc.
    const w = node.offsetWidth ?? r.width, h = node.offsetHeight ?? r.height;
    const disp = cs.display, flex = /flex/.test(disp), grid = /grid/.test(disp);
    sec('Layout', [
      row('Size', `${px(w)} × ${px(h)}`),
      row('Display', esc(disp) + (cs.position !== 'static' ? ` <span class="dim">· ${cs.position}</span>` : '')),
      flex && row('Direction', esc(cs.flexDirection) + (cs.flexWrap !== 'nowrap' ? ' wrap' : '')),
      grid && cs.gridTemplateColumns !== 'none' && row('Columns', esc(fmt(cs.gridTemplateColumns))),
      (flex || grid) && cs.rowGap !== 'normal' && row('Gap', cs.rowGap === cs.columnGap ? len(cs.rowGap) : `${len(cs.rowGap)} / ${len(cs.columnGap)}`),
      (flex || grid) && row('Align', `${esc(cs.justifyContent)} <span class="dim">/</span> ${esc(cs.alignItems)}`),
    ]);

    const pad = four(cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft);
    const mar = four(cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft);
    sec('Spacing', [
      pad !== '0' && row('Padding', esc(pad)),
      mar !== '0' && row('Margin', esc(mar)),
    ]);

    if (hasText(node)) {
      const f = renderedFont(cs);
      const lh = cs.lineHeight === 'normal' ? 'normal' : len(cs.lineHeight);
      const ls = cs.letterSpacing === 'normal' ? '0' : fmt(cs.letterSpacing);
      const ffs = cs.fontFeatureSettings !== 'normal' ? cs.fontFeatureSettings : '';
      sec('Typography', [
        row('Font', esc(f.name) + (f.fallback ? ' <span class="dim">(fallback)</span>' : '')),
        row('Weight', esc(cs.fontWeight) + (cs.fontStyle !== 'normal' ? ' ' + cs.fontStyle : '')),
        row('Size / LH', `${len(cs.fontSize)} <span class="dim">/</span> ${lh}`),
        row('Letter sp.', esc(ls)),
        row('Color', color(cs.color)),
        cs.textAlign !== 'start' && row('Align', esc(cs.textAlign)),
        cs.textTransform !== 'none' && row('Transform', esc(cs.textTransform)),
        cs.textDecorationLine !== 'none' && row('Decoration', esc(cs.textDecorationLine)),
        ffs && row('Features', esc(ffs)),
      ]);
    }

    const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth];
    const hasBorder = bw.some(v => parseFloat(v) > 0) && cs.borderTopStyle !== 'none';
    const rad = four(cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius);
    sec('Appearance', [
      !transparent(cs.backgroundColor) && row('Fill', color(cs.backgroundColor)),
      cs.backgroundImage !== 'none' && row('Image', esc(cs.backgroundImage.length > 90 ? cs.backgroundImage.slice(0, 90) + '…' : cs.backgroundImage), cs.backgroundImage),
      hasBorder && row('Border', `${esc(four(...bw))} ${esc(cs.borderTopStyle)} ${color(cs.borderTopColor)}`),
      rad !== '0' && row('Radius', esc(rad)),
      cs.boxShadow !== 'none' && row('Shadow', esc(hexAll(fmt(cs.boxShadow)))),
      cs.opacity !== '1' && row('Opacity', `${Math.round(cs.opacity * 100)}%`),
      cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 && row('Outline', `${fmt(cs.outlineWidth)} ${color(cs.outlineColor)}`),
      cs.transform !== 'none' && row('Transform', esc(readTransform(cs.transform))),
      cs.filter !== 'none' && row('Filter', esc(hexAll(cs.filter))),
    ]);
    return out;
  }

  function fillCard(node) {
    const isPinned = node === pinned;
    let sections = collect(node);

    // Pinned in a forced state: mark what differs from Default, list what changes inside
    let inside = '';
    if (isPinned && view !== 'default') {
      const base = inState(node, 'default', () => collect(node));
      const was = new Map();
      base.forEach(s => s.rows.forEach(r => was.set(s.title + '|' + r.k, r)));
      const seen = new Set();
      sections.forEach(s => s.rows.forEach(r => {
        const key = s.title + '|' + r.k, w = was.get(key);
        seen.add(key);
        if (!w) { r.chg = true; r.was = 'none'; }
        else if (w.copy !== r.copy) { r.chg = true; r.was = w.copy; }
      }));
      base.forEach(s => s.rows.forEach(r => {
        if (seen.has(s.title + '|' + r.k)) return;
        let sec = sections.find(x => x.title === s.title);
        if (!sec) sections.push(sec = { title: s.title, rows: [] });
        sec.rows.push({ k: r.k, html: '<span class="dim">none</span>', copy: 'none', chg: true, was: r.copy });
      }));
      const kids = (states[view]?.diff || []).filter(d => d.e !== node).slice(0, 10);
      if (kids.length) {
        inside = `<div class="sec"><div class="st">Changes inside</div>${kids.map(d =>
          `<span class="sub">${esc(describe(d.e))}</span>` + d.ch.map(([p, a, b]) =>
            `<span class="ch"><b>${esc(p)}</b> ${esc(hexAll(fmt(readTransform(a))))} → ${esc(hexAll(fmt(readTransform(b))))}</span>`).join('')).join('')}</div>`;
      }
    }

    const rowHtml = r => `<div class="row${r.chg ? ' chg' : ''}" data-copy="${esc(r.copy)}"><span class="k">${r.k}</span><span class="v">${r.html}${r.chg ? `<span class="was">${esc(r.was)}</span>` : ''}</span></div>`;
    const avail = isPinned && states ? STATES.filter(s => states[s.id]) : [];
    const tabs = avail.length > 1
      ? `<div class="tabs">${avail.map((s, i) => `<button type="button" data-st="${s.id}" class="${s.id === view ? 'on' : ''}" title="${i + 1}">${s.label}</button>`).join('')}</div>`
      : '';
    const hint = isPinned
      ? `${avail.length > 1 ? '1–' + avail.length + ' states · ' : ''}Click a value to copy · Enter / ⇧Enter child / parent · Alt+hover to measure · Esc to unpin`
      : 'Click to pin (states, copy) · Alt+hover to measure';

    card.innerHTML = `<div class="hd"><div class="sel">${esc(selector(node))}</div>${tabs}</div>` +
      sections.map(s => `<div class="sec"><div class="st">${s.title}</div>${s.rows.map(rowHtml).join('')}</div>`).join('') +
      inside + `<div class="hint">${hint}</div>`;
    card.classList.toggle('pinned', isPinned);
  }

  function placeCard(r) {
    const w = card.offsetWidth, h = card.offsetHeight, g = 12;
    let x = r.right + g;
    if (x + w > innerWidth - 8) x = r.left - w - g;
    if (x < 8) x = Math.min(innerWidth - w - 8, Math.max(8, mouse.x + 16));
    const y = Math.min(Math.max(8, r.top), innerHeight - h - 8);
    card.style.left = x + 'px';
    card.style.top = Math.max(8, y) + 'px';
  }

  // Inside a device iframe the card is drawn by the outer page, on the grey stage beside the
  // device, so it never covers the prototype (the boxes and lines stay in here)
  const remote = () => { if (isTop) return null; try { return parent.__inspectorApi?.remoteCard || null; } catch (_) { return null; } };
  let cardShown = false, remoteOwner = null;

  function showCard(node) {
    const key = node === pinned ? 'pin:' + view : 'hover';
    let html = null;
    if (cardKey !== key || !cardShown || card.__node !== node) {
      const st = card.scrollTop;
      fillCard(node);
      card.__node = node; cardKey = key;
      if (node === pinned) card.scrollTop = st;
      html = card.innerHTML;
    }
    cardShown = true;
    const rem = remote();
    if (rem) { card.hidden = true; rem.show(window, html, node === pinned, node.getBoundingClientRect()); return; }
    card.hidden = false;
    // Mobile prototypes drawn in the page (not an iframe): the container marked
    // data-inspector-frame is the device — the card goes beside it, like for a device iframe
    const frameEl = node.closest?.('[data-inspector-frame]');
    if (frameEl) placeBeside(frameEl.getBoundingClientRect(), node.getBoundingClientRect());
    else { card.style.width = ''; placeCard(node.getBoundingClientRect()); }
  }
  // Card on the wider side of the stage next to the device frame `fr`, aligned to the element's top `er`;
  // it narrows to fit (300 → 220), else overlaps as usual
  function placeBeside(fr, er) {
    const g = 16, right = innerWidth - fr.right - g - 8, left = fr.left - g - 8;
    const space = Math.max(left, right);
    if (space < 220) { card.style.width = ''; placeCard(er); return; }
    const w = Math.min(300, space);
    card.style.width = w + 'px';
    const h = card.offsetHeight;
    card.style.left = (right >= left ? fr.right + g : fr.left - g - w) + 'px';
    card.style.top = Math.max(8, Math.min(er.top, innerHeight - h - 8)) + 'px';
  }
  function hideCard() {
    cardShown = false;
    if (!remoteOwner) card.hidden = true;
    remote()?.hide(window);
  }

  // Outer page side: show a card for a device iframe, beside the device frame
  const remoteCard = {
    show(win, html, isPinned, r) {
      remoteOwner = win;
      if (html != null) {
        const st = card.scrollTop;
        card.innerHTML = html;
        card.classList.toggle('pinned', isPinned);
        card.scrollTop = isPinned ? st : 0;
      }
      card.hidden = false;
      const fr = win.frameElement.getBoundingClientRect(), s = fr.width / win.innerWidth;
      const er = { left: fr.left + r.left * s, top: fr.top + r.top * s, right: fr.left + r.right * s, bottom: fr.top + r.bottom * s };
      placeBeside(fr, er);
    },
    hide(win) { if (remoteOwner === win) { remoteOwner = null; card.hidden = true; card.style.width = ''; } },
  };

  // ---------- render loop ----------
  function render() {
    layer.textContent = '';
    tag.hidden = true;
    if (!on) { hideCard(); return; }
    if (pinned && !pinned.isConnected) setPinned(null);

    if (alt && hovered) {
      const ref = pinned && pinned !== hovered ? pinned : hovered.parentElement;
      if (ref && ref !== document.documentElement) {
        const a = ref.getBoundingClientRect(), b = hovered.getBoundingClientRect();
        el('box outline' + (ref === pinned ? ' pinned' : ''), R(a));
        el('box outline', R(b));
        measure(a, b);
        showTag(b);
        if (!pinned) hideCard();
        return;
      }
    }
    if (pinned) {
      el('box outline pinned', R(pinned.getBoundingClientRect()));
      showTag(drawBoxModel(hovered && hovered !== pinned ? hovered : pinned));
      showCard(pinned);
      return;
    }
    if (hovered) { showTag(drawBoxModel(hovered)); showCard(hovered); }
    else hideCard();
  }
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); };

  // Device mode: the prototype runs in a same-origin iframe — the outer pill / I key drive the
  // inspector inside it instead of this page (which is only the grey stage)
  const frames = () => [...document.querySelectorAll('iframe')]
    .map(f => { try { return f.contentWindow.__inspectorApi; } catch (_) { return null; } })
    .filter(Boolean);
  // The stage (top page around a device iframe) is never inspected itself — checked live, because in SPA / Vite
  // projects the chrome creates the iframe after this script has run
  const stage = () => isTop && (document.documentElement.classList.contains('pc-host')
    || document.documentElement.classList.contains('is-device') || !!document.querySelector('iframe.pc-device, iframe.device'));
  const delegating = () => stage() && frames().length > 0;
  // The page's ⌘\ "hide chrome" (html.chrome-hidden on the top page) hides the pill too; I still works
  if (isTop) {
    const syncHidden = () => {
      toggle.classList.toggle('hidden', document.documentElement.classList.contains('chrome-hidden'));
      if (on && stage()) handOver();   // became a stage while on → the iframe takes over
    };
    new MutationObserver(syncHidden).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    syncHidden();
  }
  function syncPill() { toggle.classList.toggle('on', on || frames().some(a => a.isOn())); }
  function flip() {
    if (stage()) {
      const fr = frames();
      const next = !fr.some(a => a.isOn());
      fr.forEach(a => a.setOn(next));
      // iframe not ready yet: it restores the state itself from the shared sessionStorage when it loads
      if (!fr.length) try { sessionStorage.setItem(KEY, next ? '1' : ''); } catch (_) {}
      syncPill();
    } else setOn(!on);
  }
  // Stage that was turned on by mistake: switch itself off and turn the iframe's inspector on
  function handOver() {
    on = false; shield.hidden = true; setPinned(null); hovered = null; cardKey = ''; schedule();
    frames().forEach(a => a.setOn(true));
    syncPill();
  }
  window.__inspectorApi = { setOn: v => setOn(v), isOn: () => on, sync: () => syncPill(), setView: v => setView(v), key: e => onKey(e), remoteCard };

  function setOn(v) {
    if (v && stage()) { frames().forEach(a => a.setOn(true)); syncPill(); return; }   // never inspect the stage
    on = v;
    if (!stage()) try { sessionStorage.setItem(KEY, on ? '1' : ''); } catch (_) {}
    syncPill();
    if (!isTop) try { parent.__inspectorApi?.sync(); } catch (_) {}
    shield.hidden = !on;
    if (on) { buildTokens(); prepareStates(); }
    else { setPinned(null); hovered = null; }
    cardKey = '';
    schedule();
  }

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => t.remove(), 1200);
  }

  // ---------- events ----------
  toggle.addEventListener('click', flip);

  // ---------- Liquid glass pill: depth while content is under it, press swell + stretch ----------
  function contentAt(doc, x, y) {
    for (const e of doc.elementsFromPoint(x, y)) {
      if (e === host) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (e.tagName === 'IFRAME') {
        try { const r = e.getBoundingClientRect(), k = r.width / e.offsetWidth || 1; return contentAt(e.contentDocument, (x - r.left) / k, (y - r.top) / k); }
        catch { return false; }
      }
      if (e instanceof SVGElement || /^(IMG|VIDEO|CANVAS|INPUT|TEXTAREA)$/.test(e.tagName)) return true;
      for (const n of e.childNodes) {
        if (n.nodeType !== 3 || !n.data.trim()) continue;
        const range = doc.createRange(); range.selectNodeContents(n);
        for (const r of range.getClientRects()) if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true;
      }
      const cs = getComputedStyle(e);
      const b = e.getBoundingClientRect(), paints = cs.backgroundImage !== 'none' || !/rgba\(.*, 0\)|transparent/.test(cs.backgroundColor);
      // small painted things (checkboxes, chips, badges, avatars) are content; a bigger fill is just a surface
      if (b.width <= 64 && b.height <= 64 && (paints || cs.boxShadow !== 'none' || parseFloat(cs.borderTopWidth) > 0)) return true;
      if (paints) return false;
    }
    return false;
  }
  // Adaptive tone (like Apple's Liquid Glass): the glass reads how light the backdrop
  // under it is and flips to its dark appearance on dark backdrops. Per point: the background layers under
  // it (topmost first, through the device iframe) are composited down to the first opaque one; media
  // (img / video / canvas) is unknown and doesn't vote. Average relative luminance with hysteresis.
  function rgbaOf(c) {
    const m = /rgba?\(([^)]+)\)/.exec(c);
    if (!m) return null;
    const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return [r, g, b, a];
  }
  function backdropAt(doc, x, y, skip) {
    const layers = [];
    for (const e of doc.elementsFromPoint(x, y)) {
      if (skip && skip.contains(e)) continue;
      if (e.checkVisibility && !e.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      if (e.tagName === 'IFRAME') {
        try {
          const r = e.getBoundingClientRect(), k = r.width / e.offsetWidth || 1;
          const inner = backdropAt(e.contentDocument, (x - r.left) / k, (y - r.top) / k);
          if (!inner) return null;
          layers.push([...inner, 1]);
        } catch { return null; }
        break;
      }
      if (/^(IMG|VIDEO|CANVAS)$/.test(e.tagName)) return null;
      const c = rgbaOf(getComputedStyle(e).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 0.99) break; }
    }
    if (!layers.length || layers[layers.length - 1][3] < 0.99) layers.push([255, 255, 255, 1]);   // the canvas
    let [r, g, b] = layers.pop();
    while (layers.length) { const [lr, lg, lb, a] = layers.pop(); r = r * (1 - a) + lr * a; g = g * (1 - a) + lg * a; b = b * (1 - a) + lb * a; }
    return [r, g, b];
  }
  const luminance = ([r, g, b]) => {
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  function darkUnder(el, skip, was) {
    const r = el.getBoundingClientRect();
    let sum = 0, n = 0;
    for (let y = r.top + 4; y < r.bottom - 2; y += 12)
      for (let x = r.left + 4; x < r.right - 2; x += 12) {
        const c = backdropAt(document, x, y, skip);
        if (c) { sum += luminance(c); n++; }
      }
    if (!n) return was;
    const l = sum / n;
    return l < 0.2 ? true : l > 0.3 ? false : was;   // ~ #7c7c7c … #959595 hysteresis band
  }
  if (isTop) setInterval(() => {
    const r = toggle.getBoundingClientRect();
    let over = false;
    for (let y = r.top + 4; y < r.bottom - 2 && !over; y += 8)
      for (let x = r.left + 4; x < r.right - 2 && !over; x += 8) over = contentAt(document, x, y);
    toggle.classList.toggle('over', over);
    toggle.classList.toggle('dark', darkUnder(toggle, host, toggle.classList.contains('dark')));
  }, 150);
  {
    let box = null;
    const set = (tx, ty, sx, sy) => Object.entries({ tx: tx + 'px', ty: ty + 'px', sx, sy }).forEach(([k, v]) => toggle.style.setProperty('--' + k, v));
    const release = () => { if (!box) return; box = null; toggle.classList.remove('pressed'); set(0, 0, 1, 1); };
    toggle.addEventListener('pointerdown', e => { box = toggle.getBoundingClientRect(); toggle.setPointerCapture(e.pointerId); toggle.classList.add('pressed'); set(0, 0, 1.08, 1.12); });
    toggle.addEventListener('pointermove', e => {
      if (!box) return;
      const dx = Math.max(-1, Math.min(1, (e.clientX - box.left - box.width / 2) / (box.width / 2)));
      const dy = Math.max(-1, Math.min(1, (e.clientY - box.top - box.height / 2) / (box.height / 2)));
      set(dx * 4, dy * 3, 1.08 + 0.05 * Math.abs(dx), 1.12 + 0.08 * Math.abs(dy) - 0.04 * Math.abs(dx));
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => toggle.addEventListener(t, release));
  }
  card.addEventListener('click', e => {
    const tab = e.target.closest('[data-st]');
    if (tab) { remoteOwner ? remoteOwner.__inspectorApi.setView(tab.dataset.st) : setView(tab.dataset.st); return; }
    const r = e.target.closest('.row');
    if (!r) return;
    navigator.clipboard?.writeText(r.dataset.copy).then(() => toast('Copied: ' + r.dataset.copy), () => {});
  });

  shield.addEventListener('mousemove', e => {
    mouse = { x: e.clientX, y: e.clientY };
    alt = e.altKey;
    const t = pick(e.clientX, e.clientY);
    if (t !== hovered) hovered = t;
    schedule();
  });
  shield.addEventListener('mouseleave', () => { hovered = null; schedule(); });
  // Nothing done on the inspector's own layers (shield, card, pill) may reach the page: its "click
  // outside" handlers (document mousedown / click) would close open dropdowns / popovers, and a
  // mousedown would move focus away (an open search field blurs → its list closes).
  ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'touchstart', 'touchend', 'focusin', 'focusout']
    .forEach(t => root.addEventListener(t, e => e.stopPropagation()));
  root.addEventListener('mousedown', e => { if (!e.target.closest?.('.toggle')) e.preventDefault(); });
  shield.addEventListener('click', e => {
    const t = pick(e.clientX, e.clientY);
    setPinned(t && t !== pinned ? t : null);
  });

  // Wheel → nearest scrollable element under the cursor (the shield would eat it otherwise). Always 'instant':
  // with scroll-behavior: smooth on the page every wheel event would start its own smooth animation and the next
  // one (a trackpad sends ~60/s) would cut it off — the scroll lags and stutters.
  const instant = (dx, dy) => ({ left: dx, top: dy, behavior: 'instant' });
  shield.addEventListener('wheel', e => {
    e.preventDefault();
    let dx = e.deltaX, dy = e.deltaY;
    if (e.shiftKey && !dx) { dx = dy; dy = 0; }
    const horiz = Math.abs(dx) > Math.abs(dy);
    for (let n = pick(e.clientX, e.clientY, true); n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const ok = horiz
        ? /(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth
        : /(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight;
      if (ok) { n.scrollBy(instant(dx, dy)); return; }
    }
    scrollBy(instant(dx, dy));
  }, { passive: false });

  const editable = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  function onKey(e) {
    if (e.key === 'Alt') { alt = true; schedule(); return; }
    if (e.metaKey || e.ctrlKey || (!on && editable(e.target))) return;
    // Off: I is handled in the bubble phase (onKeyLate) so an app's own "i" shortcut that calls
    // preventDefault wins; on: it's ours
    if (e.code === 'KeyI' && !e.altKey && !e.shiftKey) { if (on) { e.preventDefault(); flip(); } return; }
    // Outer stage focused (e.g. after clicking the card beside the device): keys go to the iframe
    if (!on) { if (delegating()) frames().forEach(a => a.isOn() && a.key(e)); return; }
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      if (pinned) setPinned(null); else setOn(false);
    } else if (pinned && /^Digit[1-4]$/.test(e.code)) {
      const avail = STATES.filter(s => states[s.id]);
      const s = avail[+e.code.slice(5) - 1];
      if (s) { e.preventDefault(); setView(s.id); }
    } else if (pinned && e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      const next = e.shiftKey ? pinned.parentElement : pinned.firstElementChild;
      if (next && next !== document.documentElement && next !== host && inspectable(next)) setPinned(next);
    }
  }
  addEventListener('keydown', onKey, true);
  addEventListener('keydown', e => {
    if (on || e.defaultPrevented || e.code !== 'KeyI' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || editable(e.target)) return;
    e.preventDefault(); flip();
  });
  addEventListener('pagehide', () => remote()?.hide(window));
  addEventListener('keyup', e => { if (e.key === 'Alt') { alt = false; schedule(); } }, true);
  addEventListener('blur', () => { if (alt) { alt = false; schedule(); } });
  addEventListener('scroll', () => { if (pinned) pinTop = pinned.getBoundingClientRect().top; schedule(); }, true);
  // A resize reflows the page (other line breaks, columns), so the pinned element jumps away — scroll it back to where
  // it was on screen; if it was out of view, bring it into view near the top.
  addEventListener('resize', () => {
    cardKey = '';
    if (pinned && pinned.isConnected && pinTop !== null) {
      const r = pinned.getBoundingClientRect();
      const want = pinTop >= 0 && pinTop + Math.min(r.height, 40) <= innerHeight ? pinTop : Math.min(innerHeight * 0.2, 120);
      if (Math.abs(r.top - want) > 0.5) scrollBy({ top: r.top - want, behavior: 'instant' });
      pinTop = pinned.getBoundingClientRect().top;
    }
    schedule();
  });

  // sessionStorage is shared with a device iframe: the stage never restores itself (the iframe does). Decided after
  // load — SPA / Vite apps create the device iframe after this script runs.
  const restore = () => { try { if (sessionStorage.getItem(KEY) && !stage()) setOn(true); } catch (_) {} };
  if (document.readyState === 'complete') restore(); else addEventListener('load', restore, { once: true });
})();
