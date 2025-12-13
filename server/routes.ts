import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, generateApiKey, generateWebhookSecret } from "./storage";
import { insertUserSchema, insertPaymentSchema, insertInvoiceSchema } from "@shared/schema";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    merchantId?: string;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const testHash = scryptSync(password, salt, 64);
  return timingSafeEqual(hashBuffer, testHash);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const createPaymentSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be a positive number"),
  currency: z.string().optional().default("USDC"),
  description: z.string().optional(),
  customerEmail: z.string().email().optional(),
});

const createInvoiceSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, "Amount must be a positive number"),
  currency: z.string().optional().default("USDC"),
  customerEmail: z.string().email("Invalid customer email"),
  customerName: z.string().optional(),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "arc-pay-kit-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      },
    })
  );

  app.post("/api/auth/register", async (req, res) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { email, password, name } = result.data;

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        name,
      });

      const merchant = await storage.createMerchant({
        userId: user.id,
        name: `${name}'s Business`,
        apiKey: generateApiKey(),
        webhookSecret: generateWebhookSecret(),
      });

      await storage.createTreasuryBalance({
        merchantId: merchant.id,
        currency: "USDC",
        balance: "0",
      });

      await storage.createTreasuryBalance({
        merchantId: merchant.id,
        currency: "USDT",
        balance: "0",
      });

      req.session.userId = user.id;
      req.session.merchantId = merchant.id;

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        merchant: { id: merchant.id, name: merchant.name, apiKey: merchant.apiKey },
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { email, password } = result.data;

      const user = await storage.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const merchant = await storage.getMerchantByUserId(user.id);

      req.session.userId = user.id;
      req.session.merchantId = merchant?.id;

      res.json({
        user: { id: user.id, email: user.email, name: user.name },
        merchant: merchant ? { id: merchant.id, name: merchant.name, apiKey: merchant.apiKey } : null,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    const merchant = req.session.merchantId
      ? await storage.getMerchant(req.session.merchantId)
      : null;

    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      merchant: merchant ? { id: merchant.id, name: merchant.name, apiKey: merchant.apiKey } : null,
    });
  });

  app.get("/api/merchants", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.status(404).json({ error: "No merchant found" });
    }

    const merchant = await storage.getMerchant(req.session.merchantId);
    res.json(merchant);
  });

  app.get("/api/payments", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.json([]);
    }

    const payments = await storage.getPayments(req.session.merchantId);
    res.json(payments);
  });

  app.get("/api/payments/:id", requireAuth, async (req, res) => {
    const payment = await storage.getPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    if (payment.merchantId !== req.session.merchantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    res.json(payment);
  });

  app.post("/api/payments", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const result = createPaymentSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { amount, currency, description, customerEmail } = result.data;

      const payment = await storage.createPayment({
        merchantId: req.session.merchantId,
        amount,
        currency,
        description,
        customerEmail,
        status: "pending",
      });

      res.json(payment);
    } catch (error) {
      console.error("Create payment error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  app.post("/api/payments/:id/confirm", requireAuth, async (req, res) => {
    try {
      const payment = await storage.getPayment(req.params.id);
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      if (payment.merchantId !== req.session.merchantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const txHash = `0x${randomBytes(32).toString("hex")}`;
      const settlementTime = Math.floor(Math.random() * 300) + 100;

      const updatedPayment = await storage.updatePayment(payment.id, {
        status: "final",
        txHash,
        settlementTime,
      });

      const treasuryBalance = await storage.getTreasuryBalance(
        payment.merchantId,
        payment.currency
      );

      if (treasuryBalance) {
        const newBalance = (
          parseFloat(treasuryBalance.balance) + parseFloat(payment.amount)
        ).toString();
        await storage.updateTreasuryBalance(treasuryBalance.id, {
          balance: newBalance,
        });
      }

      res.json(updatedPayment);
    } catch (error) {
      console.error("Confirm payment error:", error);
      res.status(500).json({ error: "Failed to confirm payment" });
    }
  });

  app.get("/api/invoices", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.json([]);
    }

    const invoices = await storage.getInvoices(req.session.merchantId);
    res.json(invoices);
  });

  app.post("/api/invoices", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const result = createInvoiceSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const { amount, currency, customerEmail, customerName, description, dueDate } = result.data;
      const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;

      const invoice = await storage.createInvoice({
        merchantId: req.session.merchantId,
        invoiceNumber,
        amount,
        currency,
        customerEmail,
        customerName,
        description,
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "sent",
      });

      res.json(invoice);
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.post("/api/invoices/:id/mark-paid", requireAuth, async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      if (invoice.merchantId !== req.session.merchantId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedInvoice = await storage.updateInvoice(invoice.id, {
        status: "paid",
      });

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Mark invoice paid error:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  app.get("/api/webhooks/events", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.json([]);
    }

    const events = await storage.getWebhookEvents(req.session.merchantId);
    res.json(events);
  });

  app.get("/api/treasury", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.json([]);
    }

    const balances = await storage.getTreasuryBalances(req.session.merchantId);
    res.json(balances);
  });

  app.post("/api/treasury/rebalance", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const balances = await storage.getTreasuryBalances(req.session.merchantId);
      res.json({ success: true, balances });
    } catch (error) {
      console.error("Rebalance error:", error);
      res.status(500).json({ error: "Failed to rebalance" });
    }
  });

  app.get("/api/stats", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.json({
        totalVolume: "0",
        totalPayments: 0,
        successRate: 100,
        avgSettlement: 0,
      });
    }

    const payments = await storage.getPayments(req.session.merchantId);
    const successfulPayments = payments.filter((p) => p.status === "final");

    const totalVolume = successfulPayments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    );

    const avgSettlement =
      successfulPayments.length > 0
        ? successfulPayments.reduce((sum, p) => sum + (p.settlementTime || 0), 0) /
          successfulPayments.length
        : 0;

    res.json({
      totalVolume: totalVolume.toFixed(2),
      totalPayments: payments.length,
      successRate:
        payments.length > 0
          ? Math.round((successfulPayments.length / payments.length) * 100)
          : 100,
      avgSettlement: Math.round(avgSettlement),
    });
  });

  return httpServer;
}
