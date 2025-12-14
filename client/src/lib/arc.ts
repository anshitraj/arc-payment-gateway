/**
 * ARC Testnet Utilities
 */

const ARC_EXPLORER_URL = import.meta.env.VITE_ARC_EXPLORER_URL || "https://testnet-explorer.arc.network/tx";
const ARC_CHAIN_ID = parseInt(import.meta.env.VITE_ARC_CHAIN_ID || "1243", 10);

export function getExplorerLink(txHash: string): string {
  return `${ARC_EXPLORER_URL}/${txHash}`;
}

export function getArcChainId(): number {
  return ARC_CHAIN_ID;
}

export function getArcNetworkName(): string {
  return "ARC Testnet";
}

export function getUsdcTokenAddress(): `0x${string}` {
  return (import.meta.env.VITE_USDC_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
}

