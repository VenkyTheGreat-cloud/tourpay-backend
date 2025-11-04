const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const walletController = require('../controllers/walletController');

// POST /api/wallet/fund - Initiate Coinbase Onramp session
router.post('/fund', authenticateToken, walletController.fundWallet);

// GET /api/wallet/balance - Get wallet balance
router.get('/balance', authenticateToken, walletController.getBalance);

// POST /api/wallet/create - Create new wallet for user
router.post('/create', authenticateToken, walletController.createWallet);

// GET /api/wallet - Get wallet details
router.get('/', authenticateToken, walletController.getWallet);

// GET /api/wallet/transactions - Get wallet transaction history
router.get('/transactions', authenticateToken, walletController.getTransactions);

module.exports = router;
