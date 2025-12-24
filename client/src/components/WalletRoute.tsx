/**
 * WalletRoute
 * 
 * Wrapper for routes that require wallet functionality.
 * Since the entire app is wrapped with LazyRainbowKitProvider,
 * this component just passes through children.
 * 
 * Wallet providers (wagmi, RainbowKit) are loaded lazily by the
 * LazyRainbowKitProvider in App.tsx.
 */

import { type ReactNode } from "react";

interface WalletRouteProps {
  children: ReactNode;
}

export function WalletRoute({ children }: WalletRouteProps) {
  // Just pass through - wallet providers are at the app level
  return <>{children}</>;
}

