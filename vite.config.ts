import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

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
    react(),
    runtimeErrorOverlay(),
    ...replitPlugins,
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
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
        manualChunks: (id) => {
          // Split node_modules into vendor chunks
          if (id.includes('node_modules')) {
            // CRITICAL: Don't split React - keep it in main bundle
            // This ensures React.createContext is available when wallet-vendor loads
            if (id.includes('react') || id.includes('react-dom')) {
              return undefined; // Keep React in main bundle
            }
            // Wallet libraries
            if (id.includes('wagmi') || id.includes('@rainbow-me') || id.includes('viem')) {
              return 'wallet-vendor';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }
            if (id.includes('framer-motion')) {
              return 'motion-vendor';
            }
            // Other vendor code
            return 'vendor';
          }
          // Split dashboard pages into separate chunks
          if (id.includes('/pages/Dashboard')) {
            return 'dashboard-pages';
          }
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
      external: [], // Don't externalize anything - bundle everything
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
    exclude: [],
    esbuildOptions: {
      target: "esnext",
    },
  },
  define: {
    global: 'globalThis',
  },
  };
});
