/**
 * Application Configuration
 */

// Production mode - set DEMO_MODE=false in .env for production
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const ARC_CHAIN_ID = parseInt(process.env.ARC_CHAIN_ID || "1243", 10);
export const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc-testnet.arc.network";
export const ARC_EXPLORER_URL = process.env.ARC_EXPLORER_URL || "https://testnet-explorer.arc.network/tx";

// PaymentRegistry Contract Configuration
export const PAYMENT_REGISTRY_ADDRESS = process.env.PAYMENT_REGISTRY_ADDRESS || "";

// Load ABI from file or env
let PAYMENT_REGISTRY_ABI: any[] = [];
if (process.env.PAYMENT_REGISTRY_ABI) {
  try {
    PAYMENT_REGISTRY_ABI = JSON.parse(process.env.PAYMENT_REGISTRY_ABI);
  } catch (e) {
    console.warn("Failed to parse PAYMENT_REGISTRY_ABI from env");
  }
} else {
  // Will be loaded dynamically when needed
  PAYMENT_REGISTRY_ABI = [];
}

export { PAYMENT_REGISTRY_ABI };

// USDC Token Configuration (ARC Testnet)
// Default USDC address - should be set in .env for production
export const USDC_TOKEN_ADDRESS = process.env.USDC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000";
export const USDC_DECIMALS = 6; // USDC uses 6 decimals

export const API_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
export const API_RATE_LIMIT_MAX_REQUESTS = 100; // per window

