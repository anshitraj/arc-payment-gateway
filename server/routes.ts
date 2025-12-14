import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage, generateApiKey, generateWebhookSecret } from "./storage";
import { insertUserSchema, insertPaymentSchema, insertInvoiceSchema } from "@shared/schema";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";
import { registerPaymentRoutes } from "./routes/payments";
import { registerRefundRoutes } from "./routes/refunds";
import { registerWebhookRoutes } from "./routes/webhooks";
import { startPaymentChecker } from "./services/paymentService";
import { startTxWatcher } from "./services/txWatcher";

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
  // CORS middleware for API routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // Allow same-origin and localhost origins
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "arc-pay-kit-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
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

  app.post("/api/auth/wallet-login", async (req, res) => {
    try {
      const { address } = req.body;
      
      if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      // Normalize wallet address (lowercase)
      const normalizedAddress = address.toLowerCase();

      // Find or create user by wallet address
      // Use wallet address as email identifier (wallet@wallet.com format)
      const walletEmail = `${normalizedAddress}@wallet.local`;
      let user = await storage.getUserByEmail(walletEmail);

      if (!user) {
        // Create new user with wallet address
        const hashedPassword = hashPassword(normalizedAddress); // Use address as password (not secure, but for wallet auth)
        user = await storage.createUser({
          email: walletEmail,
          password: hashedPassword,
          name: `Wallet ${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`,
        });

        // Create merchant for the user
        const merchant = await storage.createMerchant({
          userId: user.id,
          name: `${user.name}'s Business`,
          apiKey: generateApiKey(),
          webhookSecret: generateWebhookSecret(),
          walletAddress: normalizedAddress,
        });

        // Create treasury balances
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
      } else {
        // Existing user - get their merchant
        let merchant = await storage.getMerchantByUserId(user.id);
        
        if (!merchant) {
          // Create merchant if doesn't exist
          merchant = await storage.createMerchant({
            userId: user.id,
            name: `${user.name}'s Business`,
            apiKey: generateApiKey(),
            webhookSecret: generateWebhookSecret(),
            walletAddress: normalizedAddress,
          });

          // Create treasury balances
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
        } else {
          // Update wallet address if not set
          if (!merchant.walletAddress) {
            await storage.updateMerchant(merchant.id, { walletAddress: normalizedAddress });
          }
        }

        req.session.userId = user.id;
        req.session.merchantId = merchant.id;

        res.json({
          user: { id: user.id, email: user.email, name: user.name },
          merchant: { id: merchant.id, name: merchant.name, apiKey: merchant.apiKey },
        });
      }
    } catch (error) {
      console.error("Wallet login error:", error);
      res.status(500).json({ error: "Wallet login failed" });
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

  // Legacy endpoint for session-based auth (dashboard)
  // Public access allowed for checkout pages
  app.get("/api/payments/:id", async (req, res) => {
    const payment = await storage.getPayment(req.params.id);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    
    // If user is authenticated via session, verify ownership
    if (req.session.merchantId && payment.merchantId !== req.session.merchantId) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    // Public access allowed (for checkout pages)
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

      // Get merchant to retrieve wallet address
      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      if (!merchant.walletAddress) {
        return res.status(400).json({ error: "Merchant wallet address not set. Please configure your wallet address in settings." });
      }

      const payment = await storage.createPayment({
        merchantId: req.session.merchantId,
        amount,
        currency,
        description,
        customerEmail,
        merchantWallet: merchant.walletAddress,
        status: "created",
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

  // Demo endpoints (no auth required)
  app.get("/demo/payments", async (_, res) => {
    res.json([
      {
        id: "demo-1",
        amount: "10",
        currency: "USDC",
        status: "demo",
        wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        txHash: "0x" + randomBytes(32).toString("hex"),
        createdAt: new Date().toISOString(),
        isDemo: true,
      },
      {
        id: "demo-2",
        amount: "25.5",
        currency: "USDC",
        status: "demo",
        wallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        txHash: "0x" + randomBytes(32).toString("hex"),
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        isDemo: true,
      },
    ]);
  });

  // Register new payment, refund, and webhook routes
  registerPaymentRoutes(app);
  registerRefundRoutes(app);
  registerWebhookRoutes(app);

  // Start background payment checker (legacy)
  startPaymentChecker();
  
  // Start transaction watcher (enhanced polling with exponential backoff)
  startTxWatcher();

  return httpServer;
}
