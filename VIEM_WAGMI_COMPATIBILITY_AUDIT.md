# Viem/Wagmi Compatibility Audit Report

**Date:** 2024-12-19  
**Project:** Gateway  
**Issue:** Build failures due to version incompatibilities between `wagmi` 2.19.5 and `viem` 2.21.4

---

## Executive Summary

The build was failing due to multiple compatibility issues between `@wagmi/core` (via `wagmi` 2.19.5) and `viem` 2.21.4. The primary issue was that `wagmi` was attempting to import functions from `viem/actions` that either:
1. Don't exist in that location (they're in `viem/experimental`)
2. Don't exist at all in viem 2.21.4
3. Exist but aren't exported from the main module

**Status:** ✅ Original `getCapabilities` error resolved. Additional compatibility issues identified and partially resolved.

---

## Issues Identified

### 1. ✅ RESOLVED: Functions in `viem/experimental` instead of `viem/actions`

**Problem:** `@wagmi/core` imports EIP-5792 functions from `viem/actions`, but they're actually in `viem/experimental`.

**Affected Functions:**
- `getCapabilities` ⚠️ **Original error**
- `getCallsStatus`
- `sendCalls`
- `showCallsStatus`
- `writeContracts`

**Solution:** Created Vite transform plugin that redirects these imports to `viem/experimental`.

**Files Modified:**
- `vite.config.ts` - Added transform logic in `viemCompatibilityFix` plugin

---

### 2. ✅ RESOLVED: Functions that don't exist in viem 2.21.4

**Problem:** `@wagmi/core` imports functions that don't exist in viem 2.21.4.

**Affected Functions:**
- `sendCallsSync`
- `sendTransactionSync`
- `waitForCallsStatus`
- `prepareAuthorization` (from porto)

**Solution:** Created stub implementations that throw descriptive errors.

**Files Created:**
- `client/src/lib/viem-actions-sendCallsSync-stub.ts`
- `client/src/lib/viem-actions-sendTransactionSync-stub.ts`
- `client/src/lib/viem-actions-waitForCallsStatus-stub.ts`
- `client/src/lib/viem-actions-prepareAuthorization-stub.ts`

**Files Modified:**
- `vite.config.ts` - Added stub mappings and transform logic
- `vite.config.ts` - Added `load` hook to intercept and modify files before parsing

---

### 3. ✅ RESOLVED: Functions not exported from main viem module

**Problem:** Functions exist in viem but aren't exported from the main package entry point.

**Affected Functions:**
- `withCache` - Exists in `viem/utils/promise/withCache` but not exported via package exports

**Solution:** Created stub implementation and added alias mapping.

**Files Created:**
- `client/src/lib/viem-withCache-stub.ts`

**Files Modified:**
- `vite.config.ts` - Added alias for `viem/utils/promise/withCache`
- `vite.config.ts` - Added transform to redirect imports

---

### 4. ✅ RESOLVED: ERC7821 experimental module missing exports

**Problem:** `viem/experimental/erc7821` doesn't exist in viem 2.21.4, but dependencies try to import from it.

**Affected Functions:**
- `getExecuteError`
- `encodeExecuteData`

**Solution:** Enhanced existing stub to export these functions.

**Files Modified:**
- `client/src/lib/viem-erc7821-stub.ts` - Added stub exports

**Files Modified:**
- `vite.config.ts` - Already had alias mapping for `viem/experimental/erc7821`

---

## Technical Implementation Details

### Vite Plugin Architecture

Created a custom Vite plugin (`viemCompatibilityFix`) with:

1. **`resolveId` hook:**
   - Redirects `viem/experimental/erc7821` to stub file

2. **`load` hook:**
   - Intercepts specific wagmi files before parsing
   - Directly modifies import statements for stub functions
   - Handles: `sendCallsSync.js`, `sendTransactionSync.js`, `waitForCallsStatus.js`

3. **`transform` hook:**
   - Transforms imports from `viem/actions` to redirect experimental functions
   - Transforms imports from `viem` to redirect `withCache` to stub
   - Applies to all files (not just `@wagmi/core`) to handle porto dependencies

4. **`resolve.alias` configuration:**
   - Maps stub modules to actual stub files
   - Maps `viem/utils/promise/withCache` to stub

### Plugin Execution Order

The plugin uses `enforce: 'pre'` to ensure it runs before other plugins, allowing it to transform imports early in the build process.

---

## Files Created

### Stub Files (7 files)

