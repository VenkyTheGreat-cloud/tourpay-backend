const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// POST /api/webhooks/coinbase - Handle Coinbase webhooks
router.post('/coinbase', express.raw({ type: 'application/json' }), webhookController.handleCoinbaseWebhook);

// POST /api/webhooks/blockchain - Handle blockchain event webhooks
router.post('/blockchain', express.json(), webhookController.handleBlockchainWebhook);

module.exports = router;
