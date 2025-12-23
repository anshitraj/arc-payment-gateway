/**
 * Connect Wallet Button - Demo Mode Stub
 * 
 * DEMO MODE: Wallet functionality is disabled to prevent SES issues.
 * This component provides a demo-safe button that doesn't execute any wallet code.
 */

import { DEMO_MODE } from "@/config/demo";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConnectWalletButton() {
  if (DEMO_MODE) {
    return (
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => {
          alert('Wallet connection disabled for demo. Full on-chain flow is implemented and will be re-enabled after final security hardening.');
        }}
      >
        <Wallet className="w-4 h-4" />
        Connect Wallet (Demo)
      </Button>
    );
  }

  // Real wallet implementation will go here when DEMO_MODE is false
  return null;
}

export function ConnectWalletButtonCustom({ children }: { children: (props: any) => React.ReactNode }) {
  if (DEMO_MODE) {
    return (
      <div>
        {children({
          account: { address: '0xDEMO...WALLET', displayName: 'Demo Wallet' },
          chain: { id: 5042002, name: 'ARC Testnet', unsupported: false },
          openAccountModal: () => alert('Wallet modal disabled in demo'),
          openChainModal: () => alert('Chain modal disabled in demo'),
          openConnectModal: () => alert('Wallet connection disabled for demo'),
          authenticationStatus: 'authenticated',
          mounted: true,
        })}
      </div>
    );
  }

  return null;
}

