<!-- Source of the kit rules that `kit.py onboard` installs into each teammate's ~/.claude/CLAUDE.md.
     Everything between the RULES markers is copied verbatim. When you change a rule here, bump RULES_VERSION
     in scripts/kit.py — every teammate's block is then updated on their next use of the skill. -->

<!-- RULES:BEGIN -->
## Prototype kit rules (installed by the prototype-kit skill; edit the skill, not this block)

The `prototype-kit` skill (`~/.claude/skills/prototype-kit/`) provides the prototype environment tools: the chrome panel
(flow starting points, Desktop/Tablet/Mobile switcher, default sizes, resizable device frame, liquid-glass capsule,
⌘\ / Ctrl+\ to hide, system toasts, demo hints), the inspector panel (Figma-style, key `I`) and the local dev server.

- **Reuse the kit — never re-implement it.** Whenever a prototype needs any of these tools — new prototype, React/Vue/Vite
  project, or an old prototype carrying its own copy — load the skill and plug in the kit's files
  (`kit.py new` / `update-chrome` / `vite`); never write or hand-port your own version.
- The chrome ships with the prototype (it is deployed); the inspector never does (local dev only).
- System messages about the prototype's limits ("isn't designed yet", "only page 1 is designed", "isn't part of the
  prototype") always use the kit's toast: `data-action="soon"` / `data-soon="…"` or `ProtoChrome.toast(msg)` —
  never a hand-made toast.
- Demo hints beside the device (prototype rules the viewer can't guess: registered vs new email, right vs wrong code)
  always use the kit's hint card: `hints` in `ProtoChrome.init` / `ProtoChrome.hint(def)` — never a hand-made card.
- The prototype must also run with the kit removed: call it through the template's no-op fallback
  (`const ProtoChrome = window.ProtoChrome ?? {…}` in `app.js`; `window.ProtoChrome?.…` in React / Vue) and never make
  project styles or scripts depend on kit classes (`pc-*`, `chrome-hidden`).
- Never edit the kit folder itself; project tweaks stay in the project. A change for everyone = a merge request to the
  kit's git repository (see the kit's README), merged by its owner. Update the kit with `git pull`.

<!-- RULES:END -->
