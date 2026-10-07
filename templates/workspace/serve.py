"""Local dev server for all prototypes: serves this workspace with caching disabled,
so edits show up on a plain page reload.

    python3 serve.py [port]  ->  http://localhost:5173          (list of prototypes)
                                 http://localhost:5173/<slug>/  (one prototype)

Every prototype page served from here gets `inspector.js` (Figma-style inspector, key I)
injected before </body>. Only locally: the prototype files stay untouched and published
copies never include it.
"""
import http.server
import os
import sys
import urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
ROOT = os.path.dirname(os.path.abspath(__file__))
INJECT = b'<script src="/inspector.js"></script>\n'


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = urllib.parse.urlsplit(self.path).path
        fs = self.translate_path(self.path)
        if os.path.isdir(fs) and path.endswith("/"):
            fs = os.path.join(fs, "index.html")
        # Prototype pages only (inside a folder), not the root list
        if fs.endswith(".html") and os.path.isfile(fs) and os.path.dirname(fs) != ROOT:
            with open(fs, "rb") as f:
                body = f.read()
            i = body.lower().rfind(b"</body>")
            body = body[:i] + INJECT + body[i:] if i >= 0 else body + INJECT
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


os.chdir(ROOT)
print(f"Prototypes: http://localhost:{PORT}")
http.server.ThreadingHTTPServer(("", PORT), NoCacheHandler).serve_forever()
