const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class CoinbaseService {
  constructor() {
    this.apiKey = process.env.COINBASE_API_KEY;
    this.apiSecret = process.env.COINBASE_API_SECRET;
    this.baseUrl = process.env.COINBASE_BASE_URL || 'https://api.coinbase.com/v2';
    this.onrampUrl = process.env.COINBASE_ONRAMP_URL || 'https://pay.coinbase.com';
  }

  /**
   * Generate Coinbase Onramp session for funding wallet
   * @param {Object} params - Onramp parameters
   * @returns {Promise<Object>} - Onramp session details
   */
  async createOnrampSession({ userId, destinationWalletAddress, amount, currency = 'USD' }) {
    try {
      const sessionId = uuidv4();

      // Create onramp session with Coinbase
      const response = await axios.post(
        `${this.onrampUrl}/api/v1/buy/quote`,
        {
          destination_wallet: destinationWalletAddress,
          purchase_currency: 'USDC',
          payment_currency: currency,
          payment_amount: amount,
          blockchain: 'base',
          redirect_url: `${process.env.APP_URL}/wallet/funded`,
          session_id: sessionId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        sessionId,
        onrampUrl: response.data.onramp_url || `${this.onrampUrl}/buy?session_id=${sessionId}`,
        quoteId: response.data.quote_id,
        estimatedUSDC: response.data.estimated_usdc,
        fees: response.data.fees
      };
    } catch (error) {
      console.error('Error creating Coinbase Onramp session:', error.response?.data || error.message);
      throw new Error(`Failed to create Onramp session: ${error.message}`);
    }
  }

  /**
   * Get wallet balance from Coinbase
   * @param {string} walletId - Coinbase wallet ID
   * @returns {Promise<Object>} - Wallet balance details
   */
  async getWalletBalance(walletId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/accounts/${walletId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        balance: response.data.data.balance.amount,
        currency: response.data.data.balance.currency,
        available: response.data.data.available_balance?.amount || response.data.data.balance.amount
      };
    } catch (error) {
      console.error('Error getting wallet balance:', error.response?.data || error.message);
      throw new Error(`Failed to get wallet balance: ${error.message}`);
    }
  }

  /**
   * Purchase USDC via Coinbase Onramp
   * @param {Object} params - Purchase parameters
   * @returns {Promise<Object>} - Purchase details
   */
  async purchaseUSDC({ userId, amount, paymentMethod, destinationWallet }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/buys`,
        {
          amount: amount,
          currency: 'USDC',
          payment_method: paymentMethod,
          commit: true
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        transactionId: response.data.data.id,
        amount: response.data.data.amount.amount,
        currency: response.data.data.amount.currency,
        status: response.data.data.status,
        payoutAt: response.data.data.payout_at
      };
    } catch (error) {
      console.error('Error purchasing USDC:', error.response?.data || error.message);
      throw new Error(`Failed to purchase USDC: ${error.message}`);
    }
  }

  /**
   * Check transaction status on Coinbase
   * @param {string} transactionId - Coinbase transaction ID
   * @returns {Promise<Object>} - Transaction status
   */
  async getTransactionStatus(transactionId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transactions/${transactionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        id: response.data.data.id,
        status: response.data.data.status,
        amount: response.data.data.amount.amount,
        currency: response.data.data.amount.currency,
        createdAt: response.data.data.created_at,
        network: response.data.data.network?.name
      };
    } catch (error) {
      console.error('Error getting transaction status:', error.response?.data || error.message);
      throw new Error(`Failed to get transaction status: ${error.message}`);
    }
  }

  /**
   * Create a new Coinbase wallet for user
   * @param {string} userId - User ID
   * @param {string} name - Wallet name
   * @returns {Promise<Object>} - Wallet details
   */
  async createWallet(userId, name = 'TourPay Wallet') {
    try {
      const response = await axios.post(
        `${this.baseUrl}/accounts`,
        {
          name: name,
          currency: 'USDC'
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        walletId: response.data.data.id,
        walletAddress: response.data.data.address,
        currency: response.data.data.currency,
        balance: response.data.data.balance.amount,
        network: response.data.data.network || 'base'
      };
    } catch (error) {
      console.error('Error creating wallet:', error.response?.data || error.message);
      throw new Error(`Failed to create wallet: ${error.message}`);
    }
  }

  /**
   * Send USDC from user wallet
   * @param {Object} params - Send parameters
   * @returns {Promise<Object>} - Send transaction details
   */
  async sendUSDC({ fromWalletId, toAddress, amount, description }) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/accounts/${fromWalletId}/transactions`,
        {
          type: 'send',
          to: toAddress,
          amount: amount,
          currency: 'USDC',
          description: description
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        transactionId: response.data.data.id,
        amount: response.data.data.amount.amount,
        currency: response.data.data.amount.currency,
        status: response.data.data.status,
        network: response.data.data.network,
        txHash: response.data.data.network?.hash
      };
    } catch (error) {
      console.error('Error sending USDC:', error.response?.data || error.message);
      throw new Error(`Failed to send USDC: ${error.message}`);
    }
  }

  /**
   * Verify webhook signature from Coinbase
   * @param {string} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {boolean} - Signature validity
   */
  verifyWebhookSignature(payload, signature) {
    const crypto = require('crypto');
    const computedSignature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computedSignature)
    );
  }

  /**
   * Get exchange rate for CAD to USD
   * @returns {Promise<number>} - Exchange rate
   */
  async getExchangeRate(from = 'CAD', to = 'USD') {
    try {
      const response = await axios.get(
        `${this.baseUrl}/exchange-rates?currency=${from}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return parseFloat(response.data.data.rates[to]);
    } catch (error) {
      console.error('Error getting exchange rate:', error.response?.data || error.message);
      throw new Error(`Failed to get exchange rate: ${error.message}`);
    }
  }
}

module.exports = new CoinbaseService();
