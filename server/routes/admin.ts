/**
 * Admin Portal Routes
 * Handles admin authentication and management
 */

import { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage.js";
import { hashPassword, verifyPassword } from "../routes.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { eq, and, or, desc } from "drizzle-orm";
import { merchants, payments, webhookSubscriptions, qrCodes, businessNameChangeRequests, blocklist, merchantBadges, adminUsers } from "../../shared/schema.js";
import { db } from "../db.js";

// Admin authentication middleware
async function requireAdmin(req: Request, res: Response, next: any) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  // Load admin user and attach to request
  const admin = await storage.getAdminUser(req.session.adminId);
  if (!admin || !admin.active) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  (req as any).admin = admin;
  next();
}

// Super admin only
async function requireSuperAdmin(req: Request, res: Response, next: any) {
  if (!req.session?.adminId) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  const admin = await storage.getAdminUser(req.session.adminId);
  if (!admin || !admin.active || admin.role !== "SUPER_ADMIN") {
    return res.status(403).json({ error: "Super admin access required" });
  }
  (req as any).admin = admin;
  next();
}

const adminLoginSchema = z.object({
  email: z.string().email("Invalid email").optional(),
  password: z.string().optional(),
  address: z.string().optional(), // Wallet address for wallet-based login
});

const updateMerchantSchema = z.object({
  active: z.boolean().optional(),
  walletAddress: z.string().optional(),
});

const updateConfigSchema = z.object({
  value: z.string(),
  description: z.string().optional(),
});

const blocklistEntrySchema = z.object({
  type: z.enum(["wallet", "merchant", "email"]),
  value: z.string().min(1),
  reason: z.string().optional(),
});

