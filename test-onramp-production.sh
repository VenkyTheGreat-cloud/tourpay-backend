#!/bin/bash

# TourPay Coinbase Onramp - Production Test Script
# This script tests the Coinbase onramp functionality on the deployed Render service

# Configuration
BASE_URL="https://tourpay-payment-widget.onrender.com"
# Alternatively use: BASE_URL="https://tourpay-backend.onrender.com"

echo "========================================"
echo "TourPay Coinbase Onramp Test"
echo "========================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Test Health
echo -e "${YELLOW}[1/5] Testing Health Endpoint...${NC}"
HEALTH=$(curl -s "$BASE_URL/health")
if [[ $? -eq 0 ]]; then
  echo -e "${GREEN}✓ Server is healthy${NC}"
  echo "$HEALTH" | jq .
else
  echo -e "${RED}✗ Health check failed${NC}"
  exit 1
fi
echo ""

# Step 2: Test API Info
echo -e "${YELLOW}[2/5] Testing API Info...${NC}"
API_INFO=$(curl -s "$BASE_URL/")
if [[ $? -eq 0 ]]; then
  echo -e "${GREEN}✓ API is responding${NC}"
  echo "$API_INFO" | jq .
else
  echo -e "${RED}✗ API info failed${NC}"
  exit 1
fi
echo ""

# Step 3: Get JWT Token (You need to replace this with actual login)
echo -e "${YELLOW}[3/5] Authentication Required${NC}"
echo "Please provide a JWT token to continue testing."
echo "You can get one by:"
echo "  1. Logging in via /api/auth/admin/login"
echo "  2. Or using an existing user token"
echo ""
read -p "Enter your JWT token (or press Enter to skip wallet tests): " JWT_TOKEN
echo ""

if [[ -z "$JWT_TOKEN" ]]; then
  echo -e "${YELLOW}⊘ Skipping wallet tests (no token provided)${NC}"
  echo ""
  echo "To test wallet endpoints manually, use:"
  echo ""
  echo "# Create wallet"
  echo "curl -X POST $BASE_URL/api/wallet/create \\"
  echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
  echo "  -H \"Content-Type: application/json\""
  echo ""
  echo "# Fund wallet (Coinbase Onramp)"
  echo "curl -X POST $BASE_URL/api/wallet/fund \\"
  echo "  -H \"Authorization: Bearer YOUR_TOKEN\" \\"
  echo "  -H \"Content-Type: application/json\" \\"
  echo "  -d '{\"amount\": 100, \"currency\": \"CAD\"}'"
  echo ""
  exit 0
fi

# Step 4: Create Wallet
echo -e "${YELLOW}[4/5] Creating Wallet...${NC}"
CREATE_WALLET=$(curl -s -X POST "$BASE_URL/api/wallet/create" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json")

if echo "$CREATE_WALLET" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Wallet created successfully${NC}"
  echo "$CREATE_WALLET" | jq .
else
  echo -e "${YELLOW}⊘ Wallet may already exist or error occurred${NC}"
  echo "$CREATE_WALLET" | jq .
fi
echo ""

# Step 5: Initiate Coinbase Onramp
echo -e "${YELLOW}[5/5] Initiating Coinbase Onramp Session...${NC}"
ONRAMP=$(curl -s -X POST "$BASE_URL/api/wallet/fund" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "CAD"}')

if echo "$ONRAMP" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Onramp session created${NC}"
  echo "$ONRAMP" | jq .

  # Extract onramp URL
  ONRAMP_URL=$(echo "$ONRAMP" | jq -r '.onrampUrl')
  echo ""
  echo -e "${GREEN}========================================"
  echo "SUCCESS! Open this URL to fund wallet:"
  echo "========================================"
  echo -e "${YELLOW}$ONRAMP_URL${NC}"
  echo -e "${GREEN}========================================${NC}"
else
  echo -e "${RED}✗ Failed to create onramp session${NC}"
  echo "$ONRAMP" | jq .
  exit 1
fi
echo ""

# Bonus: Check wallet balance
echo -e "${YELLOW}[BONUS] Checking Wallet Balance...${NC}"
BALANCE=$(curl -s "$BASE_URL/api/wallet/balance" \
  -H "Authorization: Bearer $JWT_TOKEN")

if echo "$BALANCE" | jq -e '.success' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Balance retrieved${NC}"
  echo "$BALANCE" | jq .
else
  echo -e "${YELLOW}⊘ Could not retrieve balance${NC}"
  echo "$BALANCE" | jq .
fi
echo ""

echo -e "${GREEN}========================================"
echo "Test Complete!"
echo "========================================"
echo "Next steps:"
echo "1. Open the Coinbase Onramp URL in your browser"
echo "2. Complete the payment flow"
echo "3. Check your wallet balance again after payment"
echo -e "${GREEN}========================================${NC}"
