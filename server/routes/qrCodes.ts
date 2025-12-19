/**
 * QR Code Routes
 * Handles QR code creation and management
 */

import { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage.js";
import { z } from "zod";
import type { InsertQRCode } from "../../shared/schema.js";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const createQRCodeSchema = z.object({
  amountType: z.enum(["fixed", "open"]),
  amount: z.string().optional(),
  description: z.string().optional(),
  expiresInMinutes: z.coerce.number().positive().optional(),
  isTest: z.coerce.boolean().optional(),
});

export function registerQRCodeRoutes(app: Express) {
  // Get all QR codes for merchant
  app.get("/api/qr-codes", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const qrCodes = await storage.getQRCodes(req.session.merchantId);
      res.json(qrCodes);
    } catch (error) {
      console.error("Get QR codes error:", error);
      res.status(500).json({ error: "Failed to get QR codes" });
    }
  });

  // Create QR code
  app.post("/api/qr-codes", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      // Verify merchant exists
      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const result = createQRCodeSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { amountType, amount, description, expiresInMinutes, isTest } = result.data;

      // Validate fixed amount
      if (amountType === "fixed") {
        if (!amount || amount.trim() === "" || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
          return res.status(400).json({ error: "Amount is required for fixed amount QR codes" });
        }
      }

      // Calculate expiresAt if expiresInMinutes is provided
      let expiresAt: Date | null = null;
      if (expiresInMinutes) {
        expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);
      }

      // Prepare QR code data
      // Drizzle's decimal type accepts string representation of numbers
      const qrCodeData: InsertQRCode = {
        merchantId: req.session.merchantId,
        amountType,
        amount: amountType === "fixed" && amount && amount.trim() !== "" ? amount : null,
        description: description || null,
        expiresAt,
        isTest: isTest !== undefined ? isTest : true,
      };

      const qrCode = await storage.createQRCode(qrCodeData);

      res.json(qrCode);
    } catch (error: any) {
      console.error("Create QR code error:", error);
      // Log more details about the error
      if (error?.message) {
        console.error("Error message:", error.message);
      }
      if (error?.code) {
        console.error("Error code:", error.code);
      }
      if (error?.detail) {
        console.error("Error detail:", error.detail);
      }
      
      // Check if it's a missing table error
      if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
        console.error("\n❌ Database table 'qr_codes' does not exist!");
        console.error("To fix this, run: npm run db:push\n");
        return res.status(500).json({ 
          error: "Database table missing",
          message: "The qr_codes table does not exist. Please run 'npm run db:push' to create it."
        });
      }
      
      res.status(500).json({ error: "Failed to create QR code" });
    }
  });

  // Get QR code by ID
  app.get("/api/qr-codes/:id", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const qrCode = await storage.getQRCode(req.params.id);
      if (!qrCode) {
        return res.status(404).json({ error: "QR code not found" });
      }

      if (qrCode.merchantId !== req.session.merchantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(qrCode);
    } catch (error) {
      console.error("Get QR code error:", error);
      res.status(500).json({ error: "Failed to get QR code" });
    }
  });
}

