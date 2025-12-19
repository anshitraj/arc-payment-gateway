/**
 * Transaction Watcher Service
 * Polls ARC RPC for transaction confirmations with exponential backoff
 */

import { db } from "../db.js";
import { payments } from "../../shared/schema.js";
import { eq, and, isNotNull } from "drizzle-orm";
import { verifyTransaction } from "./arcService.js";
import { confirmPayment, failPayment } from "./paymentService.js";
import { ARC_CHAIN_ID } from "../config.js";

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_RETRIES = 20; // Maximum number of polling attempts (20 * 10s = 200s = ~3.3 minutes)
const INITIAL_BACKOFF = 5000; // 5 seconds
const MAX_BACKOFF = 60000; // 60 seconds

interface PaymentCheckState {
  paymentId: string;
  attempts: number;
  lastCheck: number;
  backoff: number;
}

const paymentStates = new Map<string, PaymentCheckState>();

/**
 * Calculate exponential backoff delay
 */
function calculateBackoff(attempt: number): number {
  const backoff = INITIAL_BACKOFF * Math.pow(2, attempt);
  return Math.min(backoff, MAX_BACKOFF);
}

/**
 * Check a single payment transaction
 */
async function checkPaymentTransaction(payment: typeof payments.$inferSelect): Promise<void> {
  if (!payment.txHash) {
    return;
  }

  const state = paymentStates.get(payment.id) || {
    paymentId: payment.id,
    attempts: 0,
    lastCheck: 0,
    backoff: INITIAL_BACKOFF,
  };

  // Check if we should skip this check (backoff)
  const now = Date.now();
  if (now - state.lastCheck < state.backoff) {
    return;
  }

  try {
    const txStatus = await verifyTransaction(payment.txHash);

    if (txStatus.confirmed) {
      // Transaction confirmed - update payment
      await confirmPayment(
        payment.id,
        payment.txHash,
        payment.payerWallet || ""
      );
      
      // Remove from watch list
      paymentStates.delete(payment.id);
      
      console.log(`✅ Payment ${payment.id} confirmed (tx: ${payment.txHash})`);
    } else if (txStatus.failed) {
      // Transaction failed
      await failPayment(payment.id, txStatus.error || "Transaction failed");
      
      // Remove from watch list
      paymentStates.delete(payment.id);
      
      console.log(`❌ Payment ${payment.id} failed (tx: ${payment.txHash}): ${txStatus.error}`);
    } else {
      // Still pending - increment attempts and update backoff
      state.attempts += 1;
      state.lastCheck = now;
      state.backoff = calculateBackoff(state.attempts);
      paymentStates.set(payment.id, state);

      // If max retries reached, mark as failed
      if (state.attempts >= MAX_RETRIES) {
        await failPayment(payment.id, "Transaction confirmation timeout");
        paymentStates.delete(payment.id);
        console.log(`⏱️ Payment ${payment.id} timed out after ${MAX_RETRIES} attempts`);
      }
    }
  } catch (error) {
    console.error(`Error checking payment ${payment.id}:`, error);
    
    // Increment attempts on error
    state.attempts += 1;
    state.lastCheck = now;
    state.backoff = calculateBackoff(state.attempts);
    paymentStates.set(payment.id, state);

    // If too many errors, remove from watch list
    if (state.attempts >= MAX_RETRIES) {
      paymentStates.delete(payment.id);
    }
  }
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
 * Watch pending payments and poll for confirmations
 */
export async function watchPendingPayments(): Promise<void> {
  try {
    // Get all pending payments with txHash (skip demo payments)
    const pendingPayments = await retryDbOperation(() =>
      db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.status, "pending"),
            isNotNull(payments.txHash)
          )
        )
    );

    const realPayments = pendingPayments.filter((p) => p.txHash && !p.isDemo);

    // Check each payment
    for (const payment of realPayments) {
      await checkPaymentTransaction(payment);
    }
  } catch (error) {
    // Only log if it's not a connection error (connection errors are expected and will retry)
    if (!isConnectionError(error)) {
      console.error("Error in transaction watcher:", error);
    } else {
      console.warn("Database connection error in transaction watcher, will retry on next interval");
    }
  }
}

/**
 * Start the transaction watcher (runs every N seconds)
 */
export function startTxWatcher(): void {
  // Initial check
  watchPendingPayments().catch(console.error);

  // Set up interval
  setInterval(() => {
    watchPendingPayments().catch(console.error);
  }, POLL_INTERVAL);

  console.log(`Transaction watcher started (polls every ${POLL_INTERVAL / 1000}s, max ${MAX_RETRIES} attempts)`);
}
