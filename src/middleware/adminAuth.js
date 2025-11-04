const jwt = require('jsonwebtoken');
const AdminSession = require('../models/AdminSession');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-here';

/**
 * Middleware to authenticate admin users via JWT
 */
exports.authenticateAdmin = async (req, res, next) => {
    try {
        // Get token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Please log in.'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify JWT token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    message: 'Token has expired. Please refresh your token.',
                    code: 'TOKEN_EXPIRED'
                });
            }
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please log in again.'
            });
        }

        // Find session in database
        const session = await AdminSession.findByToken(token);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Session not found or has expired. Please log in again.'
            });
        }

        // Check if user is active
        if (!session.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Attach user info to request
        req.user = {
            userId: session.user_id,
            email: session.email,
            name: session.name,
            role: session.role
        };
        req.sessionId = session.id;

        next();

    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during authentication'
        });
    }
};

/**
 * Middleware to check if user has required role
 */
exports.requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to perform this action',
                required_role: allowedRoles,
                your_role: req.user.role
            });
        }

        next();
    };
};

/**
 * Middleware to check if user is super admin
 */
exports.requireSuperAdmin = (req, res, next) => {
    return exports.requireRole('super_admin')(req, res, next);
};

/**
 * Middleware to check if user is admin or higher
 */
exports.requireAdmin = (req, res, next) => {
    return exports.requireRole('super_admin', 'admin')(req, res, next);
};
