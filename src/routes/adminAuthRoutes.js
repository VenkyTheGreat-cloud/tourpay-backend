const express = require('express');
const router = express.Router();
const adminAuthController = require('../controllers/adminAuthController');
const { authenticateAdmin } = require('../middleware/adminAuth');

/**
 * @route   POST /api/auth/admin/login
 * @desc    Login admin user
 * @access  Public
 */
router.post('/login', adminAuthController.login);

/**
 * @route   POST /api/auth/admin/logout
 * @desc    Logout admin user
 * @access  Private (requires authentication)
 */
router.post('/logout', authenticateAdmin, adminAuthController.logout);

/**
 * @route   POST /api/auth/admin/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token', adminAuthController.refreshToken);

/**
 * @route   GET /api/auth/admin/me
 * @desc    Get current logged-in admin user
 * @access  Private (requires authentication)
 */
router.get('/me', authenticateAdmin, adminAuthController.getCurrentUser);

/**
 * @route   POST /api/auth/admin/change-password
 * @desc    Change password for current user
 * @access  Private (requires authentication)
 */
router.post('/change-password', authenticateAdmin, adminAuthController.changePassword);

module.exports = router;
