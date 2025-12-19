// Vercel serverless function entry point
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get the project root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");

// Load .env from project root
config({ path: resolve(projectRoot, ".env") });

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes.js";

const app = express();

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

// Initialize routes - wrapped in async IIFE that we await
let appReady = false;
const initApp = (async () => {
  try {
    // Initialize admin user from ADMIN_WALLET env var
    const { initializeAdminFromWallet } = await import("../server/admin/init.js");
    await initializeAdminFromWallet();
    
    // Create a mock httpServer for routes that need it
    const { createServer } = await import("http");
    const httpServer = createServer(app);
    
    await registerRoutes(httpServer, app);
    
    // Register admin routes
    const { registerAdminRoutes } = await import("../server/routes/admin.js");
    registerAdminRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message });
    });

    appReady = true;
  } catch (error) {
    console.error("Failed to initialize app:", error);
    throw error;
  }
})();

// Wait for app initialization before handling requests
app.use(async (req, res, next) => {
  if (!appReady) {
    await initApp;
  }
  next();
});

// Export the Express app for Vercel
export default app;

