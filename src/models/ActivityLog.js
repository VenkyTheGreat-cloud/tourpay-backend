const pool = require('../config/database');

class ActivityLog {
    /**
     * Create an activity log entry
     */
    static async create({
        user_id,
        action,
        entity_type = null,
        entity_id = null,
        details = {},
        ip_address = null,
        user_agent = null
    }) {
        const query = `
            INSERT INTO activity_logs (
                user_id, action, entity_type, entity_id,
                details, ip_address, user_agent
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, created_at
        `;

        const result = await pool.query(query, [
            user_id,
            action,
            entity_type,
            entity_id,
            JSON.stringify(details),
            ip_address,
            user_agent
        ]);

        return result.rows[0];
    }

    /**
     * Get activity logs with filters
     */
    static async findAll({
        user_id = null,
        action = null,
        entity_type = null,
        limit = 100,
        offset = 0
    } = {}) {
        let query = `
            SELECT
                al.id, al.user_id, al.action, al.entity_type, al.entity_id,
                al.details, al.ip_address, al.created_at,
                u.email as user_email, u.name as user_name
            FROM activity_logs al
            LEFT JOIN admin_users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (user_id) {
            params.push(user_id);
            query += ` AND al.user_id = $${params.length}`;
        }

        if (action) {
            params.push(action);
            query += ` AND al.action = $${params.length}`;
        }

        if (entity_type) {
            params.push(entity_type);
            query += ` AND al.entity_type = $${params.length}`;
        }

        query += ` ORDER BY al.created_at DESC`;

        params.push(limit);
        query += ` LIMIT $${params.length}`;

        params.push(offset);
        query += ` OFFSET $${params.length}`;

        const result = await pool.query(query, params);
        return result.rows;
    }

    /**
     * Get activity stats
     */
    static async getStats({ days = 30 } = {}) {
        const query = `
            SELECT
                COUNT(*) as total_actions,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT DATE(created_at)) as active_days,
                action,
                COUNT(*) as count
            FROM activity_logs
            WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '${days} days'
            GROUP BY action
            ORDER BY count DESC
        `;

        const result = await pool.query(query);
        return result.rows;
    }

    /**
     * Delete old logs (retention policy)
     */
    static async deleteOlderThan(days) {
        const query = `
            DELETE FROM activity_logs
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '${days} days'
        `;

        const result = await pool.query(query);
        return result.rowCount;
    }
}

module.exports = ActivityLog;
