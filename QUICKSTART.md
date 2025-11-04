# TourPay Backend - Quick Start Guide

## What Has Been Built

A complete Node.js/Express backend for the TourPay blockchain-based payment platform, including:

### Core Components

1. **Database Models** (PostgreSQL)
   - User management
   - Wallet management (Coinbase integration)
   - Booking system
   - Transaction tracking
   - Network tokens (Apple Pay, Transit Cards, Discover)

2. **Services**
   - **Coinbase Service**: Onramp integration, wallet funding, USDC transactions
   - **Token Service**: Apple Pay, Transit Card, Discover token generation
   - **Smart Contract Service**: Base network integration, escrow management

3. **API Routes**
   - Authentication (register, login, JWT management)
   - Wallet operations (fund, balance, transactions)
   - Token management (create, use, deactivate)
   - Booking lifecycle (create, cancel, check-in, complete)
   - Payment processing (process, release, refund)
   - Webhooks (Coinbase, blockchain events)

4. **Security & Infrastructure**
   - JWT authentication with refresh tokens
   - Redis session management
   - Rate limiting
   - Request logging
   - Error handling
   - Database connection pooling

## File Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # PostgreSQL connection
│   │   └── logger.js            # Winston logger setup
│   ├── controllers/
│   │   └── webhookController.js # Webhook event handlers
│   ├── middleware/
│   │   └── auth.js              # JWT & session management
│   ├── models/
│   │   ├── User.js              # User model
│   │   ├── Wallet.js            # Wallet model
│   │   ├── Booking.js           # Booking model
│   │   ├── Transaction.js       # Transaction model
│   │   └── NetworkToken.js      # Network token model
│   ├── routes/
│   │   ├── authRoutes.js        # Authentication routes
│   │   ├── walletRoutes.js      # Wallet routes
│   │   ├── tokenRoutes.js       # Token routes
│   │   ├── bookingRoutes.js     # Booking routes
│   │   ├── paymentRoutes.js     # Payment routes
│   │   └── webhookRoutes.js     # Webhook routes
│   ├── services/
│   │   ├── coinbaseService.js   # Coinbase API integration
│   │   ├── tokenService.js      # Token generation service
│   │   └── smartContractService.js # Blockchain integration
│   └── server.js                # Main Express server
├── database/
│   └── schema.sql               # Database schema
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
├── package.json                 # Dependencies
├── README.md                    # Full documentation
└── QUICKSTART.md               # This file
```

## Next Steps

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Set Up Database

```bash
# Create PostgreSQL database
createdb tourpay

# Run schema
psql -d tourpay -f database/schema.sql
```

### 3. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your credentials
nano .env
```

Required configurations:
- Database connection string
- Coinbase API credentials
- JWT secrets
- Base network RPC URL
- Redis connection

### 4. Start Redis

```bash
redis-server
```

### 5. Run Development Server

```bash
npm run dev
```

The server will start on http://localhost:3000

### 6. Test Health Endpoint

```bash
curl http://localhost:3000/health
```

## What's Missing (To Be Implemented)

The following controllers need to be implemented to complete the backend:

### Controllers to Create

1. **authController.js** - Handle registration, login, logout, token refresh
2. **walletController.js** - Handle wallet operations (fund, balance, create)
3. **tokenController.js** - Handle token creation and management
4. **bookingController.js** - Handle booking lifecycle
5. **paymentController.js** - Handle payment processing

### Additional Features to Implement

1. **Email notifications** - For booking confirmations, cancellations
2. **QR code generation** - For check-in process
3. **Tour operator dashboard** - API endpoints for operators
4. **Admin panel endpoints** - For platform management
5. **Analytics endpoints** - Transaction volumes, booking stats
6. **Testing suite** - Unit and integration tests

## API Testing

Once controllers are implemented, you can test with:

```bash
# Register user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","first_name":"John","last_name":"Doe"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get wallet balance (with token)
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Smart Contract Deployment

The backend expects smart contracts to be deployed on Base network:

1. Deploy escrow contract to Base mainnet/testnet
2. Update `ESCROW_CONTRACT_ADDRESS` in .env
3. Fund escrow wallet with gas fees
4. Test contract interactions

## Production Deployment Checklist

- [ ] Set NODE_ENV=production
- [ ] Configure production database with SSL
- [ ] Set secure JWT secrets (32+ characters)
- [ ] Configure production Coinbase credentials
- [ ] Deploy smart contracts to Base mainnet
- [ ] Set up SSL/TLS certificates
- [ ] Configure production Redis
- [ ] Set up monitoring (Datadog, New Relic, etc.)
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Load testing
- [ ] Security audit

## Key Integration Points

### Coinbase Onramp
- Users fund wallets via Coinbase Onramp
- Backend receives webhooks on funding completion
- USDC balance updated in database and on-chain

### Network Tokens
- Apple Pay: Generate .pkpass files, provision to Apple Wallet
- Transit Cards: Map to Clipper/Presto card numbers
- Discover: Generate virtual card numbers with NFC support

### Smart Contracts
- Bookings create escrow locks on Base network
- Check-in triggers payment release
- Cancellations trigger automatic refunds

## Support

For questions or issues:
- Review the main README.md for detailed documentation
- Check the API endpoints in each route file
- Review service files for integration details

## Architecture Overview

```
┌─────────────┐
│   Client    │ (React/Next.js Frontend)
└──────┬──────┘
       │
       ├─── REST API ───┐
       │                │
┌──────▼──────┐    ┌───▼────────┐
│   Express   │    │  Coinbase  │
│   Backend   │◄───┤  Onramp    │
└──────┬──────┘    └────────────┘
       │
       ├─── PostgreSQL (User data, bookings, transactions)
       ├─── Redis (Sessions, rate limiting)
       └─── Base Network (Smart contracts, USDC)
```

This backend is production-ready once the remaining controllers are implemented and proper testing is complete.
