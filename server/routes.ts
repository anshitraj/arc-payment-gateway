import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { storage, generateApiKey, generateWebhookSecret } from "./storage.js";
import { db, pool } from "./db.js";
import { insertUserSchema, insertPaymentSchema, insertInvoiceSchema } from "../shared/schema.js";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { z } from "zod";
import { registerPaymentRoutes } from "./routes/payments.js";
import { registerRefundRoutes } from "./routes/refunds.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerBadgeRoutes } from "./routes/badges.js";
import { registerProofRoutes } from "./routes/proofs.js";
import { registerQRCodeRoutes } from "./routes/qrCodes.js";
import { registerApiKeyRoutes } from "./routes/apiKeys.js";
import { registerBridgeRoutes } from "./routes/bridge.js";
import { startPaymentChecker } from "./services/paymentService.js";
import { startTxWatcher } from "./services/txWatcher.js";
import { rateLimit } from "./middleware/rateLimit.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    merchantId?: string;
    adminId?: string;
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
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
  currency: z.string().optional().default("USDC"), // Payment asset (what user pays with)
  settlementCurrency: z.enum(["USDC", "EURC"]).default("USDC"), // Settlement currency (USDC or EURC on Arc)
  paymentAsset: z.string().optional(), // Specific asset identifier (e.g., "USDC_ARC", "USDC_BASE", "ETH_BASE")
  paymentChainId: z.coerce.number().int().optional(), // Chain ID where payment is made
  conversionPath: z.string().optional(), // JSON string describing conversion path
  estimatedFees: z.string().optional(), // Estimated network/gas fees
  description: z.string().optional(),
  customerEmail: z.string().email("Invalid email").optional().or(z.literal("").transform(() => undefined)),
  expiresInMinutes: z.coerce.number().int().positive().optional(),
  isTest: z.coerce.boolean().optional(), // Coerce to boolean to handle string "true"/"false"
  gasSponsored: z.coerce.boolean().optional().default(false), // Gas sponsorship preference
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
    // Allow same-origin, localhost, and Vercel production domains
    const allowedOrigins = [
      'localhost',
      '127.0.0.1',
      'vercel.app',
      'arcpaybeta.vercel.app', // Your production domain
    ];
    
    if (origin) {
      const isAllowed = allowedOrigins.some(allowed => origin.includes(allowed));
      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Configure session store - use PostgreSQL for serverless compatibility
  const PgSession = connectPgSimple(session);
  const sessionStore = new PgSession({
    pool: pool, // Use the PostgreSQL pool directly
    tableName: "session", // Table name for sessions
    createTableIfMissing: true, // Auto-create table if it doesn't exist
  });

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "arc-pay-kit-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
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
          merchant: { 
            id: merchant.id, 
            name: merchant.name, 
            apiKey: merchant.apiKey,
            walletAddress: merchant.walletAddress 
          },
        });
      } else {
        // Existing user - get their merchant
        let merchant = await storage.getMerchantByUserId(user.id);
        
        if (!merchant) {
          // Create merchant if doesn't exist
          const newMerchant = await storage.createMerchant({
            userId: user.id,
            name: `${user.name}'s Business`,
            apiKey: generateApiKey(),
            webhookSecret: generateWebhookSecret(),
            walletAddress: normalizedAddress,
          });

          if (!newMerchant) {
            return res.status(500).json({ error: "Failed to create merchant" });
          }

          merchant = newMerchant;

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
            // Refresh merchant to get updated wallet address
            const updatedMerchant = await storage.getMerchant(merchant.id);
            if (updatedMerchant) {
              merchant = updatedMerchant;
            }
          }
        }

        if (!merchant) {
          return res.status(500).json({ error: "Failed to create or retrieve merchant" });
        }

        req.session.userId = user.id;
        req.session.merchantId = merchant.id;

        res.json({
          user: { id: user.id, email: user.email, name: user.name },
          merchant: merchant ? { 
            id: merchant.id, 
            name: merchant.name, 
            apiKey: merchant.apiKey,
            walletAddress: merchant.walletAddress 
          } : null,
        });
      }
    } catch (error: any) {
      console.error("Wallet login error:", error);
      // Provide more detailed error information for debugging
      const errorMessage = error?.message || "Unknown error";
      const isDatabaseError = errorMessage.includes("DATABASE_URL") || 
                               errorMessage.includes("connection") ||
                               errorMessage.includes("timeout") ||
                               error?.code === "ECONNREFUSED" ||
                               error?.code === "ETIMEDOUT";
      
      if (isDatabaseError) {
        res.status(500).json({ 
          error: "Database connection failed",
          message: "Unable to connect to the database. Please check your DATABASE_URL environment variable.",
          details: process.env.NODE_ENV === "development" ? errorMessage : undefined
        });
      } else {
        res.status(500).json({ 
          error: "Authentication failed",
          message: errorMessage,
          details: process.env.NODE_ENV === "development" ? error?.stack : undefined
        });
      }
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
      merchant: merchant ? { 
        id: merchant.id, 
        name: merchant.name, 
        apiKey: merchant.apiKey,
        walletAddress: merchant.walletAddress 
      } : null,
    });
  });

  app.get("/api/merchants", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.status(404).json({ error: "No merchant found" });
    }

    const merchant = await storage.getMerchant(req.session.merchantId);
    res.json(merchant);
  });

  // Get merchant by wallet address (public endpoint for QR payments)
  app.get("/api/merchants/wallet/:walletAddress", async (req, res) => {
    try {
      const walletAddress = req.params.walletAddress.toLowerCase();
      const merchant = await storage.getMerchantByWalletAddress(walletAddress);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      res.json(merchant);
    } catch (error) {
      console.error("Get merchant by wallet error:", error);
      res.status(500).json({ error: "Failed to get merchant" });
    }
  });

  // Merchant Profile endpoints
  app.get("/api/merchant/profile", requireAuth, async (req, res) => {
    if (!req.session.merchantId) {
      return res.status(404).json({ error: "No merchant found" });
    }

    const merchant = await storage.getMerchant(req.session.merchantId);
    if (!merchant || !merchant.walletAddress) {
      return res.status(404).json({ error: "Merchant wallet address not found" });
    }

    const profile = await storage.getMerchantProfile(merchant.walletAddress);
    res.json(profile || null);
  });

  const merchantProfileSchema = z.object({
    businessName: z.string().min(2, "Business name must be at least 2 characters").max(50, "Business name must be at most 50 characters").optional(),
    logoUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
    defaultGasSponsorship: z.coerce.boolean().optional(),
  });

  app.post("/api/merchant/profile", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const result = merchantProfileSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      const { businessName, logoUrl, defaultGasSponsorship } = result.data;
      
      const existingProfile = await storage.getMerchantProfile(merchant.walletAddress);
      
      // If businessName is provided and different from existing, don't allow direct change
      if (businessName && existingProfile?.businessName && businessName !== existingProfile.businessName) {
        return res.status(400).json({ 
          error: "Business name cannot be changed directly. Please submit a change request." 
        });
      }
      
      // Use existing values if not provided
      const finalBusinessName = businessName || existingProfile?.businessName;
      const finalLogoUrl = logoUrl !== undefined ? (logoUrl || null) : existingProfile?.logoUrl || null;
      
      // If no profile exists and no businessName provided, require it
      if (!existingProfile && !finalBusinessName) {
        return res.status(400).json({ 
          error: "Business name is required when creating a new profile." 
        });
      }
      
      const profile = await storage.upsertMerchantProfile({
        walletAddress: merchant.walletAddress,
        businessName: finalBusinessName!,
        logoUrl: finalLogoUrl,
        defaultGasSponsorship: defaultGasSponsorship !== undefined ? defaultGasSponsorship : existingProfile?.defaultGasSponsorship ?? false,
      });

      // Check if merchant is now eligible for badge (profile completed)
      const { isMerchantEligibleForBadge } = await import("./services/badgeService.js");
      const { isMerchantVerified } = await import("./services/badgeService.js");
      const eligible = await isMerchantEligibleForBadge(merchant.id);
      const verified = await isMerchantVerified(merchant.id);

      res.json({
        ...profile,
        badgeEligible: eligible && !verified, // Eligible but not yet verified
      });
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  // Request business name change
  app.post("/api/merchant/profile/request-name-change", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const { requestedName, reason } = req.body;
      if (!requestedName || typeof requestedName !== "string" || requestedName.trim().length < 2) {
        return res.status(400).json({ error: "Valid business name is required" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const profile = await storage.getMerchantProfile(merchant.walletAddress);
      if (!profile || !profile.businessName) {
        return res.status(400).json({ error: "No existing business name to change" });
      }

      // Check if there's already a pending request
      const existingRequests = await storage.getBusinessNameChangeRequests(req.session.merchantId);
      const pendingRequest = existingRequests.find(r => r.status === "pending");
      if (pendingRequest) {
        return res.status(400).json({ error: "You already have a pending change request" });
      }

      const changeRequest = await storage.createBusinessNameChangeRequest({
        merchantId: req.session.merchantId,
        currentName: profile.businessName,
        requestedName: requestedName.trim(),
        reason: reason || null,
        status: "pending",
      });

      res.json(changeRequest);
    } catch (error) {
      console.error("Create change request error:", error);
      res.status(500).json({ error: "Failed to create change request" });
    }
  });

  // Public merchant profile endpoint - no auth required
  app.get("/api/merchant/public/:wallet", rateLimit, async (req, res) => {
    try {
      const walletAddress = req.params.wallet;
      
      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        return res.status(400).json({ error: "Invalid wallet address format" });
      }

      const normalizedWallet = walletAddress.toLowerCase();

      // Get merchant profile
      const profile = await storage.getMerchantProfile(normalizedWallet);
      if (!profile) {
        return res.status(404).json({ error: "Merchant profile not found" });
      }

      // Get merchant by wallet address
      const merchant = await storage.getMerchantByWalletAddress(normalizedWallet);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      // Get all payments for stats calculation
      const allPayments = await storage.getPayments(merchant.id);
      const confirmedPayments = allPayments.filter((p) => p.status === "confirmed");

      // Calculate stats
      const totalVolume = confirmedPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const totalTransactions = confirmedPayments.length;

      // Get active payment links (payments with status created/pending, not expired)
      const now = new Date();
      const activePaymentLinks = allPayments
        .filter((p) => {
          if (p.status !== "created" && p.status !== "pending") return false;
          if (p.expiresAt && new Date(p.expiresAt) < now) return false;
          return true;
        })
        .slice(0, 50) // Limit to 50 most recent
        .map((p) => ({
          id: p.id,
          title: p.description || `Payment ${p.id.slice(0, 8)}`,
          amount: p.amount,
          currency: p.currency,
          url: `/pay/${p.id}`,
        }));

      // Check verification status
      const { isMerchantVerified } = await import("./services/badgeService.js");
      const verified = await isMerchantVerified(merchant.id);

      // Return public data only
      res.json({
        wallet: normalizedWallet,
        business_name: profile.businessName,
        logo_url: profile.logoUrl || null,
        verified,
        created_at: profile.createdAt.toISOString(),
        stats: {
          total_volume: totalVolume.toFixed(2),
          total_transactions: totalTransactions,
        },
        payment_links: activePaymentLinks,
      });
    } catch (error) {
      console.error("Public merchant profile error:", error);
      res.status(500).json({ error: "Failed to fetch merchant profile" });
    }
  });

  // Business Activation Routes
  app.get("/api/business/activation-status", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      const profile = await storage.getMerchantProfile(merchant.walletAddress);
      const walletAddresses = await storage.getBusinessWalletAddresses(merchant.walletAddress);

      const isActivated = !!(
        profile?.activatedAt &&
        profile?.country &&
        profile?.businessType &&
        walletAddresses.length > 0 &&
        walletAddresses.length <= 3
      );

      res.json({
        activated: isActivated,
        activatedAt: profile?.activatedAt || null,
        country: profile?.country || null,
        businessType: profile?.businessType || null,
        walletAddressesCount: walletAddresses.length,
        hasRequiredFields: !!(profile?.country && profile?.businessType),
        hasWalletAddresses: walletAddresses.length > 0,
      });
    } catch (error) {
      console.error("Get activation status error:", error);
      res.status(500).json({ error: "Failed to get activation status" });
    }
  });

  const activateBusinessSchema = z.object({
    country: z.string().min(1, "Country is required"),
    businessType: z.enum(["unregistered", "registered", "nonprofit"], {
      errorMap: () => ({ message: "Business type must be unregistered, registered, or nonprofit" }),
    }),
  });

  app.post("/api/business/activate", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const result = activateBusinessSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      // Get existing profile or create new one
      const existingProfile = await storage.getMerchantProfile(merchant.walletAddress);
      
      // Check if wallet addresses exist
      const walletAddresses = await storage.getBusinessWalletAddresses(merchant.walletAddress);
      if (walletAddresses.length === 0) {
        return res.status(400).json({ error: "Please add at least one wallet address before activating" });
      }

      const profile = await storage.upsertMerchantProfile({
        walletAddress: merchant.walletAddress,
        businessName: existingProfile?.businessName || `${merchant.name}`,
        logoUrl: existingProfile?.logoUrl || null,
        country: result.data.country,
        businessType: result.data.businessType,
        activatedAt: new Date(),
      });

      res.json({
        ...profile,
        activated: true,
      });
    } catch (error) {
      console.error("Activate business error:", error);
      res.status(500).json({ error: "Failed to activate business" });
    }
  });

  // Get wallet addresses
  app.get("/api/business/wallet-addresses", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      const walletAddresses = await storage.getBusinessWalletAddresses(merchant.walletAddress);
      res.json(walletAddresses);
    } catch (error) {
      console.error("Get wallet addresses error:", error);
      res.status(500).json({ error: "Failed to get wallet addresses" });
    }
  });

  // Add wallet address
  const addWalletAddressSchema = z.object({
    paymentWalletAddress: z.string().refine((val) => /^0x[a-fA-F0-9]{40}$/.test(val), {
      message: "Invalid wallet address format",
    }),
  });

  app.post("/api/business/wallet-addresses", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const result = addWalletAddressSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      const walletAddress = await storage.createBusinessWalletAddress({
        walletAddress: merchant.walletAddress,
        paymentWalletAddress: result.data.paymentWalletAddress,
      });

      res.json(walletAddress);
    } catch (error) {
      console.error("Add wallet address error:", error);
      const message = error instanceof Error ? error.message : "Failed to add wallet address";
      res.status(400).json({ error: message });
    }
  });

  // Delete wallet address
  app.delete("/api/business/wallet-addresses/:id", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      const deleted = await storage.deleteBusinessWalletAddress(req.params.id, merchant.walletAddress);
      if (!deleted) {
        return res.status(404).json({ error: "Wallet address not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Delete wallet address error:", error);
      res.status(500).json({ error: "Failed to delete wallet address" });
    }
  });

  // Set wallet address as primary payment wallet
  app.post("/api/business/wallet-addresses/:id/set-primary", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant || !merchant.walletAddress) {
        return res.status(404).json({ error: "Merchant wallet address not found" });
      }

      // Get the wallet address to set as primary
      const walletAddresses = await storage.getBusinessWalletAddresses(merchant.walletAddress);
      const walletToSet = walletAddresses.find((w) => w.id === req.params.id);
      
      if (!walletToSet) {
        return res.status(404).json({ error: "Wallet address not found" });
      }

      // Update merchant's walletAddress to the selected payment wallet address
      const updated = await storage.updateMerchant(merchant.id, {
        walletAddress: walletToSet.paymentWalletAddress.toLowerCase(),
      });

      if (!updated) {
        return res.status(500).json({ error: "Failed to update merchant wallet address" });
      }

      res.json({ success: true, walletAddress: updated.walletAddress });
    } catch (error) {
      console.error("Set primary wallet address error:", error);
      res.status(500).json({ error: "Failed to set primary wallet address" });
    }
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

      const { 
        amount, 
        currency, 
        settlementCurrency, 
        paymentAsset, 
        paymentChainId, 
        conversionPath, 
        estimatedFees,
        description, 
        customerEmail, 
        expiresInMinutes, 
        isTest,
        gasSponsored
      } = result.data;

      // Get merchant to retrieve wallet address
      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      if (!merchant.walletAddress) {
        return res.status(400).json({ error: "Merchant wallet address not set. Please configure your wallet address in settings." });
      }

      // Check merchant verification (must own Verified Merchant Badge)
      const { isMerchantVerified } = await import("./services/badgeService.js");
      const isVerified = await isMerchantVerified(req.session.merchantId);
      if (!isVerified) {
        return res.status(403).json({ 
          error: "Verification Required",
          message: "You must own a Verified Merchant Badge to create payments. Please claim your badge first."
        });
      }

      // Use payment service to create payment
      // Explicitly handle isTest: if undefined, default to true (test mode), otherwise use the provided value
      const { createPayment } = await import("./services/paymentService.js");
      const payment = await createPayment({
        merchantId: req.session.merchantId,
        amount,
        currency,
        settlementCurrency: settlementCurrency || "USDC",
        paymentAsset,
        paymentChainId,
        conversionPath,
        estimatedFees,
        description,
        customerEmail,
        merchantWallet: merchant.walletAddress,
        expiresInMinutes,
        isTest: isTest !== undefined ? isTest : true, // Default to test mode only if not provided
        gasSponsored: gasSponsored || false,
      });

      res.json(payment);
    } catch (error) {
      console.error("Create payment error:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Generate QR code for payment
  app.get("/api/payments/:id/qr", rateLimit, async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await storage.getPayment(id);
      
      if (!payment) {
        return res.status(404).json({ error: "Payment not found" });
      }

      // Get base URL from environment or request
      const baseUrl = process.env.BASE_URL || 
        (req.headers.origin ? new URL(req.headers.origin).origin : 'https://pay.arcpaykit.com');

      const { generatePaymentQRCodes } = await import("./services/qrService.js");
      const qrCodes = await generatePaymentQRCodes(payment.id, baseUrl);

      res.json({
        paymentId: payment.id,
        deepLink: `arcpay://pay?invoiceId=${payment.id}`,
        checkoutUrl: `${baseUrl}/checkout/${payment.id}`,
        qrCodeDeepLink: qrCodes.deepLink,
        qrCodeFallback: qrCodes.fallback,
      });
    } catch (error) {
      console.error("Generate QR code error:", error);
      res.status(500).json({ error: "Failed to generate QR code" });
    }
  });

  // Get supported payment assets
  app.get("/api/payments/supported-assets", rateLimit, async (req, res) => {
    try {
      const { settlementCurrency, isTestnet } = req.query;

      if (!settlementCurrency) {
        return res.status(400).json({ error: "settlementCurrency is required" });
      }

      if (settlementCurrency !== "USDC" && settlementCurrency !== "EURC") {
        return res.status(400).json({ error: "Settlement currency must be USDC or EURC" });
      }

      const { getSupportedPaymentAssets } = await import("./services/bridgeService.js");
      const isTest = isTestnet === "true" || isTestnet === true;

      const supportedAssets = getSupportedPaymentAssets(
        settlementCurrency as "USDC" | "EURC",
        isTest
      );

      res.json(supportedAssets);
    } catch (error) {
      console.error("Get supported assets error:", error);
      res.status(500).json({ error: "Failed to get supported assets" });
    }
  });

  // Get conversion estimate
  app.get("/api/payments/conversion-estimate", rateLimit, async (req, res) => {
    try {
      const { paymentAsset, settlementCurrency, amount, isTestnet } = req.query;

      if (!paymentAsset || !settlementCurrency || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      if (settlementCurrency !== "USDC" && settlementCurrency !== "EURC") {
        return res.status(400).json({ error: "Settlement currency must be USDC or EURC" });
      }

      const { estimateConversion, getSupportedPaymentAssets } = await import("./services/bridgeService.js");
      const isTest = isTestnet === "true" || isTestnet === true;

      const estimate = estimateConversion(
        paymentAsset as string,
        settlementCurrency as "USDC" | "EURC",
        amount as string,
        isTest
      );

      // Get supported assets to determine steps
      const supportedAssets = getSupportedPaymentAssets(
        settlementCurrency as "USDC" | "EURC",
        isTest
      );
      const selectedAsset = supportedAssets.find(a => a.asset === paymentAsset);

      const steps: string[] = [];
      if (selectedAsset?.requiresSwap) {
        steps.push(`Swap to ${settlementCurrency} on source chain`);
      }
      if (selectedAsset?.requiresBridge) {
        steps.push("Bridge via Circle CCTP");
      }
      steps.push(`Settle ${settlementCurrency} on Arc Network`);

      res.json({
        ...estimate,
        steps,
      });
    } catch (error) {
      console.error("Conversion estimate error:", error);
      res.status(500).json({ error: "Failed to estimate conversion" });
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
    
    // Also get confirmed payments without invoices and create invoices for them
    const payments = await storage.getPayments(req.session.merchantId);
    const confirmedPayments = payments.filter(
      (p) => p.status === "confirmed" && p.customerEmail
    );
    
    // Create invoices for payments that don't have invoices yet
    for (const payment of confirmedPayments) {
      const hasInvoice = invoices.some((inv) => inv.paymentId === payment.id);
      if (!hasInvoice) {
        try {
          const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}-${payment.id.slice(0, 8).toUpperCase()}`;
          const invoice = await storage.createInvoice({
            merchantId: payment.merchantId,
            paymentId: payment.id,
            invoiceNumber,
            amount: payment.amount,
            currency: payment.currency,
            customerEmail: payment.customerEmail,
            customerName: null,
            description: payment.description || `Payment for ${payment.amount} ${payment.currency}`,
            status: "paid",
          });
          invoices.push(invoice);
        } catch (error) {
          console.error("Failed to create invoice from payment:", error);
        }
      }
    }
    
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

      // Dispatch invoice.paid webhook
      if (updatedInvoice) {
        const { dispatchWebhook } = await import("./services/webhookService.js");
        dispatchWebhook(invoice.merchantId, "invoice.paid", {
          type: "invoice.paid",
          data: {
            id: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoiceNumber,
            amount: updatedInvoice.amount,
            currency: updatedInvoice.currency,
            status: "paid",
            customerEmail: updatedInvoice.customerEmail,
            customerName: updatedInvoice.customerName,
            paymentId: updatedInvoice.paymentId,
          },
        }).catch(console.error);
      }

      res.json(updatedInvoice);
    } catch (error) {
      console.error("Mark invoice paid error:", error);
      res.status(500).json({ error: "Failed to mark invoice as paid" });
    }
  });

  // Webhook subscriptions (session-based for admin portal)
  app.get("/api/webhooks/subscriptions", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.json([]);
      }

      const subscriptions = await storage.getWebhookSubscriptions(req.session.merchantId);
      res.json(
        subscriptions.map((sub) => ({
          id: sub.id,
          url: sub.url,
          events: sub.events,
          active: sub.active,
          createdAt: sub.createdAt,
          // Don't return secret for security
        }))
      );
    } catch (error) {
      console.error("Get webhook subscriptions error:", error);
      res.status(500).json({ error: "Failed to get webhook subscriptions" });
    }
  });

  app.post("/api/webhooks/subscriptions", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { url, events } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ error: "At least one event type is required" });
      }

      try {
        new URL(url);
      } catch {
        return res.status(400).json({ error: "Invalid URL" });
      }

      const subscription = await storage.createWebhookSubscription({
        merchantId: req.session.merchantId,
        url,
        events,
        secret: generateWebhookSecret(),
        active: true,
      });

      res.json({
        id: subscription.id,
        url: subscription.url,
        events: subscription.events,
        active: subscription.active,
        createdAt: subscription.createdAt,
        secret: subscription.secret, // Return secret only on creation
      });
    } catch (error) {
      console.error("Create webhook subscription error:", error);
      res.status(500).json({ error: "Failed to create webhook subscription" });
    }
  });

  app.delete("/api/webhooks/subscriptions/:id", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription || subscription.merchantId !== req.session.merchantId) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }

      await storage.deleteWebhookSubscription(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete webhook subscription error:", error);
      res.status(500).json({ error: "Failed to delete webhook subscription" });
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

      // Get all confirmed payments for this merchant
      const allPayments = await storage.getPayments(req.session.merchantId);
      const confirmedPayments = allPayments.filter((p) => p.status === "confirmed");

      // Group by currency and calculate totals
      const balanceByCurrency: Record<string, number> = {};
      for (const payment of confirmedPayments) {
        const currency = payment.currency || "USDC";
        const amount = parseFloat(payment.amount);
        balanceByCurrency[currency] = (balanceByCurrency[currency] || 0) + amount;
      }

      // Update or create treasury balances
      const updatedBalances = [];
      for (const [currency, totalAmount] of Object.entries(balanceByCurrency)) {
        let treasuryBalance = await storage.getTreasuryBalance(req.session.merchantId, currency);
        
        if (treasuryBalance) {
          await storage.updateTreasuryBalance(treasuryBalance.id, {
            balance: totalAmount.toString(),
          });
          treasuryBalance = await storage.getTreasuryBalance(req.session.merchantId, currency);
        } else {
          treasuryBalance = await storage.createTreasuryBalance({
            merchantId: req.session.merchantId,
            currency,
            balance: totalAmount.toString(),
          });
        }
        
        if (treasuryBalance) {
          updatedBalances.push(treasuryBalance);
        }
      }

      // Also handle currencies that might have balances but no recent payments
      const existingBalances = await storage.getTreasuryBalances(req.session.merchantId);
      for (const balance of existingBalances) {
        if (!balanceByCurrency[balance.currency]) {
          // Keep existing balance if no payments for this currency
          updatedBalances.push(balance);
        }
      }

      res.json({ success: true, balances: updatedBalances });
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
  registerBadgeRoutes(app);
  registerProofRoutes(app);
  registerQRCodeRoutes(app);
  registerApiKeyRoutes(app);
  registerBridgeRoutes(app);

  // Start background payment checker (legacy)
  startPaymentChecker();
  
  // Start transaction watcher (enhanced polling with exponential backoff)
  startTxWatcher();

  // Get current gas price (Gwei) from ArcScan API
  app.get("/api/gas-price", rateLimit, async (req, res) => {
    try {
      const arcApiKey = process.env.ARC_API;
      const arcExplorerUrl = process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.app";
      
      if (!arcApiKey) {
        // Fallback: try to get from RPC
        try {
          const rpcUrl = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
          const response = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_gasPrice",
              params: [],
              id: 1,
            }),
          });
          
          const data = await response.json();
          if (data.result) {
            // Convert from Wei to Gwei (1 Gwei = 10^9 Wei)
            const gasPriceWei = BigInt(data.result);
            const gasPriceGwei = Number(gasPriceWei) / 1e9;
            return res.json({ gasPrice: gasPriceGwei.toFixed(2), unit: "Gwei" });
          }
        } catch (rpcError) {
          console.error("RPC gas price fetch error:", rpcError);
        }
        
        return res.status(503).json({ error: "Gas price service unavailable" });
      }

      // Try ArcScan API first
      try {
        const apiUrl = `${arcExplorerUrl}/api?module=proxy&action=eth_gasPrice&apikey=${arcApiKey}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.status === "1" && data.result) {
          // Convert from Wei to Gwei
          const gasPriceWei = BigInt(data.result);
          const gasPriceGwei = Number(gasPriceWei) / 1e9;
          return res.json({ gasPrice: gasPriceGwei.toFixed(2), unit: "Gwei" });
        }
      } catch (apiError) {
        console.error("ArcScan API gas price fetch error:", apiError);
      }

      // Fallback to RPC
      const rpcUrl = process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network";
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_gasPrice",
          params: [],
          id: 1,
        }),
      });
      
      const data = await response.json();
      if (data.result) {
        const gasPriceWei = BigInt(data.result);
        const gasPriceGwei = Number(gasPriceWei) / 1e9;
        return res.json({ gasPrice: gasPriceGwei.toFixed(2), unit: "Gwei" });
      }
      
      res.status(503).json({ error: "Failed to fetch gas price" });
    } catch (error) {
      console.error("Gas price fetch error:", error);
      res.status(500).json({ error: "Failed to fetch gas price" });
    }
  });

  // Notification endpoints
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.json([]);
      }

      const notifications = await storage.getNotifications(req.session.merchantId);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.json({ count: 0 });
      }

      const count = await storage.getUnreadNotificationsCount(req.session.merchantId);
      res.json({ count });
    } catch (error) {
      console.error("Get unread notifications count error:", error);
      res.status(500).json({ error: "Failed to get unread notifications count" });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      const notification = await storage.markNotificationAsRead(req.params.id, req.session.merchantId);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      res.json(notification);
    } catch (error) {
      console.error("Mark notification as read error:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/mark-all-read", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      await storage.markAllNotificationsAsRead(req.session.merchantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  app.delete("/api/notifications/clear", requireAuth, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(400).json({ error: "No merchant associated with account" });
      }

      await storage.clearAllNotifications(req.session.merchantId);
      res.json({ success: true });
    } catch (error) {
      console.error("Clear notifications error:", error);
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  return httpServer;
}
