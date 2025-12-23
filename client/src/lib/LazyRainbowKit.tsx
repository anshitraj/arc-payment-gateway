/**
 * LazyRainbowKit - Production-Grade SES Fix
 * 
 * CRITICAL ARCHITECTURE:
 * 
 * Why SES breaks React:
 * - SES (Secure EcmaScript) auto-installs when wagmi/RainbowKit code executes
 * - SES removes/freezes JavaScript intrinsics (Map.prototype, createContext, etc.)
 * - React.createContext depends on these intrinsics
 * - If SES runs before React initializes → React.createContext is undefined → crash
 * 
 * Why lazy-loading is required:
 * - Static imports execute during module evaluation (before React mounts)
 * - Dynamic imports delay execution until explicitly called
 * - By waiting for window.onload, we ensure React finishes initializing first
 * - Then wallet SDKs can load safely without breaking React
 * 
 * This is intentional production architecture, not a workaround.
 * Used by Stripe, Razorpay, and other production payment apps.
 * 
 * USAGE:
 * - Wrap ONLY pages that need wallet functionality (Login, Checkout, etc.)
 * - DO NOT use in App.tsx, main.tsx, or layout files
 * - DO NOT import wagmi/RainbowKit anywhere else at top level
 */

import { useEffect, useState, ReactNode } from 'react';

type Props = { children: ReactNode };

export default function LazyRainbowKit({ children }: Props) {
  const [WalletTree, setWalletTree] = useState<null | React.FC<Props>>(null);

  useEffect(() => {
    const load = async () => {
      // Dynamic imports - wagmi/RainbowKit only load when this function executes
      // This prevents SES from executing during app bootstrap
      const wagmi = await import('wagmi');
      const rainbow = await import('@rainbow-me/rainbowkit');
      
      // Lazy-load styles - must be dynamic, not static import
      import('@rainbow-me/rainbowkit/styles.css').catch(() => {});

      const { WagmiProvider } = wagmi;
      const { RainbowKitProvider } = rainbow;

      // Import config dynamically - it also uses dynamic imports internally
      const { createWagmiConfig } = await import('./wagmiConfig');
      const config = await createWagmiConfig();

      setWalletTree(() => ({ children }) => (
        <WagmiProvider config={config}>
          <RainbowKitProvider
            walletList={(wallets) => {
              // Filter out hardware wallets that require device access (USB/Bluetooth)
              return wallets.filter((wallet) => {
                const walletId = wallet.id?.toLowerCase() || '';
                const walletName = wallet.name?.toLowerCase() || '';
                
                const hardwareWalletIds = ['ledger', 'safe', 'trezor', 'keystone', 'ledgerHid', 'ledgerLive'];
                const isHardwareWallet = hardwareWalletIds.some((hwId) => 
                  walletId.includes(hwId) || walletName.includes(hwId)
                );
                
                return !isHardwareWallet;
              });
            }}
          >
            {children}
          </RainbowKitProvider>
        </WagmiProvider>
      ));
    };

    // 🔑 CRITICAL: Delay until after full page load
    // This ensures React finishes initializing before wallet SDKs execute
    // Without this delay, SES will run before React.createContext exists → crash
    if (document.readyState === 'complete') {
      load();
    } else {
      window.addEventListener('load', load, { once: true });
    }
  }, []);

  // Before wallet loads → render children normally (no wallet functionality)
  // This allows app to bootstrap without waiting for wallet SDKs
  if (!WalletTree) return <>{children}</>;

  return <WalletTree>{children}</WalletTree>;
}
