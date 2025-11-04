const jwt = require('jsonwebtoken');
const AdminUser = require('../models/AdminUser');
const AdminSession = require('../models/AdminSession');
const ActivityLog = require('../models/ActivityLog');

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key-here';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret-key-here';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '1h';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

/**
 * Login admin user
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await AdminUser.findByEmail(email);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if user is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Check if account is locked
        if (AdminUser.isAccountLocked(user)) {
            const lockTimeRemaining = Math.ceil(
                (new Date(user.locked_until) - new Date()) / 1000 / 60
            );
            return res.status(403).json({
                success: false,
                message: `Account is locked due to too many failed login attempts. Try again in ${lockTimeRemaining} minutes.`
            });
        }

        // Validate password
        const isValidPassword = await AdminUser.validatePassword(password, user.password_hash);

        if (!isValidPassword) {
            // Increment failed attempts
            const updated = await AdminUser.incrementFailedAttempts(user.id);

            const remainingAttempts = 5 - updated.failed_login_attempts;

            if (remainingAttempts <= 0) {
                return res.status(403).json({
                    success: false,
                    message: 'Account locked due to too many failed login attempts. Try again in 30 minutes.'
                });
            }

            return res.status(401).json({
                success: false,
                message: `Invalid email or password. ${remainingAttempts} attempts remaining.`
            });
        }

        // Generate JWT tokens
        const accessToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        const refreshToken = jwt.sign(
            {
                userId: user.id,
                email: user.email,
                type: 'refresh'
            },
            JWT_REFRESH_SECRET,
            { expiresIn: JWT_REFRESH_EXPIRY }
        );

        // Calculate expiry timestamps
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour from now

        const refreshExpiresAt = new Date();
        refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 7); // 7 days from now

        // Create session
        const session = await AdminSession.create({
            user_id: user.id,
            token: accessToken,
            refresh_token: refreshToken,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent'),
            expires_at: expiresAt,
            refresh_expires_at: refreshExpiresAt
        });

        // Update last login
        await AdminUser.updateLastLogin(user.id);

        // Log activity
        await ActivityLog.create({
            user_id: user.id,
            action: 'login',
            details: { method: 'password' },
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
        });

        // Return tokens and user info
        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                },
                accessToken,
                refreshToken,
                expiresIn: 3600 // 1 hour in seconds
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
};

/**
 * Logout admin user
 */
exports.logout = async (req, res) => {
    try {
        const { sessionId } = req;

        if (sessionId) {
            await AdminSession.delete(sessionId);
        }

        // Log activity
        if (req.user) {
            await ActivityLog.create({
                user_id: req.user.userId,
                action: 'logout',
                ip_address: req.ip || req.connection.remoteAddress,
                user_agent: req.get('user-agent')
            });
        }

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred during logout'
        });
    }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        // Find session
        const session = await AdminSession.findByRefreshToken(refreshToken);

        if (!session) {
            return res.status(401).json({
                success: false,
                message: 'Session not found or expired'
            });
        }

        // Check if user is still active
        if (!session.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Your account has been deactivated'
            });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            {
                userId: session.user_id,
                email: session.email,
                role: session.role
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRY }
        );

        res.json({
            success: true,
            data: {
                accessToken,
                expiresIn: 3600
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while refreshing token'
        });
    }
};

/**
 * Get current user info
 */
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await AdminUser.findById(req.user.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                    last_login: user.last_login
                }
            }
        });

    } catch (error) {
        console.error('Get current user error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching user info'
        });
    }
};

/**
 * Change password
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        // Validate new password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        // Get user with password hash
        const user = await AdminUser.findByEmail(req.user.email);

        // Verify current password
        const isValidPassword = await AdminUser.validatePassword(
            currentPassword,
            user.password_hash
        );

        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        await AdminUser.updatePassword(user.id, newPassword);

        // Log activity
        await ActivityLog.create({
            user_id: user.id,
            action: 'password_change',
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while changing password'
        });
    }
};
