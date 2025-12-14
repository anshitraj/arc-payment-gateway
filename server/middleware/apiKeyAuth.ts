/**
 * API Key Authentication Middleware
 * Validates API key from Authorization header or query parameter
 */

import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { merchants } from "@shared/schema";
import { eq } from "drizzle-orm";
import { db } from "../db";

declare module "express-serve-static-core" {
  interface Request {
    merchant?: typeof merchants.$inferSelect;
  }
}

/**
 * Extract API key from request
 */
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
  if (apiKeyHeader && typeof apiKeyHeader === "string") {
    return apiKeyHeader;
  }

  return null;
}

/**
 * API Key authentication middleware
 */
export async function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = extractApiKey(req);

  if (!apiKey) {
    return res.status(401).json({
      error: "API key required",
      message: "Provide API key via Authorization header, x-api-key header, or apiKey query parameter",
    });
  }

  try {
    // Get merchant by API key
    const merchant = await storage.getMerchantByApiKey(apiKey);

    if (!merchant) {
      return res.status(401).json({
        error: "Invalid API key",
      });
    }

    // Attach merchant to request
    req.merchant = merchant;
    next();
  } catch (error) {
    console.error("API key authentication error:", error);
    return res.status(500).json({
      error: "Authentication failed",
    });
  }
}

/**
 * Optional API key - attaches merchant if key is valid, but doesn't require it
 */
export async function optionalApiKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    try {
      const merchant = await storage.getMerchantByApiKey(apiKey);
      if (merchant) {
        req.merchant = merchant;
      }
    } catch (error) {
      console.error("Optional API key check error:", error);
    }
  }

  next();
}

