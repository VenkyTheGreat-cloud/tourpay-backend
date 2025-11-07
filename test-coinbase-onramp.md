# Testing Coinbase Onramp Functionality

This document provides step-by-step instructions for testing the TourPay Coinbase Onramp integration.

## Available Endpoints

### 1. Create Wallet
**Endpoint:** `POST /api/wallet/create`
**Authentication:** Required (Bearer token)

Creates a new wallet for the authenticated user.

**Request:**
```bash
curl -X POST http://localhost:3000/api/wallet/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "success": true,
  "message": "Wallet created successfully",
  "wallet": {
    "id": "uuid",
    "address": "0x...",
    "balance": "0.00",
    "network": "base"
  }
}
```

---

### 2. Initiate Coinbase Onramp (Fund Wallet)
**Endpoint:** `POST /api/wallet/fund`
**Authentication:** Required (Bearer token)

Initiates a Coinbase Onramp session to fund the user's wallet with USDC.

**Request:**
```bash
curl -X POST http://localhost:3000/api/wallet/fund \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD"
  }'
```

**Parameters:**
- `amount` (required): Amount to fund in the specified currency
- `currency` (optional): Currency to pay with (default: "USD", can be "CAD", "EUR", etc.)

**Response (Mock Mode - No API Keys):**
```json
{
  "success": true,
  "message": "Mock Coinbase Onramp session created (API keys not configured)",
  "onrampUrl": "https://pay.coinbase.com/buy?session_id=mock-1234567890",
  "sessionId": "mock-1234567890",
  "amount": 100,
  "currency": "USD",
  "estimatedUSDC": 100,
  "fees": {
    "coinbase": 1,
    "network": 0.1
  },
  "walletAddress": "0x...",
  "note": "This is a mock session. Configure COINBASE_API_KEY and COINBASE_API_SECRET for live onramp."
}
```

**Response (Live Mode - With API Keys):**
```json
{
  "success": true,
  "message": "Coinbase Onramp session created successfully",
  "onrampUrl": "https://pay.coinbase.com/buy?session_id=abc-123",
  "sessionId": "abc-123",
  "quoteId": "quote_xyz",
  "estimatedUSDC": 99.5,
  "fees": {
    "coinbase": 0.99,
    "network": 0.10
  },
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

---

### 3. Get Wallet Balance
**Endpoint:** `GET /api/wallet/balance`
**Authentication:** Required (Bearer token)

Retrieves the current wallet balance.

**Request:**
```bash
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "balance": {
    "usdc": "150.50",
    "currency": "USDC",
    "available": "150.50",
    "network": "base"
  },
  "wallet": {
    "address": "0x...",
    "id": "uuid"
  }
}
```

---

### 4. Get Wallet Details
**Endpoint:** `GET /api/wallet`
**Authentication:** Required (Bearer token)

Retrieves full wallet information.

**Request:**
```bash
curl http://localhost:3000/api/wallet \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "wallet": {
    "id": "uuid",
    "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "balance": "150.50",
    "network": "base",
    "createdAt": "2025-11-07T20:00:00.000Z",
    "updatedAt": "2025-11-07T21:00:00.000Z"
  }
}
```

---

### 5. Get Transaction History
**Endpoint:** `GET /api/wallet/transactions`
**Authentication:** Required (Bearer token)

Retrieves wallet transaction history.

**Request:**
```bash
curl "http://localhost:3000/api/wallet/transactions?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Query Parameters:**
- `limit` (optional): Number of transactions to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)

**Response:**
```json
{
  "success": true,
  "transactions": [
    {
      "id": "uuid",
      "type": "deposit",
      "amount": "100.00",
      "currency": "USDC",
      "status": "completed",
      "description": "Coinbase Onramp funding",
      "txHash": "0xabc...",
      "createdAt": "2025-11-07T21:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

---

## Complete Testing Flow

### Step 1: Register/Login to Get JWT Token

First, you need to authenticate to get a JWT token. You can use the admin auth endpoints or create a user auth endpoint.

**For testing, create a mock token or use admin login:**
```bash
# Admin login
curl -X POST http://localhost:3000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "uuid",
    "username": "admin"
  }
}
```

Save the token for subsequent requests.

---

### Step 2: Create Wallet

```bash
export JWT_TOKEN="your-jwt-token-here"

