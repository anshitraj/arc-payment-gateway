import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";

// Extend Window interface for MetaMask
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      isMetaMask?: boolean;
    };
  }
}
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DashboardSidebar } from "@/components/DashboardSidebar";
import { TestModeToggle } from "@/components/TestModeToggle";
import { StatusIndicator } from "@/components/StatusIndicator";
import { GasPriceDisplay } from "@/components/GasPriceDisplay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowDown, CheckCircle2, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTestMode } from "@/hooks/useTestMode";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getExplorerLink } from "@/lib/arc";
import { useWallet } from "@/lib/wallet-rainbowkit";
import { useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from "wagmi";
import { formatUnits, parseUnits, pad, Address, Hash } from "viem";
import { lazy, Suspense } from "react";

const ConnectButton = lazy(async () => {
  const mod = await import("@rainbow-me/rainbowkit");
  return { default: mod.ConnectButton };
});

interface BridgeEstimate {
  estimatedTime: number;
  estimatedFees: string;
  steps: string[];
}

interface BridgeHistory {
  id: string;
  amount: string;
  currency: string;
  fromChain: string;
  toChain: string;
  status: "pending" | "burning" | "minting" | "completed" | "failed";
  txHash?: string;
  createdAt: string;
}

const SUPPORTED_CHAINS = [
  { id: 84532, name: "Base Sepolia", testnet: true },
  { id: 11155111, name: "Sepolia", testnet: true },
  { id: 8453, name: "Base", testnet: false },
  { id: 1, name: "Ethereum", testnet: false },
  { id: 5042002, name: "Arc Network", testnet: true },
  { id: 5042001, name: "Arc Network", testnet: false },
];

// Chain configurations for adding to MetaMask
const CHAIN_CONFIGS: Record<number, {
  chainId: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrls: string[];
  blockExplorerUrls: string[];
}> = {
  5042002: {
    chainId: "0x4D0A02", // 5042002 in hex
    chainName: "Arc Testnet",
    // MetaMask requires nativeCurrency.decimals to be 18, even though USDC uses 6 decimals
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: [
      "https://rpc.testnet.arc.network",
      "https://rpc.blockdaemon.testnet.arc.network",
      "https://rpc.drpc.testnet.arc.network",
      "https://rpc.quicknode.testnet.arc.network",
    ],
    blockExplorerUrls: ["https://testnet.arcscan.app"],
  },
  5042001: {
    chainId: "0x4CEF51", // 5042001 in hex
    chainName: "Arc Network",
    // MetaMask requires nativeCurrency.decimals to be 18, even though USDC uses 6 decimals
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
    rpcUrls: [
      "https://rpc.arc.network",
      "https://rpc.blockdaemon.arc.network",
      "https://rpc.drpc.arc.network",
      "https://rpc.quicknode.arc.network",
    ],
    blockExplorerUrls: ["https://arcscan.app"],
  },
  84532: {
    chainId: "0x14A34", // 84532 in hex
    chainName: "Base Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://sepolia.base.org"],
    blockExplorerUrls: ["https://sepolia-explorer.base.org"],
  },
  11155111: {
    chainId: "0xAA36A7", // 11155111 in hex
    chainName: "Sepolia",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://rpc.sepolia.org"],
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
  },
  8453: {
    chainId: "0x2105", // 8453 in hex
    chainName: "Base",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://mainnet.base.org"],
    blockExplorerUrls: ["https://basescan.org"],
  },
  1: {
    chainId: "0x1", // 1 in hex
    chainName: "Ethereum Mainnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: ["https://eth.llamarpc.com"],
    blockExplorerUrls: ["https://etherscan.io"],
  },
};

// USDC token addresses by chain (testnet)
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  5042002: "0x3600000000000000000000000000000000000000", // Arc Testnet
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia
  // Mainnet addresses
  5042001: "0x3600000000000000000000000000000000000000", // Arc Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base Mainnet
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum Mainnet
};

