# Setup Guide

## PHASE 1 — INSTALL DEPENDENCIES

### 1️⃣ Install dependencies (root)

From project root:

```bash
npm install
```

If this fails, run:

```bash
npm install --legacy-peer-deps
```

### 2️⃣ Core frontend deps

The following are already installed in the root `package.json`:
- `react` and `react-dom`
- `@walletconnect/modal` and `@walletconnect/ethereum-provider`
- `axios`
- `clsx`

### 3️⃣ Backend deps

Backend dependencies are also in root `package.json`:
- `drizzle-orm` and `pg`
- `drizzle-kit` (dev dependency)
- `express` and related packages

### 4️⃣ Run frontend once (sanity check)

```bash
npm run dev
```

✔ If UI loads → continue  
❌ If error → stop and check the error

---

## PHASE 2 — SET UP NEON DATABASE

### 1️⃣ Create Neon DB

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string

It will look like:
```
postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/dbname
```

### 2️⃣ Backend .env

Create `server/.env`:

```env
DATABASE_URL=postgresql://user:pass@host/db
PORT=3000
SESSION_SECRET=your-session-secret-here
```

### 3️⃣ Drizzle config

The `drizzle.config.ts` is already configured. It uses:
- Schema: `./shared/schema.ts`
- Output: `./drizzle`
- Database: PostgreSQL (Neon)

### 4️⃣ Push schema to Neon

```bash
npm run db:push
```

Or:

```bash
npx drizzle-kit push
```

✔ Neon DB ready  
✔ Schema pushed

---

## PHASE 3 — BACKEND API

The backend is already set up in `server/index.ts` and `server/routes.ts`.

### Demo Endpoints

- `GET /demo/payments` - Returns demo payment data (no auth required)

### Real Payment Endpoint

- `POST /payments` - Creates a real payment (requires wallet and txHash)

### Run backend

The backend runs with the frontend via:

```bash
npm run dev
```

The server runs on port 3000 (or PORT from .env).

---

## PHASE 4 — WALLETCONNECT

### 1️⃣ Create WalletConnect project

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Create a new project
3. Copy the Project ID

### 2️⃣ Frontend .env

Create `client/.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
VITE_API_URL=http://localhost:3000
```

### 3️⃣ WalletConnect setup

The WalletConnect integration is already set up in `client/src/lib/wallet.ts`.

### 4️⃣ Use in UI

The Checkout page (`client/src/pages/Checkout.tsx`) already integrates WalletConnect.

---

## PHASE 5 — DEMO MODE

Demo mode is configured in `client/src/lib/demo.ts`.

### Toggle Demo Mode

Edit `client/src/lib/demo.ts`:

```typescript
export const DEMO_MODE = true; // Set to false for real transactions
```

### When DEMO_MODE === true:

- Loads `/demo/payments` endpoint
- Disables real wallet transactions
- Shows mock transaction hashes
- Keeps app presentable without mainnet

### When DEMO_MODE === false:

- Requires WalletConnect connection
- Uses real payment endpoints
- Processes actual transactions

---

## PHASE 6 — FINAL CHECKLIST

✔ Dependencies installed  
✔ Neon DB connected  
✔ Schema pushed  
✔ WalletConnect Project ID configured  
✔ Demo mode configured  
✔ Backend running  
✔ Frontend running  

---

## Running the Application

### Development

```bash
npm run dev
```

This starts both frontend and backend.

### Database Migrations

```bash
npm run db:push
```

---

## Architecture Lock

See `DO_NOT_TOUCH.md` for architecture constraints.

**This project uses:**
- Vite + React (frontend)
- Express (backend)
- Drizzle ORM + PostgreSQL/Neon (database)
- WalletConnect (wallet integration)

**DO NOT:**
- Change frameworks
- Migrate to Next.js
- Delete config files
- Restructure folders

