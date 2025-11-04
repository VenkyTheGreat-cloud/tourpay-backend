const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class AdminUser {
    /**
     * Create a new admin user
     */
    static async create({ email, password, name, role = 'admin', created_by = null }) {
        const password_hash = await bcrypt.hash(password, 10);

        const query = `
            INSERT INTO admin_users (email, password_hash, name, role, created_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, email, name, role, is_active, created_at
        `;

        const result = await pool.query(query, [
            email.toLowerCase().trim(),
            password_hash,
            name,
            role,
            created_by
        ]);

        return result.rows[0];
    }

    /**
     * Find user by email
     */
    static async findByEmail(email) {
        const query = `
            SELECT id, email, password_hash, name, role, is_active,
                   last_login, failed_login_attempts, locked_until,
                   created_at, updated_at
            FROM admin_users
            WHERE email = $1
        `;

        const result = await pool.query(query, [email.toLowerCase().trim()]);
        return result.rows[0];
    }

    /**
     * Find user by ID
     */
    static async findById(id) {
        const query = `
            SELECT id, email, name, role, is_active, last_login,
                   created_at, updated_at
            FROM admin_users
            WHERE id = $1
        `;

        const result = await pool.query(query, [id]);
        return result.rows[0];
    }

    /**
     * Validate password
     */
    static async validatePassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }

    /**
     * Check if account is locked
     */
    static isAccountLocked(user) {
        if (!user.locked_until) return false;
        return new Date(user.locked_until) > new Date();
    }

    /**
     * Update last login timestamp
     */
    static async updateLastLogin(userId) {
        const query = `
            UPDATE admin_users
            SET last_login = CURRENT_TIMESTAMP,
                failed_login_attempts = 0,
                locked_until = NULL
            WHERE id = $1
        `;

        await pool.query(query, [userId]);
    }

    /**
     * Increment failed login attempts
     */
    static async incrementFailedAttempts(userId) {
        const query = `
            UPDATE admin_users
            SET failed_login_attempts = failed_login_attempts + 1,
                locked_until = CASE
                    WHEN failed_login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
                    ELSE locked_until
                END
            WHERE id = $1
            RETURNING failed_login_attempts, locked_until
        `;

        const result = await pool.query(query, [userId]);
        return result.rows[0];
    }

    /**
     * Get all admin users
     */
    static async findAll({ role = null, is_active = null } = {}) {
        let query = `
            SELECT id, email, name, role, is_active, last_login, created_at
            FROM admin_users
            WHERE 1=1
        `;
        const params = [];

        if (role) {
            params.push(role);
            query += ` AND role = $${params.length}`;
        }

        if (is_active !== null) {
            params.push(is_active);
            query += ` AND is_active = $${params.length}`;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Update admin user
     */
    static async update(userId, { name, role, is_active }) {
        const fields = [];
        const params = [userId];

        if (name !== undefined) {
            params.push(name);
            fields.push(`name = $${params.length}`);
        }

        if (role !== undefined) {
            params.push(role);
            fields.push(`role = $${params.length}`);
        }

        if (is_active !== undefined) {
            params.push(is_active);
            fields.push(`is_active = $${params.length}`);
        }

        if (fields.length === 0) {
            throw new Error('No fields to update');
        }

        const query = `
            UPDATE admin_users
            SET ${fields.join(', ')}
            WHERE id = $1
            RETURNING id, email, name, role, is_active, updated_at
        `;

        const result = await pool.query(query, params);
        return result.rows[0];
    }

    /**
     * Update password
     */
    static async updatePassword(userId, newPassword) {
        const password_hash = await bcrypt.hash(newPassword, 10);

        const query = `
            UPDATE admin_users
            SET password_hash = $1
            WHERE id = $2
        `;

        await pool.query(query, [password_hash, userId]);
    }

    /**
     * Delete admin user (soft delete by deactivating)
     */
    static async delete(userId) {
        const query = `
            UPDATE admin_users
            SET is_active = false
            WHERE id = $1
        `;

        await pool.query(query, [userId]);
    }
}

module.exports = AdminUser;
