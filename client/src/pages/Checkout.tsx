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
import { Zap, Check, Loader2, Shield, Clock, AlertCircle, Wallet, ExternalLink, Info } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Payment } from "@shared/schema";
import type { MerchantProfile } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useWallet } from "@/lib/wallet-rainbowkit";
import { useWalletProviderReady } from "@/lib/WalletProviderContext";

import { ConnectWalletButtonCustom } from "@/components/ConnectWalletButton";
import { getExplorerLink, getArcNetworkName } from "@/lib/arc";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConversionFlow } from "@/components/ConversionFlow";

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
// Official ARC Testnet USDC address (native currency, used for gas fees)
const USDC_ADDRESS = (import.meta.env.VITE_USDC_TOKEN_ADDRESS || "0x3600000000000000000000000000000000000000") as `0x${string}`;
const USDC_DECIMALS = 6; // USDC uses 6 decimals

function CheckoutContent() {
  const { id } = useParams<{ id: string }>();
  const [paymentAsset, setPaymentAsset] = useState<string>("USDC_ARC"); // Default to USDC on Arc
  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "pending" | "success" | "error">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [gasSponsored, setGasSponsored] = useState<boolean>(false);
  const { address, isConnected, isArcChain, switchToArcChain, chainId } = useWallet();

  interface PaymentWithProfile extends Payment {
    merchantProfile?: {
      businessName: string;
      logoUrl: string | null;
    } | null;
  }

  const { data: payment, isLoading, error, refetch } = useQuery<PaymentWithProfile>({
    queryKey: [`/api/payments/${id}`],
    enabled: !!id,
    refetchInterval: (query) => {
      const payment = query.state.data;
      // Only poll if payment is pending and we haven't reached success state
      if (payment?.status === "pending" && paymentState !== "success") {
        return 5000; // Poll every 5s when pending (reduced frequency)
      }
      // Stop polling if confirmed or failed
      if (payment?.status === "confirmed" || payment?.status === "failed") {
        return false;
      }
      return false;
    },
  });

  // Initialize gas sponsorship from payment metadata
  useEffect(() => {
    if (payment?.metadata) {
      try {
        const metadata = JSON.parse(payment.metadata);
        if (metadata.gasSponsored !== undefined) {
          setGasSponsored(metadata.gasSponsored);
        }
      } catch {
        // Ignore invalid JSON
      }
    }
  }, [payment?.metadata]);

  // Check merchant verification status (public endpoint by wallet address)
  const { data: verificationStatus } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/badges/verification", payment?.merchantWallet],
    queryFn: async () => {
      if (!payment?.merchantWallet) return { verified: false };
      const response = await fetch(`/api/badges/verification/${payment.merchantWallet}`);
      if (!response.ok) return { verified: false };
      return await response.json();
    },
    enabled: !!payment?.merchantWallet,
    refetchInterval: 30000, // Refetch every 30s
  });

  const isVerified = verificationStatus?.verified ?? false;

  // Get display name and logo
  const merchantDisplayName = payment?.merchantProfile?.businessName || 
    (payment?.merchantWallet ? `${payment.merchantWallet.slice(0, 6)}...${payment.merchantWallet.slice(-4)}` : "Merchant");
  const merchantLogoUrl = payment?.merchantProfile?.logoUrl || null;

  // Get settlement currency from payment (default to USDC)
  const settlementCurrency = (payment?.settlementCurrency as "USDC" | "EURC") || "USDC";
  const isTestnet = payment?.isTest ?? true;

  // Get supported payment assets
  const { data: supportedAssets } = useQuery<Array<{ asset: string; chainId: number; chainName: string; requiresBridge: boolean; requiresSwap: boolean }>>({
    queryKey: ["/api/payments/supported-assets", settlementCurrency, isTestnet],
    queryFn: async () => {
      const response = await fetch(`/api/payments/supported-assets?settlementCurrency=${settlementCurrency}&isTestnet=${String(isTestnet)}`);
      if (!response.ok) {
        console.error("Failed to fetch supported assets:", response.status, response.statusText);
        return [];
      }
      return await response.json();
    },
    enabled: !!settlementCurrency,
    retry: 1,
  });

  // Get conversion estimate (only if payment asset requires conversion)
  const selectedAsset = supportedAssets?.find(a => a.asset === paymentAsset);
  const requiresConversion = selectedAsset?.requiresBridge || selectedAsset?.requiresSwap;
  
  const { data: conversionEstimate } = useQuery<{ estimatedTime: number; estimatedFees: string; conversionPath: string; steps: string[] }>({
    queryKey: ["/api/payments/conversion-estimate", paymentAsset, settlementCurrency, payment?.amount, isTestnet],
    queryFn: async () => {
      if (!payment?.amount) return null;
      const params = new URLSearchParams({
        paymentAsset,
        settlementCurrency,
        amount: String(payment.amount),
        isTestnet: String(isTestnet),
      });
      const response = await fetch(`/api/payments/conversion-estimate?${params.toString()}`);
      if (!response.ok) {
        console.error("Failed to fetch conversion estimate:", response.status, response.statusText);
        return null;
      }
      return await response.json();
    },
    enabled: !!paymentAsset && !!settlementCurrency && !!payment?.amount && requiresConversion,
    retry: 1,
  });

  // Calculate final amount with fees
  const baseAmount = payment ? parseFloat(payment.amount) : 0;
  const estimatedFees = conversionEstimate ? parseFloat(conversionEstimate.estimatedFees) : 0;
  const finalAmount = baseAmount + estimatedFees;

  // Auto-switch to ARC chain when connected
  useEffect(() => {
    if (isConnected && !isArcChain) {
      switchToArcChain().catch(console.error);
    }
  }, [isConnected, isArcChain, switchToArcChain]);

  // Chain validation is handled by RainbowKit/wagmi through isArcChain check
  // The pay button is disabled when !isArcChain, so no need for explicit validation

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
        customerEmail: customerEmail || undefined,
        customerName: customerName || undefined,
        gasSponsored: gasSponsored,
      });
      return await result.json();
    },
    retry: false, // Don't retry on error to prevent rate limit issues
    retryDelay: 0,
  });

  // Track if we've already submitted this txHash to prevent duplicate submissions
  const [submittedTxHash, setSubmittedTxHash] = useState<string | null>(null);

  // Handle transaction submission when txHash is available
  useEffect(() => {
    if (txHash && txHash !== submittedTxHash && !submitTxMutation.isPending && !submitTxMutation.isSuccess && !submitTxMutation.isError) {
      setPaymentState("pending");
      setSubmittedTxHash(txHash);
      submitTxMutation.mutate(txHash);
    }
  }, [txHash, submittedTxHash, submitTxMutation]);

  // Handle transaction success/failure
  useEffect(() => {
    if (txSuccess && submitTxMutation.isSuccess) {
      // Transaction confirmed and submitted to backend
      setPaymentError(null);
      setPaymentState("success"); // Immediately set to success to prevent multiple payments
      refetch(); // Refresh payment status
    } else if (txError || writeError) {
      setPaymentState("error");
      let errorMsg: string | null = null;
      if (writeError) {
        if (typeof writeError === 'object' && writeError !== null && 'message' in writeError) {
          errorMsg = String((writeError as { message: unknown }).message);
        } else if (typeof writeError === 'string') {
          errorMsg = writeError;
        }
      }
      if (!errorMsg && txError) {
        if (typeof txError === 'object' && txError !== null && 'message' in txError) {
          errorMsg = String((txError as { message: unknown }).message);
        } else if (typeof txError === 'string') {
          errorMsg = txError;
        }
      }
      if (errorMsg?.includes("RPC endpoint")) {
        setPaymentError("Network error: Please check your RPC connection and try again.");
      } else {
        setPaymentError(errorMsg || "Transaction failed. Please try again.");
      }
    } else if (submitTxMutation.isError) {
      setPaymentState("error");
      setPaymentError(submitTxMutation.error?.message || "Failed to submit transaction to server.");
    }
  }, [txSuccess, txError, writeError, submitTxMutation.isSuccess, submitTxMutation.isError, submitTxMutation.error, refetch]);

  // Handle payment status changes from backend polling
  useEffect(() => {
    const currentState = paymentState;
    if (payment?.status === "confirmed") {
      setPaymentState("success");
      setSubmittedTxHash(null);
      // Force a refetch to get the latest payment data
      refetch();
    } else if (payment?.status === "failed") {
      setPaymentState("error");
      setSubmittedTxHash(null);
    } else if (payment?.status === "pending") {
      // Only set to pending if we're not already in success or error state
      if (currentState === "idle" || currentState === "processing") {
        setPaymentState("pending");
      }
    }
  }, [payment?.status, paymentState, refetch]);

  // Main payment handler
  const handlePay = async () => {
    try {
      // Prevent multiple payments if already confirmed
      if (payment?.status === "confirmed" || paymentState === "success") {
        setPaymentState("success");
        return;
      }

      if (!payment || !payment.merchantWallet) {
        throw new Error("Payment or merchant wallet not found");
      }

      if (!address) {
        throw new Error("Wallet not connected");
      }

      // Prevent payment if already processing or pending
      if (paymentState === "processing" || paymentState === "pending" || payment?.status === "pending") {
        return;
      }

      // Ensure we're on the correct chain (RainbowKit handles this, but double-check for safety)
      if (!isArcChain) {
        await switchToArcChain();
        // Wait a bit for chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      setPaymentState("processing");

      // Normalize and validate merchant wallet address
      const merchantWallet = (payment.merchantWallet.toLowerCase() as `0x${string}`);
      
      // Ensure merchant wallet is different from sender
      if (merchantWallet.toLowerCase() === address.toLowerCase()) {
        throw new Error("Cannot pay to your own wallet address");
      }

      // Validate wallet address format
      if (!/^0x[a-f0-9]{40}$/.test(merchantWallet)) {
        throw new Error("Invalid merchant wallet address format");
      }

      // Execute USDC transfer directly
      const amount = parseFloat(payment.amount);
      const amountInUnits = parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
      
      console.log("Transferring USDC:", {
        to: merchantWallet,
        amount: amountInUnits.toString(),
        from: address,
      });
      
      writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [merchantWallet, amountInUnits],
      });
      setPaymentError(null); // Clear any previous errors
    } catch (error) {
      console.error("Payment error:", error);
      setPaymentState("error");
      setPaymentError(error instanceof Error ? error.message : "Payment failed. Please try again.");
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
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-checkout">
      {/* Header with Logo and Connect Wallet */}
      <header className="w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/arcpay.webp" alt="ArcPayKit" className="h-8" />
            </div>
            <div className="flex items-center">
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
                  const ready = mounted;
                  const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus ||
                      authenticationStatus === 'authenticated');

                  if (!ready) {
                    return null;
                  }

                  if (!connected) {
                    return (
                      <Button
                        onClick={openConnectModal}
                        type="button"
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <Wallet className="w-4 h-4" />
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
                        className="flex items-center gap-2"
                      >
                        Wrong Network
                      </Button>
                    );
                  }

                  return (
                    <Button
                      onClick={openAccountModal}
                      type="button"
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      {account.displayName}
                    </Button>
                  );
                }}
              </ConnectWalletButtonCustom>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 relative">

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border border-border">
          <CardHeader className="text-center pb-4 pt-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img 
                src={merchantLogoUrl || "/user.svg"} 
                alt={merchantDisplayName}
                className="w-12 h-12 rounded-xl object-cover"
                onError={(e) => {
                  // Fallback to user.svg if merchant logo fails to load
                  if (e.currentTarget.src !== `${window.location.origin}/user.svg`) {
                    e.currentTarget.src = "/user.svg";
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{merchantDisplayName}</span>
                {isVerified && (
                  <Badge variant="default" className="gap-1">
                    <Shield className="w-3 h-3" />
                    Verified
                  </Badge>
                )}
              </div>
            </div>
            {payment.isTest && (
              <Badge variant="secondary" className="mb-2">
                Test mode
              </Badge>
            )}
            {payment.description && (
              <p className="text-muted-foreground">{payment.description}</p>
            )}
          </CardHeader>
          <div className="border-b border-border mx-6"></div>

          <CardContent className="space-y-6 pt-6">
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
                  <p className="text-muted-foreground mb-6">
                    Your payment has been successfully processed.
                  </p>

                  {/* Receipt Details */}
                  <div className="bg-muted/50 rounded-lg p-4 mb-4 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Merchant</span>
                      <span className="text-sm font-medium">{merchantDisplayName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Amount</span>
                      <span className="text-sm font-medium">
                        {amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {settlementCurrency}
                      </span>
                    </div>
                    {payment.description && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Description</span>
                        <span className="text-sm font-medium">{payment.description}</span>
                      </div>
                    )}
                    {payment.payerWallet && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">From</span>
                        <span className="text-sm font-mono">
                          {payment.payerWallet.slice(0, 6)}...{payment.payerWallet.slice(-4)}
                        </span>
                      </div>
                    )}
                    {payment.txHash && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Transaction</span>
                        <a
                          href={getExplorerLink(payment.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline font-mono"
                        >
                          {payment.txHash.slice(0, 8)}...{payment.txHash.slice(-6)}
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    {payment.createdAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Date</span>
                        <span className="text-sm font-medium">
                          {new Date(payment.createdAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {payment.settlementTime && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Settlement Time</span>
                        <span className="text-sm font-medium text-green-500">
                          {payment.settlementTime}s
                        </span>
                      </div>
                    )}
                  </div>

                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {payment.settlementTime ? `Finalized in ${payment.settlementTime}s` : "Finalized"}
                  </Badge>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <Button
                      onClick={() => {
                        // Close or redirect - you can customize this
                        window.location.href = "/";
                      }}
                      className="w-full sm:w-auto"
                    >
                      Done
                    </Button>
                    {payment.txHash && (
                      <Button
                        variant="outline"
                        onClick={() => window.open(getExplorerLink(payment.txHash!), "_blank")}
                        className="w-full sm:w-auto"
                      >
                        View on ArcScan
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Customer Information Fields */}
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground mb-2">Optional details</p>
                    <div className="space-y-2">
                      <Label htmlFor="customer-name" className="text-sm text-muted-foreground">Name</Label>
                      <Input
                        id="customer-name"
                        type="text"
                        placeholder="Enter your name"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customer-email" className="text-sm text-muted-foreground">Email</Label>
                      <Input
                        id="customer-email"
                        type="email"
                        placeholder="Enter your email"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full h-9"
                      />
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="text-5xl font-bold tracking-tight mb-2">
                      {settlementCurrency === "EURC" ? "€" : "$"}
                      {amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-muted-foreground mb-4">
                      Pay with USDC
                    </div>
                  </div>

                  {/* Payment Asset Selection - Only show if cross-chain payment is required */}
                  {supportedAssets && supportedAssets.length > 0 && (
                    <div className="space-y-2">
                      <Label>Pay with</Label>
                      <Select value={paymentAsset} onValueChange={setPaymentAsset}>
                        <SelectTrigger data-testid="select-payment-asset">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedAssets.map((asset) => {
                            // Simplify display - hide technical details
                            const displayName = asset.asset === "USDC_ARC" 
                              ? "USDC" 
                              : asset.asset.replace("_", " ");
                            return (
                              <SelectItem key={asset.asset} value={asset.asset}>
                                {displayName}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Choose your payment method. Conversion happens automatically.
                      </p>
                    </div>
                  )}

                  {/* Conversion Flow - Only show if cross-chain payment is required */}
                  {paymentAsset && conversionEstimate && 
                   (conversionEstimate.steps?.length > 1 || paymentAsset !== "USDC_ARC") && (
                    <ConversionFlow
                      paymentAsset={paymentAsset}
                      settlementCurrency={settlementCurrency}
                      amount={payment?.amount || "0"}
                      isTestnet={isTestnet}
                    />
                  )}

                  {/* Fee Abstraction */}
                  <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Merchant receives</span>
                      <span className="font-medium">
                        {baseAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {settlementCurrency}
                      </span>
                    </div>
                    {estimatedFees > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Network fees</span>
                        <span className="text-muted-foreground">
                          +{estimatedFees.toLocaleString("en-US", { minimumFractionDigits: 2 })} {settlementCurrency}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="font-medium">You pay</span>
                      <span className="text-lg font-bold">
                        {finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} {settlementCurrency}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                      <Info className="w-3 h-3" />
                      <span>All fees included. Merchant receives exact settlement amount. ArcPay covers network fees where applicable.</span>
                    </div>
                  </div>

                  {/* Gas Sponsorship Toggle - Simplified wording */}
                  <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/50">
                    <div className="space-y-0.5 flex-1">
                      <Label htmlFor="gas-sponsored" className="text-base flex items-center gap-2 cursor-pointer">
                        <Zap className="w-4 h-4" />
                        No gas fees for customers
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Merchant covers transaction fees where supported
                      </p>
                    </div>
                    <Switch
                      id="gas-sponsored"
                      checked={gasSponsored}
                      onCheckedChange={setGasSponsored}
                    />
                  </div>
                  {gasSponsored && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Gas sponsorship is enabled. You won't pay transaction fees for supported operations.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Testnet Banner */}
                  {isTestnet && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-center gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-700 dark:text-yellow-400">
                          ⚠ Testnet Mode — Conversions are simulated. Settlement logic mirrors production.
                        </span>
                      </div>
                    </div>
                  )}

                  {!isConnected && (
                    <div className="mb-3 p-4 bg-muted/50 rounded-lg border border-border">
                      <p className="text-sm text-muted-foreground text-center mb-2">
                        Please connect your wallet using the button in the top right corner to proceed with payment
                      </p>
                    </div>
                  )}

                  {isConnected && !isArcChain && (
                    <div className="mb-3">
                      <Button
                        onClick={() => switchToArcChain()}
                        type="button"
                        variant="destructive"
                        className="w-full h-12 text-base"
                      >
                        Wrong network - Switch to ARC Testnet
                      </Button>
                    </div>
                  )}

                  <Button
                    className="w-full h-14 text-base font-semibold transition-all hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.01]"
                    onClick={handlePay}
                    disabled={(() => {
                      type PaymentStateType = "idle" | "processing" | "pending" | "success" | "error";
                      const state = paymentState as PaymentStateType;
                      return state === "processing" || 
                             state === "pending" ||
                             state === "success" ||
                             state === "error" ||
                             payment?.status === "confirmed" ||
                             payment?.status === "failed" ||
                             isWriting || 
                             isWaiting ||
                             !isConnected || 
                             !address ||
                             !isArcChain;
                    })()}
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
                      <>
                        Pay {settlementCurrency === "EURC" ? "€" : "$"}
                        {finalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </>
                    )}
                  </Button>

                  {paymentState === "error" && (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="w-4 h-4" />
                        <span className="font-medium">Payment Failed</span>
                      </div>
                      <p className="text-sm text-destructive">
                        {paymentError || writeError?.message || submitTxMutation.error?.message || "Payment failed. Please try again."}
                      </p>
                      {writeError?.message?.includes("RPC") && (
                        <p className="text-xs text-muted-foreground">
                          This may be a temporary network issue. Please wait a moment and try again.
                        </p>
                      )}
                      {paymentError?.toLowerCase().includes("underpayment") && (
                        <div className="mt-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs">
                          <p className="text-yellow-700 dark:text-yellow-400">
                            You sent less than required. Please send an additional amount to complete payment.
                          </p>
                        </div>
                      )}
                      {paymentError?.toLowerCase().includes("delay") || paymentError?.toLowerCase().includes("waiting") && (
                        <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded text-xs">
                          <p className="text-blue-700 dark:text-blue-400">
                            Payment received. Waiting for network confirmation...
                          </p>
                        </div>
                      )}
                      {paymentError?.toLowerCase().includes("unsupported") && (
                        <div className="mt-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded text-xs">
                          <p className="text-orange-700 dark:text-orange-400">
                            This asset is not supported yet. Please select a supported payment method.
                          </p>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                        <Info className="w-3 h-3" />
                        <span>Need help? Contact support or check our FAQ.</span>
                      </div>
                    </div>
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
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              Powered by
            </Badge>
            <img src="/arc.webp" alt="Arc Network" className="h-6" />
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}

export default function Checkout() {
  const { isReady: walletReady } = useWalletProviderReady();

  // Show loading spinner while wallet providers are loading
  if (!walletReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <CheckoutContent />;
}
