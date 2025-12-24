/**
 * SES/Lockdown No-Op Stub
 * 
 * This module completely replaces all SES/lockdown functionality with no-ops.
 * It prevents SES from executing and breaking React.
 */

// Stub all SES globals immediately
const g = globalThis as any;

// Lockdown - does nothing
export function lockdown(_options?: any): void {
  // No-op - SES lockdown disabled
}

// Harden - returns input unchanged (identity function)
export function harden<T>(x: T): T {
  return x;
}

// Compartment - proper no-op constructor that mimics SES Compartment API
export class Compartment {
  private _globalLexicals: any;
  private _endowments: any;
  
  constructor(endowments?: any, _modules?: any, options?: any) {
    this._endowments = endowments || {};
    this._globalLexicals = options?.globalLexicals || {};
  }
  
  get globalThis(): any {
    return { ...g, ...this._endowments, ...this._globalLexicals };
  }
  
  evaluate(source: string): any {
    // Return undefined for any evaluation - safer than trying to eval
    return undefined;
  }
  
  import(_specifier: string): Promise<any> {
    return Promise.resolve({});
  }
  
  load(_specifier: string): Promise<void> {
    return Promise.resolve();
  }
  
  importNow(_specifier: string): any {
    return {};
  }
  
  name = 'Compartment';
}

// RepairIntrinsics - no-op
export function repairIntrinsics(_options?: any): void {
  // No-op
}

// Assert - simple no-op assertion
export const assert = Object.assign(
  (condition: any, message?: string) => {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  },
  {
    typeof: () => {},
    error: (message: string) => new Error(message),
    fail: (message: string) => { throw new Error(message); },
    equal: () => {},
    string: () => {},
    note: () => {},
    details: () => {},
    Fail: () => {},
    quote: (val: any) => JSON.stringify(val),
  }
);

// Install stubs on globalThis if not already present
if (typeof g.lockdown !== 'function') {
  g.lockdown = lockdown;
}
if (typeof g.harden !== 'function') {
  g.harden = harden;
}
if (typeof g.Compartment !== 'function') {
  g.Compartment = Compartment;
}
if (typeof g.repairIntrinsics !== 'function') {
  g.repairIntrinsics = repairIntrinsics;
}
if (typeof g.assert !== 'function') {
  g.assert = assert;
}

// Default export for CommonJS compatibility
export default {
  lockdown,
  harden,
  Compartment,
  repairIntrinsics,
  assert,
};

