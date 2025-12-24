# ARC Payment Gateway

> **Stripe-style stablecoin payments, built natively on ARC**

A production-grade payment gateway platform similar to Stripe or Circle Payments, built natively on the ARC blockchain. The application provides enterprise-quality payment processing with features including payment creation, invoicing, webhook management, refunds, and treasury operations.

## 🌟 Features

### Core Payment Features
- ✅ **Full Payment Lifecycle** - Created → Pending → Confirmed/Failed/Expired
- ✅ **ARC Testnet Integration** - Native support for ARC blockchain transactions
- ✅ **Transaction Verification** - On-chain transaction verification via RPC
- ✅ **Non-Custodial Architecture** - Gateway never holds funds
- ✅ **Wallet Integration** - WalletConnect support for seamless payments
- ✅ **Demo Mode** - Test the platform without real transactions

### Merchant Features
- ✅ **Merchant Dashboard** - Comprehensive dashboard for managing payments
- ✅ **API Key Management** - Secure API key generation and management
- ✅ **Payment Links** - Generate shareable payment links
- ✅ **QR Code Payments** - Generate QR codes for easy payments
- ✅ **CSV Export** - Export payment data for accounting
- ✅ **Treasury Management** - Track and manage treasury balances

### Advanced Features
- ✅ **Webhook System** - HMAC-signed webhooks with retry logic
- ✅ **Refund Management** - Non-custodial refund processing
- ✅ **On-Chain Proof Layer** - Smart contracts for payment receipts
- ✅ **Merchant Badge SBT** - Non-transferable badges for verified merchants
- ✅ **Rate Limiting** - API rate limiting for security
- ✅ **Admin Portal** - Administrative interface for platform management

## 🏗️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **Wouter** - Lightweight routing
- **TanStack React Query** - Server state management
- **shadcn/ui** - UI component library
- **TailwindCSS** - Styling
- **Framer Motion** - Animations
- **React Hook Form + Zod** - Form handling and validation
- **RainbowKit + Wagmi** - Wallet connection

### Backend
- **Node.js** with Express
- **TypeScript** - Type safety throughout
- **Drizzle ORM** - Database ORM
- **PostgreSQL** - Database (Neon for serverless)
- **Express Sessions** - Session management
- **Passport** - Authentication

### Blockchain
- **ARC Testnet** - Chain ID: 5042002
- **Foundry** - Smart contract development
- **OpenZeppelin Contracts** - Secure contract libraries
- **viem** - Ethereum library for TypeScript

