import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // In production, static files are in dist/public relative to project root
  // __dirname in bundled CJS is dist/, so we need to go up and then to dist/public
  // Or use process.cwd() for more reliable path resolution
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with proper MIME types
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      // Ensure JavaScript files are served with correct MIME type
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      }
    },
  }));

  // Ensure uploads directory exists
  const uploadsDir = path.resolve(distPath, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // fall through to index.html if the file doesn't exist
  // BUT exclude API routes and asset requests - they should have already been handled
  app.use("*", (req, res, next) => {
    const url = req.originalUrl;
    
    // Don't intercept API routes - let them 404 properly
    if (url.startsWith("/api/")) {
      return next();
    }
    
    // Don't intercept asset requests (JS, CSS, images, etc.) - let them 404 if missing
    if (url.startsWith("/assets/") || 
        url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp)$/i)) {
      return next();
    }
    
    // Only serve index.html for actual page routes (SPA routing)
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
