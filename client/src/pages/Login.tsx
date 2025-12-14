import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Zap, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/**
 * Login Page - Wallet-based authentication
 * 
 * Users connect their Web3 wallet to access the dashboard.
 */
export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const hasRedirected = useRef(false);

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
    if (isConnected && address && !hasRedirected.current) {
      hasRedirected.current = true;
      walletAuthMutation.mutate(address);
    }
  }, [isConnected, address]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-login">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4" data-testid="link-home">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight">ArcPayKit</span>
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
                <ConnectButton.Custom>
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
                </ConnectButton.Custom>
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
