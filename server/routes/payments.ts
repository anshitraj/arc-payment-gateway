/**
 * Payment Routes
 * Handles payment lifecycle: create, confirm, fail, expire
 */

import type { Express } from "express";
import { z } from "zod";
import { requireApiKey, optionalApiKey } from "../middleware/apiKeyAuth";
import { rateLimit } from "../middleware/rateLimit";
import { createPayment, confirmPayment, failPayment, expirePayment } from "../services/paymentService";
import { storage } from "../storage";
import { getExplorerLink } from "../services/arcService";

const createPaymentSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be positive"),
  currency: z.string().optional().default("USDC"),
  description: z.string().optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("").transform(() => undefined)),
  merchantWallet: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), "Invalid wallet address"),
  expiresInMinutes: z.number().int().positive().optional(),
});

const confirmPaymentSchema = z.object({
  txHash: z.string().refine((val) => /^0x[a-fA-F0-9]{64}$/.test(val), "Invalid transaction hash"),
  payerWallet: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), "Invalid wallet address"),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("").transform(() => undefined)),
  customerName: z.string().optional(),
});

const failPaymentSchema = z.object({
  reason: z.string().optional(),
});

export function registerPaymentRoutes(app: Express) {
  // Create payment
  app.post(
    "/api/payments/create",
    requireApiKey,
    rateLimit,
    async (req, res) => {
      try {
        if (!req.merchant) {
          return res.status(401).json({ error: "Unauthorized" });
        }

        const result = createPaymentSchema.safeParse(req.body);
        if (!result.success) {
          return res.status(400).json({ error: result.error.errors[0].message });
        }

        const payment = await createPayment({
          merchantId: req.merchant.id,
          ...result.data,
        });

        // Generate checkout URL
        const baseUrl = process.env.BASE_URL || 
          (req.headers.origin ? new URL(req.headers.origin).origin : 'https://pay.arcpaykit.com');
        const checkoutUrl = `${baseUrl}/checkout/${payment.id}`;

        res.json({
          id: payment.id,
          status: payment.status,
          checkout_url: checkoutUrl,
          amount: parseFloat(payment.amount),
          currency: payment.currency,
          merchantWallet: payment.merchantWallet,
          expiresAt: payment.expiresAt,
          createdAt: payment.createdAt,
        });
      } catch (error) {
        console.error("Create payment error:", error);
        res.status(500).json({ error: "Failed to create payment" });
      }
    }
  );

  // Get payment by ID
  app.get("/api/payments/:id", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const payment = await storage.getPayment(req.params.id);

      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      if (payment.merchantId !== req.merchant.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({
        ...payment,
        explorerLink: payment.txHash ? getExplorerLink(payment.txHash) : null,
      });
    } catch (error) {
      console.error("Get payment error:", error);
      res.status(500).json({ error: "Failed to get payment" });
    }
  });

  // Submit transaction hash (when transaction is submitted from frontend)
  // Public endpoint for checkout page (no auth required)
  app.post(
    "/api/payments/submit-tx",
    rateLimit,
    async (req, res) => {
      try {
        const { paymentId, txHash, payerWallet, customerEmail, customerName, gasSponsored } = req.body;
        
        if (!paymentId) {
          return res.status(400).json({ error: "paymentId is required" });
        }

        const result = confirmPaymentSchema.safeParse({ txHash, payerWallet, customerEmail, customerName });
        if (!result.success) {
          return res.status(400).json({ error: result.error.errors[0].message });
        }

        // Get payment (public access for checkout)
        const payment = await storage.getPayment(paymentId);
        if (!payment) {
          return res.status(404).json({ error: "Payment not found" });
        }

        // If merchant is authenticated, verify ownership
        if (req.merchant && payment.merchantId !== req.merchant.id) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Prepare metadata with customer name and gas sponsorship if provided
        let metadata = payment.metadata;
        try {
          const existingMetadata = metadata ? JSON.parse(metadata) : {};
          const updatedMetadata: any = { ...existingMetadata };
          
          if (result.data.customerName) {
            updatedMetadata.customerName = result.data.customerName;
          }
          
          // Update gas sponsorship if provided (user can override merchant's preference)
          if (gasSponsored !== undefined) {
            updatedMetadata.gasSponsored = gasSponsored;
          }
          
          metadata = JSON.stringify(updatedMetadata);
        } catch {
          // If metadata is invalid JSON, create new object
          const newMetadata: any = {};
          if (result.data.customerName) {
            newMetadata.customerName = result.data.customerName;
          }
          if (gasSponsored !== undefined) {
            newMetadata.gasSponsored = gasSponsored;
          }
          metadata = JSON.stringify(newMetadata);
        }

        // Update payment status to pending (will be confirmed by background checker)
        await storage.updatePayment(paymentId, {
          status: "pending",
          txHash: result.data.txHash,
          payerWallet: result.data.payerWallet,
          customerEmail: result.data.customerEmail || payment.customerEmail,
          metadata: metadata || payment.metadata,
        });

        const updatedPayment = await storage.getPayment(paymentId);

        res.json({
          success: true,
          payment: updatedPayment ? {
            ...updatedPayment,
            explorerLink: getExplorerLink(result.data.txHash),
          } : null,
        });
      } catch (error) {
        console.error("Submit tx error:", error);
        res.status(500).json({ error: "Failed to submit transaction" });
      }
    }
  );

  // Confirm payment (when transaction is submitted)
  // Public endpoint for checkout page (no auth required)
  app.post(
    "/api/payments/confirm",
    rateLimit,
    async (req, res) => {
      try {
        const { paymentId, ...confirmData } = req.body;
        const result = confirmPaymentSchema.safeParse(confirmData);

        if (!result.success) {
          return res.status(400).json({ error: result.error.errors[0].message });
        }

        if (!paymentId) {
          return res.status(400).json({ error: "paymentId is required" });
        }

        // Get payment (public access for checkout)
        const payment = await storage.getPayment(paymentId);
        if (!payment) {
          return res.status(404).json({ error: "Payment not found" });
        }

        // If merchant is authenticated, verify ownership
        if (req.merchant && payment.merchantId !== req.merchant.id) {
          return res.status(403).json({ error: "Access denied" });
        }

        // Update payment status to pending (will be confirmed by background checker)
        await storage.updatePayment(paymentId, {
          status: "pending",
          txHash: result.data.txHash,
          payerWallet: result.data.payerWallet,
        });

        const updatedPayment = await storage.getPayment(paymentId);

        res.json({
          success: true,
          payment: updatedPayment ? {
            ...updatedPayment,
            explorerLink: getExplorerLink(result.data.txHash),
          } : null,
        });
      } catch (error) {
        console.error("Confirm payment error:", error);
        res.status(500).json({ error: "Failed to confirm payment" });
      }
    }
  );

  // Fail payment
  app.post("/api/payments/fail", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { paymentId, ...failData } = req.body;
      const result = failPaymentSchema.safeParse(failData);

      if (!paymentId) {
        return res.status(400).json({ error: "paymentId is required" });
      }

      const payment = await storage.getPayment(paymentId);
      if (!payment || payment.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const updatedPayment = await failPayment(paymentId, result.data.reason);

      res.json({
        success: true,
        payment: updatedPayment,
      });
    } catch (error) {
      console.error("Fail payment error:", error);
      res.status(500).json({ error: "Failed to fail payment" });
    }
  });

  // Expire payment
  app.post("/api/payments/expire", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { paymentId } = req.body;

      if (!paymentId) {
        return res.status(400).json({ error: "paymentId is required" });
      }

      const payment = await storage.getPayment(paymentId);
      if (!payment || payment.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const updatedPayment = await expirePayment(paymentId);

      res.json({
        success: true,
        payment: updatedPayment,
      });
    } catch (error) {
      console.error("Expire payment error:", error);
      res.status(500).json({ error: "Failed to expire payment" });
    }
  });
}

