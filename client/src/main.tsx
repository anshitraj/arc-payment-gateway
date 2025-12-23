import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Ensure React is available globally for vendor chunks
if (typeof window !== "undefined") {
  (window as any).React = React;
}

createRoot(document.getElementById("root")!).render(<App />);
