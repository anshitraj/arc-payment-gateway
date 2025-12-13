import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  merchants,
  payments,
  invoices,
  webhookEndpoints,
  webhookEvents,
  treasuryBalances,
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
} from "@shared/schema";
import { randomBytes } from "crypto";

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
    const [merchant] = await db.select().from(merchants).where(eq(merchants.apiKey, apiKey));
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

export const storage = new DatabaseStorage();
