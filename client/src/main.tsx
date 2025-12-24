// CRITICAL: Import SES/lockdown shim FIRST before any other code
// This prevents SES from executing and breaking React.createContext
import "./shims/endo-lockdown";

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Fail-safe: Check if SES/lockdown is present before React mounts
// This prevents the "can't access property 'createContext' of undefined" error
if (typeof window !== "undefined" && (window as any).lockdown) {
  console.warn(
    "[SES Guard] SES/lockdown detected before React mount. " +
    "Wallet providers will be lazy-loaded after React initialization to prevent conflicts."
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(React.createElement(App));
}