export function registerAdminRoutes(app: Express) {
  // Admin login (supports both email/password and wallet)
  app.post("/api/admin/login", rateLimit, async (req, res) => {
    try {
      const result = adminLoginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { email, password, address } = result.data;
      let admin;

      // Wallet-based login
      if (address) {
        if (!address.startsWith('0x') || address.length !== 42) {
          return res.status(400).json({ error: "Invalid wallet address" });
        }

        const normalizedAddress = address.toLowerCase();
        const walletEmail = `${normalizedAddress}@admin.wallet.local`;
        
        // Try to find by wallet address first
        admin = await storage.getAdminUserByWalletAddress(normalizedAddress);
        
        // Fallback to email lookup
        if (!admin) {
          admin = await storage.getAdminUserByEmail(walletEmail);
        }

        if (!admin || !admin.active) {
          return res.status(401).json({ error: "Admin wallet not authorized" });
        }

        // Verify wallet address matches
        if (admin.walletAddress?.toLowerCase() !== normalizedAddress) {
          return res.status(401).json({ error: "Wallet address mismatch" });
        }
      } 
      // Email/password login
      else if (email && password) {
        admin = await storage.getAdminUserByEmail(email);
        
        if (!admin || !admin.active) {
          return res.status(401).json({ error: "Invalid credentials" });
        }

        const isValid = verifyPassword(password, admin.password);
        if (!isValid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      } else {
        return res.status(400).json({ error: "Either email/password or wallet address required" });
      }

      // Update last login
      await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, admin.id));

      req.session.adminId = admin.id;
      (req as any).admin = admin;

      res.json({
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          walletAddress: admin.walletAddress,
        },
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Admin logout
  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Get current admin
  app.get("/api/admin/me", requireAdmin, async (req, res) => {
    const admin = await storage.getAdminUser(req.session.adminId!);
    if (!admin) {
      return res.status(401).json({ error: "Admin not found" });
    }
    res.json({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    });
  });

  // ========== MERCHANT MANAGEMENT ==========
  
  // Get all merchants
  app.get("/api/admin/merchants", requireAdmin, async (req, res) => {
    try {
      const allMerchants = await db.select().from(merchants).orderBy(desc(merchants.createdAt));
      res.json(allMerchants);
    } catch (error) {
      console.error("Get merchants error:", error);
      res.status(500).json({ error: "Failed to get merchants" });
    }
  });

  // Get merchant by ID
  app.get("/api/admin/merchants/:id", requireAdmin, async (req, res) => {
    try {
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      console.error("Get merchant error:", error);
      res.status(500).json({ error: "Failed to get merchant" });
    }
  });

  // Update merchant (approve/disable)
  app.patch("/api/admin/merchants/:id", requireAdmin, async (req, res) => {
    try {
      const result = updateMerchantSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      // Log action
      await storage.createAuditLog({
        adminId: req.session.adminId!,
        action: "merchant.updated",
        entityType: "merchant",
        entityId: merchant.id,
        metadata: JSON.stringify(result.data),
      });

      // For now, we'll just update what we can
      // Note: merchants table might need an "active" field
      res.json(merchant);
    } catch (error) {
      console.error("Update merchant error:", error);
      res.status(500).json({ error: "Failed to update merchant" });
    }
  });

  // Issue/Revoke Merchant Badge
  app.post("/api/admin/merchants/:id/badge", requireAdmin, async (req, res) => {
    try {
      const { action } = req.body; // "issue" or "revoke"
      const merchant = await storage.getMerchant(req.params.id);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      if (action === "issue") {
        // Check if badge already exists
        const existingBadge = await storage.getMerchantBadge(merchant.id);
        if (existingBadge) {
          return res.status(400).json({ error: "Merchant already has a badge" });
        }

        // Create badge (you'll need to implement minting logic)
        const badge = await storage.createMerchantBadge({
          merchantId: merchant.id,
          tokenId: null,
          mintTxHash: null,
        });

        await storage.createAuditLog({
          adminId: req.session.adminId!,
          action: "badge.issued",
          entityType: "merchant",
          entityId: merchant.id,
        });

        res.json(badge);
      } else if (action === "revoke") {
        // Delete badge
        const badge = await storage.getMerchantBadge(merchant.id);
        if (badge) {
          await db.delete(merchantBadges).where(eq(merchantBadges.id, badge.id));
        }

        await storage.createAuditLog({
          adminId: req.session.adminId!,
          action: "badge.revoked",
          entityType: "merchant",
          entityId: merchant.id,
        });

        res.json({ success: true });
      } else {
        return res.status(400).json({ error: "Invalid action. Use 'issue' or 'revoke'" });
      }
    } catch (error) {
      console.error("Badge action error:", error);
      res.status(500).json({ error: "Failed to perform badge action" });
    }
  });

  // ========== PAYMENTS MANAGEMENT ==========

  // Get all payments (admin view)
  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const allPayments = await db.select().from(payments).orderBy(desc(payments.createdAt));
      res.json(allPayments);
    } catch (error) {
      console.error("Get payments error:", error);
      res.status(500).json({ error: "Failed to get payments" });
    }
  });

  // Flag payment
  app.post("/api/admin/payments/:id/flag", requireAdmin, async (req, res) => {
    try {
      const { reason, notes } = req.body;
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Update payment metadata with flag info
      const metadata = payment.metadata ? JSON.parse(payment.metadata) : {};
      metadata.flagged = true;
      metadata.flagReason = reason;
      metadata.flagNotes = notes;
      metadata.flaggedBy = req.session.adminId;
      metadata.flaggedAt = new Date().toISOString();

      await storage.updatePayment(payment.id, { metadata: JSON.stringify(metadata) });

      await storage.createAuditLog({
        adminId: req.session.adminId!,
        action: "payment.flagged",
        entityType: "payment",
        entityId: payment.id,
        metadata: JSON.stringify({ reason, notes }),
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Flag payment error:", error);
      res.status(500).json({ error: "Failed to flag payment" });
    }
  });

  // ========== BUSINESS NAME CHANGE REQUESTS ==========

  // Get all change requests
  app.get("/api/admin/change-requests", requireAdmin, async (req, res) => {
    try {
      const status = req.query.status as "pending" | "approved" | "rejected" | undefined;
      const requests = await storage.getAllBusinessNameChangeRequests(status);
      res.json(requests);
    } catch (error) {
      console.error("Get change requests error:", error);
      res.status(500).json({ error: "Failed to get change requests" });
    }
  });

  // Approve/Reject change request
  app.post("/api/admin/change-requests/:id/review", requireAdmin, async (req, res) => {
    try {
      const { action } = req.body; // "approve" or "reject"
      const request = await storage.getBusinessNameChangeRequest(req.params.id);
      if (!request) {
        return res.status(404).json({ error: "Change request not found" });
      }

      if (request.status !== "pending") {
        return res.status(400).json({ error: "Request already reviewed" });
      }

      if (action === "approve") {
        // Update merchant profile
        const merchant = await storage.getMerchant(request.merchantId);
        if (merchant?.walletAddress) {
          await storage.upsertMerchantProfile({
            walletAddress: merchant.walletAddress,
            businessName: request.requestedName,
            logoUrl: null,
          });
        }

        await storage.updateBusinessNameChangeRequest(request.id, {
          status: "approved",
          reviewedBy: req.session.adminId!,
          reviewedAt: new Date(),
        });

        await storage.createAuditLog({
          adminId: req.session.adminId!,
          action: "change_request.approved",
          entityType: "change_request",
          entityId: request.id,
        });
      } else if (action === "reject") {
        await storage.updateBusinessNameChangeRequest(request.id, {
          status: "rejected",
          reviewedBy: req.session.adminId!,
          reviewedAt: new Date(),
        });

        await storage.createAuditLog({
          adminId: req.session.adminId!,
          action: "change_request.rejected",
          entityType: "change_request",
          entityId: request.id,
        });
      } else {
        return res.status(400).json({ error: "Invalid action. Use 'approve' or 'reject'" });
      }

      const updated = await storage.getBusinessNameChangeRequest(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Review change request error:", error);
      res.status(500).json({ error: "Failed to review change request" });
    }
  });

  // ========== WEBHOOKS MANAGEMENT ==========

  // Get all webhook subscriptions
  app.get("/api/admin/webhooks", requireAdmin, async (req, res) => {
    try {
      const allSubscriptions = await db.select().from(webhookSubscriptions).orderBy(desc(webhookSubscriptions.createdAt));
      res.json(allSubscriptions);
    } catch (error) {
      console.error("Get webhooks error:", error);
      res.status(500).json({ error: "Failed to get webhooks" });
    }
  });

  // ========== QR CODES MANAGEMENT ==========

  // Get all QR codes
  app.get("/api/admin/qr-codes", requireAdmin, async (req, res) => {
    try {
      const allQRCodes = await db.select().from(qrCodes).orderBy(desc(qrCodes.createdAt));
      res.json(allQRCodes);
    } catch (error) {
      console.error("Get QR codes error:", error);
      res.status(500).json({ error: "Failed to get QR codes" });
    }
  });

  // ========== GLOBAL CONFIG ==========

  // Get all config
  app.get("/api/admin/config", requireAdmin, async (req, res) => {
    try {
      const configs = await storage.getAllGlobalConfig();
      res.json(configs);
    } catch (error) {
      console.error("Get config error:", error);
      res.status(500).json({ error: "Failed to get config" });
    }
  });

  // Update config
  app.put("/api/admin/config/:key", requireAdmin, async (req, res) => {
    try {
      const result = updateConfigSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const config = await storage.upsertGlobalConfig({
        key: req.params.key,
        value: result.data.value,
        description: result.data.description,
        updatedBy: req.session.adminId!,
      });

      await storage.createAuditLog({
        adminId: req.session.adminId!,
        action: "config.updated",
        entityType: "config",
        entityId: config.key,
        metadata: JSON.stringify({ value: config.value }),
      });

      res.json(config);
    } catch (error) {
      console.error("Update config error:", error);
      res.status(500).json({ error: "Failed to update config" });
    }
  });

  // ========== BLOCKLIST ==========

  // Get all blocklist entries
  app.get("/api/admin/blocklist", requireAdmin, async (req, res) => {
    try {
      const entries = await storage.getAllBlocklistEntries();
      res.json(entries);
    } catch (error) {
      console.error("Get blocklist error:", error);
      res.status(500).json({ error: "Failed to get blocklist" });
    }
  });

  // Add to blocklist
  app.post("/api/admin/blocklist", requireAdmin, async (req, res) => {
    try {
      const result = blocklistEntrySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      // Check if already blocked
      const existing = await storage.getBlocklistEntry(result.data.type, result.data.value);
      if (existing) {
        return res.status(400).json({ error: "Already in blocklist" });
      }

      const entry = await storage.createBlocklistEntry({
        type: result.data.type,
        value: result.data.value,
        reason: result.data.reason || null,
        blockedBy: req.session.adminId!,
      });

      await storage.createAuditLog({
        adminId: req.session.adminId!,
        action: "blocklist.added",
        entityType: "blocklist",
        entityId: entry.id,
        metadata: JSON.stringify({ type: entry.type, value: entry.value }),
      });

      res.json(entry);
    } catch (error) {
      console.error("Add to blocklist error:", error);
      res.status(500).json({ error: "Failed to add to blocklist" });
    }
  });

  // Remove from blocklist
  app.delete("/api/admin/blocklist/:id", requireAdmin, async (req, res) => {
    try {
      await storage.deleteBlocklistEntry(req.params.id);

      await storage.createAuditLog({
        adminId: req.session.adminId!,
        action: "blocklist.removed",
        entityType: "blocklist",
        entityId: req.params.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Remove from blocklist error:", error);
      res.status(500).json({ error: "Failed to remove from blocklist" });
    }
  });

  // ========== AUDIT LOGS ==========

  // Get audit logs
  app.get("/api/admin/audit-logs", requireAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getAuditLogs(limit);
      res.json(logs);
    } catch (error) {
      console.error("Get audit logs error:", error);
      res.status(500).json({ error: "Failed to get audit logs" });
    }
  });

  // ========== NOTIFICATIONS ==========

  const sendNotificationSchema = z.object({
    merchantId: z.string().optional(), // If not provided, send to all merchants
    title: z.string().min(1, "Title is required"),
    message: z.string().min(1, "Message is required"),
    type: z.enum(["info", "warning", "success", "error"]).optional().default("info"),
  });

  // Send notification to merchant(s)
  app.post("/api/admin/notifications/send", requireAdmin, async (req, res) => {
    try {
      const result = sendNotificationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { merchantId, title, message, type } = result.data;
      const admin = (req as any).admin;

      if (merchantId) {
        // Send to specific merchant
        const merchant = await storage.getMerchant(merchantId);
        if (!merchant) {
          return res.status(404).json({ error: "Merchant not found" });
        }

        const notification = await storage.createNotification({
          merchantId,
          title,
          message,
          type: type || "info",
          read: false,
          createdBy: admin.id,
        });

        res.json(notification);
      } else {
        // Send to all merchants
        const allMerchants = await db.select().from(merchants);
        const notifications = [];

        for (const merchant of allMerchants) {
          const notification = await storage.createNotification({
            merchantId: merchant.id,
            title,
            message,
            type: type || "info",
            read: false,
            createdBy: admin.id,
          });
          notifications.push(notification);
        }

        res.json({ 
          success: true, 
          count: notifications.length,
          notifications 
        });
      }
    } catch (error) {
      console.error("Send notification error:", error);
      res.status(500).json({ error: "Failed to send notification" });
    }
  });
}