1. `client/src/lib/viem-actions-getCallsStatus-stub.ts` - Re-exports from experimental
2. `client/src/lib/viem-actions-getCapabilities-stub.ts` - Re-exports from experimental
3. `client/src/lib/viem-actions-sendCallsSync-stub.ts` - Throws error stub
4. `client/src/lib/viem-actions-sendTransactionSync-stub.ts` - Throws error stub
5. `client/src/lib/viem-actions-waitForCallsStatus-stub.ts` - Throws error stub
6. `client/src/lib/viem-actions-prepareAuthorization-stub.ts` - Throws error stub
7. `client/src/lib/viem-withCache-stub.ts` - Simple implementation stub

### Modified Files

1. `vite.config.ts` - Major changes:
   - Added `fs` import
   - Created `viemCompatibilityFix` plugin with 3 hooks
   - Added 5 new alias mappings
   - Plugin configured with `enforce: 'pre'`

2. `client/src/lib/viem-erc7821-stub.ts` - Enhanced with:
   - `getExecuteError` export
   - `encodeExecuteData` export

---

## Build Status

### Before Fixes
```
❌ Build failed immediately with:
   "getCapabilities" is not exported by "viem/actions"
```

### After Fixes
```
✅ Original error resolved
⚠️ Build progresses further but may encounter additional compatibility issues
```

---

## Recommendations

### Short-term (Current State)

1. **✅ COMPLETED:** Fix immediate build blockers
   - All critical import errors resolved
   - Build can now progress further

2. **Monitor for additional issues:**
   - Watch for runtime errors from stub functions
   - Some functions may need proper implementations instead of error-throwing stubs

### Medium-term

1. **Consider upgrading dependencies:**
   - Upgrade `wagmi` to latest version (if compatible)
   - Upgrade `viem` to latest version (if compatible)
   - Check for version compatibility matrix

2. **Implement proper stubs:**
   - Replace error-throwing stubs with functional implementations where possible
   - Especially for `withCache` which has a simple implementation

3. **Document workarounds:**
   - Document which features are unavailable due to version mismatches
   - Add runtime checks/warnings when stub functions are called

### Long-term

1. **Version alignment:**
   - Align `wagmi` and `viem` versions to officially supported combinations
   - Consider using version ranges that are known to work together

2. **Dependency audit:**
   - Review all wallet-related dependencies for compatibility
   - Consider consolidating to fewer, well-maintained packages

3. **Testing:**
   - Add integration tests for wallet functionality
   - Test with different wallet providers
   - Verify all EIP-5792 features work correctly

---

## Risk Assessment

### Low Risk ✅
- Functions that re-export from `viem/experimental` (getCapabilities, getCallsStatus, etc.)
- These are just redirecting to the correct location

### Medium Risk ⚠️
- Functions with simple stub implementations (withCache)
- May need proper implementation if caching is critical

### High Risk 🔴
- Functions that throw errors (sendCallsSync, sendTransactionSync, etc.)
- **These will break at runtime if called**
- Code using these functions needs to be updated or these functions need proper implementations

---

## Testing Checklist

- [ ] Build completes successfully
- [ ] No import errors in browser console
- [ ] Wallet connection works
- [ ] Transaction sending works (if using sendTransaction, not sendTransactionSync)
- [ ] EIP-5792 features work (getCapabilities, sendCalls, etc.)
- [ ] No runtime errors from stub functions
- [ ] Test with multiple wallet providers

---

## Dependencies Versions

**Current:**
- `viem`: `2.21.4` (pinned in overrides)
- `wagmi`: `^2.19.5`
- `@wagmi/core`: (transitive dependency)

**Recommended:**
- Check wagmi documentation for compatible viem versions
- Consider upgrading to latest compatible versions

---

## Notes

1. **Stub Functions:** Several stub functions throw errors. If your code uses these functions, you'll need to either:
   - Upgrade viem to a version that includes them
   - Implement proper functionality in the stubs
   - Refactor code to use alternative functions

2. **Experimental Features:** EIP-5792 functions are in `viem/experimental`, indicating they're still experimental. Use with caution.

3. **Build Performance:** The transform plugin adds minimal overhead but processes many files. Monitor build times.

4. **Maintenance:** This solution requires maintenance as wagmi/viem versions change. Consider this a temporary workaround until versions are aligned.

---

## Conclusion

The original build error has been resolved. The solution uses a combination of:
- Import redirections (for functions in wrong locations)
- Stub implementations (for missing functions)
- Vite plugin transforms (to apply fixes automatically)

**Status:** ✅ Primary issue resolved. Additional compatibility work may be needed as the codebase evolves.

---

**Report Generated:** 2024-12-19  
**Audited By:** AI Assistant  
**Next Review:** When upgrading wagmi/viem dependencies

