// CRITICAL: Import React FIRST and make it available globally IMMEDIATELY
// This must happen synchronously before any async vendor chunks load
import * as React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Make React available globally BEFORE any other imports
// This ensures wallet-vendor chunk can access React.createContext
if (typeof window !== "undefined") {
  // Set React globally IMMEDIATELY - this must happen before App.tsx imports
  (window as any).React = React;
  (window as any).ReactDOM = { createRoot };
  // Expose all React hooks and APIs that vendor chunks might need
  (window as any).ReactCreateContext = React.createContext;
  (window as any).ReactUseState = React.useState;
  (window as any).ReactUseEffect = React.useEffect;
  (window as any).ReactUseMemo = React.useMemo;
  (window as any).ReactUseCallback = React.useCallback;
  (window as any).ReactUseRef = React.useRef;
  (window as any).ReactUseContext = React.useContext;
}

// CRITICAL: Use dynamic import for App.tsx so it loads AFTER React is set up
// This prevents App.tsx from being evaluated before React is available globally
const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  
  // Dynamic import ensures App.tsx and its dependencies load AFTER React is set up
  import("./App").then(({ default: App }) => {
    root.render(React.createElement(App));
  }).catch((error) => {
    console.error("Failed to load App:", error);
  });
}
