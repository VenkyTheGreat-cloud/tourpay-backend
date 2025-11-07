const coinbaseService = require('../services/coinbaseService');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../config/logger');

/**
 * Create new wallet for user
 * POST /api/wallet/create
 */
exports.createWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user already has a wallet
    const existingWallet = await Wallet.findByUserId(userId);
    if (existingWallet) {
      return res.status(400).json({
        success: false,
        error: 'User already has a wallet',
        wallet: existingWallet
      });
    }

    // Create wallet via Coinbase (if API keys configured)
    let coinbaseWallet = null;
    if (process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET) {
      try {
        coinbaseWallet = await coinbaseService.createWallet(userId, `TourPay Wallet - User ${userId}`);
      } catch (error) {
        logger.warn('Failed to create Coinbase wallet:', error.message);
      }
    }

    // Create wallet in database
    const wallet = await Wallet.create({
      userId,
      walletAddress: coinbaseWallet?.walletAddress || `0x${userId.replace(/-/g, '')}`,
      coinbaseWalletId: coinbaseWallet?.walletId,
      balance: '0.00',
      network: coinbaseWallet?.network || 'base'
    });

    logger.info(`Wallet created for user ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Wallet created successfully',
      wallet: {
        id: wallet.id,
        address: wallet.wallet_address,
        balance: wallet.balance_usdc,
        network: wallet.network
      }
    });
  } catch (error) {
    logger.error('Error creating wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create wallet',
      message: error.message
    });
  }
};

/**
 * Initiate Coinbase Onramp session for funding wallet
 * POST /api/wallet/fund
 */
exports.fundWallet = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, currency = 'USD' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Amount must be greater than 0'
      });
    }

    // Get or create user's wallet
    let wallet = await Wallet.findByUserId(userId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found. Please create a wallet first',
        action: 'create_wallet'
      });
    }

    // Check if Coinbase credentials are configured
    if (!process.env.COINBASE_API_KEY || !process.env.COINBASE_API_SECRET) {
      // Return a mock onramp URL for testing without API keys
      const mockSessionId = `mock-${Date.now()}`;
      return res.json({
        success: true,
        message: 'Mock Coinbase Onramp session created (API keys not configured)',
        onrampUrl: `https://pay.coinbase.com/buy?session_id=${mockSessionId}`,
        sessionId: mockSessionId,
        amount,
        currency,
        estimatedUSDC: amount,
        fees: {
          coinbase: amount * 0.01,
          network: 0.10
        },
        walletAddress: wallet.wallet_address,
        note: 'This is a mock session. Configure COINBASE_API_KEY and COINBASE_API_SECRET for live onramp.'
      });
    }

    // Create Coinbase Onramp session
    const onrampSession = await coinbaseService.createOnrampSession({
      userId,
      destinationWalletAddress: wallet.wallet_address,
      amount,
      currency
    });

    logger.info(`Onramp session created for user ${userId}: ${onrampSession.sessionId}`);

    res.json({
      success: true,
      message: 'Coinbase Onramp session created successfully',
      onrampUrl: onrampSession.onrampUrl,
      sessionId: onrampSession.sessionId,
      quoteId: onrampSession.quoteId,
      estimatedUSDC: onrampSession.estimatedUSDC,
      fees: onrampSession.fees,
      walletAddress: wallet.wallet_address
    });
  } catch (error) {
    logger.error('Error creating onramp session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create onramp session',
      message: error.message
    });
  }
};

/**
 * Get wallet balance
 * GET /api/wallet/balance
 */
exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    // Get live balance from Coinbase if configured
    let liveBalance = null;
    if (wallet.coinbase_wallet_id && process.env.COINBASE_API_KEY) {
      try {
        liveBalance = await coinbaseService.getWalletBalance(wallet.coinbase_wallet_id);
      } catch (error) {
        logger.warn('Failed to fetch live balance from Coinbase:', error.message);
      }
    }

    res.json({
      success: true,
      balance: {
        usdc: liveBalance?.balance || wallet.balance_usdc,
        currency: 'USDC',
        available: liveBalance?.available || wallet.balance_usdc,
        network: wallet.network
      },
      wallet: {
        address: wallet.wallet_address,
        id: wallet.id
      }
    });
  } catch (error) {
    logger.error('Error getting wallet balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet balance',
      message: error.message
    });
  }
};

/**
 * Get wallet details
 * GET /api/wallet
 */
exports.getWallet = async (req, res) => {
  try {
    const userId = req.user.id;

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found',
        action: 'create_wallet'
      });
    }

    res.json({
      success: true,
      wallet: {
        id: wallet.id,
        address: wallet.wallet_address,
        balance: wallet.balance_usdc,
        network: wallet.network,
        createdAt: wallet.created_at,
        updatedAt: wallet.updated_at
      }
    });
  } catch (error) {
    logger.error('Error getting wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet details',
      message: error.message
    });
  }
};

/**
 * Get wallet transaction history
 * GET /api/wallet/transactions
 */
exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const wallet = await Wallet.findByUserId(userId);
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const transactions = await Transaction.findByUserId(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.transaction_type,
        amount: tx.amount_usdc,
        currency: 'USDC',
        status: tx.status,
        description: tx.description,
        txHash: tx.blockchain_tx_hash,
        createdAt: tx.created_at
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: transactions.length
      }
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      message: error.message
    });
  }
};
