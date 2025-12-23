/**
 * Dynamic useAccount hook
 * Only works inside LazyRainbowKit wrapper
 */
import { useEffect, useState } from 'react';

export function useWalletAccount() {
  const [result, setResult] = useState<{ address?: string; isConnected: boolean }>({ isConnected: false });

  useEffect(() => {
    import('wagmi').then(wagmi => {
      // This will only work if WagmiProvider is available
      // Component must be inside LazyRainbowKit
      const account = wagmi.useAccount();
      setResult({
        address: account.address,
        isConnected: account.isConnected || false,
      });
    }).catch(() => {
      // Wagmi not loaded yet
    });
  }, []);

  return result;
}

