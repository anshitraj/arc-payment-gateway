# Quick Start Guide

## 1. Set Up Database Connection

You need to create a `.env` file in the project root with your Neon database connection string.

### Option A: Create `.env` file manually

1. Copy `.env.example` to `.env`:
   ```bash
   copy .env.example .env
   ```

2. Edit `.env` and add your Neon database URL:
   ```
   DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname
   ```

### Option B: Get Neon Database URL

1. Go to [neon.tech](https://neon.tech)
2. Sign up or log in
3. Create a new project
4. Copy the connection string from the dashboard
5. Paste it into your `.env` file as `DATABASE_URL`

## 2. Push Database Schema

Once `DATABASE_URL` is set, run:

```bash
npm run db:push
```

This will create all the tables in your Neon database.

## 3. Set Up Client Environment

Create `client/.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_API_URL=http://localhost:3000
```

Get WalletConnect Project ID from [cloud.walletconnect.com](https://cloud.walletconnect.com)

## 4. Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

---

## Troubleshooting

### "DATABASE_URL, ensure the database is provisioned"

This means your `.env` file is missing or `DATABASE_URL` is not set.

**Solution:**
1. Create `.env` file in project root
2. Add `DATABASE_URL=your_neon_connection_string`
3. Try `npm run db:push` again

### Database connection errors

- Verify your Neon connection string is correct
- Check that your Neon project is active
- Ensure the database allows connections from your IP

