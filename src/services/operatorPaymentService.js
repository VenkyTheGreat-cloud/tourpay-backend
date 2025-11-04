const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const coinbaseService = require('./coinbaseService');
const smartContractService = require('./smartContractService');

class OperatorPaymentService {
  constructor() {
    // Plaid for ACH verification and transfers
    this.plaidClientId = process.env.PLAID_CLIENT_ID;
    this.plaidSecret = process.env.PLAID_SECRET;
    this.plaidEnv = process.env.PLAID_ENV || 'sandbox';
    this.plaidBaseUrl = this.getPlaidUrl();

    // Stripe for ACH payouts (alternative)
    this.stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    this.stripeBaseUrl = 'https://api.stripe.com/v1';

    // Circle for USDC transfers (alternative to Coinbase)
    this.circleApiKey = process.env.CIRCLE_API_KEY;
    this.circleBaseUrl = 'https://api.circle.com/v1';
  }

  getPlaidUrl() {
    const urls = {
      sandbox: 'https://sandbox.plaid.com',
      development: 'https://development.plaid.com',
      production: 'https://production.plaid.com'
    };
    return urls[this.plaidEnv] || urls.sandbox;
  }

  /**
   * Verify bank account via Plaid
   * @param {string} publicToken - Plaid public token from Link
   * @returns {Promise<Object>} - Account details
   */
  async verifyBankAccountWithPlaid(publicToken) {
    try {
      // Exchange public token for access token
      const tokenResponse = await axios.post(
        `${this.plaidBaseUrl}/item/public_token/exchange`,
        {
          client_id: this.plaidClientId,
          secret: this.plaidSecret,
          public_token: publicToken
        }
      );

      const accessToken = tokenResponse.data.access_token;

      // Get account details
      const authResponse = await axios.post(
        `${this.plaidBaseUrl}/auth/get`,
        {
          client_id: this.plaidClientId,
          secret: this.plaidSecret,
          access_token: accessToken
        }
      );

      const account = authResponse.data.accounts[0];
      const numbers = authResponse.data.numbers.ach[0];

      return {
        accessToken,
        accountId: account.account_id,
        routingNumber: numbers.routing,
        accountNumber: numbers.account,
        accountType: account.subtype, // 'checking' or 'savings'
        bankName: authResponse.data.item.institution_id,
        verified: true
      };
    } catch (error) {
      console.error('Error verifying bank account with Plaid:', error.response?.data || error.message);
      throw new Error(`Failed to verify bank account: ${error.message}`);
    }
  }

