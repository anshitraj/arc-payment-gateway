# Environment Variable Templates

## Server Environment Variables

Create `server/.env`:

```env
DATABASE_URL=postgresql://user:pass@ep-xyz.ap-southeast-1.aws.neon.tech/dbname
PORT=3000
SESSION_SECRET=your-session-secret-here
```

### How to get DATABASE_URL:

1. Go to [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from the dashboard
4. Paste it as `DATABASE_URL` in `server/.env`

---

## Client Environment Variables

Create `client/.env`:

```env
VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
VITE_API_URL=http://localhost:3000
```

### How to get VITE_WALLETCONNECT_PROJECT_ID:

1. Go to [cloud.walletconnect.com](https://cloud.walletconnect.com)
2. Sign in or create an account
3. Create a new project
4. Copy the Project ID
5. Paste it as `VITE_WALLETCONNECT_PROJECT_ID` in `client/.env`

---

## Important Notes

- **Never commit `.env` files to git** - they contain sensitive information
- The `.env` files are in `.gitignore` by default
- Use `.env.example` files as templates (if they exist)
- Restart the dev server after changing environment variables

---

## Quick Setup Checklist

- [ ] Created `server/.env` with `DATABASE_URL` from Neon
- [ ] Created `client/.env` with `VITE_WALLETCONNECT_PROJECT_ID` from WalletConnect
- [ ] Set `PORT=3000` in `server/.env` (or use default)
- [ ] Set `SESSION_SECRET` in `server/.env` (generate a random string)

