/**
 * ARC Testnet Transaction Service
 * Handles ARC chain interactions: RPC calls, transaction verification, explorer links
 */

const ARC_CHAIN_ID = parseInt(process.env.ARC_CHAIN_ID || "1243", 10); // ARC Testnet default
const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc-testnet.arc.network";
const ARC_EXPLORER_URL = process.env.ARC_EXPLORER_URL || "https://testnet-explorer.arc.network/tx";

export interface TransactionStatus {
  confirmed: boolean;
  failed: boolean;
  blockNumber?: number;
  blockHash?: string;
  error?: string;
}

/**
 * Get ARC chain configuration
 */
export function getArcChainConfig() {
  return {
    chainId: ARC_CHAIN_ID,
    rpcUrl: ARC_RPC_URL,
    explorerUrl: ARC_EXPLORER_URL,
  };
}

/**
 * Verify a transaction on ARC testnet by txHash
 * Returns transaction status and confirmation details
 */
export async function verifyTransaction(txHash: string): Promise<TransactionStatus> {
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 1,
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        confirmed: false,
        failed: true,
        error: data.error.message || "Transaction not found",
      };
    }

    if (!data.result) {
      // Transaction not yet mined
      return {
        confirmed: false,
        failed: false,
      };
    }

    const receipt = data.result;
    const status = receipt.status === "0x1" || receipt.status === "0x";

    return {
      confirmed: status,
      failed: !status,
      blockNumber: parseInt(receipt.blockNumber, 16),
      blockHash: receipt.blockHash,
      error: status ? undefined : "Transaction reverted",
    };
  } catch (error) {
    console.error("Error verifying transaction:", error);
    return {
      confirmed: false,
      failed: true,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get transaction details (nonce, gas, etc.)
 */
export async function getTransactionDetails(txHash: string) {
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionByHash",
        params: [txHash],
        id: 1,
      }),
    });

    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error("Error getting transaction details:", error);
    return null;
  }
}

/**
 * Get block timestamp from block number
 */
export async function getBlockTimestamp(blockNumber: number): Promise<Date | null> {
  try {
    const response = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getBlockByNumber",
        params: [`0x${blockNumber.toString(16)}`, false],
        id: 1,
      }),
    });

    const data = await response.json();
    if (data.result && data.result.timestamp) {
      const timestamp = parseInt(data.result.timestamp, 16);
      return new Date(timestamp * 1000);
    }
    return null;
  } catch (error) {
    console.error("Error getting block timestamp:", error);
    return null;
  }
}

/**
 * Generate explorer link for a transaction
 */
export function getExplorerLink(txHash: string): string {
  return `${ARC_EXPLORER_URL}/${txHash}`;
}

/**
 * Validate wallet address format (ARC uses same format as Ethereum)
 */
export function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Format amount for ARC chain (convert to wei/smallest unit)
 * For USDC, typically 6 decimals
 */
export function formatAmount(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  const multiplier = Math.pow(10, decimals);
  return Math.floor(num * multiplier).toString();
}

