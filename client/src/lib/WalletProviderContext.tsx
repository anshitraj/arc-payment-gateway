/**
 * WalletProviderContext
 * 
 * Context to track whether wallet providers (wagmi, RainbowKit) are ready.
 * Components that use wagmi hooks should check this before rendering.
 */

import { createContext, useContext, type ReactNode } from "react";

interface WalletProviderContextValue {
  isReady: boolean;
}

const WalletProviderContext = createContext<WalletProviderContextValue>({
  isReady: false,
});

export function useWalletProviderReady() {
  return useContext(WalletProviderContext);
}

interface WalletProviderContextProviderProps {
  children: ReactNode;
  isReady: boolean;
}

export function WalletProviderContextProvider({
  children,
  isReady,
}: WalletProviderContextProviderProps) {
  return (
    <WalletProviderContext.Provider value={{ isReady }}>
      {children}
    </WalletProviderContext.Provider>
  );
}

