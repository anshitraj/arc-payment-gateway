import { useState, useEffect } from "react";
import { useParams, useLocation as useWouterLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, Shield, AlertCircle } from "lucide-react";
import { useWalletProviderReady } from "@/lib/WalletProviderContext";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { getExplorerLink } from "@/lib/arc";
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';
import { useWallet } from "@/lib/wallet-rainbowkit";
import { apiRequest } from "@/lib/queryClient";
import { useTestMode } from "@/hooks/useTestMode";
import { Navbar } from "@/components/Navbar";
import type { Payment } from "@shared/schema";

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

const USDC_ADDRESS = (import.meta.env.VITE_USDC_TOKEN_ADDRESS || "0x3600000000000000000000000000000000000000") as `0x${string}`;
const USDC_DECIMALS = 6;

function QRPaymentContent() {
  const { merchantId } = useParams<{ merchantId: string }>();
  const [, setLocation] = useWouterLocation();
  
  const [searchParams] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  });
  const [amount, setAmount] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("amount") || "";
    }
    return "";
  });
  const [paymentState, setPaymentState] = useState<"idle" | "processing" | "pending" | "success" | "error">("idle");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  const { address, isConnected, isArcChain, switchToArcChain } = useWallet();
  const { testMode } = useTestMode();

  // Get merchant info by wallet address (merchantId is wallet address in QR codes)
  const { data: merchant, isLoading: isLoadingMerchant, error: merchantError } = useQuery({
    queryKey: ["/api/merchants/wallet", merchantId],
    queryFn: async () => {
      if (!merchantId || !merchantId.startsWith("0x")) {
        return null;
      }
      try {
        // Try to get merchant by wallet address
        const response = await fetch(`/api/merchants/wallet/${merchantId}`);
        if (!response.ok) {
          // If not found, return null (merchant might not exist)
          return null;
        }
        return await response.json();
      } catch (error) {
        console.error("Error fetching merchant:", error);
        return null;
      }
    },
    enabled: !!merchantId && merchantId.startsWith("0x"),
    retry: false,
  });

  // Get merchant profile (business name) by wallet address
  const { data: merchantProfileData } = useQuery({
    queryKey: ["/api/merchant/public", merchantId],
    queryFn: async () => {
      if (!merchantId || !merchantId.startsWith("0x")) {
        return null;
      }
      try {
        const response = await fetch(`/api/merchant/public/${merchantId}`);
        if (!response.ok) {
          return null;
        }
        return await response.json();
      } catch {
        return null;
      }
    },
    enabled: !!merchantId && merchantId.startsWith("0x"),
  });

  // Extract business name from profile data
  const businessName = merchantProfileData?.business_name || merchantProfileData?.profile?.businessName;

  // Check merchant verification status (public endpoint by wallet address)
  const { data: verificationStatus } = useQuery<{ verified: boolean }>({
    queryKey: ["/api/badges/verification", merchantId],
    queryFn: async () => {
      if (!merchantId || !merchantId.startsWith("0x")) return { verified: false };
      const response = await fetch(`/api/badges/verification/${merchantId}`);
      if (!response.ok) return { verified: false };
      return await response.json();
    },
    enabled: !!merchantId && merchantId.startsWith("0x"),
    refetchInterval: 30000, // Refetch every 30s
  });

  const isVerified = verificationStatus?.verified ?? false;
  const merchantWallet = merchant?.walletAddress as `0x${string}` | undefined;
  const isFixedAmount = !!searchParams.get("amount");
  const fixedAmount = searchParams.get("amount") || "";

  // Auto-switch to ARC chain when connected
  useEffect(() => {
    if (isConnected && !isArcChain) {
      switchToArcChain().catch(console.error);
    }
  }, [isConnected, isArcChain, switchToArcChain]);

  // Create payment when amount is set
  const createPaymentMutation = useMutation({
    mutationFn: async (paymentAmount: string) => {
      if (!merchantId || !merchantWallet) {
        throw new Error("Merchant information not available");
      }

      const response = await apiRequest("POST", "/api/payments", {
        amount: paymentAmount,
        currency: "USDC",
        description: "QR Code Payment",
        isTest: testMode,
      });
      return await response.json();
    },
  });

  const { writeContract, data: hash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Submit transaction hash to backend
  const submitTxMutation = useMutation({
    mutationFn: async ({ paymentId, txHash, payerWallet }: { paymentId: string; txHash: string; payerWallet: string }) => {
      const response = await apiRequest("POST", "/api/payments/submit-tx", {
        paymentId,
        txHash,
        payerWallet,
      });
      return await response.json();
    },
  });

  // Watch for payment confirmation
  const { data: payment, refetch: refetchPayment } = useQuery<Payment>({
    queryKey: ["/api/payments", createPaymentMutation.data?.id],
    enabled: !!createPaymentMutation.data?.id,
    refetchInterval: paymentState === "pending" ? 3000 : false,
  });

  useEffect(() => {
    if (payment?.status === "confirmed") {
      setPaymentState("success");
    } else if (payment?.status === "failed") {
      setPaymentState("error");
      setPaymentError("Payment failed");
    }
  }, [payment]);

  useEffect(() => {
    if (isConfirmed && hash && createPaymentMutation.data) {
      setPaymentState("pending");
      submitTxMutation.mutate({
        paymentId: createPaymentMutation.data.id,
        txHash: hash,
        payerWallet: address || "",
      });
    }
  }, [isConfirmed, hash, createPaymentMutation.data, address, submitTxMutation]);

  // Set success state immediately when transaction is confirmed and submitted
  useEffect(() => {
    if (isConfirmed && submitTxMutation.isSuccess) {
      setPaymentState("success");
    }
  }, [isConfirmed, submitTxMutation.isSuccess]);

  const handlePay = async () => {
    // Prevent multiple payments if already confirmed
    if (paymentState === "success" || payment?.status === "confirmed") {
      return;
    }

    // Prevent payment if already processing or pending
    if (paymentState === "processing" || paymentState === "pending") {
      return;
    }

    if (!isConnected) {
      return;
    }

    if (!isArcChain) {
      try {
        await switchToArcChain();
      } catch (error) {
        setPaymentError("Failed to switch to ARC Testnet");
        return;
      }
    }

    const paymentAmount = isFixedAmount ? fixedAmount : amount;
    if (!paymentAmount || isNaN(parseFloat(paymentAmount)) || parseFloat(paymentAmount) <= 0) {
      setPaymentError("Please enter a valid amount");
      return;
    }

    if (!merchantWallet) {
      setPaymentError("Merchant wallet address not found");
      return;
    }

    try {
      setPaymentState("processing");
      setPaymentError(null);

      // Create payment first
      const payment = await createPaymentMutation.mutateAsync(paymentAmount);

      // Convert amount to USDC (6 decimals)
      const amountInUnits = parseUnits(paymentAmount, USDC_DECIMALS);

      // Write contract
      writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [merchantWallet, amountInUnits],
      });
    } catch (error: any) {
      console.error("Payment error:", error);
      setPaymentState("error");
      setPaymentError(error.message || "Payment failed");
    }
  };

  // Use business name from profile, fallback to merchant name, then wallet address
  const merchantDisplayName = businessName || merchant?.name || (merchantWallet ? `${merchantWallet.slice(0, 6)}...${merchantWallet.slice(-4)}` : "Merchant");

  // Show error if merchant ID is invalid or merchant not found
  if (merchantId && (!merchantId.startsWith("0x") || merchantId === "invalid")) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen pt-32 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Invalid QR Code</CardTitle>
              <CardDescription>
                This QR code is invalid or the merchant wallet address is not configured.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please contact the merchant to get a valid QR code.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show loading state while fetching merchant
  if (isLoadingMerchant) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen pt-32 p-4">
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error if there was an error fetching merchant
  if (merchantError) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen pt-32 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Error Loading Merchant</CardTitle>
              <CardDescription>
                There was an error loading the merchant information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {merchantError instanceof Error ? merchantError.message : "Failed to load merchant"}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error if merchant not found
  if (merchantId && !isLoadingMerchant && !merchant) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen pt-32 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Merchant Not Found</CardTitle>
              <CardDescription>
                The merchant associated with this QR code could not be found.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please verify the QR code is correct or contact the merchant.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center min-h-screen pt-32 p-4">
        <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CardTitle className="text-2xl">Pay {merchantDisplayName}</CardTitle>
            {isVerified && (
              <Badge variant="default" className="gap-1">
                <Shield className="w-3 h-3" />
                Verified
              </Badge>
            )}
          </div>
          <CardDescription>
            {testMode && (
              <Badge variant="secondary" className="mb-2">Test Mode</Badge>
            )}
            {isFixedAmount ? (
              <span className="text-lg font-semibold text-foreground">
                ${parseFloat(fixedAmount).toFixed(2)} USDC
              </span>
            ) : (
              "Enter amount to pay"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {paymentState === "success" && payment ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
                <p className="text-muted-foreground mb-4">
                  Your payment of ${parseFloat(payment.amount).toFixed(2)} USDC has been confirmed.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    onClick={() => {
                      setLocation("/");
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
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : paymentState === "error" ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{paymentError || "Payment failed"}</AlertDescription>
            </Alert>
          ) : (
            <>
              {!isFixedAmount && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USDC)</Label>
                  <NumberInput
                    id="amount"
                    step={0.01}
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={paymentState !== "idle"}
                  />
                </div>
              )}

              {!isConnected ? (
                <div className="space-y-4">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Connect your wallet to pay
                    </AlertDescription>
                  </Alert>
                  <ConnectWalletButton />
                </div>
              ) : (
                <div className="space-y-4">
                  {!isArcChain && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Please switch to ARC Testnet to continue
                      </AlertDescription>
                    </Alert>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handlePay}
                    disabled={
                      paymentState === "success" ||
                      paymentState === "processing" ||
                      paymentState === "pending" ||
                      payment?.status === "confirmed" ||
                      isWriting ||
                      isConfirming ||
                      createPaymentMutation.isPending ||
                      (!isFixedAmount && (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0)) ||
                      !isArcChain
                    }
                  >
                    {paymentState === "processing" || isWriting || isConfirming || createPaymentMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : paymentState === "pending" ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirming...
                      </>
                    ) : (
                      `Pay ${isFixedAmount ? `$${parseFloat(fixedAmount).toFixed(2)}` : amount ? `$${parseFloat(amount).toFixed(2)}` : ""} USDC`
                    )}
                  </Button>

                  {testMode && (
                    <p className="text-xs text-center text-muted-foreground">
                      This is a test payment. No real funds will be transferred.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

export default function QRPayment() {
  const { isReady: walletReady } = useWalletProviderReady();

  // Show loading spinner while wallet providers are loading
  if (!walletReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return <QRPaymentContent />;
}

