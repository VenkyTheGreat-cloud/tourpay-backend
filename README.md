# TourPay Backend

Blockchain-based payment platform backend for the Canadian tour industry, enabling seamless bookings for US tours through Canadian tour operators.

## Overview

TourPay integrates **Coinbase Onramp** and **tokenization** to allow Canadian travelers to pay in CAD while benefiting from crypto advantages: lower fees (1% vs 5%), instant settlement, automated escrow, and zero chargebacks.

## Architecture

### Technology Stack

- **Runtime**: Node.js with Express
- **Database**: PostgreSQL with Redis for session management
- **Blockchain**: Base Network (Coinbase L2) with USDC
- **Payment**: Coinbase Onramp integration
- **Tokens**: Apple Pay, Transit Card (Clipper/Presto), Discover Network Token
- **Smart Contracts**: Solidity escrow contracts on Base

### Key Features

1. **Coinbase Onramp Integration**
   - Fund wallets via bank account, debit/credit card, Apple Pay
   - Automatic USDC conversion
   - 1% fee vs traditional 5%

2. **Multiple Payment Methods**
   - Apple Pay Token (pass.pkpass)
   - Transit Card Token (Clipper/Presto/ORCA)
   - Discover Network Token (Virtual NFC card)
   - Google Pay Token (coming soon)
   - Direct wallet payment

3. **Smart Contract Escrow**
   - Automated payment hold until tour check-in
   - Instant release to operators post-attendance
   - Automatic refunds for cancellations
   - Zero chargeback protection

4. **Tour Booking Flow**
   - Browse tours on operator websites
   - Pay with Coinbase in CAD
   - Receive instant confirmation
   - Check-in via QR code
   - Automatic payment release

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/update` - Update user profile

### Wallet Management
- `POST /api/wallet/create` - Create new wallet
- `POST /api/wallet/fund` - Initiate Coinbase Onramp session
- `GET /api/wallet/balance` - Get wallet balance
- `GET /api/wallet` - Get wallet details
- `GET /api/wallet/transactions` - Get transaction history

### Network Tokens
- `POST /api/tokens/applepay` - Create Apple Pay token
- `POST /api/tokens/transit` - Create Transit Card token
- `POST /api/tokens/discover` - Create Discover network token
- `POST /api/tokens/googlepay` - Create Google Pay token
- `GET /api/tokens` - Get all user tokens
- `GET /api/tokens/:tokenId` - Get token details
- `PUT /api/tokens/:tokenId/deactivate` - Deactivate token
- `POST /api/tokens/:tokenId/use` - Process payment using token

### Bookings
- `POST /api/bookings` - Create new booking
- `GET /api/bookings` - Get all user bookings
- `GET /api/bookings/upcoming` - Get upcoming bookings
- `GET /api/bookings/past` - Get past bookings
- `GET /api/bookings/:bookingId` - Get booking details
- `POST /api/bookings/:bookingId/cancel` - Cancel booking
- `POST /api/bookings/:bookingId/checkin` - Check-in to booking
- `POST /api/bookings/:bookingId/complete` - Complete booking

### Payments
- `POST /api/payments/process` - Process payment for booking
- `POST /api/payments/release` - Release payment to operator
- `POST /api/payments/refund` - Process refund
- `GET /api/payments/:transactionId` - Get payment details
- `GET /api/payments/booking/:bookingId` - Get booking payments

### Webhooks
- `POST /api/webhooks/coinbase` - Handle Coinbase webhooks
- `POST /api/webhooks/blockchain` - Handle blockchain events

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Coinbase API credentials
- Base network RPC access

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Create database
createdb tourpay

# Run database migrations
psql -d tourpay -f database/schema.sql

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `COINBASE_API_KEY` - Coinbase API key
- `COINBASE_API_SECRET` - Coinbase API secret
- `BASE_RPC_URL` - Base network RPC URL
- `ESCROW_CONTRACT_ADDRESS` - Smart contract address
- `JWT_SECRET` - JWT signing secret

## Database Schema

### Core Tables

1. **users** - User accounts (travelers, operators, admins)
2. **wallets** - Coinbase wallet mapping and USDC balances
3. **bookings** - Tour bookings with status tracking
4. **transactions** - All financial transactions
5. **network_tokens** - Payment tokens (Apple Pay, Transit, Discover)
6. **tour_operators** - Tour operator profiles
7. **tours** - Available tours catalog

## Smart Contract Integration

### Escrow Contract Functions

```solidity
- createBooking() - Create booking with escrow
- processPayment() - Lock payment in escrow
- releasePayment() - Release to operator after check-in
- processRefund() - Refund to traveler if cancelled
- getBooking() - Get booking status
```

### Events

```solidity
- BookingCreated(bookingId, userId, tourOperator, amount)
- PaymentProcessed(bookingId, amount)
- PaymentReleased(bookingId, tourOperator, amount)
- RefundProcessed(bookingId, user, refundAmount)
```

## Token Service

### Apple Pay Token
- Generates pass.pkpass files
- Provisioning via Apple Wallet API
- Real-time balance updates
- Tap-to-pay enabled

### Transit Card Token
- Compatible with Clipper, Presto, ORCA
- NFC-enabled for physical terminals
- Maps to existing transit cards or virtual
- ISO14443A encoding

### Discover Network Token
- Virtual card number generation
- NFC credentials for POS
- Compass protocol support
- CVV and expiry management

## Security

- JWT-based authentication with refresh tokens
- Rate limiting (100 requests/15 minutes)
- Redis session management
- Token blacklisting for logout
- Helmet.js security headers
- CORS configuration
- Input validation with express-validator

## Logging

Winston logger with:
- Console output (development)
- File rotation (production)
- Error tracking
- Request logging with Morgan

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Deployment

### Production Checklist

1. Set `NODE_ENV=production`
2. Configure production database
3. Set secure JWT secrets
4. Configure Coinbase production credentials
5. Deploy smart contracts to Base mainnet
6. Set up SSL/TLS certificates
7. Configure rate limiting
8. Set up monitoring and alerts

### Docker Support (Coming Soon)

```bash
docker-compose up -d
```

## Market Opportunity

- **1.6M** Canadian tour bookings to US annually
- **$4B CAD** market size
- **$200M** wasted in current payment fees
- **$1.2B** potential in 3 years

## Benefits

### For Travelers
- Pay in CAD with familiar methods
- 3-5% lower prices (no currency buffers)
- Instant booking confirmation
- Automatic refunds if tour cancels
- Smart contract protection

### For Tour Operators
- 80% lower fees ($200K → $40K annually)
- Zero chargebacks (save $35K+ annually)
- Instant payment visibility
- No currency risk with USDC
- Better cash flow management

## Contributing

Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License

This project is proprietary software. All rights reserved.

## Support

For issues and questions:
- Email: support@tourpay.com
- Documentation: https://docs.tourpay.com
