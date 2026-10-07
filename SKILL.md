---
name: prototype-kit
description: Sets up the clickable-prototype environment tools in any project: a liquid-glass chrome panel (flow starting points, device switcher with default sizes and a resizable frame, ⌘\ to hide, system toasts for unbuilt parts), the local Figma-style inspector panel and a no-cache dev server — for plain HTML or React/Vue/Vite prototypes, web or mobile. Use when the user asks to deploy / set up / spin up the prototype environment, the chrome or the inspector in a project, start a new prototype folder, or update the kit's tools in a project. Also use whenever a prototype is ported / rewritten to another stack (React, Vue, Vite…) or any prototype contains chrome elements the kit already has — reuse the kit's modules, never re-implement them.
---

# Prototype kit

Environment tools for clickable prototypes: two panels — the **chrome** (flows + devices + system toasts + demo hints, shipped with the prototype) and the **inspector** (local only) — plus the dev server. The kit doesn't cover how screens are designed or coded. Reply in the user's language.

## First step every time — kit version + kit rules
Before anything else run `python3 ~/.claude/skills/prototype-kit/scripts/kit.py update-check`:
- `N new commit(s)` → tell the user a newer kit is available and offer the printed `git pull` (run it on their yes).
- `LOCAL EDITS` → tell the user their copy of the kit has local changes that block updates (see "Changing the kit").
- anything else (up to date / not a git checkout / offline) → continue.

