/**
 * Endo/Lockdown Shim
 * 
 * Hard-disables SES/lockdown at runtime by stubbing out lockdown functions
 * before they can execute and cause React.createContext to be undefined.
 * 
 * This shim must be imported BEFORE any wallet code loads.
 */

const g = globalThis as any;
if (typeof g.lockdown !== "function") g.lockdown = () => {};
if (typeof g.harden !== "function") g.harden = (x: any) => x;
if (typeof g.Compartment !== "function") g.Compartment = undefined;
export {};

