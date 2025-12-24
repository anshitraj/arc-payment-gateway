/**
 * Connect Wallet Button
 * Standard RainbowKit ConnectButton wrapper
 * Uses dynamic import to avoid top-level wallet imports
 */

import { useState, useEffect, type ReactNode } from "react";
import { useWalletProviderReady } from "@/lib/WalletProviderContext";

interface ConnectButtonProps {
  children?: ReactNode;
}

interface ConnectButtonCustomProps {
  children: (props: any) => ReactNode;
}

export function ConnectWalletButton({ children }: ConnectButtonProps) {
  const { isReady } = useWalletProviderReady();
  const [ConnectButtonComponent, setConnectButtonComponent] = useState<any>(null);

  useEffect(() => {
    if (!isReady) return;

    // Dynamically import ConnectButton only when wallet providers are ready
    import("@rainbow-me/rainbowkit").then((mod) => {
      setConnectButtonComponent(() => mod.ConnectButton);
    });
  }, [isReady]);

  if (!isReady || !ConnectButtonComponent) {
    return <div className="h-10 w-32 bg-muted animate-pulse rounded" />;
  }

  return <ConnectButtonComponent>{children}</ConnectButtonComponent>;
}

export function ConnectWalletButtonCustom({ children }: ConnectButtonCustomProps) {
  const { isReady } = useWalletProviderReady();
  const [ConnectButtonCustomComponent, setConnectButtonCustomComponent] = useState<any>(null);

  useEffect(() => {
    if (!isReady) return;

    // Dynamically import ConnectButton only when wallet providers are ready
    import("@rainbow-me/rainbowkit").then((mod) => {
      setConnectButtonCustomComponent(() => mod.ConnectButton.Custom);
    });
  }, [isReady]);

  if (!isReady || !ConnectButtonCustomComponent) {
    return <div className="h-10 w-full bg-muted animate-pulse rounded" />;
  }

  return <ConnectButtonCustomComponent>{children}</ConnectButtonCustomComponent>;
}

