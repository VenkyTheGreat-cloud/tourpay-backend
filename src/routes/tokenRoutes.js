const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const tokenController = require('../controllers/tokenController');

// POST /api/tokens/applepay - Create Apple Pay token
router.post('/applepay', authenticateToken, tokenController.createApplePayToken);

// POST /api/tokens/transit - Create Transit Card token
router.post('/transit', authenticateToken, tokenController.createTransitToken);

// POST /api/tokens/discover - Create Discover network token
router.post('/discover', authenticateToken, tokenController.createDiscoverToken);

// POST /api/tokens/googlepay - Create Google Pay token
router.post('/googlepay', authenticateToken, tokenController.createGooglePayToken);

// GET /api/tokens - Get all user tokens
router.get('/', authenticateToken, tokenController.getUserTokens);

// GET /api/tokens/:tokenId - Get specific token details
router.get('/:tokenId', authenticateToken, tokenController.getTokenDetails);

// PUT /api/tokens/:tokenId/deactivate - Deactivate a token
router.put('/:tokenId/deactivate', authenticateToken, tokenController.deactivateToken);

// DELETE /api/tokens/:tokenId - Delete a token
router.delete('/:tokenId', authenticateToken, tokenController.deleteToken);

// POST /api/tokens/:tokenId/use - Process payment using token
router.post('/:tokenId/use', authenticateToken, tokenController.useToken);

module.exports = router;
