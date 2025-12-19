/**
 * Payment Service
 * Handles payment lifecycle: create, confirm, fail, expire
 */

import { db } from "../db.js";
import { payments } from "../../shared/schema.js";
import { eq, and, lt, isNotNull, or } from "drizzle-orm";
import { dispatchWebhook } from "./webhookService.js";
import { verifyTransaction, getExplorerLink, getBlockTimestamp } from "./arcService.js";
import { recordPaymentProofOnChain } from "./contractService.js";
import { DEMO_MODE } from "../config.js";

export interface CreatePaymentRequest {
  merchantId: string;
  amount: string;
  currency: string; // Payment asset (what user pays with)
  settlementCurrency: string; // Settlement currency (USDC or EURC on Arc)
  paymentAsset?: string; // Specific asset identifier (e.g., "USDC_ARC", "USDC_BASE", "ETH_BASE")
  paymentChainId?: number; // Chain ID where payment is made
  conversionPath?: string; // JSON string describing conversion path
  estimatedFees?: string; // Estimated network/gas fees
  description?: string;
  customerEmail?: string;
  merchantWallet: string;
  expiresInMinutes?: number;
  isTest?: boolean;
  gasSponsored?: boolean; // Gas sponsorship preference
}

/**
 * Create a new payment
 */
export async function createPayment(request: CreatePaymentRequest) {
  const expiresAt = request.expiresInMinutes
    ? new Date(Date.now() + request.expiresInMinutes * 60 * 1000)
    : new Date(Date.now() + 30 * 60 * 1000); // Default 30 minutes

  // Store gas sponsorship in metadata
  let metadata = null;
  if (request.gasSponsored !== undefined) {
    metadata = JSON.stringify({ gasSponsored: request.gasSponsored });
  }

  const [payment] = await db
    .insert(payments)
    .values({
      merchantId: request.merchantId,
      amount: request.amount,
      currency: request.currency || "USDC",
      settlementCurrency: request.settlementCurrency || "USDC",
      paymentAsset: request.paymentAsset,
      paymentChainId: request.paymentChainId,
      conversionPath: request.conversionPath,
      estimatedFees: request.estimatedFees,
      status: "created",
      description: request.description,
      customerEmail: request.customerEmail,
      merchantWallet: request.merchantWallet,
      isDemo: false, // Real payments only - no demo mode
      isTest: request.isTest !== undefined ? request.isTest : true, // Default to test mode only if not provided
      expiresAt,
      metadata,
    })
    .returning();

  // Dispatch webhook (non-blocking)
  dispatchWebhook(request.merchantId, "payment.created", {
    type: "payment.created",
    data: {
      id: payment.id,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      merchantWallet: payment.merchantWallet,
      expiresAt: payment.expiresAt,
    },
  }).catch(console.error);

  return payment;
}

/**
 * Confirm a payment (called when transaction is verified)
 */
