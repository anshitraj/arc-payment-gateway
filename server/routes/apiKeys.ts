/**
 * API Keys Routes
 * Handles API key management for developers
 */

import { Express, Request, Response } from "express";
import { storage } from "../storage.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireApiKey } from "../middleware/apiKeyAuth.js";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { apiKeys as apiKeysTable } from "../../shared/schema.js";
import { db } from "../db.js";

function requireAuth(req: Request, res: Response, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

const regenerateKeySchema = z.object({
  keyType: z.enum(["publishable", "secret"]),
  mode: z.enum(["test", "live"]),
});

const createKeySchema = z.object({
  mode: z.enum(["test", "live"]).optional(),
  name: z.string().optional(),
});

const updateKeyNameSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").max(100, "Name is too long"),
});

/**
 * Generate API key with prefix
 */
function generateApiKey(prefix: string): string {
  const randomPart = randomBytes(24).toString("hex");
  return `${prefix}${randomPart}`;
}

/**
 * Get wallet address for merchant, using merchant ID as fallback if wallet address is not set
 */
function getMerchantWalletAddress(merchant: { id: string; walletAddress: string | null }): string {
  if (merchant.walletAddress) {
    return merchant.walletAddress.toLowerCase();
  }
  // Use merchant ID as fallback - create deterministic wallet-like address
  // Hash the merchant ID to get a consistent 40-character hex string
  const hash = createHash('sha256').update(merchant.id).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

/**
 * Hash API key for storage
 */
function hashApiKey(key: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(key, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify API key against hash
 */
function verifyApiKey(key: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const hashBuffer = Buffer.from(hash, "hex");
  const testHash = scryptSync(key, salt, 64);
  return timingSafeEqual(hashBuffer, testHash);
}

export function registerApiKeyRoutes(app: Express) {
  // Create API keys for merchant (for current mode)
  app.post("/api/developers/api-keys/create", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const result = createKeySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const { mode, name } = result.data;
      const targetMode = mode === "test" ? "test" : "live";

      const walletAddress = getMerchantWalletAddress(merchant);
      
      // Validate wallet address
      if (!walletAddress || walletAddress.trim() === "") {
        return res.status(400).json({ error: "Invalid wallet address" });
      }
      
      // Query database directly to count all active keys (non-revoked, non-deleted)
      // Deleted keys are removed from DB, so they won't appear in this query
      const allActiveKeys = await db
        .select()
        .from(apiKeysTable)
        .where(
          and(
            eq(apiKeysTable.walletAddress, walletAddress.toLowerCase()),
            isNull(apiKeysTable.revokedAt)
          )
        );
      
      // Enforce limit of 4 keys total (2 pairs: 1 test pair + 1 live pair)
      // Each pair = 1 publishable + 1 secret = 2 keys
      if (allActiveKeys.length >= 4) {
        return res.status(400).json({ error: "Maximum limit of 4 API keys (2 pairs) reached. Please delete an existing key before creating a new one." });
      }
      
      // Use the queried keys for further checks
      let merchantKeys = allActiveKeys;
      
      // Check if keys already exist for this mode
      const hasPublishable = merchantKeys.some(k => k.keyType === "publishable" && k.mode === targetMode);
      const hasSecret = merchantKeys.some(k => k.keyType === "secret" && k.mode === targetMode);

      if (hasPublishable && hasSecret) {
        return res.status(400).json({ error: `API keys already exist for ${targetMode} mode` });
      }

      const newKeys: any[] = [];
      
      if (!hasPublishable) {
        try {
          const prefix = `pk_arc_${targetMode}_`;
          const key = generateApiKey(prefix);
          const newKey = await storage.createApiKey({
            walletAddress: walletAddress,
            keyType: "publishable",
            mode: targetMode,
            keyPrefix: key,
            hashedKey: "PUBLISHABLE_KEY_NO_HASH", // Placeholder for publishable keys (not hashed, stored in keyPrefix)
            name: name || undefined,
          });
          newKeys.push(newKey);
        } catch (error: any) {
          console.error("Failed to create publishable key:", error);
          throw new Error(`Failed to create publishable key: ${error?.message || error}`);
        }
      }
      
      if (!hasSecret) {
        try {
          const prefix = `sk_arc_${targetMode}_`;
          const key = generateApiKey(prefix);
          const hashedKey = hashApiKey(key);
          const newKey = await storage.createApiKey({
            walletAddress: walletAddress,
            keyType: "secret",
            mode: targetMode,
            keyPrefix: key,
            hashedKey,
            name: name || undefined,
          });
          newKeys.push(newKey);
        } catch (error: any) {
          console.error("Failed to create secret key:", error);
          throw new Error(`Failed to create secret key: ${error?.message || error}`);
        }
      }

      // Refresh keys list
      const updatedKeys = await storage.getApiKeys(walletAddress);
      
      res.json({ 
        message: "API keys created successfully",
        keys: updatedKeys.filter(k => k.mode === targetMode)
      });
    } catch (error: any) {
      console.error("Create API keys error:", error);
      const errorMessage = error?.message || error?.toString() || "Unknown error";
      const errorDetails = error?.code || error?.constraint || "";
      console.error("Error details:", { errorMessage, errorDetails, error });
      res.status(500).json({ 
        error: "Failed to create API keys",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  });

  // Get all API keys for merchant
  app.get("/api/developers/api-keys", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const walletAddress = getMerchantWalletAddress(merchant);
      const merchantApiKeys = await storage.getApiKeys(walletAddress);
      
      // Return only existing keys - don't auto-create deleted keys
      res.json(merchantApiKeys);
    } catch (error) {
      console.error("Get API keys error:", error);
      res.status(500).json({ error: "Failed to get API keys" });
    }
  });

  // Reveal secret key (requires confirmation)
  app.post("/api/developers/api-keys/:id/reveal", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const walletAddress = getMerchantWalletAddress(merchant);
      const apiKey = await storage.getApiKey(req.params.id);
      if (!apiKey) {
        return res.status(404).json({ error: "API key not found" });
      }

      if (apiKey.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (apiKey.keyType !== "secret") {
        return res.status(400).json({ error: "Only secret keys can be revealed" });
      }

      // Get full key from storage (we need to store it temporarily or reconstruct)
      // For now, return the key prefix (in production, you'd decrypt or retrieve from secure storage)
      const fullKey = await storage.getApiKeyFullValue(req.params.id);
      
      res.json({ fullKey });
    } catch (error) {
      console.error("Reveal API key error:", error);
      res.status(500).json({ error: "Failed to reveal API key" });
    }
  });

  // Regenerate API key
  app.post("/api/developers/api-keys/:id/regenerate", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const result = regenerateKeySchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const walletAddress = getMerchantWalletAddress(merchant);
      const existingKey = await storage.getApiKey(req.params.id);
      if (!existingKey) {
        return res.status(404).json({ error: "API key not found" });
      }

      if (existingKey.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Revoke old key
      await storage.revokeApiKey(req.params.id);

      // Generate new key
      const prefix = result.data.keyType === "publishable" 
        ? `pk_arc_${result.data.mode}_` 
        : `sk_arc_${result.data.mode}_`;
      const newKey = generateApiKey(prefix);
      const hashedKey = result.data.keyType === "secret" ? hashApiKey(newKey) : "PUBLISHABLE_KEY_NO_HASH";

      // Store full key temporarily for retrieval (in production, use secure vault)
      // For MVP, we'll store it in the keyPrefix for now (not secure, but functional)
      // Better: Create a secure_keys table with encryption
      const fullKeyPrefix = newKey; // Store full key in prefix for MVP
      
      const newApiKey = await storage.createApiKey({
        walletAddress: walletAddress,
        keyType: result.data.keyType,
        mode: result.data.mode,
        keyPrefix: fullKeyPrefix, // Store full key here for MVP
        hashedKey,
        name: existingKey.name || undefined, // Preserve name when regenerating
      });

      // Log regeneration event
      await storage.logApiKeyEvent({
        apiKeyId: newApiKey.id,
        eventType: "regenerated",
        metadata: { oldKeyId: req.params.id },
      });

      res.json({ 
        id: newApiKey.id,
        fullKey: newKey, // Return full key only on regeneration
        keyType: newApiKey.keyType,
        mode: newApiKey.mode,
      });
    } catch (error) {
      console.error("Regenerate API key error:", error);
      res.status(500).json({ error: "Failed to regenerate API key" });
    }
  });

  // Delete API key
  app.delete("/api/developers/api-keys/:id", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const walletAddress = getMerchantWalletAddress(merchant);
      const existingKey = await storage.getApiKey(req.params.id);
      if (!existingKey) {
        return res.status(404).json({ error: "API key not found" });
      }

      if (existingKey.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Find and delete the related key (publishable/secret pair)
      // Keys are created as pairs, so delete both together
      // Query all keys including revoked ones to find the pair
      const allKeysForWallet = await db
        .select()
        .from(apiKeysTable)
        .where(eq(apiKeysTable.walletAddress, walletAddress.toLowerCase()));
      
      const relatedKey = allKeysForWallet.find(
        (k) =>
          k.id !== existingKey.id &&
          k.mode === existingKey.mode &&
          ((existingKey.keyType === "publishable" && k.keyType === "secret") ||
            (existingKey.keyType === "secret" && k.keyType === "publishable"))
      );

      // Delete the requested key
      await storage.deleteApiKey(req.params.id);

      // Delete the related key if it exists
      if (relatedKey) {
        await storage.deleteApiKey(relatedKey.id);
      }

      // Verify deletion by checking remaining keys count
      const remainingKeys = await db
        .select()
        .from(apiKeysTable)
        .where(
          and(
            eq(apiKeysTable.walletAddress, walletAddress.toLowerCase()),
            isNull(apiKeysTable.revokedAt)
          )
        );
      
      console.log(`Deleted API key ${req.params.id}${relatedKey ? ` and related key ${relatedKey.id}` : ''}. Remaining active keys: ${remainingKeys.length}`);

      // Log deletion event
      await storage.logApiKeyEvent({
        apiKeyId: req.params.id,
        eventType: "deleted",
        metadata: { 
          keyType: existingKey.keyType, 
          mode: existingKey.mode,
          deletedPair: !!relatedKey,
          relatedKeyId: relatedKey?.id,
          remainingKeysCount: remainingKeys.length
        },
      });

      res.json({ 
        message: relatedKey 
          ? "API key pair deleted successfully" 
          : "API key deleted successfully",
        remainingKeysCount: remainingKeys.length
      });
    } catch (error) {
      console.error("Delete API key error:", error);
      res.status(500).json({ error: "Failed to delete API key" });
    }
  });

  // Update API key name
  app.put("/api/developers/api-keys/:id/name", requireAuth, rateLimit, async (req, res) => {
    try {
      if (!req.session.merchantId) {
        return res.status(401).json({ error: "No merchant found" });
      }

      const result = updateKeyNameSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const merchant = await storage.getMerchant(req.session.merchantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const walletAddress = getMerchantWalletAddress(merchant);
      const existingKey = await storage.getApiKey(req.params.id);
      if (!existingKey) {
        return res.status(404).json({ error: "API key not found" });
      }

      if (existingKey.walletAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Update the name
      await db
        .update(apiKeysTable)
        .set({ name: result.data.name })
        .where(eq(apiKeysTable.id, req.params.id));

      const updatedKey = await storage.getApiKey(req.params.id);

      res.json({ 
        message: "API key name updated successfully",
        key: updatedKey
      });
    } catch (error) {
      console.error("Update API key name error:", error);
      res.status(500).json({ error: "Failed to update API key name" });
    }
  });

  // Test/Verify API key endpoint - allows developers to test if their API key works
  // This endpoint requires API key authentication to verify it works
  app.get("/api/test", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ 
          error: "Invalid API key",
          message: "The provided API key is not valid or has been revoked"
        });
      }

      // Get API key info if available
      const apiKey = extractApiKey(req);
      let apiKeyInfo = null;
      
      if (apiKey && req.merchant.walletAddress) {
        const walletAddress = req.merchant.walletAddress.toLowerCase();
        const keys = await storage.getApiKeys(walletAddress);
        const matchingKey = keys.find(k => k.keyPrefix === apiKey || k.keyPrefix.startsWith(apiKey.substring(0, 20)));
        
        if (matchingKey) {
          apiKeyInfo = {
            keyType: matchingKey.keyType,
            mode: matchingKey.mode,
            name: matchingKey.name,
            lastUsedAt: matchingKey.lastUsedAt,
            createdAt: matchingKey.createdAt,
          };
          
          // Update lastUsedAt
          await db
            .update(apiKeysTable)
            .set({ lastUsedAt: new Date() })
            .where(eq(apiKeysTable.id, matchingKey.id));
        }
      }

      res.json({
        success: true,
        message: "API key is valid and working!",
        merchant: {
          id: req.merchant.id,
          name: req.merchant.name,
          walletAddress: req.merchant.walletAddress,
        },
        apiKey: apiKeyInfo,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Test API key error:", error);
      res.status(500).json({ error: "Failed to verify API key" });
    }
  });
}

// Helper function to extract API key (same as in middleware)
function extractApiKey(req: Request): string | null {
  // Check Authorization header: Bearer <key> or <key>
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    return authHeader;
  }

  // Check query parameter
  if (req.query.apiKey && typeof req.query.apiKey === "string") {
    return req.query.apiKey;
  }

  // Check x-api-key header
  const apiKeyHeader = req.headers["x-api-key"];
  if (apiKeyHeader) {
    return apiKeyHeader;
  }

  return null;
}

