import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";

const viteLogger = createLogger();

// Get the project root directory without relying on import.meta.url so the
// bundled CJS build works in production.
const projectRoot = process.cwd();
const clientRoot = path.resolve(projectRoot, "client");

export async function setupVite(server: Server, app: Express) {
  const port = parseInt(process.env.PORT || "5000", 10);
  
  const serverOptions = {
    middlewareMode: true,
    hmr: { 
      server, 
      path: "/vite-hmr",
      protocol: "ws",
    },
    allowedHosts: true as const,
    watch: {
      usePolling: false,
      interval: 100,
    },
  };

  // Load the vite config
  const config = await viteConfig();

  const vite = await createViteServer({
    ...config,
    root: clientRoot,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // Don't exit on errors, just log them
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Cache template to avoid reading from disk on every request
  let templateCache: string | null = null;
  let templateCacheTime = 0;
  const CACHE_TTL = 1000; // 1 second cache

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(clientRoot, "index.html");

      // Cache template for better performance
      const now = Date.now();
      if (!templateCache || (now - templateCacheTime) > CACHE_TTL) {
        templateCache = await fs.promises.readFile(clientTemplate, "utf-8");
        templateCacheTime = now;
      }
      
      let template = templateCache;
      // Only add version query for initial load, not for HMR updates
      if (!url.includes("vite-hmr") && !url.includes("?")) {
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${Date.now()}"`,
        );
      }
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
