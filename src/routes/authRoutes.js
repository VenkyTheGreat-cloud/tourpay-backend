const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

// POST /api/auth/register - Register new user
router.post('/register', authController.register);

// POST /api/auth/login - Login user
router.post('/login', authController.login);

// POST /api/auth/logout - Logout user
router.post('/logout', authenticateToken, authController.logout);

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', authController.refreshToken);

// GET /api/auth/me - Get current user details
router.get('/me', authenticateToken, authController.getCurrentUser);

// PUT /api/auth/update - Update user profile
router.put('/update', authenticateToken, authController.updateProfile);

// POST /api/auth/change-password - Change password
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