### Smart Contracts
- **MerchantBadge.sol** - Non-transferable SBT for verified merchants
- **InvoicePaymentProof.sol** - On-chain payment receipt records

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database (or Neon account)
- WalletConnect Project ID ([Get one here](https://cloud.walletconnect.com))
- Wallet with ARC Testnet USDC for gas fees

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/arc-payment-gateway.git
   cd arc-payment-gateway
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   
   **⚠️ Important:** If you encounter SES-related errors or wallet connection issues after updating dependencies, perform a clean install:
   
   **Windows (PowerShell):**
   ```powershell
   Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
   npm install
   npm run build
   ```
   
   **macOS/Linux:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   ```
   
   The dependency overrides in `package.json` ensure compatible wallet SDK versions that don't inject SES.

3. **Set up environment variables**

   Create `.env` in the project root:
   ```env
   DATABASE_URL=postgresql://user:password@host/dbname
   PORT=3000
   SESSION_SECRET=your-session-secret-here
   ARC_CHAIN_ID=5042002
   ARC_RPC_URL=https://rpc.testnet.arc.network
   ARC_EXPLORER_URL=https://testnet.arcscan.app/tx
   DEMO_MODE=true
   MERCHANT_BADGE_ADDRESS=0x...
   INVOICE_PAYMENT_PROOF_ADDRESS=0x...
   ```

   Create `client/.env`:
   ```env
   VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
   VITE_API_URL=http://localhost:3000
   VITE_ARC_CHAIN_ID=5042002
   VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
   VITE_ARC_EXPLORER_URL=https://testnet.arcscan.app/tx
   VITE_MERCHANT_BADGE_ADDRESS=0x...
   VITE_INVOICE_PAYMENT_PROOF_ADDRESS=0x...
   ```

4. **Set up database**
   ```bash
   npm run db:push
   ```

5. **Run the application**
   ```bash
   npm run dev
   ```

   The app will be available at `http://localhost:3000`

## 📚 Documentation

- **[QUICK_START.md](./QUICK_START.md)** - Quick setup guide
- **[SETUP.md](./SETUP.md)** - Detailed setup instructions
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Complete feature list
- **[CONTRACT_DEPLOYMENT.md](./CONTRACT_DEPLOYMENT.md)** - Smart contract deployment guide
- **[ON_CHAIN_PROOF_LAYER_IMPLEMENTATION.md](./ON_CHAIN_PROOF_LAYER_IMPLEMENTATION.md)** - On-chain features documentation
- **[ADMIN_PORTAL_SETUP.md](./ADMIN_PORTAL_SETUP.md)** - Admin portal setup
- **[ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md)** - Environment variables guide
- **[ENV_TEMPLATES.md](./ENV_TEMPLATES.md)** - Environment variable templates

## 🛣️ API Endpoints

### Payment Endpoints
- `POST /api/payments/create` - Create a new payment
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/confirm` - Confirm payment with transaction hash
- `POST /api/payments/fail` - Mark payment as failed
- `POST /api/payments/expire` - Expire a payment

### Refund Endpoints
- `POST /api/payments/:id/refund` - Create refund intent
- `POST /api/refunds/:id/complete` - Complete refund with transaction hash
- `GET /api/refunds/:id` - Get refund details
- `GET /api/payments/:id/refunds` - Get all refunds for a payment

### Webhook Endpoints
- `POST /api/webhooks/subscriptions` - Create webhook subscription
- `GET /api/webhooks/subscriptions` - List webhook subscriptions
- `PUT /api/webhooks/subscriptions/:id` - Update webhook subscription
- `DELETE /api/webhooks/subscriptions/:id` - Delete webhook subscription
- `GET /api/webhooks/events` - Get webhook event logs

### Badge Endpoints
- `GET /api/badges/status` - Get merchant badge status
- `GET /api/badges/eligibility` - Check badge eligibility
- `POST /api/badges/record-mint` - Record badge mint transaction

### Proof Endpoints
- `GET /api/payments/:id/proof` - Get payment proof status
- `POST /api/payments/:id/generate-invoice-hash` - Generate invoice hash
- `POST /api/payments/:id/record-proof` - Record payment proof on-chain

## 🔐 Authentication

The API uses API key authentication. Include your API key in requests:

```bash
# Using Authorization header
Authorization: Bearer your_api_key_here

# Or using x-api-key header
x-api-key: your_api_key_here

# Or as query parameter
?apiKey=your_api_key_here
```

## 🏛️ Architecture

### Project Structure
```
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/      # Route-level page components
│   │   ├── hooks/      # Custom React hooks
│   │   └── lib/        # Utilities and configurations
│   └── public/         # Static assets
├── server/             # Express backend
│   ├── routes/         # API route handlers
│   ├── services/       # Business logic services
│   ├── middleware/     # Express middleware
│   └── admin/          # Admin portal routes
├── contracts/          # Smart contracts (Solidity)
├── shared/             # Shared code (database schema)
├── script/             # Deployment scripts
└── migrations/         # Database migrations
```

### Key Design Principles
- **Non-Custodial** - Gateway never holds user funds
- **Wallet-Controlled** - All blockchain transactions require wallet signature
- **Service-Oriented** - Clean separation of concerns
- **Type-Safe** - TypeScript throughout
- **Secure** - API key auth, rate limiting, HMAC webhooks

## 🔒 Security Features

- ✅ API key authentication
- ✅ Rate limiting (100 requests/minute per API key)
- ✅ HMAC webhook signatures
- ✅ Input validation (Zod schemas)
- ✅ Non-custodial architecture
- ✅ Private keys never exposed
- ✅ Session-based authentication for dashboard

## 🧪 Testing

### Demo Mode
Set `DEMO_MODE=true` in your `.env` to enable demo mode:
- No real ARC transactions required
- Mock transaction hashes
- Auto-confirmed payment status
- Perfect for testing and demos

### Test Mode Toggle
The frontend includes a test mode toggle for switching between demo and live modes.

## 📦 Smart Contracts

### MerchantBadge.sol
Non-transferable Soulbound Token (SBT) for verified merchants. Merchants become eligible after their first confirmed payment.

### InvoicePaymentProof.sol
Minimal contract for recording payment receipts on-chain. Provides immutable proof of payment.

See [CONTRACT_DEPLOYMENT.md](./CONTRACT_DEPLOYMENT.md) for deployment instructions.

## 🚢 Deployment

### Database Setup
1. Create a PostgreSQL database (recommended: [Neon](https://neon.tech))
2. Set `DATABASE_URL` in `.env`
3. Run `npm run db:push` to create tables

### Environment Configuration
See [ENV_SETUP_GUIDE.md](./ENV_SETUP_GUIDE.md) for complete environment setup.

### Production Checklist
- [ ] Set `DEMO_MODE=false` for real transactions
- [ ] Deploy smart contracts to ARC Testnet/Mainnet
- [ ] Configure production database
- [ ] Set up webhook endpoints
- [ ] Configure rate limiting
- [ ] Set secure `SESSION_SECRET`
- [ ] Enable HTTPS

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built for the ARC blockchain ecosystem
- Inspired by Stripe and Circle Payments
- Uses OpenZeppelin contracts for secure smart contract development

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Built with ❤️ for the ARC ecosystem**

