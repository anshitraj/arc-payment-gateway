// CRITICAL: Import React FIRST and make it available globally IMMEDIATELY
// This must happen synchronously before any async vendor chunks load
import * as React from "react";
import { createRoot } from "react-dom/client";

// Make React available globally BEFORE any other imports
// This ensures wallet-vendor chunk can access React.createContext
if (typeof window !== "undefined") {
  (window as any).React = React;
  (window as any).ReactDOM = { createRoot };
  // Also expose createContext directly for easier access
  (window as any).ReactCreateContext = React.createContext;
  
  // Ensure React is available even if vendor chunks load first
  // This is a fallback for cases where chunks load out of order
  if (!(window as any).React?.createContext) {
    (window as any).React = React;
  }
}

// Now import the rest of the app
import App from "./App";
import "./index.css";

// Render the app
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(React.createElement(App));
}
