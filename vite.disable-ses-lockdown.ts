/**
 * Vite Plugin: Disable SES/Lockdown
 * 
 * Hard-blocks SES/Endo lockdown at the resolver level by redirecting
 * all SES/lockdown imports to a no-op stub module.
 * 
 * This prevents SES from executing and breaking React.createContext.
 */

import type { Plugin } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Get the path to the no-op stub (ESM compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SES_NOOP_PATH = path.resolve(__dirname, "client", "src", "shims", "ses-noop.ts");

// Patterns that match SES-related imports
function isSesImport(id: string): boolean {
  // Normalize path separators
  const normalizedId = id.replace(/\\/g, '/');
  
  // Direct package imports
  if (normalizedId === 'ses' || 
      normalizedId === '@endo/lockdown' ||
      normalizedId === '@endo/ses' ||
      normalizedId.startsWith('ses/') ||
      normalizedId.startsWith('@endo/')) {
    return true;
  }
  
  // Node_modules paths containing SES
  if (normalizedId.includes('node_modules/ses/') ||
      normalizedId.includes('node_modules/@endo/') ||
      normalizedId.includes('/ses/dist/') ||
      normalizedId.includes('/ses/src/')) {
    return true;
  }
  
  // Lockdown-install specifically (used by wallet libraries)
  if (normalizedId.includes('lockdown-install') ||
      normalizedId.includes('lockdown.js') ||
      normalizedId.includes('lockdown.mjs') ||
      normalizedId.includes('lockdown.cjs')) {
    return true;
  }
  
  return false;
}

export function disableSesLockdown(): Plugin {
  return {
    name: "disable-ses-lockdown",
    enforce: "pre", // Run before all other plugins
    
    resolveId(id: string, importer?: string) {
      // Check if this is a SES-related import
      if (isSesImport(id)) {
        console.log(`[SES Block] Redirecting import: ${id}`);
        return SES_NOOP_PATH;
      }
      
      return null;
    },
    
    load(id: string) {
      // If somehow SES code is loaded, replace it with no-op
      const normalizedId = id.replace(/\\/g, '/');
      if (isSesImport(normalizedId)) {
        console.log(`[SES Block] Replacing module: ${id}`);
        return `
// SES/Lockdown blocked - replaced with no-op
const g = globalThis;
export function lockdown() {}
export function harden(x) { return x; }
export class Compartment {
  constructor(endowments, modules, options) {
    this._endowments = endowments || {};
    this._globalLexicals = (options && options.globalLexicals) || {};
  }
  get globalThis() { return Object.assign({}, g, this._endowments, this._globalLexicals); }
  evaluate() { return undefined; }
  import() { return Promise.resolve({}); }
  load() { return Promise.resolve(); }
  importNow() { return {}; }
}
export function repairIntrinsics() {}
export const assert = Object.assign(function(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }, {
  typeof: function(){}, error: function(m){ return new Error(m); }, fail: function(m){ throw new Error(m); },
  equal: function(){}, string: function(){}, note: function(){}, details: function(){}, Fail: function(){},
  quote: function(v){ return JSON.stringify(v); }
});
if (typeof g.lockdown !== 'function') g.lockdown = lockdown;
if (typeof g.harden !== 'function') g.harden = harden;
if (typeof g.Compartment !== 'function') g.Compartment = Compartment;
if (typeof g.repairIntrinsics !== 'function') g.repairIntrinsics = repairIntrinsics;
if (typeof g.assert !== 'function') g.assert = assert;
export default { lockdown, harden, Compartment, repairIntrinsics, assert };
`;
      }
      
      return null;
    },
    
    transform(code: string, id: string) {
      // Skip HTML files - don't transform our SES blocking script
      if (id.endsWith('.html')) {
        return null;
      }
      
      // AGGRESSIVE: Strip ALL SES code from ANY file (not just node_modules)
      // This catches SES that might be bundled into our own code
      if (code.includes('lockdown') || 
          code.includes('SES Removing') || 
          code.includes('unpermitted intrinsics') ||
          code.includes('lockdown-install') ||
          code.includes('@endo') ||
          code.includes('repairIntrinsics')) {
        console.log(`[SES Block] Transforming code in: ${id}`);
        
        let transformed = code;
        
        // Replace all lockdown() calls with no-ops
        transformed = transformed.replace(/\blockdown\s*\(\s*\)/g, '(() => {})()');
        transformed = transformed.replace(/\blockdown\s*\(\s*\{[^}]*\}\s*\)/g, '(() => {})()');
        transformed = transformed.replace(/\blockdown\s*\(\s*\{[^}]*\}[^)]*\)/g, '(() => {})()');
        transformed = transformed.replace(/\.lockdown\s*\(/g, '.noop(');
        transformed = transformed.replace(/lockdown\s*\(\s*options\s*\)/g, '(() => {})()');
        
        // Replace harden calls with identity function
        transformed = transformed.replace(/\bharden\s*\(\s*([^)]+)\s*\)/g, '($1)');
        
        // Replace repairIntrinsics
        transformed = transformed.replace(/\brepairIntrinsics\s*\(\s*\)/g, '(() => {})()');
        transformed = transformed.replace(/\brepairIntrinsics\s*\(\s*[^)]*\)/g, '(() => {})()');
        
        // Remove SES warning/error messages completely
        transformed = transformed.replace(/console\.(warn|log|error|info)\s*\(\s*["']SES[^"']*["'][^)]*\)/g, '');
        transformed = transformed.replace(/console\.(warn|log|error|info)\s*\(\s*["']Removing[^"']*["'][^)]*\)/g, '');
        transformed = transformed.replace(/SES Removing[^\n]*/g, '');
        transformed = transformed.replace(/unpermitted intrinsics[^\n]*/g, '');
        transformed = transformed.replace(/SES_UNCAUGHT_EXCEPTION[^\n]*/g, '');
        
        // Remove entire SES error throwing blocks
        transformed = transformed.replace(/throw\s+new\s+Error\s*\(\s*["']SES[^"']*["']\)/g, '');
        transformed = transformed.replace(/throw\s+new\s+Error\s*\(\s*["']Removing[^"']*["']\)/g, '');
        
        // Replace SES Compartment usage
        transformed = transformed.replace(/new\s+Compartment\s*\(/g, 'new (function() { return {}; })(');
        
        // Block SES from modifying prototypes
        transformed = transformed.replace(/Object\.defineProperty\s*\(\s*[^,]+,\s*["']lockdown["'][^)]*\)/g, '');
        transformed = transformed.replace(/Object\.defineProperty\s*\(\s*[^,]+,\s*["']harden["'][^)]*\)/g, '');
        
        return { code: transformed, map: null };
      }
      
      return null;
    },
  };
}
