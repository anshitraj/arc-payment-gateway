import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "./db.js";
import { scryptSync, timingSafeEqual } from "crypto";
import {
  users,
  merchants,
  payments,
  invoices,
  webhookEndpoints,
  webhookEvents,
  treasuryBalances,
  refunds,
  webhookSubscriptions,
  merchantBadges,
  paymentProofs,
  merchantProfiles,
  businessWalletAddresses,
  qrCodes,
  apiKeys,
  businessNameChangeRequests,
  adminUsers,
  adminAuditLogs,
  globalConfig,
  blocklist,
  type User,
  type InsertUser,
  type Merchant,
  type InsertMerchant,
  type Payment,
  type InsertPayment,
  type Invoice,
  type InsertInvoice,
  type WebhookEndpoint,
  type InsertWebhookEndpoint,
  type WebhookEvent,
  type InsertWebhookEvent,
  type TreasuryBalance,
  type InsertTreasuryBalance,
  type Refund,
  type InsertRefund,
  type WebhookSubscription,
  type InsertWebhookSubscription,
  type MerchantBadge,
  type InsertMerchantBadge,
  type PaymentProof,
  type InsertPaymentProof,
  type MerchantProfile,
  type InsertMerchantProfile,
  type BusinessWalletAddress,
  type InsertBusinessWalletAddress,
  type QRCode,
  type InsertQRCode,
  type ApiKey,
  type InsertApiKey,
  type BusinessNameChangeRequest,
  type InsertBusinessNameChangeRequest,
  type AdminUser,
  type InsertAdminUser,
  type AdminAuditLog,
  type InsertAdminAuditLog,
  type GlobalConfig,
  type InsertGlobalConfig,
  type BlocklistEntry,
  type InsertBlocklistEntry,
  type Notification,
  type InsertNotification,
  notifications,
} from "../shared/schema.js";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getMerchant(id: string): Promise<Merchant | undefined>;
  getMerchantByUserId(userId: string): Promise<Merchant | undefined>;
  getMerchantByApiKey(apiKey: string): Promise<Merchant | undefined>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  updateMerchant(id: string, updates: Partial<Merchant>): Promise<Merchant | undefined>;

  getPayments(merchantId: string): Promise<Payment[]>;
  getPayment(id: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined>;

  getInvoices(merchantId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  createInvoice(invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined>;

  getWebhookEndpoints(merchantId: string): Promise<WebhookEndpoint[]>;
  createWebhookEndpoint(endpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint>;

  getWebhookEvents(merchantId: string): Promise<WebhookEvent[]>;
  createWebhookEvent(event: InsertWebhookEvent): Promise<WebhookEvent>;
  updateWebhookEvent(id: string, updates: Partial<WebhookEvent>): Promise<WebhookEvent | undefined>;

  getTreasuryBalances(merchantId: string): Promise<TreasuryBalance[]>;
  getTreasuryBalance(merchantId: string, currency: string): Promise<TreasuryBalance | undefined>;
  createTreasuryBalance(balance: InsertTreasuryBalance): Promise<TreasuryBalance>;
  updateTreasuryBalance(id: string, updates: Partial<TreasuryBalance>): Promise<TreasuryBalance | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getMerchant(id: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.id, id));
    return merchant;
  }

  async getMerchantByUserId(userId: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.userId, userId));
    return merchant;
  }

  async getMerchantByApiKey(apiKey: string): Promise<Merchant | undefined> {
    // First, try the old system (merchants.apiKey)
    const [merchant] = await db.select().from(merchants).where(eq(merchants.apiKey, apiKey));
    if (merchant) {
      return merchant;
    }

    // Then, try the new apiKeys table
    // Check if the key matches any keyPrefix (for publishable keys or MVP where full key is stored)
    const matchingKey = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyPrefix, apiKey),
          isNull(apiKeys.revokedAt)
        )
      )
      .limit(1);

    if (matchingKey.length > 0) {
      const apiKeyRecord = matchingKey[0];
      // Get merchant by wallet address
      return await this.getMerchantByWalletAddress(apiKeyRecord.walletAddress);
    }

    // For secret keys, we need to verify against hashedKey
    // Get all non-revoked secret keys and check them
    const allSecretKeys = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.keyType, "secret"),
          isNull(apiKeys.revokedAt)
        )
      );

    for (const keyRecord of allSecretKeys) {
      if (keyRecord.hashedKey) {
        try {
          const [salt, hash] = keyRecord.hashedKey.split(":");
          const hashBuffer = Buffer.from(hash, "hex");
          const testHash = scryptSync(apiKey, salt, 64);
          if (timingSafeEqual(hashBuffer, testHash)) {
            return await this.getMerchantByWalletAddress(keyRecord.walletAddress);
          }
        } catch (error) {
          // Skip invalid hashes
          continue;
        }
      }
    }

    return undefined;
  }

  async getMerchantByWalletAddress(walletAddress: string): Promise<Merchant | undefined> {
    const [merchant] = await db.select().from(merchants).where(eq(merchants.walletAddress, walletAddress.toLowerCase()));
    return merchant;
  }

  async createMerchant(insertMerchant: InsertMerchant): Promise<Merchant> {
    const [merchant] = await db.insert(merchants).values(insertMerchant).returning();
    return merchant;
  }

  async updateMerchant(id: string, updates: Partial<Merchant>): Promise<Merchant | undefined> {
    const [merchant] = await db.update(merchants).set(updates).where(eq(merchants.id, id)).returning();
    return merchant;
  }

  async getPayments(merchantId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.merchantId, merchantId)).orderBy(desc(payments.createdAt));
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const [payment] = await db.insert(payments).values(insertPayment).returning();
    return payment;
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set({ ...updates, updatedAt: new Date() }).where(eq(payments.id, id)).returning();
    return payment;
  }

  async getInvoices(merchantId: string): Promise<Invoice[]> {
    return await db.select().from(invoices).where(eq(invoices.merchantId, merchantId)).orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async createInvoice(insertInvoice: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(insertInvoice).returning();
    return invoice;
  }

  async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice | undefined> {
    const [invoice] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
    return invoice;
  }

  async getWebhookEndpoints(merchantId: string): Promise<WebhookEndpoint[]> {
    return await db.select().from(webhookEndpoints).where(eq(webhookEndpoints.merchantId, merchantId));
  }

  async createWebhookEndpoint(insertEndpoint: InsertWebhookEndpoint): Promise<WebhookEndpoint> {
    const [endpoint] = await db.insert(webhookEndpoints).values(insertEndpoint).returning();
    return endpoint;
  }

  async getWebhookEvents(merchantId: string): Promise<WebhookEvent[]> {
    const endpoints = await this.getWebhookEndpoints(merchantId);
    if (endpoints.length === 0) return [];
    
    const endpointIds = endpoints.map(e => e.id);
    const allEvents: WebhookEvent[] = [];
    
    for (const endpointId of endpointIds) {
      const events = await db.select().from(webhookEvents).where(eq(webhookEvents.endpointId, endpointId)).orderBy(desc(webhookEvents.createdAt));
      allEvents.push(...events);
    }
    
    return allEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createWebhookEvent(insertEvent: InsertWebhookEvent): Promise<WebhookEvent> {
    const [event] = await db.insert(webhookEvents).values(insertEvent).returning();
    return event;
  }

  async updateWebhookEvent(id: string, updates: Partial<WebhookEvent>): Promise<WebhookEvent | undefined> {
    const [event] = await db.update(webhookEvents).set(updates).where(eq(webhookEvents.id, id)).returning();
    return event;
  }

  async getTreasuryBalances(merchantId: string): Promise<TreasuryBalance[]> {
    return await db.select().from(treasuryBalances).where(eq(treasuryBalances.merchantId, merchantId));
  }

  async getTreasuryBalance(merchantId: string, currency: string): Promise<TreasuryBalance | undefined> {
    const [balance] = await db.select().from(treasuryBalances).where(
      and(eq(treasuryBalances.merchantId, merchantId), eq(treasuryBalances.currency, currency))
    );
    return balance;
  }

  async createTreasuryBalance(insertBalance: InsertTreasuryBalance): Promise<TreasuryBalance> {
    const [balance] = await db.insert(treasuryBalances).values(insertBalance).returning();
    return balance;
  }

  async updateTreasuryBalance(id: string, updates: Partial<TreasuryBalance>): Promise<TreasuryBalance | undefined> {
    const [balance] = await db.update(treasuryBalances).set({ ...updates, updatedAt: new Date() }).where(eq(treasuryBalances.id, id)).returning();
    return balance;
  }
}

export function generateApiKey(): string {
  return `arc_${randomBytes(24).toString("hex")}`;
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("hex")}`;
}

// Extended storage with refunds and webhook subscriptions
export class ExtendedStorage extends DatabaseStorage {
  async createRefund(insertRefund: InsertRefund): Promise<Refund> {
    const [refund] = await db.insert(refunds).values(insertRefund).returning();
    return refund;
  }

  async getRefund(id: string): Promise<Refund | undefined> {
    const [refund] = await db.select().from(refunds).where(eq(refunds.id, id));
    return refund;
  }

  async getRefundsByPayment(paymentId: string): Promise<Refund[]> {
    return await db
      .select()
      .from(refunds)
      .where(eq(refunds.paymentId, paymentId))
      .orderBy(desc(refunds.createdAt));
  }

  async updateRefund(id: string, updates: Partial<Refund>): Promise<Refund | undefined> {
    const [refund] = await db
      .update(refunds)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(refunds.id, id))
      .returning();
    return refund;
  }

  async createWebhookSubscription(
    insertSubscription: InsertWebhookSubscription
  ): Promise<WebhookSubscription> {
    const [subscription] = await db
      .insert(webhookSubscriptions)
      .values(insertSubscription)
      .returning();
    return subscription;
  }

  async getWebhookSubscriptions(merchantId: string): Promise<WebhookSubscription[]> {
    return await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.merchantId, merchantId));
  }

  async getWebhookSubscription(id: string): Promise<WebhookSubscription | undefined> {
    const [subscription] = await db
      .select()
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.id, id));
    return subscription;
  }

  async updateWebhookSubscription(
    id: string,
    updates: Partial<WebhookSubscription>
  ): Promise<WebhookSubscription | undefined> {
    const [subscription] = await db
      .update(webhookSubscriptions)
      .set(updates)
      .where(eq(webhookSubscriptions.id, id))
      .returning();
    return subscription;
  }

  async deleteWebhookSubscription(id: string): Promise<boolean> {
    await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));
    return true;
  }

  async getMerchantBadge(merchantId: string): Promise<MerchantBadge | undefined> {
    const [badge] = await db.select().from(merchantBadges).where(eq(merchantBadges.merchantId, merchantId));
    return badge;
  }

  async createMerchantBadge(insertBadge: InsertMerchantBadge): Promise<MerchantBadge> {
    const [badge] = await db.insert(merchantBadges).values(insertBadge).returning();
    return badge;
  }

  async updateMerchantBadge(merchantId: string, updates: Partial<MerchantBadge>): Promise<MerchantBadge | undefined> {
    const [badge] = await db.update(merchantBadges).set(updates).where(eq(merchantBadges.merchantId, merchantId)).returning();
    return badge;
  }

  async getPaymentProof(paymentId: string): Promise<PaymentProof | undefined> {
    const [proof] = await db.select().from(paymentProofs).where(eq(paymentProofs.paymentId, paymentId));
    return proof;
  }

  async getPaymentProofByInvoiceHash(invoiceHash: string): Promise<PaymentProof | undefined> {
    const [proof] = await db.select().from(paymentProofs).where(eq(paymentProofs.invoiceHash, invoiceHash));
    return proof;
  }

  async createPaymentProof(insertProof: InsertPaymentProof): Promise<PaymentProof> {
    const [proof] = await db.insert(paymentProofs).values(insertProof).returning();
    return proof;
  }

  async updatePaymentProof(id: string, updates: Partial<PaymentProof>): Promise<PaymentProof | undefined> {
    const [proof] = await db.update(paymentProofs).set(updates).where(eq(paymentProofs.id, id)).returning();
    return proof;
  }

  async getMerchantProfile(walletAddress: string): Promise<MerchantProfile | undefined> {
    const [profile] = await db
      .select()
      .from(merchantProfiles)
      .where(eq(merchantProfiles.walletAddress, walletAddress.toLowerCase()));
    return profile;
  }

  async upsertMerchantProfile(profile: InsertMerchantProfile): Promise<MerchantProfile> {
    const normalizedWalletAddress = profile.walletAddress.toLowerCase();
    const existing = await this.getMerchantProfile(normalizedWalletAddress);
    
    if (existing) {
      const [result] = await db
        .update(merchantProfiles)
        .set({
          businessName: profile.businessName,
          logoUrl: profile.logoUrl,
          country: profile.country,
          businessType: profile.businessType,
          defaultGasSponsorship: profile.defaultGasSponsorship !== undefined ? profile.defaultGasSponsorship : existing.defaultGasSponsorship,
          activatedAt: profile.activatedAt,
          updatedAt: new Date(),
        })
        .where(eq(merchantProfiles.walletAddress, normalizedWalletAddress))
        .returning();
      return result;
    } else {
      const [result] = await db
        .insert(merchantProfiles)
        .values({
          ...profile,
          walletAddress: normalizedWalletAddress,
          updatedAt: new Date(),
        })
        .returning();
      return result;
    }
  }

  // Business Wallet Addresses
  async getBusinessWalletAddresses(walletAddress: string): Promise<BusinessWalletAddress[]> {
    return await db
      .select()
      .from(businessWalletAddresses)
      .where(eq(businessWalletAddresses.walletAddress, walletAddress.toLowerCase()))
      .orderBy(desc(businessWalletAddresses.createdAt));
  }

  async createBusinessWalletAddress(insertWallet: InsertBusinessWalletAddress): Promise<BusinessWalletAddress> {
    // Check if we already have 3 wallet addresses
    const existing = await this.getBusinessWalletAddresses(insertWallet.walletAddress);
    if (existing.length >= 3) {
      throw new Error("Maximum of 3 wallet addresses allowed");
    }

    // Validate wallet address format
    const walletRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletRegex.test(insertWallet.paymentWalletAddress)) {
      throw new Error("Invalid wallet address format");
    }

    // Check for duplicates
    const duplicate = existing.find(
      (w) => w.paymentWalletAddress.toLowerCase() === insertWallet.paymentWalletAddress.toLowerCase()
    );
    if (duplicate) {
      throw new Error("This wallet address is already added");
    }

    const [wallet] = await db
      .insert(businessWalletAddresses)
      .values({
        ...insertWallet,
        walletAddress: insertWallet.walletAddress.toLowerCase(),
        paymentWalletAddress: insertWallet.paymentWalletAddress.toLowerCase(),
      })
      .returning();
    return wallet;
  }

  async deleteBusinessWalletAddress(id: string, walletAddress: string): Promise<boolean> {
    const [deleted] = await db
      .delete(businessWalletAddresses)
      .where(
        and(
          eq(businessWalletAddresses.id, id),
          eq(businessWalletAddresses.walletAddress, walletAddress.toLowerCase())
        )
      )
      .returning();
    return !!deleted;
  }

  async getQRCodes(merchantId: string): Promise<QRCode[]> {
    return await db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.merchantId, merchantId))
      .orderBy(desc(qrCodes.createdAt));
  }

  async getQRCode(id: string): Promise<QRCode | undefined> {
    const [qrCode] = await db.select().from(qrCodes).where(eq(qrCodes.id, id));
    return qrCode;
  }

  async createQRCode(insertQRCode: InsertQRCode): Promise<QRCode> {
    const [qrCode] = await db.insert(qrCodes).values(insertQRCode).returning();
    return qrCode;
  }

  async getApiKeys(walletAddress: string): Promise<ApiKey[]> {
    return await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.walletAddress, walletAddress.toLowerCase()),
          isNull(apiKeys.revokedAt)
        )
      )
      .orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string): Promise<ApiKey | undefined> {
    const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return key;
  }

  async createApiKey(insertApiKey: InsertApiKey): Promise<ApiKey> {
    const [key] = await db.insert(apiKeys).values({
      ...insertApiKey,
      walletAddress: insertApiKey.walletAddress.toLowerCase(),
    }).returning();
    return key;
  }

  async revokeApiKey(id: string): Promise<void> {
    await db
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(apiKeys.id, id));
  }

  async deleteApiKey(id: string): Promise<void> {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async getApiKeyFullValue(id: string): Promise<string | null> {
    const key = await this.getApiKey(id);
    if (!key) return null;
    
    // For MVP: Return the keyPrefix which contains the full key
    // In production, implement proper encryption/decryption with a secure vault
    // TODO: Implement secure key storage with encryption
    return key.keyPrefix;
  }

  async logApiKeyEvent(data: { apiKeyId: string; eventType: string; metadata?: any }): Promise<void> {
    // Log API key events for audit trail
    // This could be stored in a separate api_key_events table
    console.log("API Key Event:", data);
  }

  // Business Name Change Requests
  async createBusinessNameChangeRequest(insertRequest: InsertBusinessNameChangeRequest): Promise<BusinessNameChangeRequest> {
    const [request] = await db.insert(businessNameChangeRequests).values(insertRequest).returning();
    return request;
  }

  async getBusinessNameChangeRequests(merchantId: string): Promise<BusinessNameChangeRequest[]> {
    return await db
      .select()
      .from(businessNameChangeRequests)
      .where(eq(businessNameChangeRequests.merchantId, merchantId))
      .orderBy(desc(businessNameChangeRequests.createdAt));
  }

  async getAllBusinessNameChangeRequests(status?: "pending" | "approved" | "rejected"): Promise<BusinessNameChangeRequest[]> {
    if (status) {
      return await db
        .select()
        .from(businessNameChangeRequests)
        .where(eq(businessNameChangeRequests.status, status))
        .orderBy(desc(businessNameChangeRequests.createdAt));
    }
    return await db
      .select()
      .from(businessNameChangeRequests)
      .orderBy(desc(businessNameChangeRequests.createdAt));
  }

  async getBusinessNameChangeRequest(id: string): Promise<BusinessNameChangeRequest | undefined> {
    const [request] = await db
      .select()
      .from(businessNameChangeRequests)
      .where(eq(businessNameChangeRequests.id, id));
    return request;
  }

  async updateBusinessNameChangeRequest(id: string, updates: Partial<BusinessNameChangeRequest>): Promise<BusinessNameChangeRequest | undefined> {
    const [request] = await db
      .update(businessNameChangeRequests)
      .set(updates)
      .where(eq(businessNameChangeRequests.id, id))
      .returning();
    return request;
  }

  // Admin Users
  async getAdminUser(id: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
    return admin;
  }

  async getAdminUserByEmail(email: string): Promise<AdminUser | undefined> {
    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
    return admin;
  }

  async getAdminUserByWalletAddress(walletAddress: string): Promise<AdminUser | undefined> {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.walletAddress, walletAddress.toLowerCase()));
    return admin;
  }

  async getAllAdminUsers(): Promise<AdminUser[]> {
    return await db.select().from(adminUsers).orderBy(desc(adminUsers.createdAt));
  }

  async createAdminUser(insertAdmin: InsertAdminUser): Promise<AdminUser> {
    const [admin] = await db.insert(adminUsers).values(insertAdmin).returning();
    return admin;
  }

  // Admin Audit Logs
  async createAuditLog(insertLog: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [log] = await db.insert(adminAuditLogs).values(insertLog).returning();
    return log;
  }

  async getAuditLogs(limit: number = 100): Promise<AdminAuditLog[]> {
    return await db
      .select()
      .from(adminAuditLogs)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit);
  }

  // Global Config
  async getGlobalConfig(key: string): Promise<GlobalConfig | undefined> {
    const [config] = await db.select().from(globalConfig).where(eq(globalConfig.key, key));
    return config;
  }

  async getAllGlobalConfig(): Promise<GlobalConfig[]> {
    return await db.select().from(globalConfig);
  }

  async upsertGlobalConfig(config: InsertGlobalConfig & { updatedBy: string }): Promise<GlobalConfig> {
    const existing = await this.getGlobalConfig(config.key);
    if (existing) {
      const [updated] = await db
        .update(globalConfig)
        .set({
          value: config.value,
          description: config.description,
          updatedBy: config.updatedBy,
          updatedAt: new Date(),
        })
        .where(eq(globalConfig.key, config.key))
        .returning();
      return updated!;
    } else {
      const [created] = await db.insert(globalConfig).values(config).returning();
      return created;
    }
  }

  // Blocklist
  async getBlocklistEntry(type: string, value: string): Promise<BlocklistEntry | undefined> {
    const [entry] = await db
      .select()
      .from(blocklist)
      .where(
        and(eq(blocklist.type, type), eq(blocklist.value, value.toLowerCase()))
      );
    return entry;
  }

  async getAllBlocklistEntries(): Promise<BlocklistEntry[]> {
    return await db.select().from(blocklist).orderBy(desc(blocklist.createdAt));
  }

  async createBlocklistEntry(insertEntry: InsertBlocklistEntry): Promise<BlocklistEntry> {
    const [entry] = await db.insert(blocklist).values({
      ...insertEntry,
      value: insertEntry.value.toLowerCase(),
    }).returning();
    return entry;
  }

  async deleteBlocklistEntry(id: string): Promise<void> {
    await db.delete(blocklist).where(eq(blocklist.id, id));
  }

  // Notification methods
  async getNotifications(merchantId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.merchantId, merchantId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsCount(merchantId: string): Promise<number> {
    const result = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.merchantId, merchantId),
          eq(notifications.read, false)
        )
      );
    return result.length;
  }

  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(insertNotification).returning();
    return notification;
  }

  async markNotificationAsRead(id: string, merchantId: string): Promise<Notification | undefined> {
    const [notification] = await db
      .update(notifications)
      .set({ read: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.merchantId, merchantId)
        )
      )
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(merchantId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ read: true })
      .where(eq(notifications.merchantId, merchantId));
  }

  async clearAllNotifications(merchantId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.merchantId, merchantId));
  }

  async deleteNotification(id: string, merchantId: string): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.merchantId, merchantId)
        )
      )
      .returning();
    return result.length > 0;
  }
}

export const storage = new ExtendedStorage();
