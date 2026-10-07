# Local dev server

## Local
- `python3 serve.py [port]` at the workspace root → `http://localhost:5173/` (list), `/<slug>/` (prototype). No-cache; injects the inspector into prototype pages.
- Start it in the **user's Terminal** (`mcp__terminal__run_in_terminal`, cwd = workspace root; without the desktop app: give the user the command), not with Bash / `preview_start` when the workspace is under `~/Desktop` / `~/Documents` (macOS privacy: those servers can't read it). Check first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/` → 200 = already up (a second one fails with "Address already in use").
- `file://` doesn't work. No `.claude/launch.json`.
- All paths in code relative (`assets/…`) so the files work under `localhost:5173/<slug>/` and wherever the project later publishes them.
- Publishing / deploy isn't part of the kit — set it up per project when the user asks.

## Vite (React / Vue projects)
- No `serve.py` — the project's own dev server (`npm run dev`) serves the app; the inspector comes from the
  `vite-inspector.ts` plugin. Pin the port in `vite.config` (`server: { port, strictPort: true }`) so links stay stable.
- Start it with `preview_start` and a `.claude/launch.json` entry (`npm run dev`, the port); if the pane's server can't
  read the project folder (macOS privacy for `~/Desktop` / `~/Documents`), start it in the user's Terminal.