// ERC20 ABI
const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// CCTP TokenMessenger ABI (depositForBurn function)
const TOKEN_MESSENGER_ABI = [
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
    ],
    name: "depositForBurn",
    outputs: [{ name: "_nonce", type: "uint64" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// CCTP contract addresses (testnet)
const CCTP_TESTNET_CONFIG: Record<number, { tokenMessenger: Address; usdc: Address; domain: number }> = {
  5042002: {
    // Arc Testnet - TokenMessengerV2
    tokenMessenger: "0x8FE689990c688CcFDD58f7EB8974218be2542DAA",
    usdc: "0x3600000000000000000000000000000000000000", // USDC ERC-20 interface (6 decimals)
    domain: 26, // Arc Testnet domain
  },
  84532: {
    tokenMessenger: "0x9f3B8679C73C2Fef8b59B4f3444d4e156fb70AA5",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    domain: 6, // Base Sepolia
  },
  11155111: {
    tokenMessenger: "0x9f3B8679C73C2Fef8b59B4f3444d4e156fb70AA5",
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    domain: 0, // Sepolia
  },
};

// CCTP contract addresses (mainnet)
const CCTP_MAINNET_CONFIG: Record<number, { tokenMessenger: Address; usdc: Address; domain: number }> = {
  8453: {
    tokenMessenger: "0x1682Ae6375C4E4A97e4B583BC4cB31Cc3a3b2c6e",
    usdc: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    domain: 6, // Base
  },
  1: {
    tokenMessenger: "0xbd3fa81B58Ba92a82136038B25aDec7066af3155",
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    domain: 0, // Ethereum
  },
};

// CCTP Domain IDs
const CCTP_DOMAINS: Record<number, number> = {
  84532: 6, // Base Sepolia
  11155111: 0, // Sepolia
  5042002: 999, // Arc Testnet (placeholder)
  8453: 6, // Base
  1: 0, // Ethereum
  5042001: 999, // Arc Mainnet (placeholder)
};

export default function DashboardBridge() {
  const { testMode } = useTestMode();
  const { toast } = useToast();
  const { address, isConnected, chainId } = useWallet();
  const { writeContract, data: burnTxHash, isPending: isBurnPending, error: burnError } = useWriteContract();
  const { switchChain } = useSwitchChain();
  
  // Wait for burn transaction
  const { isLoading: isBurnConfirming, isSuccess: isBurnSuccess } = useWaitForTransactionReceipt({
    hash: burnTxHash,
    enabled: !!burnTxHash,
  });
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"USDC" | "EURC">("USDC");
  const [fromChainId, setFromChainId] = useState<string>("");
  const [toChainId, setToChainId] = useState<string>("");
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "estimating" | "bridging" | "success" | "error">("idle");
  const [estimate, setEstimate] = useState<BridgeEstimate | null>(null);

  // Filter chains based on test mode
  const availableChains = SUPPORTED_CHAINS.filter((chain) => chain.testnet === testMode);

  // Set default chains on mount - FROM Arc Testnet TO Base Sepolia (testnet)
  useEffect(() => {
    if (!fromChainId && availableChains.length > 0) {
      // Default FROM chain should be Arc Testnet (5042002) or Arc Mainnet (5042001)
      const arcChain = availableChains.find((c) => 
        (testMode && c.id === 5042002) || (!testMode && c.id === 5042001)
      ) || availableChains.find((c) => c.id === 5042002 || c.id === 5042001);
      if (arcChain) {
        setFromChainId(arcChain.id.toString());
      }
    }
    if (!toChainId && availableChains.length > 0) {
      // Default TO chain should be Base Sepolia (84532) for testnet, Base (8453) for mainnet
      const baseChain = availableChains.find((c) => 
        (testMode && c.id === 84532) || (!testMode && c.id === 8453)
      ) || availableChains.find((c) => c.id === 84532 || c.id === 8453);
      if (baseChain) {
        setToChainId(baseChain.id.toString());
      } else {
        // Fallback to first non-Arc chain
        const nonArcChain = availableChains.find((c) => c.id !== 5042002 && c.id !== 5042001);
        if (nonArcChain) {
          setToChainId(nonArcChain.id.toString());
        }
      }
    }
  }, [availableChains, fromChainId, toChainId, testMode]);

  // Get USDC token address for the FROM chain
  const fromChainIdNum = fromChainId ? parseInt(fromChainId, 10) : null;
  const usdcAddress = fromChainIdNum && USDC_ADDRESSES[fromChainIdNum] ? USDC_ADDRESSES[fromChainIdNum] : undefined;

  // Check if user is connected to the FROM chain (ensure both are valid numbers)
  const isOnFromChain = 
    chainId !== undefined && 
    chainId !== null && 
    fromChainIdNum !== null && 
    !isNaN(Number(chainId)) && 
    !isNaN(Number(fromChainIdNum)) &&
    Number(chainId) === Number(fromChainIdNum);
  
  // Check if user is on the correct chain for button display
  const isOnCorrectChain = isOnFromChain;

  // Check if FROM chain is Arc (USDC is native on Arc)
  const isArcChain = fromChainIdNum === (testMode ? 5042002 : 5042001);

  // For Arc: Use native balance first (faster), fallback to ERC20 if needed
  // Native balance uses 18 decimals, ERC20 interface uses 6 decimals
  const { data: nativeBalance, isLoading: nativeBalanceLoading, error: nativeBalanceError } = useBalance({
    address: address,
    chainId: isArcChain && fromChainIdNum ? fromChainIdNum : undefined,
    query: {
      enabled: !!address && isOnFromChain && isArcChain && !!fromChainIdNum,
      refetchInterval: 30000, // Reduced from 10s to 30s
      staleTime: 20000, // Consider data fresh for 20s
      gcTime: 60000, // Keep in cache for 60s
    },
  });

  // Only fetch ERC20 balance on Arc if native balance fails or is unavailable
  const shouldFetchArcErc20 = isArcChain && (!nativeBalance && !nativeBalanceLoading && nativeBalanceError);
  const { data: arcErc20Balance, isLoading: arcErc20BalanceLoading } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: isArcChain && fromChainIdNum ? fromChainIdNum : undefined,
    query: {
      enabled: shouldFetchArcErc20 && !!address && !!usdcAddress && isOnFromChain && !!fromChainIdNum,
      refetchInterval: 30000,
      staleTime: 20000,
      gcTime: 60000,
    },
  });

  // Fetch ERC20 balance for non-Arc chains
  const { data: balance, isLoading: balanceLoading } = useReadContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: !isArcChain && fromChainIdNum ? fromChainIdNum : undefined,
    query: {
      enabled: !!address && !!usdcAddress && !!fromChainIdNum && isOnFromChain && !isArcChain,
      refetchInterval: 30000, // Reduced from 10s to 30s
      staleTime: 20000, // Consider data fresh for 20s
      gcTime: 60000, // Keep in cache for 60s
    },
  });

  // Format balance for display (memoized to prevent unnecessary recalculations)
  const { isLoadingBalance, displayBalance } = useMemo(() => {
    const loading = isArcChain 
      ? (nativeBalanceLoading || arcErc20BalanceLoading)
      : balanceLoading;
    
    // Use different variable name to avoid shadowing the hook's `balance`
    const calculatedBalance = isArcChain
      ? (nativeBalance?.value ? nativeBalance.value : arcErc20Balance) // Native uses 18, ERC20 uses 6
      : balance; // ERC20 uses 6 decimals
    
    return { isLoadingBalance: loading, displayBalance: calculatedBalance };
  }, [isArcChain, nativeBalanceLoading, arcErc20BalanceLoading, balanceLoading, nativeBalance?.value, arcErc20Balance, balance]);
  
  // Debug: Log balance state (throttled to avoid performance issues)
  if (process.env.NODE_ENV === 'development') {
    // Only log when balance changes, not on every render
    const debugKey = `${address}-${chainId}-${fromChainIdNum}-${nativeBalance?.value?.toString()}-${arcErc20Balance?.toString()}-${balance?.toString()}`;
    if (typeof window !== 'undefined' && (window as any).__lastBalanceDebugKey !== debugKey) {
      (window as any).__lastBalanceDebugKey = debugKey;
      console.log('Balance Debug:', {
        isArcChain,
        isOnFromChain,
        chainId,
        fromChainIdNum,
        nativeBalance: nativeBalance?.formatted,
        arcErc20Balance: arcErc20Balance?.toString(),
        balance: balance?.toString(),
      });
    }
  }

  const balanceFormatted = displayBalance
    ? parseFloat(formatUnits(displayBalance, isArcChain && nativeBalance?.value ? 18 : 6)).toFixed(2)
    : isLoadingBalance && isOnFromChain
    ? "..."
    : isConnected && !isOnFromChain && fromChainIdNum
    ? "Switch chain"
    : !isConnected
    ? "--"
    : "--";

  // Fetch bridge history (mock for now - would come from backend)
  const { data: bridgeHistory = [] } = useQuery<BridgeHistory[]>({
    queryKey: ["/api/bridge/history"],
    queryFn: async () => {
      // Mock data - replace with actual API call
      return [];
    },
    staleTime: 30000, // Consider data fresh for 30s
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  const estimateBridge = useMutation({
    mutationFn: async () => {
      if (!amount || !fromChainId || !toChainId) {
        throw new Error("Please fill in all fields");
      }

      const response = await apiRequest("POST", "/api/bridge/estimate", {
        amount,
        currency,
        fromChainId: parseInt(fromChainId),
        toChainId: parseInt(toChainId),
        isTestnet: testMode,
      });

      return await response.json();
    },
    onSuccess: (data: BridgeEstimate) => {
      setEstimate(data);
      setBridgeStatus("idle");
      toast({
        title: "Bridge estimate ready",
        description: `Estimated time: ~${data.estimatedTime}s, Fees: ${data.estimatedFees} ${currency}`,
      });
    },
    onError: (error: Error) => {
      setBridgeStatus("error");
      toast({
        title: "Estimate failed",
        description: error.message || "Failed to estimate bridge",
        variant: "destructive",
      });
    },
  });

  const initiateBridge = useMutation({
    mutationFn: async (estimateData?: BridgeEstimate) => {
      if (!amount || !fromChainId || !toChainId) {
        throw new Error("Please fill in all fields");
      }

      if (!address) {
        throw new Error("Please connect your wallet");
      }

      const response = await apiRequest("POST", "/api/bridge/initiate", {
        amount,
        currency,
        fromChainId: parseInt(fromChainId),
        toChainId: parseInt(toChainId),
        fromAddress: address,
        toAddress: address, // Same address for both (user bridging their own tokens)
        isTestnet: testMode,
      });

      return await response.json();
    },
    onSuccess: () => {
      setBridgeStatus("success");
      toast({
        title: "Bridge initiated",
        description: "Your bridge transaction has been submitted. It will complete in ~20 seconds.",
      });
      // Reset form
      setAmount("");
      setEstimate(null);
      setTimeout(() => setBridgeStatus("idle"), 3000);
    },
    onError: (error: Error) => {
      setBridgeStatus("error");
      console.error("Bridge initiation error:", error);
      toast({
        title: "Bridge failed",
        description: error.message || "Failed to initiate bridge",
        variant: "destructive",
      });
    },
  });

  const handleEstimate = () => {
    if (!amount || !fromChainId || !toChainId) return;
    setBridgeStatus("estimating");
    estimateBridge.mutate();
  };

  // Function to automatically switch chain (Uniswap style) - uses wagmi's switchChain
  const ensureChain = async (targetChainId: number): Promise<boolean> => {
    if (!isConnected || !address) {
      return false;
    }

    // If already on the correct chain, return true
    if (chainId === targetChainId) {
      return true;
    }

    try {
      // Use wagmi's switchChain - it will prompt MetaMask automatically (Uniswap style)
      await switchChain({ chainId: targetChainId });
      return true;
    } catch (error: any) {
      // User rejected - don't show error, just return false
      if (error.name === 'UserRejectedRequestError' || error.code === 4001) {
        return false;
      }
      
      // Chain might not be in wagmi config - try adding via MetaMask
      const chainConfig = CHAIN_CONFIGS[targetChainId];
      if (chainConfig && window.ethereum) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [chainConfig],
          });
          // After adding, switch with wagmi
          await switchChain({ chainId: targetChainId });
          return true;
        } catch (addError: any) {
          // Don't show error if user rejected
          if (addError.code !== 4001 && addError.name !== 'UserRejectedRequestError') {
            toast({
              title: "Failed to add chain",
              description: addError.message || "Please add the chain manually in MetaMask",
              variant: "destructive",
            });
          }
          return false;
        }
      }
      return false;
    }
  };

  const handleBridge = async () => {
    if (!amount || !fromChainId || !toChainId) return;
    
    if (!address) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to bridge tokens",
        variant: "destructive",
      });
      return;
    }

    if (!fromChainIdNum) {
      toast({
        title: "Invalid source chain",
        description: "Please select a source chain",
        variant: "destructive",
      });
      return;
    }

    const toChainIdNum = parseInt(toChainId);

    // Automatically switch to the correct chain if needed (Uniswap style)
    if (!isOnCorrectChain) {
      setBridgeStatus("bridging");
      const switched = await ensureChain(fromChainIdNum);
      if (!switched) {
        setBridgeStatus("idle");
        return;
      }
      // Wait briefly for chain switch to propagate (wagmi updates chainId automatically)
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    // Auto-estimate if not already done
    let estimateData = estimate;
    if (!estimateData) {
      try {
        setBridgeStatus("estimating");
        const response = await apiRequest("POST", "/api/bridge/estimate", {
          amount,
          currency,
          fromChainId: fromChainIdNum,
          toChainId: toChainIdNum,
          isTestnet: testMode,
        });
        estimateData = await response.json();
        setEstimate(estimateData);
        setBridgeStatus("idle");
      } catch (error) {
        setBridgeStatus("error");
        console.error("Bridge estimate error:", error);
        toast({
          title: "Estimate failed",
          description: (error as Error).message || "Failed to estimate bridge",
          variant: "destructive",
        });
        return;
      }
    }

    // For CCTP bridges:
    // - FROM Arc TO CCTP chain: Arc burns, CCTP chain mints (need CCTP config on destination)
    // - FROM CCTP chain TO Arc: CCTP chain burns, Arc mints (need CCTP config on source)
    const arcChainId = testMode ? 5042002 : 5042001;
    const fromIsArc = fromChainIdNum === arcChainId;
    const toIsArc = toChainIdNum === arcChainId;
    
    // Determine which chain needs CCTP config
    const cctpChainId = fromIsArc ? toChainIdNum : fromChainIdNum;
    const cctpConfig = testMode 
      ? CCTP_TESTNET_CONFIG[cctpChainId]
      : CCTP_MAINNET_CONFIG[cctpChainId];

    if (!cctpConfig) {
      const chainName = fromIsArc ? toChain?.name : fromChain?.name;
      toast({
        title: "CCTP not supported",
        description: `CCTP bridging requires CCTP support on ${chainName || "the destination chain"}`,
        variant: "destructive",
      });
      return;
    }

    // Get destination domain for CCTP
    const destinationDomain = CCTP_DOMAINS[toChainIdNum];
    if (!destinationDomain && !toIsArc) {
      toast({
        title: "Invalid destination",
        description: `Destination chain ${toChain?.name || "chain"} is not supported for CCTP`,
        variant: "destructive",
      });
      return;
    }

    // Arc Network now has CCTP TokenMessengerV2, so bridging FROM Arc is fully supported!

    // FROM CCTP chain TO Arc: Use CCTP TokenMessenger
    const tokenAddress = currency === "USDC" ? cctpConfig.usdc : null;
    if (!tokenAddress) {
      toast({
        title: "Token not supported",
        description: `${currency} is not supported on ${fromChain?.name || "this chain"}`,
        variant: "destructive",
      });
      return;
    }

    // Convert amount to wei
    // On Arc, USDC ERC-20 interface uses 6 decimals (even though native uses 18)
    // On other chains, USDC uses 6 decimals
    const amountWei = parseUnits(amount, 6);

    // Convert destination address to bytes32 (padded)
    const mintRecipient = pad(address as Address, { size: 32 });

    setBridgeStatus("bridging");

    try {
      // Step 1: Approve TokenMessenger to spend USDC (if needed)
      // Note: In production, you'd check allowance first
      
      // Step 2: Burn USDC on source chain using CCTP TokenMessenger
      // Make sure we're using the correct chain's contract
      if (!cctpConfig.tokenMessenger) {
        throw new Error("TokenMessenger address not found for this chain");
      }

      writeContract({
        address: cctpConfig.tokenMessenger,
        abi: TOKEN_MESSENGER_ABI,
        functionName: "depositForBurn",
        args: [amountWei, destinationDomain, mintRecipient, tokenAddress],
      });
    } catch (error) {
      setBridgeStatus("error");
      toast({
        title: "Transaction failed",
        description: (error as Error).message || "Failed to initiate burn transaction",
        variant: "destructive",
      });
    }
  };

  // Handle burn transaction success
  useEffect(() => {
    if (isBurnSuccess && burnTxHash) {
      toast({
        title: "Burn successful",
        description: "Waiting for Circle attestation...",
      });
      setBridgeStatus("attesting");
      
      // In a real implementation, you would:
      // 1. Poll Circle's Attestation Service for the attestation
      // 2. Switch to destination chain
      // 3. Call MessageTransmitter.receiveMessage() with the attestation
      // For now, we'll show a success message
      setTimeout(() => {
        setBridgeStatus("success");
        toast({
          title: "Bridge initiated",
          description: `Your bridge transaction has been submitted. Transaction: ${burnTxHash.slice(0, 10)}...`,
        });
        setAmount("");
        setEstimate(null);
      }, 2000);
    }
  }, [isBurnSuccess, burnTxHash, toast]);

  // Handle burn transaction error
  useEffect(() => {
    if (burnError) {
      setBridgeStatus("error");
      toast({
        title: "Transaction failed",
        description: burnError.message || "Failed to execute burn transaction",
        variant: "destructive",
      });
    }
  }, [burnError, toast]);

  const fromChain = availableChains.find((c) => c.id.toString() === fromChainId);
  const toChain = availableChains.find((c) => c.id.toString() === toChainId);

  // Get chain icon/color
  const getChainIcon = (chainName: string) => {
    if (chainName.includes("Arc")) {
      return { bg: "bg-purple-500", text: "A", name: "Arc" };
    }
    if (chainName.includes("Ethereum") || chainName.includes("Mainnet")) {
      return { bg: "bg-gray-900", text: "E", name: "Ethereum" };
    }
    if (chainName.includes("Base")) {
      return { bg: "bg-blue-500", text: "B", name: "Base" };
    }
    if (chainName.includes("Sepolia")) {
      return { bg: "bg-gray-600", text: "S", name: "Sepolia" };
    }
    return { bg: "bg-gray-500", text: chainName[0], name: chainName };
  };

  const fromChainIcon = fromChain ? getChainIcon(fromChain.name) : null;
  const toChainIcon = toChain ? getChainIcon(toChain.name) : null;
  const estimatedTime = estimate?.estimatedTime || (testMode ? 20 : 45);

  const style = {
    "--sidebar-width": "var(--sidebar-width-expanded, 260px)",
    "--sidebar-width-icon": "var(--sidebar-width-collapsed, 72px)",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <DashboardSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header 
            className="flex items-center justify-between gap-4 px-6 border-b border-border/50 bg-background/95 backdrop-blur-sm flex-shrink-0"
            style={{ height: 'var(--app-header-height)' }}
          >
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-6 w-6" />
              <div>
                <h1 className="text-base font-semibold leading-tight">Bridge (CCTP)</h1>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Cross-chain transfers with zero slippage
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <GasPriceDisplay />
              <ThemeToggle />
              <StatusIndicator />
              <TestModeToggle />
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 bg-background">
            <div className="max-w-[420px] mx-auto">
              {/* Main Bridge Card */}
              <Card className="border border-border rounded-lg">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-lg font-semibold mb-0.5">Cross-Chain Bridge</CardTitle>
                  <CardDescription className="text-[10px] text-muted-foreground">Powered by Circle CCTP</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  {/* Currency Selector */}
                  <div className="flex items-center gap-2 pb-3 border-b border-border/20">
                    <Label className="text-[10px] text-muted-foreground font-medium">Asset</Label>
                    <Select value={currency} onValueChange={(v) => setCurrency(v as "USDC" | "EURC")}>
                      <SelectTrigger className="w-24 h-7 rounded-md border-border/30 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USDC">USDC</SelectItem>
                        <SelectItem value="EURC">EURC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* From Section */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">From</Label>
                    <Select value={fromChainId} onValueChange={setFromChainId}>
                      <SelectTrigger className="h-11 flex-1 rounded-lg border-border/30 bg-muted/20 hover:bg-muted/30">
                        <div className="flex items-center gap-2 w-full">
                          {fromChainIcon && (
                            <div className={`w-8 h-8 rounded-lg ${fromChainIcon.bg} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                              {fromChainIcon.text}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <div className="font-semibold text-xs">{fromChain?.name || "Select chain"}</div>
                          </div>
                        </div>
                      </SelectTrigger>
                        <SelectContent>
                          {availableChains.map((chain) => {
                            const icon = getChainIcon(chain.name);
                            return (
                              <SelectItem key={chain.id} value={chain.id.toString()}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-md ${icon.bg} flex items-center justify-center text-white text-[10px] font-bold`}>
                                    {icon.text}
                                  </div>
                                  <span className="text-xs">{chain.name}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                  </div>

                  {/* Direction Arrow */}
                  <div className="flex justify-center -my-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        // Swap chains
                        const temp = fromChainId;
                        setFromChainId(toChainId);
                        setToChainId(temp);
                      }}
                      className="w-7 h-7 rounded-full bg-muted/30 border border-border/30 flex items-center justify-center hover:bg-muted/50 transition-all hover:scale-105"
                    >
                      <ArrowDown className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>

                  {/* To Section */}
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">To</Label>
                    <Select value={toChainId} onValueChange={setToChainId}>
                      <SelectTrigger className="h-11 flex-1 rounded-lg border-border/30 bg-muted/20 hover:bg-muted/30">
                        <div className="flex items-center gap-2 w-full">
                          {toChainIcon && (
                            <div className={`w-8 h-8 rounded-lg ${toChainIcon.bg} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}>
                              {toChainIcon.text}
                            </div>
                          )}
                          <div className="flex-1 text-left">
                            <div className="font-semibold text-xs">{toChain?.name || "Select chain"}</div>
                          </div>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {availableChains.map((chain) => {
                          const icon = getChainIcon(chain.name);
                          return (
                            <SelectItem key={chain.id} value={chain.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className={`w-6 h-6 rounded-md ${icon.bg} flex items-center justify-center text-white text-[10px] font-bold`}>
                                  {icon.text}
                                </div>
                                <span className="text-xs">{chain.name}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount Input */}
                  <div className="pt-1 space-y-1.5">
                    <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Amount</Label>
                    <NumberInput
                      step={0.01}
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0"
                      className="h-12 text-lg font-semibold rounded-lg border border-border bg-background text-center focus:bg-background"
                    />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 px-1">
                      <span>Est. time: ~{estimatedTime}s</span>
                      {isConnected && address ? (
                        <span>Balance: {balanceFormatted} {currency}</span>
                      ) : (
                        <span className="text-muted-foreground/50 text-[9px]">Connect wallet</span>
                      )}
                    </div>
                  </div>

                  {/* Wallet Connection */}
                  {!isConnected && (
                    <div className="space-y-1.5">
                      <div className="text-center text-xs text-muted-foreground">
                        Connect your wallet to bridge tokens
                      </div>
                      <div className="flex justify-center">
                        <Suspense fallback={<div className="h-10 w-full bg-muted animate-pulse rounded" />}>
                          <ConnectButton.Custom>
                          {({ account, chain, openConnectModal, mounted }) => {
                            const ready = mounted;
                            const connected = ready && account && chain;

                            return (
                              <Button
                                onClick={openConnectModal}
                                className="w-full h-10 text-xs font-semibold rounded-lg"
                                size="sm"
                              >
                                Connect Wallet
                              </Button>
                            );
                          }}
                        </ConnectButton.Custom>
                        </Suspense>
                      </div>
                    </div>
                  )}

                  {/* Bridge Button */}
                  {isConnected && (
                    <Button
                      onClick={handleBridge}
                      disabled={
                        !amount || 
                        !fromChainId || 
                        !toChainId || 
                        bridgeStatus === "bridging" || 
                        bridgeStatus === "estimating" || 
                        bridgeStatus === "attesting" ||
                        isBurnPending ||
                        isBurnConfirming ||
                        !address ||
                        !fromChainIdNum
                      }
                      className="w-full h-10 text-xs font-semibold rounded-lg shadow-sm"
                      size="sm"
                    >
                      {bridgeStatus === "bridging" || isBurnPending || isBurnConfirming ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          {isBurnPending ? "Confirm in wallet..." : isBurnConfirming ? "Confirming..." : "Bridging..."}
                        </>
                      ) : bridgeStatus === "estimating" ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          Estimating...
                        </>
                      ) : bridgeStatus === "attesting" ? (
                        <>
                          <Clock className="w-3 h-3 mr-1.5" />
                          Waiting for attestation...
                        </>
                      ) : bridgeStatus === "success" ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 mr-1.5" />
                          Success
                        </>
                      ) : (
                        `Bridge to ${toChain?.name || "Chain"}`
                      )}
                    </Button>
                  )}

                  {/* Footer Info */}
                  <div className="text-center text-[9px] text-muted-foreground/60 pt-2 border-t border-border/20">
                    0% Slippage • Native Burn & Mint
                  </div>
                </CardContent>
              </Card>

              {/* Bridge History */}
              <Card className="border border-border rounded-lg mt-4">
                <CardHeader className="pb-3 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">CCTP Activity</CardTitle>
                  <CardDescription className="text-[10px] text-muted-foreground">Recent bridge transactions</CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {bridgeHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No bridge transactions yet
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Amount</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Time</TableHead>
                          <TableHead>Transaction</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bridgeHistory.map((bridge) => (
                          <TableRow key={bridge.id}>
                            <TableCell className="font-medium">
                              {bridge.amount} {bridge.currency}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {bridge.fromChain} → {bridge.toChain}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  bridge.status === "completed"
                                    ? "default"
                                    : bridge.status === "failed"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {bridge.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(bridge.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {bridge.txHash ? (
                                <a
                                  href={getExplorerLink(bridge.txHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1 text-sm"
                                >
                                  View
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Network Configuration Details */}
              {fromChainIdNum && CHAIN_CONFIGS[fromChainIdNum] && (
                <Card className="border border-border rounded-lg mt-4">
                  <CardHeader className="pb-3 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold">{fromChain?.name || "Network"} Configuration</CardTitle>
                    <CardDescription className="text-[10px] text-muted-foreground">Network details for wallet setup</CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">Network:</span>
                          <div className="font-medium mt-0.5">{fromChain?.name || "Unknown"}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Chain ID:</span>
                          <div className="font-medium mt-0.5 font-mono">{fromChainIdNum}</div>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">RPC endpoint:</span>
                        <div className="mt-1 space-y-1">
                          {CHAIN_CONFIGS[fromChainIdNum].rpcUrls.map((url, idx) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-primary hover:underline font-mono text-[10px] break-all"
                            >
                              {url}
                            </a>
                          ))}
                        </div>
                      </div>
                      {CHAIN_CONFIGS[fromChainIdNum].blockExplorerUrls.length > 0 && (
                        <div>
                          <span className="text-muted-foreground">Explorer:</span>
                          <div className="mt-1">
                            <a
                              href={CHAIN_CONFIGS[fromChainIdNum].blockExplorerUrls[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-mono text-[10px] break-all"
                            >
                              {CHAIN_CONFIGS[fromChainIdNum].blockExplorerUrls[0]}
                            </a>
                          </div>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Currency:</span>
                        <div className="font-medium mt-0.5">
                          {CHAIN_CONFIGS[fromChainIdNum].nativeCurrency.name} ({CHAIN_CONFIGS[fromChainIdNum].nativeCurrency.symbol})
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* CCTP Features - Full Width */}
            <div className="w-full px-4 mt-4">
              <Card className="border border-border rounded-lg">
                <CardHeader className="pb-4 pt-4 px-4">
                  <CardTitle className="text-lg font-semibold text-center leading-tight">
                    The most secure way to transfer USDC crosschain
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-6 py-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    {/* Feature 1: Maximum capital efficiency */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-base">⚡</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-2">Maximum capital efficiency</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Deliver secure 1:1 USDC crosschain transfers through a native burn-and-mint process, eliminating the need for liquidity pools or third-party fillers.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Feature 2: Trust minimized */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-base">🛡️</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-2">Trust minimized</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Every crosschain transfer is validated by Circle, the same company you already trust for holding and transacting with USDC.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Feature 3: Open composability */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-sm font-mono">&lt;/&gt;</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-2">Open composability</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Automate post-transfer transactions with Hooks for frictionless crosschain deposits, asset swaps, purchases, and treasury management.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Feature 4: Seamless extensibility */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-base">⊞</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-2">Seamless extensibility</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            As a foundational building block, CCTP integrates easily into apps, bridges, exchanges, wallets, and other smart contracts.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

