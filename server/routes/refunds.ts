/**
 * Refund Routes
 * Handles refund creation and retrieval
 */

import type { Express } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKeyAuth";
import { rateLimit } from "../middleware/rateLimit";
import { createRefundIntent, completeRefund, getRefund, getRefundsByPayment } from "../services/refundService";
import { storage } from "../storage";
import { getExplorerLink } from "../services/arcService";

const createRefundSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be positive"),
  currency: z.string().optional().default("USDC"),
  reason: z.string().optional(),
});

const completeRefundSchema = z.object({
  refundId: z.string().min(1, "Refund ID is required"),
  txHash: z.string().refine((val) => /^0x[a-fA-F0-9]{64}$/.test(val), "Invalid transaction hash"),
});

export function registerRefundRoutes(app: Express) {
  // Create refund intent
  app.post("/api/payments/:id/refund", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = createRefundSchema.safeParse({
        paymentId: req.params.id,
        ...req.body,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const refund = await createRefundIntent({
        paymentId: result.data.paymentId,
        merchantId: req.merchant.id,
        amount: result.data.amount,
        currency: result.data.currency,
        reason: result.data.reason,
      });

      res.json({
        id: refund.id,
        paymentId: refund.paymentId,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        createdAt: refund.createdAt,
        message: "Refund intent created. Initiate transaction from your wallet to complete.",
      });
    } catch (error) {
      console.error("Create refund error:", error);
      const message = error instanceof Error ? error.message : "Failed to create refund";
      res.status(400).json({ error: message });
    }
  });

  // Complete refund (after merchant initiates transaction)
  app.post("/api/refunds/:id/complete", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = completeRefundSchema.safeParse({
        refundId: req.params.id,
        ...req.body,
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const refund = await getRefund(result.data.refundId);
      if (!refund || refund.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Refund not found" });
      }

      const completedRefund = await completeRefund(result.data.refundId, result.data.txHash);

      res.json({
        success: true,
        refund: {
          ...completedRefund,
          explorerLink: getExplorerLink(result.data.txHash),
        },
      });
    } catch (error) {
      console.error("Complete refund error:", error);
      const message = error instanceof Error ? error.message : "Failed to complete refund";
      res.status(400).json({ error: message });
    }
  });

  // Get refund by ID
  app.get("/api/refunds/:id", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const refund = await getRefund(req.params.id);
      if (!refund || refund.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Refund not found" });
      }

      res.json({
        ...refund,
        explorerLink: refund.txHash ? getExplorerLink(refund.txHash) : null,
      });
    } catch (error) {
      console.error("Get refund error:", error);
      res.status(500).json({ error: "Failed to get refund" });
    }
  });

  // Get refunds for a payment
  app.get("/api/payments/:id/refunds", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payment = await storage.getPayment(req.params.id);
      if (!payment || payment.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const refunds = await getRefundsByPayment(req.params.id);

      res.json(
        refunds.map((refund) => ({
          ...refund,
          explorerLink: refund.txHash ? getExplorerLink(refund.txHash) : null,
        }))
      );
    } catch (error) {
      console.error("Get refunds error:", error);
      res.status(500).json({ error: "Failed to get refunds" });
    }
  });
}

