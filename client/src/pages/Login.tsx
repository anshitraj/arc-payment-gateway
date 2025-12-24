import { useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAccount, useSignMessage } from "wagmi";
import { ConnectWalletButtonCustom } from "@/components/ConnectWalletButton";
import { useWalletProviderReady } from "@/lib/WalletProviderContext";
import { Button } from "@/components/ui/button";
import { useTestMode } from "@/hooks/useTestMode";

/**
 * Login Content
 */
function LoginContent() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { setTestMode } = useTestMode();
  
  // Clear logout flag if present
  useEffect(() => {
    const justLoggedOut = sessionStorage.getItem("logout");
    if (justLoggedOut) {
      sessionStorage.removeItem("logout");
    }
  }, []);
  
  // useAccount hook - will only work when WagmiProvider is ready
  const { address, isConnected } = useAccount();
  
  // Generate a unique message for signing (regenerate when address changes)
  const loginMessage = useMemo(() => {
    if (!address) return "";
    return `Sign this message to authenticate with ArcPayKit.\n\nWallet: ${address}\nTimestamp: ${Date.now()}`;
  }, [address]);

  // Authenticate with wallet address and signature
  const walletAuthMutation = useMutation({
    mutationFn: async ({ address, signature, message }: { address: string; signature: string; message: string }) => {
      return await apiRequest("POST", "/api/auth/wallet-login", { 
        address,
        signature,
        message,
      });
    },
    onSuccess: async () => {
      console.log("✅ Login mutation successful, setting up session...");
      
      toast({ 
        title: "Wallet connected!", 
        description: "You've been signed in successfully." 
      });
      
      // Invalidate and clear any cached auth data
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      
      // Wait for session cookie to be set by browser
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verify session by fetching auth data
      try {
        console.log("🔄 Verifying session...");
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        
        if (response.ok) {
          const authData = await response.json();
          console.log("✅ Session verified:", authData);
          
          // Set the auth data in query cache
          queryClient.setQueryData(["/api/auth/me"], authData);
          
          // Ensure new users default to demo mode (test mode = true)
          // Check if test mode is not set or is false, and set it to true
          const currentTestMode = localStorage.getItem("arcpaykit_test_mode");
          if (currentTestMode === null || currentTestMode === "false") {
            setTestMode(true);
            localStorage.setItem("arcpaykit_test_mode", "true");
            console.log("✅ Set test mode to demo (true) for new user");
          }
          
          // Redirect to dashboard
          setLocation("/dashboard");
        } else {
          console.error("❌ Session verification failed:", response.status);
          toast({
            title: "Session error",
            description: "Please try signing in again",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("❌ Error verifying session:", error);
        // Still redirect - the session might work
        setLocation("/dashboard");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Authentication failed",
        description: error.message || "Could not authenticate with wallet",
        variant: "destructive",
      });
    },
  });
  
  // Sign message hook - wagmi v2 mutation
  const { 
    signMessageAsync, 
    isPending: isSigning, 
    error: signError 
  } = useSignMessage();
  
  // Log signError if it exists
  useEffect(() => {
    if (signError) {
      console.error("❌ Sign error detected:", signError);
      toast({
        title: "Signing failed",
        description: signError.message || "Could not sign message. Please try again.",
        variant: "destructive",
      });
    }
  }, [signError, toast]);

  // Handle sign in button click
  const handleSignIn = async () => {
    console.log("Sign in button clicked");
    
    if (!address) {
      console.error("No address found");
      toast({
        title: "No wallet connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }
    
    if (!loginMessage) {
      console.error("No login message generated");
      toast({
        title: "Error",
        description: "Unable to generate login message",
        variant: "destructive",
      });
      return;
    }
    
    if (!signMessageAsync) {
      console.error("signMessageAsync function not available");
      toast({
        title: "Error",
        description: "Signing function not available. Please refresh the page.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("Sign in clicked, message:", loginMessage);
    console.log("Address:", address);
    console.log("🔄 Calling signMessageAsync...");
    
    try {
      // Use signMessageAsync which returns a promise
      const signature = await signMessageAsync({ message: loginMessage });
      console.log("✅ Signature received:", signature);
      console.log("🔄 Starting authentication with backend...");
      
      // After successful signature, authenticate with backend
      if (!address || !loginMessage) {
        console.error("❌ Missing address or loginMessage after signing");
        toast({
          title: "Error",
          description: "Missing wallet information. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Double-check address is available
      if (!address) {
        console.error("❌ Address is undefined when trying to authenticate");
        toast({
          title: "Error",
          description: "Wallet address not available. Please reconnect your wallet.",
          variant: "destructive",
        });
        return;
      }
      
      console.log("📤 Sending authentication request:", {
        address,
        hasSignature: !!signature,
        hasMessage: !!loginMessage,
      });
      
      try {
        const result = await walletAuthMutation.mutateAsync({
          address,
          signature,
          message: loginMessage,
        });
        console.log("✅ Authentication successful:", result);
      } catch (error) {
        console.error("❌ Authentication error after signing:", error);
        // Error handling is done in mutation
      }
    } catch (error) {
      console.error("❌ Error signing message:", error);
      toast({
        title: "Signing failed",
        description: error instanceof Error ? error.message : "Failed to sign message",
        variant: "destructive",
      });
    }
  };


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
                              <Button
                                onClick={handleSignIn}
                                disabled={isSigning || walletAuthMutation.isPending}
                                type="button"
                                className="w-full h-12 px-6 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
                              >
                                {isSigning || walletAuthMutation.isPending ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    {isSigning ? "Signing..." : "Verifying..."}
                                  </>
                                ) : (
                                  "Verify your wallet"
                                )}
                              </Button>
                              <button
                                onClick={openAccountModal}
                                type="button"
                                className="w-full h-10 px-6 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm"
                              >
                                Change Wallet
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }}
                </ConnectWalletButtonCustom>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Login Page
 */
export default function Login() {
  const { isReady: walletReady } = useWalletProviderReady();
  
  // Show loading spinner while wallet providers are loading
  if (!walletReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return <LoginContent />;
}
