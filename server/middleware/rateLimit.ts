/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter (use Redis in production)
 */

import type { Request, Response, NextFunction } from "express";
import { API_RATE_LIMIT_WINDOW, API_RATE_LIMIT_MAX_REQUESTS } from "../config";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Get rate limit key from request
 */
function getRateLimitKey(req: Request): string {
  // Use API key if available, otherwise use IP
  if (req.merchant?.apiKey) {
    return `api:${req.merchant.apiKey}`;
  }

  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `ip:${ip}`;
}

/**
 * Rate limiting middleware
 */
export function rateLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const key = getRateLimitKey(req);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance to clean up
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetAt < now) {
        rateLimitStore.delete(k);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    // Create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + API_RATE_LIMIT_WINDOW,
    });
    return next();
  }

  if (entry.count >= API_RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: "Rate limit exceeded",
      message: `Maximum ${API_RATE_LIMIT_MAX_REQUESTS} requests per ${API_RATE_LIMIT_WINDOW / 1000} seconds`,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  // Increment count
  entry.count++;
  next();
}

