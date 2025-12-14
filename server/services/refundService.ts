/**
 * Refund Service
 * Handles non-custodial refunds - merchant wallet sends funds back to payer
 */

import { db } from "../db";
import { refunds, payments } from "@shared/schema";
import { eq } from "drizzle-orm";
import { dispatchWebhook } from "./webhookService";
import { getExplorerLink } from "./arcService";

export interface RefundRequest {
  paymentId: string;
  merchantId: string;
  amount: string;
  currency: string;
  reason?: string;
}

/**
 * Create a refund intent
 * Note: This creates the refund record, but the actual transaction
 * must be initiated by the merchant's wallet (non-custodial)
 */
export async function createRefundIntent(request: RefundRequest) {
  // Verify payment exists and belongs to merchant
  const [payment] = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.id, request.paymentId), eq(payments.merchantId, request.merchantId))
    );

  if (!payment) {
    throw new Error("Payment not found");
  }

  if (payment.status === "refunded") {
    throw new Error("Payment already refunded");
  }

  if (payment.status !== "confirmed") {
    throw new Error("Can only refund confirmed payments");
  }

  // Check if refund amount is valid
  const refundAmount = parseFloat(request.amount);
  const paymentAmount = parseFloat(payment.amount);
  if (refundAmount > paymentAmount) {
    throw new Error("Refund amount cannot exceed payment amount");
  }

  // Create refund record
  const [refund] = await db
    .insert(refunds)
    .values({
      paymentId: request.paymentId,
      merchantId: request.merchantId,
      amount: request.amount,
      currency: request.currency || payment.currency,
      status: "pending",
      reason: request.reason,
    })
    .returning();

  return refund;
}

/**
 * Complete a refund (called after merchant initiates transaction)
 */
export async function completeRefund(refundId: string, txHash: string) {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId));

  if (!refund) {
    throw new Error("Refund not found");
  }

  // Update refund status
  await db
    .update(refunds)
    .set({
      txHash,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(refunds.id, refundId));

  // Update payment status
  await db
    .update(payments)
    .set({
      status: "refunded",
      updatedAt: new Date(),
    })
    .where(eq(payments.id, refund.paymentId));

  // Dispatch webhook
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, refund.paymentId));

  if (payment) {
    await dispatchWebhook(refund.merchantId, "payment.refunded", {
      type: "payment.refunded",
      data: {
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: "refunded",
        },
        refund: {
          id: refund.id,
          amount: refund.amount,
          txHash,
          explorerLink: getExplorerLink(txHash),
        },
      },
    });
  }

  return refund;
}

/**
 * Get refund by ID
 */
export async function getRefund(refundId: string) {
  const [refund] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.id, refundId));

  return refund;
}

/**
 * Get refunds for a payment
 */
export async function getRefundsByPayment(paymentId: string) {
  return await db
    .select()
    .from(refunds)
    .where(eq(refunds.paymentId, paymentId));
}

