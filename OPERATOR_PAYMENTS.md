# TourPay Operator Payment System

## Overview

The operator payment system enables tour operators to receive payouts from completed bookings through multiple payment methods:
- **ACH Bank Transfer** (via Stripe)
- **Coinbase Wallet** (USDC direct transfer)
- **Bank Wire** (future implementation)

## Architecture

### Database Schema

#### operator_payment_methods
Stores payment method details for operators:
- ACH (routing number, account number, bank name)
- Coinbase Wallet (wallet address, wallet ID)
- Bank Wire (SWIFT, IBAN, routing)
- Verification status and history

#### operator_payouts
Tracks all payout transactions:
- Amount in USDC and USD
- Fees and net amounts
- Transaction IDs across platforms
- Status tracking (pending, processing, completed, failed)
- Retry logic

### Payment Flow

```
1. Booking Completed & Check-in Confirmed
   ↓
2. Smart Contract Releases Funds from Escrow
   ↓
3. Admin Initiates Payout Process
   ↓
4. System Selects Primary Payment Method
   ↓
5. Payout Processed via Selected Method:
   - ACH: Stripe → Operator Bank Account (1-2 days)
   - Coinbase: Direct USDC Transfer (instant)
   - Wire: Manual processing (same day)
   ↓
6. Payout Status Updated (Processing → Completed)
   ↓
7. Operator Receives Funds
```

## Payment Methods

### 1. ACH Bank Transfer (Stripe)

**Advantages:**
- Free for standard ACH
- 1-2 business day arrival
- Direct to operator's bank account
- No crypto knowledge required

**Setup:**
1. Operator provides bank details (routing + account number)
2. Optional: Verify with Plaid for instant verification
3. Manual verification with micro-deposits (alternative)

**Implementation:**
```javascript
POST /api/operators/payment-methods
{
  "payment_type": "ach",
  "ach_routing_number": "110000000",
  "ach_account_number": "000123456789",
  "ach_account_type": "checking",
  "ach_bank_name": "Chase Bank"
}
```

**Processing:**
- Convert USDC to USD (1:1 via Coinbase)
- Create Stripe payout to bank account
- Track via Stripe payout ID
- 1-2 business days settlement

**Fees:**
- Standard ACH: $0 (free)
- Instant ACH: 1.5% with $0.50 cap

### 2. Coinbase Wallet (USDC)

**Advantages:**
- Instant settlement
- On-chain transparency
- Lower fees (1%)
- Operator keeps crypto for further use

**Setup:**
1. Operator provides Coinbase wallet address
2. Verify address format
3. Optional: Test transaction

**Implementation:**
```javascript
POST /api/operators/payment-methods
{
  "payment_type": "coinbase_wallet",
  "coinbase_wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "coinbase_network": "base"
}
```

**Processing:**
- Direct USDC transfer on Base network
- Smart contract or Coinbase API
- Track via blockchain transaction hash
- Instant confirmation

**Fees:**
- Network gas fee: ~$0.10 (Base network)
- TourPay fee: 1%

### 3. Bank Wire (Future)

**Advantages:**
- Same-day settlement
- High limits
- International support

**Implementation:**
```javascript
POST /api/operators/payment-methods
{
  "payment_type": "bank_wire",
  "wire_bank_name": "JP Morgan Chase",
  "wire_swift_code": "CHASUS33",
  "wire_account_number": "123456789",
  "wire_routing_number": "021000021"
}
```

**Fees:**
- Wire transfer fee: $25 flat

## API Endpoints

### Payment Method Management

#### Add Payment Method
```http
POST /api/operators/payment-methods
Authorization: Bearer <token>

{
  "payment_type": "ach|coinbase_wallet|bank_wire",
  "is_primary": true,
  // ... method-specific fields
}
```

#### Get All Payment Methods
```http
GET /api/operators/payment-methods
Authorization: Bearer <token>
```

#### Set Primary Method
```http
PUT /api/operators/payment-methods/:methodId/primary
Authorization: Bearer <token>
```

#### Verify with Plaid
```http
POST /api/operators/payment-methods/verify/plaid
Authorization: Bearer <token>

{
  "public_token": "public-sandbox-xxxxx"
}
```

### Payout Management

#### Get Payouts
```http
GET /api/operators/payouts?limit=50
Authorization: Bearer <token>
```

#### Get Payout Details
```http
GET /api/operators/payouts/:payoutId
Authorization: Bearer <token>
```

#### Get Payouts by Status
```http
GET /api/operators/payouts/status/pending
Authorization: Bearer <token>
```

#### Get Payout Summary
```http
GET /api/operators/payouts/stats/summary
Authorization: Bearer <token>
```

### Admin Endpoints

#### Process Payout
```http
POST /api/operators/payouts/process
Authorization: Bearer <admin-token>

{
  "booking_id": "uuid",
  "operator_id": "uuid",
  "payment_method_id": "uuid"
}
```

#### Batch Process Payouts
```http
POST /api/operators/payouts/batch-process
Authorization: Bearer <admin-token>

{
  "payouts": [
    {
      "booking_id": "uuid",
      "operator_id": "uuid",
      "payment_method_id": "uuid"
    }
  ]
}
```

#### Retry Failed Payout
```http
POST /api/operators/payouts/:payoutId/retry
Authorization: Bearer <admin-token>
```

## Integration Guide

### For Operators