curl -X POST http://localhost:3000/api/wallet/create \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

---

### Step 3: Initiate Coinbase Onramp

```bash
curl -X POST http://localhost:3000/api/wallet/fund \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "USD"
  }'
```

**Copy the `onrampUrl` from the response** and open it in a browser to complete the payment flow.

---

### Step 4: Check Wallet Balance

After funding (or simulating funding), check the balance:

```bash
curl http://localhost:3000/api/wallet/balance \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

### Step 5: View Transaction History

```bash
curl http://localhost:3000/api/wallet/transactions \
  -H "Authorization: Bearer $JWT_TOKEN"
```

---

## Testing with Production Server

To test with the production server at https://tourpay-backend.onrender.com:

Replace `http://localhost:3000` with `https://tourpay-backend.onrender.com` in all the above commands.

**Example:**
```bash
curl -X POST https://tourpay-backend.onrender.com/api/wallet/fund \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 100,
    "currency": "CAD"
  }'
```

---

## Mock Mode vs Live Mode

### Mock Mode (Default - No API Keys)

When `COINBASE_API_KEY` and `COINBASE_API_SECRET` are not configured, the API returns mock responses:

- ✅ All endpoints work
- ✅ Returns mock Coinbase Onramp URLs
- ✅ Simulates the onramp flow
- ❌ Does not create real Coinbase sessions
- ❌ Does not interact with actual Coinbase API

**Use this for:**
- Testing API integration
- Frontend development
- Demo purposes

### Live Mode (With API Keys)

When Coinbase API credentials are configured:

- ✅ Creates real Coinbase Onramp sessions
- ✅ Returns actual Coinbase payment URLs
- ✅ Processes real USDC funding
- ✅ Interacts with Coinbase API

**Use this for:**
- Production environment
- Real transactions
- Actual user payments

---

## Environment Variables for Live Mode

To enable live Coinbase Onramp:

```bash
# .env file
COINBASE_API_KEY=your-coinbase-api-key
COINBASE_API_SECRET=your-coinbase-api-secret
COINBASE_BASE_URL=https://api.coinbase.com/v2
COINBASE_ONRAMP_URL=https://pay.coinbase.com
```

Get your API keys from: https://www.coinbase.com/settings/api

---

## Error Handling

### Invalid Amount
```json
{
  "success": false,
  "error": "Invalid amount. Amount must be greater than 0"
}
```

### Wallet Not Found
```json
{
  "success": false,
  "error": "Wallet not found. Please create a wallet first",
  "action": "create_wallet"
}
```

### Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized. Token is missing or invalid"
}
```

---

## Frontend Integration Example

```javascript
// React/Next.js example
const fundWallet = async (amount, currency = 'USD') => {
  try {
    const response = await fetch('/api/wallet/fund', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount, currency })
    });

    const data = await response.json();

    if (data.success) {
      // Open Coinbase Onramp URL
      window.location.href = data.onrampUrl;
    } else {
      console.error('Error:', data.error);
    }
  } catch (error) {
    console.error('Failed to create onramp session:', error);
  }
};

// Usage
fundWallet(100, 'CAD');
```

---

## Support

For issues or questions:
- Check server logs for detailed error messages
- Verify JWT token is valid and not expired
- Ensure wallet exists before calling fund endpoint
- Confirm Coinbase API credentials if using live mode

---

## Next Steps

1. ✅ Test wallet creation
2. ✅ Test onramp session creation
3. ✅ Integrate with frontend
4. ⏳ Configure Coinbase API keys for live mode
5. ⏳ Test with real Coinbase payments
6. ⏳ Implement webhook handler for payment confirmations