export async function confirmPayment(paymentId: string, txHash: string, payerWallet: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status !== "pending" && payment.status !== "created") {
    throw new Error(`Cannot confirm payment with status: ${payment.status}`);
  }

  const settlementTime = payment.createdAt
    ? Math.floor((Date.now() - new Date(payment.createdAt).getTime()) / 1000)
    : 0;

  // Get block timestamp from transaction receipt if available
  const txStatus = await verifyTransaction(txHash);
  let blockTimestamp = new Date();
  if (txStatus.blockNumber) {
    const timestamp = await getBlockTimestamp(txStatus.blockNumber);
    if (timestamp) {
      blockTimestamp = timestamp;
    }
  }

  await db
    .update(payments)
    .set({
      status: "confirmed",
      txHash,
      payerWallet,
      settlementTime,
      updatedAt: blockTimestamp,
    })
    .where(eq(payments.id, paymentId));

  const [updatedPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  // Update treasury balance when payment is confirmed
  if (updatedPayment) {
    try {
      const { storage } = await import("../storage.js");
      const treasuryBalance = await storage.getTreasuryBalance(
        updatedPayment.merchantId,
        updatedPayment.currency
      );

      if (treasuryBalance) {
        const newBalance = (
          parseFloat(treasuryBalance.balance) + parseFloat(updatedPayment.amount)
        ).toString();
        await storage.updateTreasuryBalance(treasuryBalance.id, {
          balance: newBalance,
        });
      } else {
        // Create treasury balance if it doesn't exist
        await storage.createTreasuryBalance({
          merchantId: updatedPayment.merchantId,
          currency: updatedPayment.currency,
          balance: updatedPayment.amount,
        });
      }
    } catch (error) {
      console.error("Failed to update treasury balance:", error);
      // Don't throw - balance update should not block payment confirmation
    }

    // Auto-create invoice from payment if customerEmail is provided
    if (updatedPayment.customerEmail) {
      try {
        const { storage } = await import("../storage.js");
        // Check if invoice already exists for this payment
        const existingInvoices = await storage.getInvoices(updatedPayment.merchantId);
        const existingInvoice = existingInvoices.find(inv => inv.paymentId === updatedPayment.id);
        
        if (!existingInvoice) {
          // Generate invoice number
          const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${updatedPayment.id.slice(0, 8).toUpperCase()}`;
          
          // Create invoice from payment
          await storage.createInvoice({
            merchantId: updatedPayment.merchantId,
            paymentId: updatedPayment.id,
            invoiceNumber,
            amount: updatedPayment.amount,
            currency: updatedPayment.currency,
            customerEmail: updatedPayment.customerEmail,
            customerName: null, // Can be extracted from metadata if available
            description: updatedPayment.description || `Payment for ${updatedPayment.amount} ${updatedPayment.currency}`,
            status: "paid", // Mark as paid since payment is confirmed
          });
        }
      } catch (error) {
        console.error("Failed to auto-create invoice from payment:", error);
        // Don't throw - invoice creation should not block payment confirmation
      }
    }
  }

  // Dispatch webhook
  if (updatedPayment) {
    const webhookPayload = {
      type: "payment.succeeded",
      data: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: "confirmed",
        txHash,
        payerWallet,
        explorerLink: getExplorerLink(txHash),
        settlementTime,
      },
    };

    // Dispatch both payment.succeeded (primary) and payment.confirmed (for backward compatibility)
    await Promise.all([
      dispatchWebhook(payment.merchantId, "payment.succeeded", webhookPayload),
      dispatchWebhook(payment.merchantId, "payment.confirmed", {
        ...webhookPayload,
        type: "payment.confirmed",
      }),
    ]);

    // Record payment proof on-chain (non-blocking)
    recordPaymentProofOnChain(updatedPayment).catch((error) => {
      console.error("Failed to record payment proof on-chain:", error);
      // Don't throw - proof recording should not block payment confirmation
    });
  }

  return updatedPayment;
}

/**
 * Mark payment as failed
 */
export async function failPayment(paymentId: string, reason?: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  if (!payment) {
    throw new Error("Payment not found");
  }

  await db
    .update(payments)
    .set({
      status: "failed",
      updatedAt: new Date(),
      metadata: reason ? JSON.stringify({ failureReason: reason }) : payment.metadata,
    })
    .where(eq(payments.id, paymentId));

  const [updatedPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  // Dispatch webhook
  if (updatedPayment) {
    await dispatchWebhook(payment.merchantId, "payment.failed", {
      type: "payment.failed",
      data: {
        id: updatedPayment.id,
        amount: updatedPayment.amount,
        currency: updatedPayment.currency,
        status: "failed",
        reason,
      },
    });
  }

  return updatedPayment;
}

/**
 * Expire a payment
 */
export async function expirePayment(paymentId: string) {
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status === "confirmed" || payment.status === "refunded") {
    return payment; // Already final, don't expire
  }

  await db
    .update(payments)
    .set({
      status: "expired",
      updatedAt: new Date(),
    })
    .where(eq(payments.id, paymentId));

  const [updatedPayment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId));

  return updatedPayment;
}

/**
 * Check if an error is a database connection error
 */
function isConnectionError(error: any): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";
  
  return (
    message.includes("connection terminated") ||
    message.includes("connection closed") ||
    message.includes("connection refused") ||
    message.includes("connection reset") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("etimedout") ||
    code === "econnreset" ||
    code === "econnrefused" ||
    code === "etimedout" ||
    code === "57p01" || // PostgreSQL: terminating connection due to administrator command
    code === "57p02" || // PostgreSQL: terminating connection due to crash
    code === "57p03" || // PostgreSQL: terminating connection due to idle timeout
    code === "08003" || // PostgreSQL: connection does not exist
    code === "08006"    // PostgreSQL: connection failure
  );
}

/**
 * Retry a database operation with exponential backoff
 */
async function retryDbOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (!isConnectionError(error) || attempt === maxRetries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`Database connection error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Background service: Check pending payments and verify transactions
 */
export async function checkPendingPayments() {
  try {
    // Get all pending payments with txHash (skip demo payments)
    const allPendingPayments = await retryDbOperation(() =>
      db
        .select()
        .from(payments)
        .where(eq(payments.status, "pending"))
    );

    const pendingPayments = allPendingPayments.filter((p) => p.txHash && !p.isDemo);

    const paymentsToCheck = pendingPayments;

    for (const payment of paymentsToCheck) {
      if (!payment.txHash) continue;

      try {
        const txStatus = await verifyTransaction(payment.txHash);

        if (txStatus.confirmed) {
          await confirmPayment(
            payment.id,
            payment.txHash,
            payment.payerWallet || ""
          );
        } else if (txStatus.failed) {
          await failPayment(payment.id, txStatus.error);
        }
        // If still pending, leave it for next check
      } catch (error) {
        console.error(`Error checking payment ${payment.id}:`, error);
      }
    }

    // Check for expired payments
    const now = new Date();
    const allPayments = await retryDbOperation(() =>
      db.select().from(payments)
    );
    const expiredPayments = allPayments.filter(
      (p) =>
        p.expiresAt &&
        new Date(p.expiresAt) < now &&
        (p.status === "created" || p.status === "pending")
    );

    for (const payment of expiredPayments) {
      if (
        payment.status === "created" ||
        payment.status === "pending"
      ) {
        await expirePayment(payment.id);
      }
    }
  } catch (error) {
    // Only log if it's not a connection error (connection errors are expected and will retry)
    if (!isConnectionError(error)) {
      console.error("Error in payment checker:", error);
    } else {
      console.warn("Database connection error in payment checker, will retry on next interval");
    }
  }
}

/**
 * Start background payment checker (runs every 10 seconds)
 * NOTE: This is now handled by txWatcher service for better polling
 */
export function startPaymentChecker() {
  // Legacy function - kept for compatibility
  // Actual transaction watching is handled by txWatcher service
  setInterval(() => {
    checkPendingPayments().catch(console.error);
  }, 10000); // 10 seconds

  console.log("Payment checker started (runs every 10s)");
}

