# Prototypes workspace

Clickable prototypes built from Figma. Set up with the **prototype-kit** skill (`~/.claude/skills/prototype-kit/`) — its `SKILL.md` and `reference/*.md` describe the tools (chrome, inspector, server).
Reply in the user's language. They review in the in-app browser pane.

**Each prototype is a self-contained folder** with its own `CLAUDE.md` (Figma file, flow, decisions, gotchas). Before working on one, read its `CLAUDE.md`. Prototypes may be for different, unrelated businesses: never share code, styles, assets or brand between them — copy a pattern if useful, don't link to another folder.

| Folder | Business | Type | Figma file |
|---|---|---|---|
<!-- prototypes -->

When the user doesn't say which prototype a request is about, infer it from the Figma link (file key) or ask.

## Shared tooling (workspace root)

- `serve.py` — no-cache dev server for all prototypes: `http://localhost:5173/` (list), `http://localhost:5173/<folder>/`. Injects `inspector.js` into prototype pages (local only). Start it in the user's Terminal (`mcp__terminal__run_in_terminal`, cwd = workspace root); check first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → 200 means it's up.
- `inspector.js` — Figma-style inspector (key `I` / "Inspect" pill). **Local only: never part of a prototype or its publish, never referenced from a prototype.** See the kit's `reference/inspector.md`.
- `index.html` — local list of prototypes (not part of any prototype). Add a card per prototype.
- Each prototype carries its own copy of the chrome (`proto-chrome.js/.css`: flow starting points, device switcher, liquid glass) — see the kit's `reference/chrome.md`. ⌘\ / Ctrl+\ hides the chrome.

## Folder convention

```
<slug>/
  CLAUDE.md
  index.html, styles.css, app.js, <section>.js, proto-chrome.js, proto-chrome.css
  assets/<section>/
```
All paths in code are relative (`assets/...`). New prototype: `python3 ~/.claude/skills/prototype-kit/scripts/kit.py new . <slug> --name "…" --mode web|mobile --figma <fileKey>`.
