const { Pool } = require('pg');

class OperatorPayout {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Create a new payout record
   */
  async create({
    operator_id,
    booking_id = null,
    payment_method_id,
    amount_usdc,
    amount_usd = null,
    fee_amount = 0,
    payout_type,
    metadata = {}
  }) {
    const net_amount = parseFloat(amount_usdc) - parseFloat(fee_amount);

    const query = `
      INSERT INTO operator_payouts (
        operator_id, booking_id, payment_method_id,
        amount_usdc, amount_usd, fee_amount, net_amount,
        payout_type, status, metadata,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      operator_id, booking_id, payment_method_id,
      amount_usdc, amount_usd, fee_amount, net_amount,
      payout_type, 'pending', JSON.stringify(metadata)
    ];

    try {
      const result = await this.pool.query(query, values);
      const payout = result.rows[0];
      payout.metadata = JSON.parse(payout.metadata || '{}');
      return payout;
    } catch (error) {
      throw new Error(`Error creating payout: ${error.message}`);
    }
  }

  /**
   * Find payout by ID
   */
  async findById(id) {
    const query = 'SELECT * FROM operator_payouts WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding payout: ${error.message}`);
    }
  }

  /**
   * Find all payouts for an operator
   */
  async findByOperatorId(operator_id, limit = 50) {
    const query = `
      SELECT * FROM operator_payouts
      WHERE operator_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [operator_id, limit]);
      result.rows.forEach(row => {
        row.metadata = JSON.parse(row.metadata || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payouts by operator: ${error.message}`);
    }
  }

  /**
   * Find payout by booking ID
   */
  async findByBookingId(booking_id) {
    const query = `
      SELECT * FROM operator_payouts
      WHERE booking_id = $1
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [booking_id]);
      result.rows.forEach(row => {
        row.metadata = JSON.parse(row.metadata || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payouts by booking: ${error.message}`);
    }
  }

  /**
   * Get pending payouts for operator
   */
  async getPending(operator_id) {
    const query = `
      SELECT * FROM operator_payouts
      WHERE operator_id = $1 AND status = 'pending'
      ORDER BY created_at ASC
    `;

    try {
      const result = await this.pool.query(query, [operator_id]);
      result.rows.forEach(row => {
        row.metadata = JSON.parse(row.metadata || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding pending payouts: ${error.message}`);
    }
  }

  /**
   * Update payout status
   */
  async updateStatus(id, status, transaction_ids = {}) {
    const {
      coinbase_transaction_id = null,
      ach_transaction_id = null,
      blockchain_tx_hash = null,
      external_reference = null
    } = transaction_ids;

    const query = `
      UPDATE operator_payouts
      SET
        status = $1,
        coinbase_transaction_id = COALESCE($2, coinbase_transaction_id),
        ach_transaction_id = COALESCE($3, ach_transaction_id),
        blockchain_tx_hash = COALESCE($4, blockchain_tx_hash),
        external_reference = COALESCE($5, external_reference),
        processed_at = CASE WHEN $1 = 'processing' THEN NOW() ELSE processed_at END,
        completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END,
        failed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE failed_at END,
        updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        status,
        coinbase_transaction_id,
        ach_transaction_id,
        blockchain_tx_hash,
        external_reference,
        id
      ]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating payout status: ${error.message}`);
    }
  }

  /**
   * Mark payout as processing
   */
  async markProcessing(id, transaction_ids = {}) {
    return this.updateStatus(id, 'processing', transaction_ids);
  }

  /**
   * Mark payout as completed
   */
  async markCompleted(id, transaction_ids = {}) {
    return this.updateStatus(id, 'completed', transaction_ids);
  }

  /**
   * Mark payout as failed
   */
  async markFailed(id, error_code, error_message) {
    const query = `
      UPDATE operator_payouts
      SET
        status = 'failed',
        error_code = $1,
        error_message = $2,
        failed_at = NOW(),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [error_code, error_message, id]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error marking payout as failed: ${error.message}`);
    }
  }

  /**
   * Increment retry count
   */
  async incrementRetry(id) {
    const query = `
      UPDATE operator_payouts
      SET retry_count = retry_count + 1, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error incrementing retry count: ${error.message}`);
    }
  }

  /**
   * Get total payouts for operator
   */
  async getTotalPayouts(operator_id) {
    const query = `
      SELECT
        COUNT(*) as total_count,
        SUM(amount_usdc) as total_amount,
        SUM(fee_amount) as total_fees,
        SUM(net_amount) as total_net,
        SUM(CASE WHEN status = 'completed' THEN amount_usdc ELSE 0 END) as completed_amount,
        SUM(CASE WHEN status = 'pending' THEN amount_usdc ELSE 0 END) as pending_amount,
        SUM(CASE WHEN status = 'processing' THEN amount_usdc ELSE 0 END) as processing_amount
      FROM operator_payouts
      WHERE operator_id = $1
    `;

    try {
      const result = await this.pool.query(query, [operator_id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting total payouts: ${error.message}`);
    }
  }

  /**
   * Get payouts by status
   */
  async findByStatus(operator_id, status, limit = 50) {
    const query = `
      SELECT * FROM operator_payouts
      WHERE operator_id = $1 AND status = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    try {
      const result = await this.pool.query(query, [operator_id, status, limit]);
      result.rows.forEach(row => {
        row.metadata = JSON.parse(row.metadata || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payouts by status: ${error.message}`);
    }
  }

  /**
   * Get payouts within date range
   */
  async findByDateRange(operator_id, start_date, end_date) {
    const query = `
      SELECT * FROM operator_payouts
      WHERE operator_id = $1
        AND created_at >= $2
        AND created_at <= $3
      ORDER BY created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [operator_id, start_date, end_date]);
      result.rows.forEach(row => {
        row.metadata = JSON.parse(row.metadata || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payouts by date range: ${error.message}`);
    }
  }

  /**
   * Cancel a pending payout
   */
  async cancel(id) {
    const query = `
      UPDATE operator_payouts
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1 AND status = 'pending'
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error cancelling payout: ${error.message}`);
    }
  }

  /**
   * Update metadata
   */
  async updateMetadata(id, metadata) {
    const query = `
      UPDATE operator_payouts
      SET metadata = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [JSON.stringify(metadata), id]);
      if (result.rows[0]) {
        result.rows[0].metadata = JSON.parse(result.rows[0].metadata || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating payout metadata: ${error.message}`);
    }
  }
}

module.exports = OperatorPayout;
