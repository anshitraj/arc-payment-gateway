# SES Fix - Complete Implementation Guide

## ✅ Files Fixed

### Core Infrastructure
- ✅ `client/src/lib/wagmiConfig.ts` - Dynamic config (no top-level imports)
- ✅ `client/src/lib/LazyRainbowKit.tsx` - Lazy-loading wrapper (production-grade)
- ✅ `client/src/lib/useDynamicWagmi.ts` - Dynamic wagmi hooks helper
- ✅ `client/src/pages/Login.tsx` - Fixed with dynamic imports + LazyRainbowKit wrapper

### Components Fixed
- ✅ `client/src/components/Navbar.tsx` - ConnectButton loaded dynamically

### Files Deleted
- ❌ `client/src/lib/rainbowkit.tsx` - Had static imports (replaced by wagmiConfig.ts)
- ❌ `client/src/lib/wallet-provider-lazy.tsx` - Old implementation (replaced by LazyRainbowKit.tsx)

## ⚠️ Files Still Need Fixing

### Pages (Must wrap with LazyRainbowKit + use dynamic imports):
1. `client/src/pages/Checkout.tsx` - Has static imports
2. `client/src/pages/QRPayment.tsx` - Has static imports  
3. `client/src/pages/DashboardBridge.tsx` - Has static imports
4. `client/src/pages/AdminLogin.tsx` - Has static imports

### Components (Must use dynamic imports):
1. `client/src/components/PaymentsTable.tsx` - Has static wagmi imports
2. `client/src/components/DashboardSidebar.tsx` - Has static wagmi imports
3. `client/src/components/MerchantBadgeClaim.tsx` - Has static wagmi imports
4. `client/src/components/PaymentProofRecord.tsx` - Has static wagmi imports

### Library Files (May need refactoring):
1. `client/src/lib/wallet-rainbowkit.ts` - Has static wagmi imports (may be unused)
2. `client/src/lib/wallet.ts` - Has @walletconnect import (different SDK, may be OK)

## 🔧 Fix Pattern for Remaining Files

### For Pages:
```tsx
// 1. Remove static imports
// ❌ import { ConnectButton } from '@rainbow-me/rainbowkit';
// ❌ import { useAccount } from 'wagmi';

// 2. Add dynamic loading
const [wagmiHooks, setWagmiHooks] = useState(null);
const [connectButton, setConnectButton] = useState(null);

useEffect(() => {
  Promise.all([
    import('wagmi'),
    import('@rainbow-me/rainbowkit')
  ]).then(([wagmi, rainbow]) => {
    setWagmiHooks(wagmi);
    setConnectButton(() => rainbow.ConnectButton);
  });
}, []);

// 3. Wrap page with LazyRainbowKit
export default function Page() {
  return (
    <LazyRainbowKit>
      <PageContent />
    </LazyRainbowKit>
  );
}
```

### For Components:
```tsx
// Use dynamic imports - component will only work inside LazyRainbowKit
const [wagmiHook, setWagmiHook] = useState(null);

useEffect(() => {
  import('wagmi').then(wagmi => {
    setWagmiHook(() => wagmi.useWriteContract);
  });
}, []);

// Use hook when available
const writeContract = wagmiHook ? wagmiHook() : null;
```

## ✅ Verification Checklist

After fixing all files:

1. **Build succeeds** - `npm run build` completes without errors
2. **No static imports** - Search codebase for:
   - `import.*from.*wagmi`
   - `import.*from.*@rainbow-me`
   - `import.*from.*@walletconnect`
   - Should only find dynamic imports (`await import(...)`)
3. **Pages wrapped** - All wallet pages use `<LazyRainbowKit>`
4. **Production test**:
   - Initial load: No `wallet-vendor-*.js` in Network tab
   - No `lockdown-install.js` errors
   - React renders successfully
   - After clicking wallet button: wallet loads, no crash

## 🎯 Current Status

- ✅ Core infrastructure complete
- ✅ Login page fixed (example pattern)
- ✅ Navbar fixed (graceful degradation)
- ⚠️ 8 files still need fixing (follow Login.tsx pattern)

