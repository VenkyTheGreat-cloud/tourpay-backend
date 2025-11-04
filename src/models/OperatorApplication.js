const pool = require('../config/database');

class OperatorApplication {
  /**
   * Create a new operator/merchant application from landing page
   */
  static async create({
    business_name,
    email,
    phone,
    province,
    monthly_volume_usd,
    business_type,
    additional_info
  }) {
    const query = `
      INSERT INTO operator_applications
      (business_name, email, phone, province, monthly_volume_usd, business_type, additional_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    try {
      const result = await pool.query(query, [
        business_name,
        email,
        phone,
        province,
        monthly_volume_usd,
        business_type,
        additional_info
      ]);
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error('Email already registered');
      }
      throw error;
    }
  }

  /**
   * Get all operator applications with optional filtering
   */
  static async findAll({ status, business_type, limit = 100, offset = 0 } = {}) {
    let query = 'SELECT * FROM operator_applications WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      query += ' AND status = $' + params.length;
    }

    if (business_type) {
      params.push(business_type);
      query += ' AND business_type = $' + params.length;
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    const result = await pool.query(query, params);
    return result.rows;
  }

  /**
   * Get a single operator application by ID
   */
  static async findById(id) {
    const query = 'SELECT * FROM operator_applications WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get an operator application by email
   */
  static async findByEmail(email) {
    const query = 'SELECT * FROM operator_applications WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Update operator application status
   */
  static async update(id, { status, rejection_reason, notes }) {
    const query = `
      UPDATE operator_applications
      SET status = COALESCE($2, status),
          rejection_reason = COALESCE($3, rejection_reason),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [id, status, rejection_reason, notes]);
    return result.rows[0];
  }

  /**
   * Approve an application
   */
  static async approve(id, notes = null) {
    return this.update(id, { status: 'approved', notes });
  }

  /**
   * Reject an application
   */
  static async reject(id, rejection_reason, notes = null) {
    return this.update(id, { status: 'rejected', rejection_reason, notes });
  }

  /**
   * Get statistics about operator applications
   */
  static async getStats() {
    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'reviewing' THEN 1 END) as reviewing,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN business_type = 'tour-operator' THEN 1 END) as tour_operators,
        COUNT(CASE WHEN business_type = 'travel-agency' THEN 1 END) as travel_agencies,
        COUNT(CASE WHEN business_type = 'hotel' THEN 1 END) as hotels,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 END) as last_7_days,
        COUNT(CASE WHEN created_at > NOW() - INTERVAL '30 days' THEN 1 END) as last_30_days
      FROM operator_applications
    `;

    const result = await pool.query(query);
    return result.rows[0];
  }

  /**
   * Get volume distribution
   */
  static async getVolumeDistribution() {
    const query = `
      SELECT
        monthly_volume_usd,
        COUNT(*) as count
      FROM operator_applications
      GROUP BY monthly_volume_usd
      ORDER BY
        CASE monthly_volume_usd
          WHEN 'under50k' THEN 1
          WHEN '50k-100k' THEN 2
          WHEN '100k-500k' THEN 3
          WHEN '500k-1m' THEN 4
          WHEN 'over1m' THEN 5
        END
    `;

    const result = await pool.query(query);
    return result.rows;
  }

  /**
   * Delete an operator application
   */
  static async delete(id) {
    const query = 'DELETE FROM operator_applications WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = OperatorApplication;
