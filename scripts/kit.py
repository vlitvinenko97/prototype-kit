#!/usr/bin/env python3
"""prototype-kit scaffolding.

  kit.py init <workspace>                       set up a workspace (serve.py, inspector.js, index.html, CLAUDE.md)
  kit.py new <workspace> <slug> --name "Brand" --mode web|mobile [--figma KEY]
                                                create a prototype folder (inits the workspace if needed)
  kit.py update-chrome <prototype-dir>          overwrite proto-chrome.js/.css with the kit's current version
  kit.py update-tools <workspace>               overwrite serve.py + inspector.js with the kit's current version
  kit.py vite <project>                         React / Vue + Vite project: install / update the kit's files
                                                (public/proto-chrome.*, src/proto-chrome.d.ts, vite-inspector.ts,
                                                inspector.js) and print the wiring steps
  kit.py wordpress <wp-content>                 WordPress site: install / update the Prototype Kit plugin
                                                (wp-content/plugins/prototype-kit/ = the WP glue + the kit's chrome
                                                and inspector in kit/) and print the next steps
  kit.py wordpress --zip <file.zip>             the same plugin as a zip (upload in wp-admin → Plugins → Add new)
  kit.py update-check                           is a newer kit version in its git repository? (fetch + compare;
                                                skipped when the kit isn't a git checkout or offline)
  kit.py onboard [--check] [--target PATH]      install / update the kit rules (reference/kit-rules.md) in
                                                ~/.claude/CLAUDE.md; --check only reports: missing / outdated / ok

Never overwrites existing files except in the update-* commands.
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import tempfile
import sys

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
T_WS = os.path.join(KIT, "templates", "workspace")
T_PR = os.path.join(KIT, "templates", "prototype")
T_RE = os.path.join(KIT, "templates", "react")
T_WP = os.path.join(KIT, "templates", "wordpress", "prototype-kit")
RULES_SRC = os.path.join(KIT, "reference", "kit-rules.md")
# Bump when reference/kit-rules.md changes: every teammate's installed block is then refreshed on next use.
RULES_VERSION = 7


def say(msg):
    print(msg)


def escape_for(dst, value):
    """Make a substituted value safe for the file it lands in (names may contain <, ", */ …)."""
    if dst.endswith(".html"):
        return html.escape(value)
    if dst.endswith(".js"):
        # inside "…" strings and /* … */ comments
        return json.dumps(value, ensure_ascii=False)[1:-1].replace("*/", "*\\/").replace("<", "\\u003c")
    if dst.endswith(".css"):
        return value.replace("*/", "* /")
    return value


def copy_if_missing(src, dst, subst=None):
    if os.path.exists(dst):
        say(f"  keep   {dst} (exists)")
        return False
    with open(src, encoding="utf-8") as f:
        text = f.read()
    for k, v in (subst or {}).items():
        text = text.replace("{{" + k + "}}", escape_for(dst, v))
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        f.write(text)
    if dst.endswith(".sh") or dst.endswith(".py"):
        os.chmod(dst, 0o755)
    say(f"  create {dst}")
    return True


def init_ws(ws):
    ws = os.path.abspath(ws)
    os.makedirs(ws, exist_ok=True)
    say(f"Workspace {ws}")
    for name in ("serve.py", "inspector.js", "index.html", "CLAUDE.md"):
        copy_if_missing(os.path.join(T_WS, name), os.path.join(ws, name))
    return ws


def new_proto(ws, slug, name, mode, figma):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
        sys.exit("slug: lowercase letters, digits, dashes")
    ws = init_ws(ws)
    d = os.path.join(ws, slug)
    if os.path.exists(os.path.join(d, "index.html")):
        sys.exit(f"{d} already has a prototype")
    say(f"Prototype {d} ({mode})")
    subst = {
        "NAME": name, "SLUG": slug, "MODE": mode, "FIGMA_KEY": figma or "—",
        "MODE_LABEL": "mobile app" if mode == "mobile" else "web",
                "WEB_CHROME": "; device switcher Desktop / Tablet / Mobile, Default sizes panel, resizable frame (`devices` option)" if mode == "web" else "; the phone `#device` gets `data-inspector-frame`",
    }
    copy_if_missing(os.path.join(T_PR, f"index.{mode}.html"), os.path.join(d, "index.html"), subst)
    for f in ("styles.css", "app.js", "proto-chrome.js", "proto-chrome.css", "CLAUDE.md"):
        copy_if_missing(os.path.join(T_PR, f), os.path.join(d, f), subst)
    os.makedirs(os.path.join(d, "assets"), exist_ok=True)

    # card in the local list
    idx = os.path.join(ws, "index.html")
    with open(idx, encoding="utf-8") as f:
        s = f.read()
    if f'href="{slug}/"' not in s:
        card = f'    <a class="card" href="{slug}/"><b>{html.escape(name)}</b><span>{"Mobile app" if mode == "mobile" else "Web"}</span></a>\n'
        s = s.replace('  </div>\n</main>', card + '  </div>\n</main>', 1)
        with open(idx, "w", encoding="utf-8") as f:
            f.write(s)
        say(f"  card   {idx}")
    # row in the workspace CLAUDE.md
    md = os.path.join(ws, "CLAUDE.md")
    with open(md, encoding="utf-8") as f:
        s = f.read()
    if f"`{slug}/`" not in s and "<!-- prototypes -->" in s:
        row = f"| `{slug}/` | {name} | {'Mobile app' if mode == 'mobile' else 'Web'} | `{figma or '—'}` |\n<!-- prototypes -->"
        s = s.replace("<!-- prototypes -->", row, 1)
        with open(md, "w", encoding="utf-8") as f:
            f.write(s)
        say(f"  row    {md}")
    say(f"\nLocal: python3 {os.path.join(ws, 'serve.py')}  →  http://localhost:5173/{slug}/")


def force_copy(src, dst):
    shutil.copyfile(src, dst)
    say(f"  update {dst}")


VITE_STEPS = """
Wire it once (see reference/chrome.md → "React / Vite"):
  index.html   <link rel="stylesheet" href="/proto-chrome.css"> in <head>;
               <script src="/proto-chrome.js"></script> BEFORE <script type="module" src="/src/main.(t|j)sx">
  main         const pc = window.ProtoChrome.init({ id, title, mode, defaultScreen, flows, flowKeys, devices });
               if (!pc.isHost) mount the app   (web: the top page is only the stage around the device iframe)
  router       window.ProtoChrome.screen(id) in an effect on the current screen
  vite.config  import { inspector } from "./vite-inspector";  plugins: [..., inspector("./inspector.js")]
               (+ add vite-inspector.ts to tsconfig.node.json "include" if it lists files)
"""


def vite(project):
    if not os.path.exists(os.path.join(project, "package.json")):
        sys.exit(f"{project}: no package.json — not a Vite project")
    for src, dst in (
        (os.path.join(T_PR, "proto-chrome.js"), os.path.join(project, "public", "proto-chrome.js")),
        (os.path.join(T_PR, "proto-chrome.css"), os.path.join(project, "public", "proto-chrome.css")),
        (os.path.join(T_RE, "proto-chrome.d.ts"), os.path.join(project, "src", "proto-chrome.d.ts")),
        (os.path.join(T_RE, "vite-inspector.ts"), os.path.join(project, "vite-inspector.ts")),
        # local-only: project root, never public/ (the plugin serves it in dev; the build doesn't contain it)
        (os.path.join(T_WS, "inspector.js"), os.path.join(project, "inspector.js")),
    ):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        force_copy(src, dst)
    say(VITE_STEPS)


WP_STEPS = """
Next (see reference/chrome.md → "WordPress"):
  wp-admin     Plugins → activate "Prototype Kit"; Settings → Prototype Kit: environments (default: all but
               production), tools, the panel's points (page + section)
  wp-config    define( 'WP_ENVIRONMENT_TYPE', 'local' );   (staging / production on the other servers)
  theme        optional: filter prototype_kit_config (id, devices, hints), prototype_kit_points (suggested points);
               in JS: window.ProtoKitWP?.pc (pc.isHost = the stage page: boot nothing), window.ProtoChrome ?? no-op
"""


def kit_rev():
    try:
        return subprocess.run(["git", "-C", KIT, "rev-parse", "--short", "HEAD"], capture_output=True, text=True,
                              check=True).stdout.strip() or "unknown"
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def build_wp_plugin(dest):
    """The plugin folder = templates/wordpress/prototype-kit + the kit's chrome / inspector in kit/ + the kit version."""
    rev = kit_rev()
    shutil.copytree(T_WP, dest, dirs_exist_ok=True)
    os.makedirs(os.path.join(dest, "kit"), exist_ok=True)
    for src in (os.path.join(T_PR, "proto-chrome.js"), os.path.join(T_PR, "proto-chrome.css"),
                os.path.join(T_WS, "inspector.js")):
        shutil.copyfile(src, os.path.join(dest, "kit", os.path.basename(src)))
    with open(os.path.join(dest, "kit", "KIT_VERSION"), "w") as f:
        f.write(f"prototype-kit {rev}\n")
    # asset version = plugin version + kit commit: browsers drop cached chrome / inspector after an update
    main_php = os.path.join(dest, "prototype-kit.php")
    with open(main_php) as f:
        code = f.read()
    code = re.sub(r"(define\( 'PROTOTYPE_KIT_VERSION', ')([^']+)(' \);)", lambda m: f"{m.group(1)}{m.group(2).split('+')[0]}+{rev}{m.group(3)}", code)
    with open(main_php, "w") as f:
        f.write(code)
    return rev


def wordpress(target, zip_path):
    if zip_path:
        with tempfile.TemporaryDirectory() as tmp:
            rev = build_wp_plugin(os.path.join(tmp, "prototype-kit"))
            out = shutil.make_archive(os.path.splitext(os.path.abspath(zip_path))[0], "zip", tmp, "prototype-kit")
        say(f"  zip    {out} (prototype-kit {rev})")
        return
    if not target:
        sys.exit("kit.py wordpress <wp-content> | --zip <file.zip>")
    # accepts the WordPress root, wp-content or wp-content/plugins
    for plugins in (os.path.join(target, "wp-content", "plugins"), os.path.join(target, "plugins"), target):
        if os.path.isdir(plugins) and os.path.basename(os.path.normpath(plugins)) == "plugins":
            break
    else:
        sys.exit(f"{target}: no wp-content/plugins here — pass the WordPress root or its wp-content")
    dest = os.path.join(plugins, "prototype-kit")
    action = "update" if os.path.exists(dest) else "add   "
    rev = build_wp_plugin(dest)
    say(f"  {action} {dest} (prototype-kit {rev})")
    say(WP_STEPS)


def update_check():
    import subprocess
    git = lambda *a: subprocess.run(["git", "-C", KIT, *a], capture_output=True, text=True, timeout=15)
    try:
        if git("rev-parse", "--is-inside-work-tree").stdout.strip() != "true":
            say("kit: not a git checkout — no update check")
            return
        if git("rev-parse", "--abbrev-ref", "@{u}").returncode != 0:
            say("kit: no upstream branch — no update check")
            return
        if git("fetch", "-q").returncode != 0:
            say("kit: can't reach the repository (offline?) — skipped")
            return
        behind = int(git("rev-list", "--count", "HEAD..@{u}").stdout.strip() or 0)
        dirty = bool(git("status", "--porcelain").stdout.strip())
    except (OSError, subprocess.TimeoutExpired):
        say("kit: update check skipped")
        return
    if dirty:
        say("kit: LOCAL EDITS in the kit folder — they block updates; kit changes go through the repository")
    say(f"kit: {behind} new commit(s) — update: git -C {KIT} pull --ff-only" if behind else "kit: up to date")


def onboard(target, check):
    with open(RULES_SRC, encoding="utf-8") as f:
        src = f.read()
    body = src.split("<!-- RULES:BEGIN -->", 1)[1].split("<!-- RULES:END -->", 1)[0].strip("\n")
    begin = f"<!-- prototype-kit:rules v{RULES_VERSION} -->"
    end = "<!-- /prototype-kit:rules -->"
    block = f"{begin}\n{body}\n{end}"
    text = open(target, encoding="utf-8").read() if os.path.exists(target) else ""
    m = re.search(r"<!-- prototype-kit:rules v(\d+) -->.*?<!-- /prototype-kit:rules -->", text, re.S)
    state = "missing" if not m else ("ok" if int(m.group(1)) >= RULES_VERSION else f"outdated (v{m.group(1)} < v{RULES_VERSION})")
    if check:
        say(f"kit rules in {target}: {state}")
        return
    if state == "ok":
        say(f"  keep   {target} (kit rules v{RULES_VERSION} already installed)")
        return
    text = text[:m.start()] + block + text[m.end():] if m else (text.rstrip("\n") + "\n\n" if text.strip() else "") + block + "\n"
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8") as f:
        f.write(text)
    say(f"  {'update' if m else 'add   '} kit rules v{RULES_VERSION} → {target}")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("init"); a.add_argument("workspace")
    a = sub.add_parser("new"); a.add_argument("workspace"); a.add_argument("slug")
    a.add_argument("--name", required=True); a.add_argument("--mode", choices=["web", "mobile"], required=True)
    a.add_argument("--figma", default="")
    a = sub.add_parser("update-chrome"); a.add_argument("prototype")
    a = sub.add_parser("update-tools"); a.add_argument("workspace")
    a = sub.add_parser("vite"); a.add_argument("project")
    a = sub.add_parser("wordpress"); a.add_argument("target", nargs="?"); a.add_argument("--zip", default="")
    sub.add_parser("update-check")
    a = sub.add_parser("onboard"); a.add_argument("--check", action="store_true")
    a.add_argument("--target", default=os.path.expanduser("~/.claude/CLAUDE.md"))
    args = p.parse_args()
    if args.cmd == "init":
        init_ws(args.workspace)
    elif args.cmd == "new":
        new_proto(args.workspace, args.slug, args.name, args.mode, args.figma)
    elif args.cmd == "update-chrome":
        for f in ("proto-chrome.js", "proto-chrome.css"):
            force_copy(os.path.join(T_PR, f), os.path.join(args.prototype, f))
    elif args.cmd == "vite":
        vite(args.project)
    elif args.cmd == "wordpress":
        wordpress(args.target, args.zip)
    elif args.cmd == "update-check":
        update_check()
    elif args.cmd == "onboard":
        onboard(args.target, args.check)
    elif args.cmd == "update-tools":
        for f in ("serve.py", "inspector.js"):
            force_copy(os.path.join(T_WS, f), os.path.join(args.workspace, f))


if __name__ == "__main__":
    main()
