/**
 * RainbowKit Wallet Utilities
 * Simplified wallet connection using RainbowKit + wagmi
 */

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';

/**
 * Hook to get wallet connection status and account
 */
export function useWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const currentChainId = useChainId();

  const arcChainId = parseInt(import.meta.env.VITE_ARC_CHAIN_ID || '1243', 10);

  const switchToArcChain = async () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (currentChainId !== arcChainId) {
      try {
        await switchChain({ chainId: arcChainId });
      } catch (error) {
        console.error('Failed to switch to ARC Testnet:', error);
        throw error;
      }
    }
  };

  return {
    address: address || null,
    isConnected: isConnected || false,
    chainId: currentChainId,
    isArcChain: currentChainId === arcChainId,
    connect,
    disconnect,
    connectors,
    isPending,
    switchToArcChain,
  };
}

