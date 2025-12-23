import * as React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// CRITICAL: Make React available globally IMMEDIATELY
// This must happen before any vendor chunks try to use createContext
if (typeof window !== "undefined") {
  (window as any).React = React;
  (window as any).ReactDOM = { createRoot };
  // Also expose createContext directly for easier access
  (window as any).ReactCreateContext = React.createContext;
}

// Render immediately - React is now available globally
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(React.createElement(App));
}
