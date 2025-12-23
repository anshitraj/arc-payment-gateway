/**
 * LazyConnectButton - Dynamically loads ConnectButton
 * 
 * CRITICAL: ConnectButton must NOT be statically imported.
 * Static import causes wagmi/RainbowKit to execute during app bootstrap → SES breaks React.
 * 
 * This component loads ConnectButton dynamically only after LazyRainbowKit is ready.
 */

import { useEffect, useState, ReactNode } from 'react';

type ConnectButtonProps = {
  children?: (props: any) => ReactNode;
  Custom?: React.ComponentType<{ children: (props: any) => ReactNode }>;
};

export function LazyConnectButton({ children, ...props }: any) {
  const [ConnectButton, setConnectButton] = useState<any>(null);

  useEffect(() => {
    // Dynamic import - only loads when this component mounts
    // Component should only mount inside LazyRainbowKit wrapper
    import('@rainbow-me/rainbowkit').then(rainbow => {
      setConnectButton(() => rainbow.ConnectButton);
    });
  }, []);

  if (!ConnectButton) {
    return <div className="h-14 w-full flex items-center justify-center text-muted-foreground">Loading wallet...</div>;
  }

  if (children && typeof children === 'function') {
    return <ConnectButton.Custom>{children}</ConnectButton.Custom>;
  }

  return <ConnectButton {...props} />;
}