  /**
   * Create ACH payout via Stripe
   * @param {Object} params - Payout parameters
   * @returns {Promise<Object>} - Payout details
   */
  async createACHPayoutViaStripe({
    operator_id,
    amount_usd,
    routing_number,
    account_number,
    account_holder_name,
    account_type = 'checking',
    description = 'TourPay operator payout'
  }) {
    try {
      // Convert amount to cents
      const amountCents = Math.round(parseFloat(amount_usd) * 100);

      // Create or get Stripe connected account for operator
      const stripeAccountId = await this.getOrCreateStripeAccount(operator_id);

      // Create external bank account
      const bankAccountResponse = await axios.post(
        `${this.stripeBaseUrl}/accounts/${stripeAccountId}/external_accounts`,
        new URLSearchParams({
          external_account: {
            object: 'bank_account',
            country: 'US',
            currency: 'usd',
            routing_number: routing_number,
            account_number: account_number,
            account_holder_name: account_holder_name,
            account_holder_type: 'company'
          }
        }),
        {
          headers: {
            'Authorization': `Bearer ${this.stripeSecretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      // Create payout
      const payoutResponse = await axios.post(
        `${this.stripeBaseUrl}/payouts`,
        new URLSearchParams({
          amount: amountCents,
          currency: 'usd',
          method: 'standard', // standard = ACH (1-2 business days)
          destination: bankAccountResponse.data.id,
          description: description
        }),
        {
          headers: {
            'Authorization': `Bearer ${this.stripeSecretKey}`,
            'Stripe-Account': stripeAccountId,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        transactionId: payoutResponse.data.id,
        amount: amount_usd,
        status: payoutResponse.data.status,
        arrivalDate: new Date(payoutResponse.data.arrival_date * 1000),
        bankAccount: this.maskAccountNumber(account_number),
        method: 'ach'
      };
    } catch (error) {
      console.error('Error creating ACH payout via Stripe:', error.response?.data || error.message);
      throw new Error(`Failed to create ACH payout: ${error.message}`);
    }
  }

  /**
   * Create payout to operator's Coinbase wallet
   * @param {Object} params - Payout parameters
   * @returns {Promise<Object>} - Payout details
   */
  async createCoinbaseWalletPayout({
    operator_id,
    amount_usdc,
    wallet_address,
    description = 'TourPay operator payout'
  }) {
    try {
      // Send USDC from escrow wallet to operator wallet
      const result = await coinbaseService.sendUSDC({
        fromWalletId: process.env.ESCROW_WALLET_ID,
        toAddress: wallet_address,
        amount: amount_usdc,
        description: description
      });

      return {
        transactionId: result.transactionId,
        amount: amount_usdc,
        currency: 'USDC',
        status: result.status,
        network: result.network,
        txHash: result.txHash,
        walletAddress: wallet_address,
        method: 'coinbase_wallet'
      };
    } catch (error) {
      console.error('Error creating Coinbase wallet payout:', error);
      throw new Error(`Failed to create Coinbase wallet payout: ${error.message}`);
    }
  }

  /**
   * Create payout via blockchain transfer
   * @param {Object} params - Payout parameters
   * @returns {Promise<Object>} - Payout details
   */
  async createBlockchainPayout({
    operator_id,
    amount_usdc,
    wallet_address,
    booking_id = null
  }) {
    try {
      // Use smart contract service to send USDC
      const result = await smartContractService.sendUSDCToOperator(
        wallet_address,
        amount_usdc,
        booking_id
      );

      return {
        transactionHash: result.transactionHash,
        amount: amount_usdc,
        currency: 'USDC',
        status: result.status,
        network: 'base',
        walletAddress: wallet_address,
        method: 'blockchain'
      };
    } catch (error) {
      console.error('Error creating blockchain payout:', error);
      throw new Error(`Failed to create blockchain payout: ${error.message}`);
    }
  }

  /**
   * Process payout based on payment method
   * @param {Object} params - Payout parameters
   * @returns {Promise<Object>} - Payout result
   */
  async processPayout({
    operator_id,
    booking_id,
    payment_method,
    amount_usdc,
    amount_usd
  }) {
    try {
      let result;

      switch (payment_method.payment_type) {
        case 'ach':
          // Convert USDC to USD first via Coinbase
          const usdAmount = amount_usd || await this.convertUSDCToUSD(amount_usdc);

          result = await this.createACHPayoutViaStripe({
            operator_id,
            amount_usd: usdAmount,
            routing_number: payment_method.ach_routing_number,
            account_number: payment_method.ach_account_number,
            account_holder_name: payment_method.ach_bank_name,
            account_type: payment_method.ach_account_type,
            description: `TourPay payout for booking ${booking_id}`
          });
          break;

        case 'coinbase_wallet':
          result = await this.createCoinbaseWalletPayout({
            operator_id,
            amount_usdc,
            wallet_address: payment_method.coinbase_wallet_address,
            description: `TourPay payout for booking ${booking_id}`
          });
          break;

        case 'bank_wire':
          // For bank wires, would integrate with a wire transfer provider
          throw new Error('Bank wire payouts not yet implemented');

        default:
          throw new Error(`Unsupported payment method type: ${payment_method.payment_type}`);
      }

      return {
        success: true,
        payoutId: result.transactionId || result.transactionHash,
        ...result
      };
    } catch (error) {
      console.error('Error processing payout:', error);
      throw new Error(`Failed to process payout: ${error.message}`);
    }
  }

  /**
   * Get or create Stripe connected account for operator
   * @param {string} operator_id - Operator ID
   * @returns {Promise<string>} - Stripe account ID
   */
  async getOrCreateStripeAccount(operator_id) {
    // In production, you would store this in database
    // For now, return placeholder
    return `acct_${operator_id.substring(0, 16)}`;
  }

  /**
   * Convert USDC to USD
   * @param {number} amount_usdc - Amount in USDC
   * @returns {Promise<number>} - Amount in USD
   */
  async convertUSDCToUSD(amount_usdc) {
    // USDC is pegged 1:1 to USD, but account for small variations
    // In production, you might want to check actual exchange rate
    return parseFloat(amount_usdc).toFixed(2);
  }

  /**
   * Check payout status via Stripe
   * @param {string} payoutId - Stripe payout ID
   * @returns {Promise<Object>} - Payout status
   */
  async checkStripePayoutStatus(payoutId) {
    try {
      const response = await axios.get(
        `${this.stripeBaseUrl}/payouts/${payoutId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.stripeSecretKey}`
          }
        }
      );

      return {
        id: response.data.id,
        status: response.data.status,
        amount: response.data.amount / 100,
        arrivalDate: new Date(response.data.arrival_date * 1000),
        failureCode: response.data.failure_code,
        failureMessage: response.data.failure_message
      };
    } catch (error) {
      console.error('Error checking Stripe payout status:', error.response?.data || error.message);
      throw new Error(`Failed to check payout status: ${error.message}`);
    }
  }

  /**
   * Check Coinbase transaction status
   * @param {string} transactionId - Coinbase transaction ID
   * @returns {Promise<Object>} - Transaction status
   */
  async checkCoinbasePayoutStatus(transactionId) {
    try {
      return await coinbaseService.getTransactionStatus(transactionId);
    } catch (error) {
      console.error('Error checking Coinbase payout status:', error);
      throw new Error(`Failed to check Coinbase payout status: ${error.message}`);
    }
  }

  /**
   * Check blockchain transaction status
   * @param {string} txHash - Transaction hash
   * @returns {Promise<Object>} - Transaction status
   */
  async checkBlockchainPayoutStatus(txHash) {
    try {
      return await smartContractService.getTransactionStatus(txHash);
    } catch (error) {
      console.error('Error checking blockchain payout status:', error);
      throw new Error(`Failed to check blockchain payout status: ${error.message}`);
    }
  }

  /**
   * Estimate payout fee
   * @param {string} payment_type - Payment method type
   * @param {number} amount - Amount
   * @returns {number} - Estimated fee
   */
  estimatePayoutFee(payment_type, amount) {
    const fees = {
      ach: 0, // Stripe standard ACH is free
      coinbase_wallet: parseFloat(amount) * 0.01, // 1% for crypto
      bank_wire: 25.00, // Flat fee for wire
      blockchain: 0.10 // Base network gas fee (approximate)
    };

    return fees[payment_type] || 0;
  }

  /**
   * Mask account number for display
   * @param {string} account_number - Account number
   * @returns {string} - Masked account number
   */
  maskAccountNumber(account_number) {
    if (!account_number || account_number.length < 4) {
      return '****';
    }
    return '****' + account_number.slice(-4);
  }

  /**
   * Validate payout eligibility
   * @param {Object} operator - Operator details
   * @param {Object} booking - Booking details
   * @returns {Object} - Validation result
   */
  validatePayoutEligibility(operator, booking) {
    const errors = [];

    // Check operator status
    if (operator.status !== 'approved') {
      errors.push('Operator account is not approved');
    }

    // Check booking status
    if (booking.status !== 'checked_in' && booking.status !== 'completed') {
      errors.push('Booking must be checked-in or completed before payout');
    }

    // Check if already paid
    if (booking.payout_completed) {
      errors.push('Payout already processed for this booking');
    }

    return {
      eligible: errors.length === 0,
      errors
    };
  }
}

module.exports = new OperatorPaymentService();
