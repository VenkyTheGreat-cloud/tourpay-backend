const pool = require('../config/database');
const crypto = require('crypto');

class AdminSession {
    /**
     * Create a new session
     */
    static async create({
        user_id,
        token,
        refresh_token,
        ip_address,
        user_agent,
        expires_at,
        refresh_expires_at
    }) {
        // Hash tokens before storing (security best practice)
        const token_hash = crypto.createHash('sha256').update(token).digest('hex');
        const refresh_token_hash = refresh_token
            ? crypto.createHash('sha256').update(refresh_token).digest('hex')
            : null;

        const query = `
            INSERT INTO admin_sessions (
                user_id, token_hash, refresh_token_hash,
                ip_address, user_agent, expires_at, refresh_expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, user_id, created_at, expires_at
        `;

        const result = await pool.query(query, [
            user_id,
            token_hash,
            refresh_token_hash,
            ip_address,
            user_agent,
            expires_at,
            refresh_expires_at
        ]);

        return result.rows[0];
    }

    /**
     * Find session by token
     */
    static async findByToken(token) {
        const token_hash = crypto.createHash('sha256').update(token).digest('hex');

        const query = `
            SELECT s.id, s.user_id, s.expires_at, s.created_at,
                   u.email, u.name, u.role, u.is_active
            FROM admin_sessions s
            JOIN admin_users u ON s.user_id = u.id
            WHERE s.token_hash = $1
                AND s.expires_at > CURRENT_TIMESTAMP
        `;

        const result = await pool.query(query, [token_hash]);
        return result.rows[0];
    }

    /**
     * Find session by refresh token
     */
    static async findByRefreshToken(refreshToken) {
        const refresh_token_hash = crypto.createHash('sha256').update(refreshToken).digest('hex');

        const query = `
            SELECT s.id, s.user_id, s.refresh_expires_at,
                   u.email, u.name, u.role, u.is_active
            FROM admin_sessions s
            JOIN admin_users u ON s.user_id = u.id
            WHERE s.refresh_token_hash = $1
                AND s.refresh_expires_at > CURRENT_TIMESTAMP
        `;

        const result = await pool.query(query, [refresh_token_hash]);
        return result.rows[0];
    }

    /**
     * Delete session (logout)
     */
    static async delete(sessionId) {
        const query = 'DELETE FROM admin_sessions WHERE id = $1';
        await pool.query(query, [sessionId]);
    }

    /**
     * Delete all sessions for a user (logout from all devices)
     */
    static async deleteAllForUser(userId) {
        const query = 'DELETE FROM admin_sessions WHERE user_id = $1';
        await pool.query(query, [userId]);
    }

    /**
     * Delete expired sessions (cleanup)
     */
    static async deleteExpired() {
        const query = `
            DELETE FROM admin_sessions
            WHERE expires_at < CURRENT_TIMESTAMP
        `;
        const result = await pool.query(query);
        return result.rowCount;
    }

    /**
     * Get all active sessions for a user
     */
    static async findByUserId(userId) {
        const query = `
            SELECT id, ip_address, user_agent, created_at, expires_at
            FROM admin_sessions
            WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
        `;

        const result = await pool.query(query, [userId]);
        return result.rows;
    }
}

module.exports = AdminSession;
