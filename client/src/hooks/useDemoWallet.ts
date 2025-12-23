/**
 * Demo Wallet Hooks - Stub implementations for DEMO_MODE
 * 
 * These hooks return demo data when DEMO_MODE is true, preventing
 * any wagmi/RainbowKit code from executing.
 */

import { DEMO_MODE } from "@/config/demo";

export function useDemoAccount() {
  if (DEMO_MODE) {
    return {
      address: '0xDEMO...WALLET' as `0x${string}`,
      isConnected: true,
      chainId: 5042002,
    };
  }
  return { address: undefined, isConnected: false, chainId: undefined };
}

export function useDemoWriteContract() {
  if (DEMO_MODE) {
    return {
      writeContract: () => Promise.resolve('0xDEMO...TX' as `0x${string}`),
      isPending: false,
      isError: false,
    };
  }
  return null;
}

export function useDemoWaitForTransactionReceipt() {
  if (DEMO_MODE) {
    return {
      isLoading: false,
      isSuccess: true,
      data: { transactionHash: '0xDEMO...TX' as `0x${string}` },
    };
  }
  return null;
}

export function useDemoReadContract() {
  if (DEMO_MODE) {
    return {
      data: '0',
      isLoading: false,
    };
  }
  return null;
}

export function useDemoBalance() {
  if (DEMO_MODE) {
    return {
      data: { value: BigInt('1000000000'), decimals: 6, symbol: 'USDC' },
      isLoading: false,
    };
  }
  return null;
}

export function useDemoSwitchChain() {
  if (DEMO_MODE) {
    return {
      switchChain: () => Promise.resolve(),
    };
  }
  return null;
}

export function useDemoDisconnect() {
  if (DEMO_MODE) {
    return {
      disconnect: () => {},
    };
  }
  return null;
}