#### 1. Set Up Payment Method

**Option A: ACH with Plaid (Recommended)**
```javascript
// Frontend: Initialize Plaid Link
const config = {
  token: linkToken,
  onSuccess: async (public_token) => {
    // Send to backend
    const response = await fetch('/api/operators/payment-methods/verify/plaid', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ public_token })
    });

    const data = await response.json();
    console.log('Bank account verified:', data);
  }
};
```

**Option B: Manual ACH Entry**
```javascript
const response = await fetch('/api/operators/payment-methods', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_type: 'ach',
    ach_routing_number: '110000000',
    ach_account_number: '000123456789',
    ach_account_type: 'checking',
    ach_bank_name: 'Chase Bank',
    is_primary: true
  })
});
```

**Option C: Coinbase Wallet**
```javascript
const response = await fetch('/api/operators/payment-methods', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payment_type: 'coinbase_wallet',
    coinbase_wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    coinbase_network: 'base',
    is_primary: true
  })
});
```

#### 2. View Payouts

```javascript
// Get all payouts
const payouts = await fetch('/api/operators/payouts', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});

// Get summary
const summary = await fetch('/api/operators/payouts/stats/summary', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
});
```

### For Admins

#### Process Single Payout
```javascript
const response = await fetch('/api/operators/payouts/process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    booking_id: 'booking-uuid',
    operator_id: 'operator-uuid',
    payment_method_id: 'method-uuid'
  })
});
```

#### Process Batch Payouts
```javascript
const response = await fetch('/api/operators/payouts/batch-process', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    payouts: [
      {
        booking_id: 'booking-1',
        operator_id: 'operator-1',
        payment_method_id: 'method-1'
      },
      {
        booking_id: 'booking-2',
        operator_id: 'operator-2',
        payment_method_id: 'method-2'
      }
    ]
  })
});
```

## Fee Structure

| Method | Fee | Settlement Time |
|--------|-----|----------------|
| ACH Standard | $0 | 1-2 business days |
| ACH Instant | 1.5% (max $0.50) | Instant |
| Coinbase Wallet | 1% + $0.10 gas | Instant |
| Bank Wire | $25 | Same day |

## Security

### Account Verification

1. **Plaid Integration**
   - OAuth-based bank login
   - Instant verification
   - Real-time balance checks
   - Secure token exchange

2. **Micro-deposits**
   - Send 2 small deposits
   - Operator verifies amounts
   - Confirms account ownership

3. **Manual Review**
   - Admin verification
   - Document upload
   - Voided check validation

### Data Protection

- ACH account numbers encrypted at rest
- Only last 4 digits shown in UI
- PCI DSS compliance for card data
- Audit logging for all payout operations

### Fraud Prevention

- Payout velocity limits
- Operator identity verification (KYC)
- Booking completion requirement
- Manual review for large amounts

## Error Handling

### Payout Failures

**ACH Failures:**
```json
{
  "error_code": "insufficient_funds",
  "error_message": "Escrow account has insufficient funds",
  "retry_eligible": true
}
```

**Coinbase Failures:**
```json
{
  "error_code": "invalid_address",
  "error_message": "Wallet address is invalid or not on Base network",
  "retry_eligible": false
}
```

### Retry Logic

- Automatic retry for transient errors
- Maximum 3 retry attempts
- Exponential backoff (1min, 5min, 15min)
- Admin notification after 3 failures

## Monitoring

### Payout Dashboard (Admin)

- Total payouts processed
- Pending payouts
- Failed payouts requiring attention
- Average settlement time
- Fee breakdown
- Payout volume by method

### Operator Dashboard

- Upcoming payouts
- Payout history
- Total earnings
- Payment method status
- Transaction details

## Compliance

### Tax Reporting

- Annual 1099 forms for operators
- Transaction history export
- CSV download for accounting
- IRS reporting integration

### Record Keeping

- 7-year payout history retention
- Audit trail for all transactions
- Compliance reports
- Dispute management

## Testing

### Sandbox Mode

**Stripe Test Cards:**
```
Routing: 110000000
Account: 000123456789
```

**Plaid Sandbox:**
```
Username: user_good
Password: pass_good
```

**Coinbase Testnet:**
```
Network: Base Goerli
Wallet: Test wallet addresses
```

### Test Scenarios

1. Successful ACH payout
2. Failed ACH (insufficient funds)
3. Coinbase wallet payout
4. Batch processing
5. Retry failed payout

## Troubleshooting

### Common Issues

**"Payment method not verified"**
- Complete Plaid verification
- Or wait for micro-deposit verification

**"Insufficient escrow balance"**
- Check USDC balance in escrow wallet
- Fund escrow wallet via Coinbase

**"Invalid wallet address"**
- Verify address format
- Ensure Base network compatibility
- Test with small amount first

**"Payout processing stuck"**
- Check transaction status via Stripe/Coinbase
- Review error logs
- Contact support for manual intervention

## Support

For operator payout issues:
- Email: payouts@tourpay.com
- Phone: 1-800-TOURPAY
- Support portal: https://support.tourpay.com

## Future Enhancements

- [ ] International payouts (Wise, PayPal)
- [ ] Crypto payout options (BTC, ETH)
- [ ] Scheduled recurring payouts
- [ ] Dynamic fee optimization
- [ ] Multi-currency support
- [ ] Instant settlement via Stripe Instant Payouts
