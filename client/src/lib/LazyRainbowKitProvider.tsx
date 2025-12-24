/**
 * LazyRainbowKitProvider
 * 
 * Lazy-loads wallet providers (wagmi, RainbowKit) only after React is mounted
 * and window has loaded. This prevents SES/lockdown from executing before
 * React's createContext is available.
 * 
 * This component renders children immediately without wallet providers,
 * then dynamically imports wallet code after mount.
 */

import { useState, useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { WalletProviderContextProvider } from "./WalletProviderContext";

interface LazyRainbowKitProviderProps {
  children: ReactNode;
}

export function LazyRainbowKitProvider({ children }: LazyRainbowKitProviderProps) {
  const [WalletProviders, setWalletProviders] = useState<React.ComponentType<{ children: ReactNode }> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Immediately load wallet providers after React mounts
    // The SES blocking is now handled by our stub modules
    const loadWalletProviders = async () => {
      // Small delay to ensure React is fully mounted
      await new Promise<void>((resolve) => setTimeout(resolve, 10));

      try {
        // Dynamically import wallet dependencies - NO top-level imports allowed
        // All wallet libs imported ONLY inside this async function
        const [
          { WagmiProvider, http },
          { RainbowKitProvider, getDefaultConfig },
          { mainnet, sepolia, base, baseSepolia },
        ] = await Promise.all([
          import("wagmi"),
          import("@rainbow-me/rainbowkit"),
          import("wagmi/chains"),
        ]);

        // Import RainbowKit styles
        await import("@rainbow-me/rainbowkit/styles.css");

        // Create wagmi config inside the dynamic import to avoid top-level wallet imports
        const arcTestnet = {
          id: parseInt(import.meta.env.VITE_ARC_CHAIN_ID || '5042002', 10),
          name: 'ARC Testnet',
          nativeCurrency: {
            decimals: 6,
            name: 'USDC',
            symbol: 'USDC',
          },
          rpcUrls: {
            default: {
              http: [import.meta.env.VITE_ARC_RPC_URL || 'https://rpc.testnet.arc.network'],
            },
          },
          blockExplorers: {
            default: {
              name: 'ARC Explorer',
              url: import.meta.env.VITE_ARC_EXPLORER_URL || 'https://testnet.arcscan.app',
            },
          },
          testnet: true,
        } as const;

        const arcMainnet = {
          id: 5042001,
          name: 'ARC Network',
          nativeCurrency: {
            decimals: 6,
            name: 'USDC',
            symbol: 'USDC',
          },
          rpcUrls: {
            default: {
              http: ['https://rpc.arc.network'],
            },
          },
          blockExplorers: {
            default: {
              name: 'ARC Explorer',
              url: 'https://arcscan.app',
            },
          },
          testnet: false,
        } as const;

        const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

        const wagmiConfig = getDefaultConfig({
          appName: 'ArcPayKit',
          projectId: projectId || '00000000000000000000000000000000',
          chains: [arcTestnet, arcMainnet, baseSepolia, base, mainnet, sepolia],
          ssr: false,
          autoConnect: false,
          transports: {
            [arcTestnet.id]: http(),
            [arcMainnet.id]: http(),
            [baseSepolia.id]: http(),
            [base.id]: http(),
            [mainnet.id]: http(),
            [sepolia.id]: http(),
          },
        });

        // Create the provider component
        const Providers = ({ children: providerChildren }: { children: ReactNode }) => (
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <RainbowKitProvider>
                {providerChildren}
              </RainbowKitProvider>
            </QueryClientProvider>
          </WagmiProvider>
        );

        setWalletProviders(() => Providers);
        setIsLoading(false);
      } catch (error) {
        console.error("Failed to load wallet providers:", error);
        // Even if wallet fails to load, render children without wallet
        setIsLoading(false);
      }
    };

    loadWalletProviders();
  }, []);

  // Show loading state while wallet providers are being loaded
  // This prevents pages that use wagmi hooks from rendering before providers are ready
  if (isLoading) {
    return (
      <QueryClientProvider client={queryClient}>
        <WalletProviderContextProvider isReady={false}>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </WalletProviderContextProvider>
      </QueryClientProvider>
    );
  }

  // If wallet providers failed to load, render without them (for non-wallet pages)
  if (!WalletProviders) {
    return (
      <QueryClientProvider client={queryClient}>
        <WalletProviderContextProvider isReady={false}>
          {children}
        </WalletProviderContextProvider>
      </QueryClientProvider>
    );
  }

  return (
    <WalletProviders>
      <WalletProviderContextProvider isReady={true}>
        {children}
      </WalletProviderContextProvider>
    </WalletProviders>
  );
}

