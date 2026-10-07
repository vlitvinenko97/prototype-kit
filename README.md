# prototype-kit

A Claude Code skill that sets up the environment tools for clickable prototypes in any project:

- **Chrome panel** (ships with the prototype): flow starting points, Desktop / Tablet / Mobile switcher with default
  sizes and a resizable device frame, liquid-glass capsule, system toasts for unbuilt parts, ⌘\ / Ctrl+\ to hide.
- **Inspector panel** (local dev only): Figma-style inspector, key `I`.
- **Dev server**: no-cache `serve.py` for plain HTML prototypes; React / Vue projects use their Vite server + a plugin.

Works for plain HTML/JS and React / Vue + Vite projects, web or mobile prototypes.

## Install

```bash
git clone <repo-url> ~/.claude/skills/prototype-kit
```

Then ask Claude Code to set up the prototype environment (e.g. "set up the prototype environment here"). On first use
the skill installs its rules into `~/.claude/CLAUDE.md` (a marked block — your own content stays untouched), so they
apply in every project.

Requirements: macOS (on Windows/Linux ⌘ = Ctrl), Python 3, Node for React / Vue projects, any browser. The Claude
desktop app's built-in browser is the smoothest way to review; the CLI / IDE extensions work too.

## Update

```bash
git -C ~/.claude/skills/prototype-kit pull --ff-only
```

The skill also checks for a newer version on each use and offers the pull. After pulling, the rules block in
`~/.claude/CLAUDE.md` refreshes on the next use; update a project's copies with `kit.py update-chrome <dir>`,
`kit.py update-tools <workspace>` or `kit.py vite <project>`.

## Changing the kit

The repository is the only source of truth; the kit's owner reviews and merges every change.

- Don't edit your local copy (`~/.claude/skills/prototype-kit/`) — local edits block updates and never reach the team.
- Project-specific tweaks live in the project (its files + its `CLAUDE.md`), not in the kit.
- A change for everyone → a branch + merge request to the repository. If it changes `reference/kit-rules.md`, bump
  `RULES_VERSION` in `scripts/kit.py` in the same change.

## Layout

| Path | What |
|---|---|
| `SKILL.md` | Instructions Claude follows |
| `scripts/kit.py` | `new`, `init`, `update-chrome`, `update-tools`, `vite`, `onboard` |
| `templates/prototype/` | Starter prototype + `proto-chrome.js/.css` (the chrome) |
| `templates/workspace/` | `serve.py`, `inspector.js`, local index, workspace `CLAUDE.md` |
| `templates/react/` | Vite inspector plugin + `ProtoChrome` types |
| `reference/` | `chrome.md`, `inspector.md`, `server.md`, `kit-rules.md` |
