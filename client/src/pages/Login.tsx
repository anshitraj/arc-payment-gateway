import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { DEMO_MODE } from "@/config/demo";
import { useDemoAccount } from "@/hooks/useDemoWallet";
import { ConnectWalletButtonCustom } from "@/components/ConnectWalletButton";

/**
 * Login Content - Demo Mode Compatible
 * DEMO MODE: Uses stub hooks that don't execute any wallet code
 */
function LoginContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { address, isConnected } = useDemoAccount();
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
                <ConnectWalletButtonCustom>
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
                </ConnectWalletButtonCustom>
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
 * Login Page - Demo Mode Compatible
 * DEMO MODE: No wallet SDKs loaded, preventing SES issues
 */
export default function Login() {
  return <LoginContent />;
}
