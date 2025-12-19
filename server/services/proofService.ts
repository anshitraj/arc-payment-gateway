/**
 * Proof Service
 * Handles invoice payment proof generation and recording
 */

import { createHash } from "crypto";
import { storage } from "../storage.js";
import type { Payment } from "../../shared/schema.js";

/**
 * Generate invoice hash: keccak256(invoiceId + merchant + amount)
 * For payments, we use paymentId as invoiceId
 */
export function generateInvoiceHash(
  invoiceId: string,
  merchantAddress: string,
  amount: string
): string {
  const data = `${invoiceId}${merchantAddress}${amount}`;
  const hash = createHash("sha256").update(data).digest("hex");
  return `0x${hash}`;
}

/**
 * Get payment proof status
 */
export async function getPaymentProofStatus(paymentId: string) {
  const proof = await storage.getPaymentProof(paymentId);
  
  if (proof && proof.proofTxHash) {
    return {
      exists: true,
      invoiceHash: proof.invoiceHash,
      proofTxHash: proof.proofTxHash,
      createdAt: proof.createdAt,
    };
  }

  return {
    exists: false,
  };
}

/**
 * Check if payment is eligible for proof recording
 * Must be CONFIRMED
 */
export function isPaymentEligibleForProof(payment: Payment): boolean {
  return payment.status === "confirmed" && !!payment.txHash;
}