Then run `python3 ~/.claude/skills/prototype-kit/scripts/kit.py onboard --check`.
- `ok` → continue.
- `missing` (first use on this machine) or `outdated` (the kit's rules changed) → tell the user in one line that the kit installs the kit rules into their `~/.claude/CLAUDE.md` (a marked block; their own content stays untouched) so they apply in every project, even without the skill loaded — then run `kit.py onboard`. The rules' source is `reference/kit-rules.md`; never edit the installed block by hand.
- When a kit rule changes in `reference/kit-rules.md`, bump `RULES_VERSION` in `scripts/kit.py` so everyone's block refreshes on their next use.

## Reuse the kit — never re-implement it
If a prototype needs anything the kit provides — the chrome, the inspector, the dev server — **plug in the kit's files, don't write or hand-port your own**, also when porting a prototype to React / Vue / another stack and even if the old prototype carries its own older copy of the chrome (replace that copy with the kit module). Stack recipes: `reference/chrome.md` → "React / Vite".

## Requirements (tell the user what's missing before setting up)
- macOS (⌘\ and the macOS folder-privacy notes assume it; on Windows/Linux ⌘ = Ctrl and the privacy notes don't apply).
- Python 3 (`kit.py`, `serve.py`): `python3 --version`.
- React / Vue projects: Node + the project's Vite dev server.
- A browser to review in. The Claude desktop app's built-in browser is the smoothest; any browser works.

## Without the Claude desktop app (CLI, VS Code, JetBrains)
The references name desktop-app tools (`preview_start`, the built-in browser, `mcp__terminal__run_in_terminal`). If they
aren't available: give the user the command to run in their own terminal (`python3 serve.py`, or `npm run dev`) in a
`bash` block, tell them which URL to open in their browser, and ask them to confirm what they see (capsule, devices,
⌘\, Inspect pill) instead of checking it yourself.

## Files
- `README.md` — for people: install (`git clone`), update (`git pull`), contributing.
- `scripts/kit.py` — scaffolding (`init`, `new`, `update-chrome`, `update-tools`, `vite`) + `update-check` (newer kit in git?) + `onboard` (kit rules → `~/.claude/CLAUDE.md`). Never overwrites except `update-*` / the marked rules block.
- `templates/workspace/` — `serve.py` (no-cache server, injects the inspector), `inspector.js`, `index.html` (local list), `CLAUDE.md`.
- `templates/react/` — `vite-inspector.ts` (dev-only Vite plugin for the inspector), `proto-chrome.d.ts` (types); installed by `kit.py vite`.
- `templates/prototype/` — starter `index.web.html` / `index.mobile.html`, `styles.css`, `app.js` (chrome init + minimal router), `proto-chrome.js/.css`, `CLAUDE.md`. (No deploy setup — publishing is decided per project.)
- `reference/` — read the relevant one before acting:
  - `chrome.md` — the panel: API, behaviour, rejected alternatives.
  - `inspector.md` — inspector features and the local-only rule.
  - `server.md` — the local dev server.
  - `kit-rules.md` — the rules `onboard` installs for every teammate.

## Setting up the environment
1. **Ask whether it's mobile or web** (AskUserQuestion: Web — desktop dashboard/site in a device iframe with Desktop/Tablet/Mobile switcher; Mobile — iOS/Android app drawn as a phone on a grey stage). Also get the prototype name (→ lowercase slug) and, optionally, the Figma file key for its CLAUDE.md.
2. Workspace = the current project root unless the user names another. Run:
   `python3 ~/.claude/skills/prototype-kit/scripts/kit.py new <workspace> <slug> --name "<Name>" --mode web|mobile --figma <fileKey>`
   (inits the workspace — serve.py, inspector.js, index.html, CLAUDE.md — if missing; adds the card + table row).
   If the project already has its own CLAUDE.md / index.html, the script keeps them — merge the kit's rules into the existing CLAUDE.md by hand.
3. Start the server (see `server.md`; check it isn't already running) and open `http://localhost:5173/<slug>/`; check the capsule, the device switcher (web) / phone (mobile), ⌘\, the Inspect pill.
4. Later screens: add each entry screen to `FLOWS` in `app.js`; for web set `devices` defaults if the design needs others.
   One long page (landing) whose points are its sections → points scroll, never reload: `reference/chrome.md` → "One-page flows".

## Adding the chrome to an existing prototype
**Framework project (React / Vue / anything on Vite — has `package.json` + `vite.config`)** → don't use the vanilla steps below:
run `python3 ~/.claude/skills/prototype-kit/scripts/kit.py vite <project>` (copies the chrome to `public/`, types to `src/`,
the inspector plugin + `inspector.js` to the project root; no `serve.py`), then do the wiring it prints — details and
port gotchas in `reference/chrome.md` → "React / Vite"; dev server in `reference/server.md` → "Vite". Same command updates the kit files later.

**Plain HTML/JS prototype:** Copy `proto-chrome.js/.css` into it, include them before the app's script, call `ProtoChrome.init({...})` before the router boots (web: `if (pc.isHost) return;` — the top page is only the stage), call `ProtoChrome.screen(id)` from the router, mark extra chrome with `.pc-hideable`. Make sure all asset paths are relative. Inspector: add `serve.py` + `inspector.js` at the served root (never into the prototype).

## Updating projects from the kit
`kit.py update-chrome <prototype-dir>` / `kit.py update-tools <workspace>` / `kit.py vite <project>` (Vite) overwrite with the kit's current versions — check for local edits first (diff) and tell the user.

## Changing the kit
The kit is distributed as a git repository (install / update / contributing: `README.md`); the repository is the only
source of truth and the kit's owner merges every change.
- Never edit the kit folder (templates, `reference/*.md`, scripts) on your own initiative. Any change request — even one
  about the chrome, inspector, server or toasts — is made **locally in the current project** (its files + its CLAUDE.md).
- When the user explicitly wants a change for everyone: make it on a branch of the kit repository and prepare a merge
  request for the owner (don't commit to the main branch); if `reference/kit-rules.md` changes, bump `RULES_VERSION` in
  `scripts/kit.py` in the same change. If the kit folder isn't a git checkout yet, edit it in place only on the user's
  explicit request.
- If a local change looks generally useful, mention once that it could go into the kit — the user decides.
