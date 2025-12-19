/**
 * Badge Service
 * Handles merchant badge eligibility and status
 */

import { db } from "../db.js";
import { payments, merchantBadges, merchants } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage.js";
import { checkBadgeOwnership } from "./arcService.js";

/**
 * Check if a merchant is eligible for a badge
 * Eligibility: Merchant has completed their profile (businessName set)
 */
export async function isMerchantEligibleForBadge(merchantId: string): Promise<boolean> {
  const merchant = await storage.getMerchant(merchantId);
  if (!merchant || !merchant.walletAddress) {
    return false;
  }

  // Check if merchant has completed their profile
  const profile = await storage.getMerchantProfile(merchant.walletAddress);
  if (!profile || !profile.businessName) {
    return false;
  }

  return true;
}

/**
 * Get merchant badge status
 */
export async function getMerchantBadgeStatus(merchantId: string) {
  const badge = await storage.getMerchantBadge(merchantId);
  const eligible = await isMerchantEligibleForBadge(merchantId);

  if (badge) {
    return {
      status: "claimed",
      tokenId: badge.tokenId,
      mintTxHash: badge.mintTxHash,
      createdAt: badge.createdAt,
    };
  }

  if (eligible) {
    return {
      status: "eligible",
    };
  }

  return {
    status: "not_eligible",
  };
}

/**
 * Check if merchant is verified (owns badge on-chain)
 * This is the authoritative check for merchant verification
 * Requirements:
 * 1. Merchant must have wallet address set
 * 2. Merchant must have completed profile (businessName set and not empty)
 * 3. Merchant must own badge on-chain
 */
export async function isMerchantVerified(merchantId: string): Promise<boolean> {
  const merchant = await storage.getMerchant(merchantId);
  if (!merchant || !merchant.walletAddress) {
    console.log(`[Verification] Merchant ${merchantId}: No merchant or wallet address`);
    return false;
  }

  // Check if merchant has completed their profile (businessName is required and must not be empty)
  const profile = await storage.getMerchantProfile(merchant.walletAddress);
  if (!profile) {
    console.log(`[Verification] Merchant ${merchantId}: No profile found`);
    return false;
  }
  
  if (!profile.businessName || profile.businessName.trim() === "") {
    console.log(`[Verification] Merchant ${merchantId}: Profile exists but businessName is empty or not set`);
    return false;
  }

  const MERCHANT_BADGE_ADDRESS = process.env.MERCHANT_BADGE_ADDRESS;
  if (!MERCHANT_BADGE_ADDRESS) {
    console.warn("MERCHANT_BADGE_ADDRESS not configured, skipping on-chain check");
    // Even in fallback mode, require businessName to be set
    // Fallback to DB check if contract address not configured
    const badge = await storage.getMerchantBadge(merchantId);
    const hasBadge = !!badge;
    console.log(`[Verification] Merchant ${merchantId}: Fallback mode - badge in DB: ${hasBadge}, businessName: ${profile.businessName}`);
    return hasBadge;
  }

  // Check on-chain ownership
  const hasBadge = await checkBadgeOwnership(merchant.walletAddress, MERCHANT_BADGE_ADDRESS);
  console.log(`[Verification] Merchant ${merchantId}: On-chain badge check: ${hasBadge}, businessName: ${profile.businessName}`);
  
  // If on-chain check passes but DB doesn't have record, update DB
  if (hasBadge) {
    const badge = await storage.getMerchantBadge(merchantId);
    if (!badge) {
      // Badge exists on-chain but not in DB - this shouldn't happen normally
      // but we'll still return true since on-chain is authoritative
      console.warn(`Merchant ${merchantId} has badge on-chain but not in DB`);
    }
  }

  return hasBadge;
}
