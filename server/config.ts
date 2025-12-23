/**
 * Application Configuration
 */

import fs from "fs";
import path from "path";

// Derive paths from the working directory so the bundled CJS build does not
// rely on import.meta.url (which becomes undefined after esbuild converts
// modules to CommonJS).
const projectRoot = process.cwd();

// Production mode - set DEMO_MODE=false in .env for production
export const DEMO_MODE = process.env.DEMO_MODE === "true";

export const ARC_CHAIN_ID = parseInt(process.env.ARC_CHAIN_ID || "5042002", 10);
export const ARC_RPC_URL = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
export const ARC_EXPLORER_URL = process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.app";

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

// Merchant Badge Contract Configuration
export const MERCHANT_BADGE_ADDRESS = process.env.MERCHANT_BADGE_ADDRESS || "";

let MERCHANT_BADGE_ABI: any[] = [];
if (process.env.MERCHANT_BADGE_ABI) {
  try {
    MERCHANT_BADGE_ABI = JSON.parse(process.env.MERCHANT_BADGE_ABI);
  } catch (e) {
    console.warn("Failed to parse MERCHANT_BADGE_ABI from env");
  }
} else {
  // Try to load from file (synchronous for config)
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(projectRoot, "contracts", "MerchantBadge.abi.json"),
      path.resolve("contracts", "MerchantBadge.abi.json"),
    ];
    
    for (const abiPath of possiblePaths) {
      if (fs.existsSync(abiPath)) {
        MERCHANT_BADGE_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
        break;
      }
    }
  } catch (e) {
    // Silently fail - ABI will remain empty array
    // Only log if it's not a file not found error
    if ((e as any).code !== "ENOENT") {
      console.warn("Failed to load MERCHANT_BADGE_ABI from file:", (e as any).message);
    }
  }
}

export { MERCHANT_BADGE_ABI };

// Invoice Payment Proof Contract Configuration
export const INVOICE_PAYMENT_PROOF_ADDRESS = process.env.INVOICE_PAYMENT_PROOF_ADDRESS || "";

let INVOICE_PAYMENT_PROOF_ABI: any[] = [];
if (process.env.INVOICE_PAYMENT_PROOF_ABI) {
  try {
    INVOICE_PAYMENT_PROOF_ABI = JSON.parse(process.env.INVOICE_PAYMENT_PROOF_ABI);
  } catch (e) {
    console.warn("Failed to parse INVOICE_PAYMENT_PROOF_ABI from env");
  }
} else {
  // Try to load from file (synchronous for config)
  try {
    // Try multiple possible paths
    const possiblePaths = [
      path.join(projectRoot, "contracts", "InvoicePaymentProof.abi.json"),
      path.resolve("contracts", "InvoicePaymentProof.abi.json"),
    ];
    
    for (const abiPath of possiblePaths) {
      if (fs.existsSync(abiPath)) {
        INVOICE_PAYMENT_PROOF_ABI = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
        break;
      }
    }
  } catch (e) {
    // Silently fail - ABI will remain empty array
    // Only log if it's not a file not found error
    if ((e as any).code !== "ENOENT") {
      console.warn("Failed to load INVOICE_PAYMENT_PROOF_ABI from file:", (e as any).message);
    }
  }
}

export { INVOICE_PAYMENT_PROOF_ABI };

// USDC Token Configuration (ARC Testnet)
// Official ARC Testnet USDC address (native currency, used for gas fees)
export const USDC_TOKEN_ADDRESS = process.env.USDC_TOKEN_ADDRESS || "0x3600000000000000000000000000000000000000";
export const USDC_DECIMALS = 6; // USDC uses 6 decimals on ARC

export const API_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
export const API_RATE_LIMIT_MAX_REQUESTS = 100; // per window

// Phase 3 Feature Flags
export const FEATURE_FLAGS = {
  subscriptionsEnabled: process.env.SUBSCRIPTIONS_ENABLED !== "false", // Default: enabled
  payoutsEnabled: process.env.PAYOUTS_ENABLED !== "false", // Default: enabled
  supabaseIntegrationEnabled: process.env.SUPABASE_INTEGRATION_ENABLED !== "false", // Default: enabled
  neonIntegrationEnabled: process.env.NEON_INTEGRATION_ENABLED !== "false", // Default: enabled
  feesAndSplitsEnabled: process.env.FEES_AND_SPLITS_ENABLED !== "false", // Default: enabled
};

