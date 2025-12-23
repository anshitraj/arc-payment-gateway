/**
 * Dynamic Wallet Hooks
 * 
 * CRITICAL: These hooks must be used ONLY inside components wrapped with LazyRainbowKit.
 * They dynamically import wagmi hooks to prevent SES from executing during app bootstrap.
 */

import { useEffect, useState } from 'react';

type WagmiHooks = {
  useAccount: any;
  useConnect: any;
  useDisconnect: any;
  useChainId: any;
  useSwitchChain: any;
  useWriteContract: any;
  useWaitForTransactionReceipt: any;
  useReadContract: any;
  useBalance: any;
};

let wagmiHooksCache: WagmiHooks | null = null;

export async function loadWagmiHooks(): Promise<WagmiHooks> {
  if (wagmiHooksCache) return wagmiHooksCache;
  
  const wagmi = await import('wagmi');
  wagmiHooksCache = {
    useAccount: wagmi.useAccount,
    useConnect: wagmi.useConnect,
    useDisconnect: wagmi.useDisconnect,
    useChainId: wagmi.useChainId,
    useSwitchChain: wagmi.useSwitchChain,
    useWriteContract: wagmi.useWriteContract,
    useWaitForTransactionReceipt: wagmi.useWaitForTransactionReceipt,
    useReadContract: wagmi.useReadContract,
    useBalance: wagmi.useBalance,
  };
  return wagmiHooksCache;
}

/**
 * Hook to get wagmi hooks dynamically
 * Only works inside LazyRainbowKit wrapper
 */
export function useWagmiHooks() {
  const [hooks, setHooks] = useState<WagmiHooks | null>(null);

  useEffect(() => {
    loadWagmiHooks().then(setHooks);
  }, []);

  return hooks;
}

