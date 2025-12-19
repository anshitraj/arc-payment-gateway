/**
 * Contract Service
 * Handles on-chain contract interactions for InvoicePaymentProof
 * 
 * NOTE: This service requires:
 * - INVOICE_PAYMENT_PROOF_ADDRESS environment variable
 * - PRIVATE_KEY environment variable (contract owner)
 * - Proper contract deployment
 */

import { createWalletClient, http, encodeFunctionData, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { INVOICE_PAYMENT_PROOF_ADDRESS, INVOICE_PAYMENT_PROOF_ABI, ARC_RPC_URL, ARC_CHAIN_ID } from "../config.js";
import type { Payment } from "../../shared/schema.js";

/**
 * Record payment proof on-chain via InvoicePaymentProof contract
 * This requires the contract owner's private key
 */
export async function recordPaymentProofOnChain(payment: Payment): Promise<string | null> {
  // Check if contract is configured
  if (!INVOICE_PAYMENT_PROOF_ADDRESS || !INVOICE_PAYMENT_PROOF_ABI || INVOICE_PAYMENT_PROOF_ABI.length === 0) {
    console.warn("InvoicePaymentProof contract not configured, skipping on-chain proof recording");
    return null;
  }

  // Check if private key is configured
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    console.warn("PRIVATE_KEY not configured, cannot record payment proof on-chain");
    return null;
  }

  // Validate payment data
  if (!payment.txHash || !payment.merchantWallet || !payment.payerWallet) {
    console.warn("Payment missing required data for on-chain proof recording");
    return null;
  }

  try {
    // Convert amount to wei (USDC uses 6 decimals)
    const amountInUnits = parseUnits(parseFloat(payment.amount).toFixed(6), 6);

    // Convert txHash to bytes32 (remove 0x prefix, pad to 64 chars, add 0x back)
    const txHashBytes = payment.txHash.startsWith("0x") 
      ? payment.txHash.slice(2) 
      : payment.txHash;
    
    // Pad to 32 bytes (64 hex chars) and ensure it's exactly 64 chars
    const txHashBytes32 = ("0x" + txHashBytes.padStart(64, "0").slice(0, 64)) as `0x${string}`;

    // Ensure addresses are valid
    const merchantAddress = payment.merchantWallet as `0x${string}`;
    const payerAddress = payment.payerWallet as `0x${string}`;
    const contractAddress = INVOICE_PAYMENT_PROOF_ADDRESS as `0x${string}`;

    // Create wallet client from private key
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const client = createWalletClient({
      account,
      chain: {
        id: ARC_CHAIN_ID,
        name: "ARC Testnet",
        nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
        rpcUrls: {
          default: { http: [ARC_RPC_URL] },
        },
      },
      transport: http(ARC_RPC_URL),
    });

    // Encode function call
    const data = encodeFunctionData({
      abi: INVOICE_PAYMENT_PROOF_ABI as any,
      functionName: "recordProof",
      args: [
        payment.id,
        merchantAddress,
        payerAddress,
        amountInUnits,
        payment.currency || "USDC",
        txHashBytes32,
      ],
    });

    // Send transaction
    const hash = await client.sendTransaction({
      to: contractAddress,
      data,
    });

    console.log("Payment proof recorded on-chain:", {
      contract: INVOICE_PAYMENT_PROOF_ADDRESS,
      paymentId: payment.id,
      txHash: hash,
    });

    return hash;
  } catch (error) {
    console.error("Error recording payment proof on-chain:", error);
    return null;
  }
}

/**
 * Check if contract service is properly configured
 */
export function isContractServiceConfigured(): boolean {
  return !!(
    INVOICE_PAYMENT_PROOF_ADDRESS &&
    INVOICE_PAYMENT_PROOF_ABI &&
    INVOICE_PAYMENT_PROOF_ABI.length > 0 &&
    process.env.PRIVATE_KEY
  );
}

