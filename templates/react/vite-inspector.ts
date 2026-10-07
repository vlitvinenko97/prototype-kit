import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

/* prototype-kit: local Figma-style inspector (key I) for Vite projects — dev server only, never in the build
   (the inspector is local-only). Point it at the workspace's inspector.js (kit: templates/workspace/inspector.js,
   update with kit.py update-tools). Usage in vite.config.ts: plugins: [react(), inspector("../inspector.js")] */
export function inspector(path: string): Plugin {
  const file = resolve(path);
  return {
    name: "prototype-kit-inspector",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/inspector.js", (_req, res) => {
        if (!existsSync(file)) { res.statusCode = 404; res.end(); return; }
        res.setHeader("Content-Type", "text/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(readFileSync(file));
      });
    },
    transformIndexHtml(html) {
      return existsSync(file) ? html.replace("</body>", '<script src="/inspector.js"></script>\n</body>') : html;
    },
  };
}
