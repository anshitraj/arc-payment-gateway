import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { disableSesLockdown } from "./vite.disable-ses-lockdown";

export default defineConfig(async () => {
  // Load Replit plugins conditionally
  let replitPlugins: any[] = [];
  if (process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined) {
    try {
      const cartographer = await import("@replit/vite-plugin-cartographer");
      const devBanner = await import("@replit/vite-plugin-dev-banner");
      replitPlugins = [cartographer.cartographer(), devBanner.devBanner()];
    } catch (e) {
      // Silently fail if plugins aren't available
      console.warn("Replit plugins not available:", e);
    }
  }

  return {
  plugins: [
    disableSesLockdown(), // MUST be first to intercept SES/lockdown imports
    react(),
    runtimeErrorOverlay(),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      // CRITICAL: Redirect ALL SES/lockdown imports to our no-op stub
      // This completely replaces SES with empty stubs
      "ses": path.resolve(import.meta.dirname, "client", "src", "shims", "ses-noop.ts"),
      "ses/lockdown": path.resolve(import.meta.dirname, "client", "src", "shims", "ses-noop.ts"),
      "@endo/lockdown": path.resolve(import.meta.dirname, "client", "src", "shims", "ses-noop.ts"),
      "@endo/ses": path.resolve(import.meta.dirname, "client", "src", "shims", "ses-noop.ts"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
    rollupOptions: {
      output: {
        // CRITICAL FIX: Use a function that ensures React is available to all chunks
        // The error occurs because vendor chunk can't access React from wallet-vendor
        manualChunks: {
          // Use object-based chunk configuration for cleaner dependency management
          // This avoids circular dependencies that arise from function-based chunking
          'react-vendor': [
            'react',
            'react-dom',
            'scheduler',
          ],
          'motion-vendor': [
            'framer-motion',
          ],
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    reportCompressedSize: false,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: false,
      interval: 100,
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
    exclude: ["ses", "@endo/lockdown"], // Exclude SES/lockdown from optimization
    esbuildOptions: {
      target: "esnext",
    },
  },
  define: {
    global: 'globalThis',
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
  };
});
