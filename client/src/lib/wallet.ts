import { EthereumProvider } from "@walletconnect/ethereum-provider";

// Provider types
type InjectedProvider = {
  request: (args: { method: string; params?: any[] }) => Promise<any>;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
};

// TypeScript declaration for window.ethereum
declare global {
  interface Window {
    ethereum?: InjectedProvider;
  }
}

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Initialize providers
let walletConnectProvider: EthereumProvider | null = null;
let injectedProvider: InjectedProvider | null = null;
let isWalletConnectInitialized = false;
let currentProvider: "injected" | "walletconnect" | null = null;

/**
 * Check if injected wallet (MetaMask, etc.) is available
 */
export function hasInjectedWallet(): boolean {
  if (typeof window === "undefined") return false;
  return typeof window.ethereum !== "undefined";
}

/**
 * Get injected wallet name
 */
export function getInjectedWalletName(): string | null {
  if (!hasInjectedWallet()) return null;
  
  const ethereum = window.ethereum as InjectedProvider & { isMetaMask?: boolean; isCoinbaseWallet?: boolean; isBraveWallet?: boolean };
  
  if (ethereum.isMetaMask) return "MetaMask";
  if (ethereum.isCoinbaseWallet) return "Coinbase Wallet";
  if (ethereum.isBraveWallet) return "Brave Wallet";
  return "Browser Wallet";
}

/**
 * Connect to injected wallet (MetaMask, etc.)
 */
export async function connectInjectedWallet(): Promise<string> {
  if (!hasInjectedWallet()) {
    throw new Error("No injected wallet found. Please install MetaMask or another wallet extension.");
  }

  const ethereum = window.ethereum as InjectedProvider;
  const arcChainId = parseInt(import.meta.env.VITE_ARC_CHAIN_ID || "1243", 10);

  try {
    // Request account access
    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found");
    }

    // Try to switch to ARC Testnet
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${arcChainId.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain doesn't exist, try to add it
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: `0x${arcChainId.toString(16)}`,
                chainName: "ARC Testnet",
                nativeCurrency: {
                  name: "ETH",
                  symbol: "ETH",
                  decimals: 18,
                },
                rpcUrls: [import.meta.env.VITE_ARC_RPC_URL || "https://rpc-testnet.arc.network"],
                blockExplorerUrls: [import.meta.env.VITE_ARC_EXPLORER_URL || "https://testnet-explorer.arc.network"],
              },
            ],
          });
        } catch (addError) {
          console.warn("Could not add ARC Testnet:", addError);
        }
      }
    }

    injectedProvider = ethereum;
    currentProvider = "injected";
    return accounts[0];
  } catch (error) {
    console.error("Failed to connect injected wallet:", error);
    throw error;
  }
}

/**
 * Initialize WalletConnect
 */
export async function initWalletConnect() {
  if (!projectId) {
    throw new Error("WalletConnect Project ID is not configured. Set VITE_WALLETCONNECT_PROJECT_ID in client/.env");
  }

  if (walletConnectProvider && isWalletConnectInitialized) {
    return walletConnectProvider;
  }

  try {
    // ARC Testnet chain ID: 1243 (configurable via env)
    const arcChainId = parseInt(import.meta.env.VITE_ARC_CHAIN_ID || "1243", 10);
    
    walletConnectProvider = await EthereumProvider.init({
      projectId,
      chains: [arcChainId], // ARC Testnet
      showQrModal: true, // This enables the QR modal automatically
    });

    isWalletConnectInitialized = true;
    return walletConnectProvider;
  } catch (error) {
    console.error("Failed to initialize WalletConnect:", error);
    throw error;
  }
}

/**
 * Connect via WalletConnect (QR code)
 */
export async function connectWalletConnect(): Promise<string> {
  const provider = await initWalletConnect();
  if (!provider) {
    throw new Error("WalletConnect not initialized");
  }

  try {
    await provider.connect();
    currentProvider = "walletconnect";
    
    const accounts = await provider.request({ method: "eth_accounts" });
    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found");
    }
    
    return accounts[0];
  } catch (error) {
    console.error("Failed to connect wallet:", error);
    throw error;
  }
}

/**
 * Generic connect function (tries injected first, then WalletConnect)
 */
export async function connectWallet(): Promise<string> {
  if (hasInjectedWallet()) {
    try {
      return await connectInjectedWallet();
    } catch (error) {
      console.warn("Injected wallet connection failed, trying WalletConnect:", error);
    }
  }
  
  return await connectWalletConnect();
}

/**
 * Disconnect wallet
 */
export async function disconnectWallet() {
  if (currentProvider === "walletconnect" && walletConnectProvider) {
    await walletConnectProvider.disconnect();
    walletConnectProvider = null;
    isWalletConnectInitialized = false;
  }
  
  injectedProvider = null;
  currentProvider = null;
}

/**
 * Get current provider
 */
export function getProvider(): InjectedProvider | EthereumProvider | null {
  if (currentProvider === "injected") return injectedProvider;
  if (currentProvider === "walletconnect") return walletConnectProvider;
  return null;
}

/**
 * Check if wallet is connected
 */
export function isConnected(): boolean {
  if (currentProvider === "injected" && injectedProvider) {
    return true; // Injected wallets are always "connected" if provider exists
  }
  if (currentProvider === "walletconnect" && walletConnectProvider) {
    return walletConnectProvider.connected ?? false;
  }
  return false;
}

/**
 * Get connected account address
 */
export async function getAccount(): Promise<string | null> {
  if (!isConnected()) {
    return null;
  }

  try {
    if (currentProvider === "injected" && injectedProvider) {
      const accounts = await injectedProvider.request({ method: "eth_accounts" });
      return accounts?.[0] ?? null;
    }
    
    if (currentProvider === "walletconnect" && walletConnectProvider) {
      const accounts = await walletConnectProvider.request({ method: "eth_accounts" });
      return accounts?.[0] ?? null;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to get account:", error);
    return null;
  }
}

