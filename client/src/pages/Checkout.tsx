import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Zap, Check, Loader2, Shield, Clock, AlertCircle, Wallet, ExternalLink } from "lucide-react";
import type { Payment } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "@/lib/wallet-rainbowkit";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getExplorerLink, getArcNetworkName, getArcChainId } from "@/lib/arc";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

// USDC ERC20 ABI (transfer function only)
const USDC_ABI = [
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// USDC token address on ARC Testnet (should be set in env)
const USDC_ADDRESS = (import.meta.env.VITE_USDC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const USDC_DECIMALS = 6; // USDC uses 6 decimals

export default function Checkout() {
  const { id } = useParams<{ id: string }>();
  const [currency, setCurrency] = useState("USDC");
  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "pending" | "success" | "error">("idle");
  const { address, isConnected, isArcChain, switchToArcChain } = useWallet();

  const { data: payment, isLoading, error, refetch } = useQuery<Payment>({
    queryKey: ["/api/payments", id],
    enabled: !!id,
    refetchInterval: paymentState === "pending" ? 3000 : false, // Poll every 3s when pending
  });

  // Auto-switch to ARC chain when connected
  useEffect(() => {
    if (isConnected && !isArcChain) {
      switchToArcChain().catch(console.error);
    }
  }, [isConnected, isArcChain, switchToArcChain]);

  // Validate chain before proceeding
  const validateChain = async () => {
    if (!isConnected || !address) {
      throw new Error("Wallet not connected. Please connect your wallet first.");
    }

    if (!isArcChain) {
      await switchToArcChain();
      // Wait a bit for chain switch
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const currentChainId = getArcChainId();
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const chainId = await (window as any).ethereum.request({ method: 'eth_chainId' });
      const chainIdNum = parseInt(chainId, 16);
      if (chainIdNum !== currentChainId) {
        throw new Error(`Please switch to ARC Testnet (Chain ID: ${currentChainId})`);
      }
    }
  };

  // USDC transfer transaction
  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract();

  // Wait for transaction receipt
  const { isLoading: isWaiting, isSuccess: txSuccess, isError: txError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Submit txHash to backend
  const submitTxMutation = useMutation({
    mutationFn: async (hash: `0x${string}`) => {
      const result = await apiRequest("POST", `/api/payments/submit-tx`, {
        paymentId: id,
        txHash: hash,
        payerWallet: address,
      });
      return await result.json();
    },
  });

  // Handle transaction submission when txHash is available
  useEffect(() => {
    if (txHash && !submitTxMutation.isPending && !submitTxMutation.isSuccess && !submitTxMutation.isError) {
      setPaymentState("pending");
      submitTxMutation.mutate(txHash);
    }
  }, [txHash, submitTxMutation]);

  // Handle transaction success/failure
  useEffect(() => {
    if (txSuccess && submitTxMutation.isSuccess) {
      // Transaction confirmed and submitted to backend
      refetch(); // Refresh payment status
    } else if (txError || writeError) {
      setPaymentState("error");
    } else if (submitTxMutation.isError) {
      setPaymentState("error");
    }
  }, [txSuccess, txError, writeError, submitTxMutation.isSuccess, submitTxMutation.isError, refetch]);

  // Handle payment status changes from backend polling
  useEffect(() => {
    if (payment?.status === "confirmed") {
      setPaymentState("success");
    } else if (payment?.status === "failed") {
      setPaymentState("error");
    } else if (payment?.status === "pending" && paymentState === "idle") {
      setPaymentState("pending");
    }
  }, [payment?.status, paymentState]);

  // Main payment handler
  const handlePay = async () => {
    try {
      if (!payment || !payment.merchantWallet) {
        throw new Error("Payment or merchant wallet not found");
      }

      setPaymentState("processing");
      await validateChain();

      // Execute USDC transfer directly
      const amount = parseFloat(payment.amount);
      const amountInUnits = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
      
      writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [payment.merchantWallet as `0x${string}`, amountInUnits],
      });
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentState("error");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Payment Not Found</h2>
            <p className="text-muted-foreground">
              This payment link may have expired or doesn't exist.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const amount = parseFloat(payment.amount);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="page-checkout">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="bg-card/80 backdrop-blur-xl border-border shadow-2xl shadow-primary/5">
          <CardHeader className="text-center pb-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold">ArcPayKit</span>
            </div>
            {payment.description && (
              <p className="text-muted-foreground">{payment.description}</p>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            <AnimatePresence mode="wait">
              {paymentState === "success" ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="text-center py-8"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="w-10 h-10 text-green-500" />
                  </motion.div>
                  <h2 className="text-2xl font-bold mb-2">Payment Complete</h2>
                  <p className="text-muted-foreground mb-4">
                    Your payment of {amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {currency} has been processed.
                  </p>
                  {payment.txHash && (
                    <a
                      href={getExplorerLink(payment.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-3"
                    >
                      View on Explorer
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {payment.settlementTime ? `Finalized in ${payment.settlementTime}s` : "Finalized"}
                  </Badge>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="text-center">
                    <div className="text-5xl font-bold tracking-tight mb-2">
                      ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-32 mx-auto" data-testid="select-checkout-currency">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="EURC">EURC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span>{getArcNetworkName()}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Gas Fee</span>
                      <span className="text-green-500">Paid in USDC</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Settlement</span>
                      <span>&lt;1 second</span>
                    </div>
                  </div>

                  {!isConnected && (
                    <div className="mb-3">
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
                          const ready = mounted;
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
                            >
                              {(() => {
                                if (!connected) {
                                  return (
                                    <Button
                                      onClick={openConnectModal}
                                      type="button"
                                      className="w-full h-12 text-base"
                                      variant="outline"
                                    >
                                      <Wallet className="w-5 h-5 mr-2" />
                                      Connect Wallet
                                    </Button>
                                  );
                                }

                                if (chain.unsupported) {
                                  return (
                                    <Button
                                      onClick={openChainModal}
                                      type="button"
                                      variant="destructive"
                                      className="w-full h-12 text-base"
                                    >
                                      Wrong network - Switch to ARC Testnet
                                    </Button>
                                  );
                                }

                                return null;
                              })()}
                            </div>
                          );
                        }}
                      </ConnectButton.Custom>
                    </div>
                  )}

                  <Button
                    className="w-full h-12 text-base"
                    onClick={handlePay}
                    disabled={
                      paymentState === "processing" || 
                      paymentState === "pending" ||
                      isWriting || 
                      isWaiting ||
                      !isConnected || 
                      !address ||
                      !isArcChain
                    }
                    data-testid="button-pay"
                  >
                    {paymentState === "processing" || isWriting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Preparing...
                      </>
                    ) : paymentState === "pending" || isWaiting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      <>Pay ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</>
                    )}
                  </Button>

                  {paymentState === "error" && (
                    <p className="text-sm text-destructive text-center">
                      {writeError?.message || submitTxMutation.error?.message || "Payment failed. Please try again."}
                    </p>
                  )}

                  {paymentState === "pending" && txHash && (
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Transaction submitted. Waiting for confirmation...
                      </p>
                      <a
                        href={getExplorerLink(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        View on Explorer
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>Secured by ArcPayKit</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <div className="text-center mt-6">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            <Zap className="w-3 h-3 mr-1" />
            Powered by Arc Network
          </Badge>
        </div>
      </motion.div>
    </div>
  );
}
