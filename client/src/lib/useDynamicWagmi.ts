/**
 * Dynamic Wagmi Hooks Helper
 * 
 * CRITICAL: These hooks only work inside LazyRainbowKit wrapper.
 * They use dynamic imports to prevent SES from executing during app bootstrap.
 */

import { useEffect, useState } from 'react';

let wagmiModule: any = null;

async function loadWagmi() {
  if (wagmiModule) return wagmiModule;
  wagmiModule = await import('wagmi');
  return wagmiModule;
}

export function useDynamicAccount() {
  const [result, setResult] = useState<{ address?: string; isConnected: boolean }>({ isConnected: false });

  useEffect(() => {
    loadWagmi().then(wagmi => {
      try {
        const account = wagmi.useAccount();
        setResult({
          address: account.address,
          isConnected: account.isConnected || false,
        });
      } catch (e) {
        // Not inside WagmiProvider
      }
    });
  }, []);

  return result;
}

export function useDynamicWriteContract() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useWriteContract);
    });
  }, []);

  return hook;
}

export function useDynamicWaitForTransactionReceipt() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useWaitForTransactionReceipt);
    });
  }, []);

  return hook;
}

export function useDynamicReadContract() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useReadContract);
    });
  }, []);

  return hook;
}

export function useDynamicBalance() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useBalance);
    });
  }, []);

  return hook;
}

export function useDynamicSwitchChain() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useSwitchChain);
    });
  }, []);

  return hook;
}

export function useDynamicDisconnect() {
  const [hook, setHook] = useState<any>(null);

  useEffect(() => {
    loadWagmi().then(wagmi => {
      setHook(() => wagmi.useDisconnect);
    });
  }, []);

  return hook;
}

