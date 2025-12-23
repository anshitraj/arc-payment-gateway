import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import LazyRainbowKit from "@/lib/LazyRainbowKit";

/**
 * Login Content - Uses wallet hooks dynamically
 * CRITICAL: No static imports of wagmi/RainbowKit - they cause SES to execute early
 */
function LoginContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [wagmiHooks, setWagmiHooks] = useState<any>(null);
  const [connectButton, setConnectButton] = useState<any>(null);
  const hasRedirected = useRef(false);

  // Dynamically load wagmi hooks and ConnectButton
  useEffect(() => {
    Promise.all([
      import('wagmi'),
      import('@rainbow-me/rainbowkit')
    ]).then(([wagmi, rainbow]) => {
      setWagmiHooks(wagmi);
      setConnectButton(() => rainbow.ConnectButton);
    });
  }, []);

  // Get account info using dynamic hook
  const accountResult = wagmiHooks?.useAccount ? wagmiHooks.useAccount() : { address: undefined, isConnected: false };
  const { address, isConnected } = accountResult;

  // Authenticate with wallet address when connected
  const walletAuthMutation = useMutation({
    mutationFn: async (walletAddress: string) => {
      return await apiRequest("POST", "/api/auth/wallet-login", { address: walletAddress });
    },
    onSuccess: () => {
      toast({ 
        title: "Wallet connected!", 
        description: "You've been signed in successfully." 
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Authentication failed",
        description: error.message || "Could not authenticate with wallet",
        variant: "destructive",
      });
    },
  });

  // Auto-authenticate when wallet connects
  useEffect(() => {
    const justLoggedOut = sessionStorage.getItem("logout");
    if (justLoggedOut) {
      sessionStorage.removeItem("logout");
      return;
    }
    
    if (isConnected && address && !hasRedirected.current) {
      hasRedirected.current = true;
      walletAuthMutation.mutate(address);
    }
  }, [isConnected, address, walletAuthMutation]);

  if (!connectButton) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Wallet className="w-8 h-8 mx-auto mb-4 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading wallet...</p>
        </div>
      </div>
    );
  }

  const ConnectButtonCustom = connectButton.Custom;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-login">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4" data-testid="link-home">
            <img src="/arcpay.webp" alt="ArcPayKit" className="h-10" />
          </Link>
          <p className="text-muted-foreground">
            Connect your wallet to access the dashboard
          </p>
        </div>

        <Card className="bg-card/80 backdrop-blur-xl border-border">
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Web3 Wallet Login</h2>
                <p className="text-sm text-muted-foreground">
                  Connect your wallet to sign in and manage your payments
                </p>
              </div>

              <div className="flex justify-center">
                <ConnectButtonCustom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading';
                    const connected =
                      ready &&
                      account &&
                      chain &&
                      (!authenticationStatus ||
                        authenticationStatus === 'authenticated');

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          'style': {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                        className="w-full"
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                type="button"
                                className="w-full h-14 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                data-testid="button-connect-wallet-login"
                              >
                                <Wallet className="w-5 h-5" />
                                Connect Wallet
                              </button>
                            );
                          }

                          if (chain.unsupported) {
                            return (
                              <button
                                onClick={openChainModal}
                                type="button"
                                className="w-full h-14 px-6 rounded-lg bg-destructive text-destructive-foreground font-medium hover:bg-destructive/90 transition-colors"
                              >
                                Wrong Network - Switch to ARC Testnet
                              </button>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                                <div className="text-sm text-muted-foreground mb-1">Connected</div>
                                <div className="font-mono text-sm">
                                  {account.displayName || `${account.address.slice(0, 6)}...${account.address.slice(-4)}`}
                                </div>
                              </div>
                              <button
                                onClick={openAccountModal}
                                type="button"
                                className="w-full h-12 px-6 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm"
                              >
                                Manage Wallet
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectButtonCustom>
              </div>

              {walletAuthMutation.isPending && (
                <div className="text-center text-sm text-muted-foreground">
                  Authenticating...
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Login Page - Wraps LoginContent with LazyRainbowKit
 * CRITICAL: This ensures wallet SDKs only load after window.onload
 */
export default function Login() {
  return (
    <LazyRainbowKit>
      <LoginContent />
    </LazyRainbowKit>
  );
}
