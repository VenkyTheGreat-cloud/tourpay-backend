const pool = require('../config/database');

class ConsumerLead {
  /**
   * Create a new consumer lead from landing page waitlist
   */
  static async create({ email, province, visit_frequency, wants_updates = true }) {
    const query = `
      INSERT INTO consumer_leads (email, province, visit_frequency, wants_updates)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [email, province, visit_frequency, wants_updates]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Get all consumer leads with optional filtering
   */
  static async findAll({ status, limit = 100, offset = 0 } = {}) {
    let query = 'SELECT * FROM consumer_leads';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get a single consumer lead by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM consumer_leads WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get a consumer lead by email
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM consumer_leads WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Update consumer lead status and notes
   */
  static async update(id, { status, notes }) {
    const query = `
      UPDATE consumer_leads
      SET status = COALESCE($2, status),
          notes = COALESCE($3, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, status, notes]);
    return result.rows[0];
  }

  /**
   * Get statistics about consumer leads
   */
  static async getStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted,
        COUNT(CASE WHEN visit_frequency = 'frequent' THEN 1 END) as frequent_travelers,
        COUNT(CASE WHEN visit_frequency = 'snowbird' THEN 1 END) as snowbirds,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
      FROM consumer_leads
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  /**
   * Delete a consumer lead (soft delete by updating status)
   */
  static async delete(id) {
    const query = 'DELETE FROM consumer_leads WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = ConsumerLead;
