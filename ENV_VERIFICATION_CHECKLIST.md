# Environment Variables Verification Checklist

## ✅ Critical Checks for Production

Based on your Vercel environment variables, verify the following:

### 1. **DEMO_MODE** ⚠️ CRITICAL
- **Must be:** `false` (not `true`, not `"false"`, just `false`)
- **Why:** If this is `true`, the app will be in demo mode and won't work properly

### 2. **NODE_ENV**
- **Must be:** `production`
- **Why:** Ensures production optimizations are enabled

### 3. **BASE_URL**
- **Must be:** `https://arcpaybeta.vercel.app` (your actual Vercel URL)
- **Why:** Used for generating payment links and API calls

### 4. **VITE_API_URL**
- **Must be:** `https://arcpaybeta.vercel.app` (should match BASE_URL)
- **Why:** Client needs to know where to make API calls

### 5. **Matching Server/Client Variables**
Ensure these pairs match:
- `ARC_CHAIN_ID` = `VITE_ARC_CHAIN_ID`
- `ARC_RPC_URL` = `VITE_ARC_RPC_URL`
- `ARC_EXPLORER_URL` = `VITE_ARC_EXPLORER_URL`
- `MERCHANT_BADGE_ADDRESS` = `VITE_MERCHANT_BADGE_ADDRESS`
- `INVOICE_PAYMENT_PROOF_ADDRESS` = `VITE_INVOICE_PAYMENT_PROOF_ADDRESS`

### 6. **ALLOW_SELF_SIGNED_CERTS**
- **Should be:** `false` or **omitted entirely**
- **Why:** Production should use proper SSL certificates

## 📋 Variables You Have (Good!)

✅ DATABASE_URL
✅ SESSION_SECRET
✅ ARC_CHAIN_ID
✅ ARC_RPC_URL
✅ ARC_EXPLORER_URL
✅ MERCHANT_BADGE_ADDRESS
✅ INVOICE_PAYMENT_PROOF_ADDRESS
✅ ADMIN_WALLET
✅ BASE_URL
✅ VITE_API_URL
✅ VITE_WALLETCONNECT_PROJECT_ID
✅ VITE_ARC_CHAIN_ID
✅ VITE_ARC_RPC_URL
✅ VITE_ARC_EXPLORER_URL
✅ VITE_MERCHANT_BADGE_ADDRESS
✅ VITE_INVOICE_PAYMENT_PROOF_ADDRESS
✅ VITE_USDC_TOKEN_ADDRESS
✅ DEMO_MODE
✅ NODE_ENV

## ⚠️ Potential Issues

### 1. **ARC_TESTNET_RPC_URL**
- You have both `ARC_RPC_URL` and `ARC_TESTNET_RPC_URL`
- **Action:** Make sure `ARC_RPC_URL` is set correctly (the code uses `ARC_RPC_URL`, not `ARC_TESTNET_RPC_URL`)
- You can remove `ARC_TESTNET_RPC_URL` if it's redundant

### 2. **BLOB_READ_WRITE_TOKEN**
- This seems to be for Vercel Blob storage
- **Action:** Make sure this is set if you're using file uploads

### 3. **PRIVATE_KEY**
- Only needed if you're doing automated contract interactions
- **Action:** Verify if you actually need this

### 4. **ARC_API**
- Optional, only if using ARC API services
- **Action:** Verify if you're using this

## 🔍 Quick Verification Steps

1. **Check DEMO_MODE value:**
   - Click on `DEMO_MODE` in Vercel
   - Verify it shows `false` (not `"false"` or `true`)

2. **Check BASE_URL:**
   - Should be exactly: `https://arcpaybeta.vercel.app`
   - No trailing slash

3. **Check VITE_API_URL:**
   - Should match BASE_URL exactly: `https://arcpaybeta.vercel.app`

4. **Verify matching values:**
   - `ARC_CHAIN_ID` should equal `VITE_ARC_CHAIN_ID`
   - `ARC_RPC_URL` should equal `VITE_ARC_RPC_URL`
   - `ARC_EXPLORER_URL` should equal `VITE_ARC_EXPLORER_URL`

5. **After making changes:**
   - **Redeploy** your application in Vercel
   - Environment variables only apply on new deployments

## 🚨 Most Common Issues

1. **DEMO_MODE is `true`** → App won't work properly
2. **BASE_URL doesn't match actual URL** → Payment links won't work
3. **VITE_API_URL doesn't match BASE_URL** → API calls will fail
4. **Mismatched server/client variables** → Inconsistent behavior
5. **Missing VITE_WALLETCONNECT_PROJECT_ID** → Wallet connection won't work

## 📝 Action Items

1. ✅ Verify `DEMO_MODE=false`
2. ✅ Verify `NODE_ENV=production`
3. ✅ Verify `BASE_URL=https://arcpaybeta.vercel.app`
4. ✅ Verify `VITE_API_URL=https://arcpaybeta.vercel.app`
5. ✅ Verify all matching pairs are identical
6. ✅ Remove or verify `ARC_TESTNET_RPC_URL` (redundant?)
7. ✅ Set `ALLOW_SELF_SIGNED_CERTS=false` or remove it
8. ✅ **Redeploy after making any changes**

