# {{NAME}} — {{MODE_LABEL}} prototype (HTML/CSS/JS)

Clickable {{MODE_LABEL}} prototype of **{{NAME}}**.
Reply in the user's language. Workspace rules: `../CLAUDE.md`; kit: `~/.claude/skills/prototype-kit/`.

- Figma file: `{{FIGMA_KEY}}` (https://www.figma.com/design/{{FIGMA_KEY}})
- Built so far (Figma section → screens): —
- Stack: plain HTML + CSS + vanilla JS, no build step.

## Running

- Local: `../serve.py` → http://localhost:5173/{{SLUG}}/ — deep-link `?screen=<id>`, `?motion=reduced`.
- Chrome (`proto-chrome.js/.css`, part of the prototype): flow starting points = `FLOWS` in `app.js` — add each new section's entry screen{{WEB_CHROME}}; demo hints beside the device = `HINTS` in `app.js` (only screens where the prototype branches). ⌘\ hides it.

## Files

| File | What |
|---|---|
| `index.html` | Every screen as `<section class="screen" data-screen="id">`, overlays, toast |
| `styles.css` | Tokens in `:root` (Figma styles), then one block per section |
| `app.js` | One IIFE: chrome init, router (`go`, `onEnter`), `showToast`, one block per section |
| `proto-chrome.js/.css` | Prototype chrome (copied from the kit; update with `kit.py update-chrome`) |

## Flow (current)

—

## User decisions

—
