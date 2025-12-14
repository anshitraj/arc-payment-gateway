// Demo mode configuration
// Set to true to use mock data and disable real wallet transactions
// PRODUCTION: Set to false for real transactions
export const DEMO_MODE = false;

export const DEMO_PAYMENTS = [
  {
    id: "demo-1",
    amount: "10",
    currency: "USDC",
    status: "demo",
    wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    createdAt: new Date().toISOString(),
    isDemo: true,
  },
  {
    id: "demo-2",
    amount: "25.5",
    currency: "USDC",
    status: "demo",
    wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    txHash: "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    isDemo: true,
  },
];

// Generate a mock transaction hash
export function generateMockTxHash(): string {
  return "0x" + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

