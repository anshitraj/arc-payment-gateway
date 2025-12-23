// Load environment variables first, before any other imports
import { config } from "dotenv";
import { resolve } from "path";

// Determine the project root using the working directory so the build
// works in both ESM and the bundled CJS output produced for production.
// Relying on import.meta.url breaks once esbuild converts modules to CJS
// (import.meta becomes undefined after bundling).
const projectRoot = process.cwd();

// Load .env from project root
config({ path: resolve(projectRoot, ".env") });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes.js";
import { serveStatic } from "./static.js";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Enhanced API logging middleware (replaces basic logging)
import { apiLogging } from "./middleware/apiLogging.js";
app.use(apiLogging);

(async () => {
  // Initialize admin user from ADMIN_WALLET env var
  const { initializeAdminFromWallet } = await import("./admin/init.js");
  await initializeAdminFromWallet();
  
  await registerRoutes(httpServer, app);
  
  // Register admin routes
  const { registerAdminRoutes } = await import("./routes/admin.js");
  registerAdminRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    // Don't send response if headers already sent
    if (res.headersSent) {
      console.error("Error after headers sent:", err);
      return;
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error(`Error ${status}:`, message);
    res.status(status).json({ error: message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite.js");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  
  httpServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      log(`❌ Port ${port} is already in use.`);
      log(`   Please stop the process using port ${port} or change the PORT in .env`);
      log(`   To find the process: netstat -ano | findstr :${port}`);
      process.exit(1);
    } else {
      log(`Server error: ${err.message}`);
      throw err;
    }
  });

  httpServer.listen(
    port,
    "0.0.0.0",
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
