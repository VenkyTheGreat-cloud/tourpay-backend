const express = require('express');
const router = express.Router();
const AdminUser = require('../models/AdminUser');
const ActivityLog = require('../models/ActivityLog');
const { authenticateAdmin, requireSuperAdmin, requireAdmin } = require('../middleware/adminAuth');

/**
 * @route   GET /api/admin/users
 * @desc    Get all admin users
 * @access  Private (Admin and above)
 */
router.get('/', authenticateAdmin, requireAdmin, async (req, res) => {
    try {
        const { role, is_active } = req.query;

        const users = await AdminUser.findAll({
            role: role || null,
            is_active: is_active !== undefined ? is_active === 'true' : null
        });

        res.json({
            success: true,
            data: { users }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching users'
        });
    }
});

/**
 * @route   POST /api/admin/users
 * @desc    Create new admin user
 * @access  Private (Super Admin only)
 */
router.post('/', authenticateAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const { email, password, name, role } = req.body;

        // Validate input
        if (!email || !password || !name || !role) {
            return res.status(400).json({
                success: false,
                message: 'Email, password, name, and role are required'
            });
        }

        // Validate role
        const validRoles = ['super_admin', 'admin', 'sales', 'support'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        // Validate password strength
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Create user
        const user = await AdminUser.create({
            email,
            password,
            name,
            role,
            created_by: req.user.userId
        });

        // Log activity
        await ActivityLog.create({
            user_id: req.user.userId,
            action: 'create_user',
            entity_type: 'admin_user',
            entity_id: user.id,
            details: { email: user.email, role: user.role },
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Create user error:', error);

        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'A user with this email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'An error occurred while creating user'
        });
    }
});

/**
 * @route   GET /api/admin/users/:id
 * @desc    Get single admin user
 * @access  Private (Admin and above)
 */
router.get('/:id', authenticateAdmin, requireAdmin, async (req, res) => {
    try {
        const user = await AdminUser.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: { user }
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching user'
        });
    }
});

/**
 * @route   PUT /api/admin/users/:id
 * @desc    Update admin user
 * @access  Private (Super Admin only)
 */
router.put('/:id', authenticateAdmin, requireSuperAdmin, async (req, res) => {
    try {
        const { name, role, is_active } = req.body;

        // Validate role if provided
        if (role) {
            const validRoles = ['super_admin', 'admin', 'sales', 'support'];
            if (!validRoles.includes(role)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
                });
            }
        }

        const user = await AdminUser.update(req.params.id, {
            name,
            role,
            is_active
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log activity
        await ActivityLog.create({
            user_id: req.user.userId,
            action: 'update_user',
            entity_type: 'admin_user',
            entity_id: user.id,
            details: { name, role, is_active },
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user }
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while updating user'
        });
    }
});

/**
 * @route   DELETE /api/admin/users/:id
 * @desc    Deactivate admin user (soft delete)
 * @access  Private (Super Admin only)
 */
router.delete('/:id', authenticateAdmin, requireSuperAdmin, async (req, res) => {
    try {
        // Prevent self-deletion
        if (req.params.id === req.user.userId) {
            return res.status(400).json({
                success: false,
                message: 'You cannot deactivate your own account'
            });
        }

        await AdminUser.delete(req.params.id);

        // Log activity
        await ActivityLog.create({
            user_id: req.user.userId,
            action: 'deactivate_user',
            entity_type: 'admin_user',
            entity_id: req.params.id,
            ip_address: req.ip || req.connection.remoteAddress,
            user_agent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'User deactivated successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while deactivating user'
        });
    }
});

/**
 * @route   GET /api/admin/activity-logs
 * @desc    Get activity logs
 * @access  Private (Admin and above)
 */
router.get('/activity/logs', authenticateAdmin, requireAdmin, async (req, res) => {
    try {
        const { user_id, action, entity_type, limit, offset } = req.query;

        const logs = await ActivityLog.findAll({
            user_id: user_id || null,
            action: action || null,
            entity_type: entity_type || null,
            limit: limit ? parseInt(limit) : 100,
            offset: offset ? parseInt(offset) : 0
        });

        res.json({
            success: true,
            data: { logs }
        });

    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching activity logs'
        });
    }
});

module.exports = router;
