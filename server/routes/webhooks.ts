/**
 * Webhook Routes
 * Handles webhook subscription management and dispatch
 */

import type { Express } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKeyAuth";
import { rateLimit } from "../middleware/rateLimit";
import { storage } from "../storage";
import { generateWebhookSecret } from "../storage";
import { getWebhookEvents } from "../services/webhookService";

const createWebhookSubscriptionSchema = z.object({
  url: z.string().url("Invalid URL"),
  events: z.array(z.string()).min(1, "At least one event type is required"),
});

const updateWebhookSubscriptionSchema = z.object({
  url: z.string().url("Invalid URL").optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export function registerWebhookRoutes(app: Express) {
  // Create webhook subscription
  app.post("/api/webhooks/subscriptions", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = createWebhookSubscriptionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const subscription = await storage.createWebhookSubscription({
        merchantId: req.merchant.id,
        url: result.data.url,
        events: result.data.events,
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

  // Get webhook subscriptions
  app.get("/api/webhooks/subscriptions", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const subscriptions = await storage.getWebhookSubscriptions(req.merchant.id);

      res.json(
        subscriptions.map((sub) => ({
          id: sub.id,
          url: sub.url,
          events: sub.events,
          active: sub.active,
          createdAt: sub.createdAt,
          // Don't return secret
        }))
      );
    } catch (error) {
      console.error("Get webhook subscriptions error:", error);
      res.status(500).json({ error: "Failed to get webhook subscriptions" });
    }
  });

  // Update webhook subscription
  app.put("/api/webhooks/subscriptions/:id", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const result = updateWebhookSubscriptionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: result.error.errors[0].message });
      }

      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription || subscription.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }

      const updated = await storage.updateWebhookSubscription(req.params.id, result.data);

      res.json({
        id: updated?.id,
        url: updated?.url,
        events: updated?.events,
        active: updated?.active,
      });
    } catch (error) {
      console.error("Update webhook subscription error:", error);
      res.status(500).json({ error: "Failed to update webhook subscription" });
    }
  });

  // Delete webhook subscription
  app.delete("/api/webhooks/subscriptions/:id", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const subscription = await storage.getWebhookSubscription(req.params.id);
      if (!subscription || subscription.merchantId !== req.merchant.id) {
        return res.status(404).json({ error: "Webhook subscription not found" });
      }

      await storage.deleteWebhookSubscription(req.params.id);

      res.json({ success: true });
    } catch (error) {
      console.error("Delete webhook subscription error:", error);
      res.status(500).json({ error: "Failed to delete webhook subscription" });
    }
  });

  // Get webhook events
  app.get("/api/webhooks/events", requireApiKey, rateLimit, async (req, res) => {
    try {
      if (!req.merchant) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const events = await getWebhookEvents(req.merchant.id, limit);

      res.json(events);
    } catch (error) {
      console.error("Get webhook events error:", error);
      res.status(500).json({ error: "Failed to get webhook events" });
    }
  });
}

