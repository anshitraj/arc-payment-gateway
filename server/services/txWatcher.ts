/**
 * Transaction Watcher Service
 * Polls ARC RPC for transaction confirmations with exponential backoff
 */

import { db } from "../db";
import { payments } from "@shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { verifyTransaction } from "./arcService";
import { confirmPayment, failPayment } from "./paymentService";
import { ARC_CHAIN_ID } from "../config";

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
 * Watch pending payments and poll for confirmations
 */
export async function watchPendingPayments(): Promise<void> {
  try {
    // Get all pending payments with txHash (skip demo payments)
    const pendingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.status, "pending"),
          isNotNull(payments.txHash)
        )
      );

    const realPayments = pendingPayments.filter((p) => p.txHash && !p.isDemo);

    // Check each payment
    for (const payment of realPayments) {
      await checkPaymentTransaction(payment);
    }
  } catch (error) {
    console.error("Error in transaction watcher:", error);
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
