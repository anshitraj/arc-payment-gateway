/**
 * Webhook Service
 * Handles webhook delivery with HMAC signatures, retries, and non-blocking dispatch
 */

import { createHmac, timingSafeEqual } from "crypto";
import { db } from "../db";
import { webhookSubscriptions, webhookEvents } from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

/**
 * Generate HMAC signature for webhook payload
 */
export function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expectedSignature = generateWebhookSignature(payload, secret);
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(signature, "hex");

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Dispatch webhook to a single subscription (non-blocking)
 */
async function dispatchToSubscription(
  subscriptionId: string,
  url: string,
  secret: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);

  // Create webhook event record
  const [event] = await db
    .insert(webhookEvents)
    .values({
      endpointId: subscriptionId,
      eventType: eventType as any,
      payload: payloadString,
      status: "pending",
      attempts: 0,
    })
    .returning();

  // Dispatch asynchronously (don't block)
  dispatchWithRetry(event.id, url, payloadString, signature, 0).catch((error) => {
    console.error(`Failed to dispatch webhook ${event.id} after retries:`, error);
  });
}

/**
 * Retry logic for webhook delivery
 */
async function dispatchWithRetry(
  eventId: string,
  url: string,
  payload: string,
  signature: string,
  attempt: number
): Promise<void> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-arc-signature": signature,
        "x-arc-event-type": JSON.parse(payload).type || "unknown",
      },
      body: payload,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const responseBody = await response.text();
    const isSuccess = response.ok && response.status >= 200 && response.status < 300;

    // Update event record
    await db
      .update(webhookEvents)
      .set({
        status: isSuccess ? "delivered" : "failed",
        attempts: attempt + 1,
        lastAttempt: new Date(),
        responseCode: response.status,
        responseBody: responseBody.substring(0, 1000), // Limit response body size
      })
      .where(eq(webhookEvents.id, eventId));

    if (!isSuccess && attempt < MAX_RETRIES - 1) {
      // Retry with exponential backoff
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      setTimeout(() => {
        dispatchWithRetry(eventId, url, payload, signature, attempt + 1).catch(console.error);
      }, delay);
    }
  } catch (error) {
    console.error(`Webhook dispatch attempt ${attempt + 1} failed:`, error);

    // Update event record
    await db
      .update(webhookEvents)
      .set({
        attempts: attempt + 1,
        lastAttempt: new Date(),
        responseCode: 0,
        responseBody: error instanceof Error ? error.message : "Network error",
      })
      .where(eq(webhookEvents.id, eventId));

    // Retry if attempts remaining
    if (attempt < MAX_RETRIES - 1) {
      const delay = RETRY_DELAYS[attempt] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
      setTimeout(() => {
        dispatchWithRetry(eventId, url, payload, signature, attempt + 1).catch(console.error);
      }, delay);
    } else {
      // Mark as failed after max retries
      await db
        .update(webhookEvents)
        .set({
          status: "failed",
        })
        .where(eq(webhookEvents.id, eventId));
    }
  }
}

/**
 * Dispatch webhook event to all active subscriptions for a merchant
 * Non-blocking - returns immediately
 */
export async function dispatchWebhook(
  merchantId: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    // Find all active subscriptions for this merchant that listen to this event
    const subscriptions = await db
      .select()
      .from(webhookSubscriptions)
      .where(
        and(
          eq(webhookSubscriptions.merchantId, merchantId),
          eq(webhookSubscriptions.active, true)
        )
      );

    // Filter subscriptions that listen to this event type
    const relevantSubscriptions = subscriptions.filter((sub) =>
      sub.events.includes(eventType)
    );

    // Dispatch to all relevant subscriptions (non-blocking)
    for (const subscription of relevantSubscriptions) {
      dispatchToSubscription(
        subscription.id,
        subscription.url,
        subscription.secret,
        eventType,
        payload
      ).catch((error) => {
        console.error(`Failed to dispatch to subscription ${subscription.id}:`, error);
      });
    }
  } catch (error) {
    console.error("Error dispatching webhook:", error);
    // Don't throw - webhooks should never block the main flow
  }
}

/**
 * Get webhook events for a merchant
 */
export async function getWebhookEvents(merchantId: string, limit: number = 100) {
  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.merchantId, merchantId));

  const subscriptionIds = subscriptions.map((s) => s.id);

  if (subscriptionIds.length === 0) {
    return [];
  }

  if (subscriptionIds.length === 0) {
    return [];
  }

  const events = await db
    .select()
    .from(webhookEvents)
    .where(inArray(webhookEvents.endpointId, subscriptionIds))
    .orderBy(desc(webhookEvents.createdAt))
    .limit(limit);

  return events;
}

