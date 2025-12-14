/**
 * Payment Service
 * Handles payment lifecycle: create, confirm, fail, expire
 */

import { db } from "../db";
import { payments } from "@shared/schema";
import { eq, and, lt, isNotNull, or } from "drizzle-orm";
import { dispatchWebhook } from "./webhookService";
import { verifyTransaction, getExplorerLink, getBlockTimestamp } from "./arcService";
import { DEMO_MODE } from "../config";

export interface CreatePaymentRequest {
  merchantId: string;
  amount: string;
  currency: string;
  description?: string;
  customerEmail?: string;
  merchantWallet: string;
  expiresInMinutes?: number;
}

/**
 * Create a new payment
 */
export async function createPayment(request: CreatePaymentRequest) {
  const expiresAt = request.expiresInMinutes
    ? new Date(Date.now() + request.expiresInMinutes * 60 * 1000)
    : new Date(Date.now() + 30 * 60 * 1000); // Default 30 minutes

  const [payment] = await db
    .insert(payments)
    .values({
      merchantId: request.merchantId,
      amount: request.amount,
      currency: request.currency || "USDC",
      status: "created",
      description: request.description,
      customerEmail: request.customerEmail,
      merchantWallet: request.merchantWallet,
      isDemo: false, // Real payments only - no demo mode
      expiresAt,
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

  // Dispatch webhook
  if (updatedPayment) {
    await dispatchWebhook(payment.merchantId, "payment.confirmed", {
      type: "payment.confirmed",
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
 * Background service: Check pending payments and verify transactions
 */
export async function checkPendingPayments() {
  try {
    // Get all pending payments with txHash (skip demo payments)
    const allPendingPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.status, "pending"));

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
    const allPayments = await db.select().from(payments);
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
    console.error("Error in payment checker:", error);
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

