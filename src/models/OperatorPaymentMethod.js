const { Pool } = require('pg');

class OperatorPaymentMethod {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Create a new payment method for operator
   */
  async create({
    operator_id,
    payment_type,
    is_primary = false,
    // ACH details
    ach_routing_number = null,
    ach_account_number = null,
    ach_account_type = null,
    ach_bank_name = null,
    // Coinbase wallet details
    coinbase_wallet_address = null,
    coinbase_wallet_id = null,
    coinbase_network = 'base',
    // Bank wire details
    wire_bank_name = null,
    wire_swift_code = null,
    wire_account_number = null,
    wire_iban = null,
    wire_routing_number = null,
    // Verification
    plaid_account_id = null
  }) {
    const query = `
      INSERT INTO operator_payment_methods (
        operator_id, payment_type, is_primary,
        ach_routing_number, ach_account_number, ach_account_type, ach_bank_name,
        coinbase_wallet_address, coinbase_wallet_id, coinbase_network,
        wire_bank_name, wire_swift_code, wire_account_number, wire_iban, wire_routing_number,
        plaid_account_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `;

    const values = [
      operator_id, payment_type, is_primary,
      ach_routing_number, ach_account_number, ach_account_type, ach_bank_name,
      coinbase_wallet_address, coinbase_wallet_id, coinbase_network,
      wire_bank_name, wire_swift_code, wire_account_number, wire_iban, wire_routing_number,
      plaid_account_id
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating payment method: ${error.message}`);
    }
  }

  /**
   * Get all payment methods for an operator
   */
  async findByOperatorId(operator_id) {
    const query = 'SELECT * FROM operator_payment_methods WHERE operator_id = $1 ORDER BY is_primary DESC, created_at DESC';

    try {
      const result = await this.pool.query(query, [operator_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payment methods: ${error.message}`);
    }
  }

  /**
   * Get a specific payment method by ID
   */
  async findById(id) {
    const query = 'SELECT * FROM operator_payment_methods WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding payment method: ${error.message}`);
    }
  }

  /**
   * Get primary payment method for operator
   */
  async getPrimaryMethod(operator_id) {
    const query = `
      SELECT * FROM operator_payment_methods
      WHERE operator_id = $1 AND is_primary = true AND status = 'active'
      LIMIT 1
    `;

    try {
      const result = await this.pool.query(query, [operator_id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding primary payment method: ${error.message}`);
    }
  }

  /**
   * Get active payment methods by type
   */
  async findByType(operator_id, payment_type) {
    const query = `
      SELECT * FROM operator_payment_methods
      WHERE operator_id = $1 AND payment_type = $2 AND status = 'active'
      ORDER BY is_primary DESC, created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [operator_id, payment_type]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding payment methods by type: ${error.message}`);
    }
  }

  /**
   * Set a payment method as primary
   */
  async setPrimary(id, operator_id) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Unset all other primary methods for this operator
      await client.query(
        'UPDATE operator_payment_methods SET is_primary = false WHERE operator_id = $1',
        [operator_id]
      );

      // Set this one as primary
      const result = await client.query(
        'UPDATE operator_payment_methods SET is_primary = true, updated_at = NOW() WHERE id = $1 RETURNING *',
        [id]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error setting primary payment method: ${error.message}`);
    } finally {
      client.release();
    }
  }

  /**
   * Update verification status
   */
  async updateVerification(id, verification_status, verification_method = null) {
    const query = `
      UPDATE operator_payment_methods
      SET
        verification_status = $1,
        verification_method = $2,
        verification_date = NOW(),
        status = CASE
          WHEN $1 = 'verified' THEN 'active'
          WHEN $1 = 'failed' THEN 'rejected'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [verification_status, verification_method, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating verification status: ${error.message}`);
    }
  }

  /**
   * Update payment method status
   */
  async updateStatus(id, status) {
    const query = `
      UPDATE operator_payment_methods
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [status, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating payment method status: ${error.message}`);
    }
  }

  /**
   * Update last used timestamp
   */
  async updateLastUsed(id) {
    const query = `
      UPDATE operator_payment_methods
      SET last_used_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating last used: ${error.message}`);
    }
  }

  /**
   * Delete a payment method
   */
  async delete(id) {
    const query = 'DELETE FROM operator_payment_methods WHERE id = $1 RETURNING id';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting payment method: ${error.message}`);
    }
  }

  /**
   * Validate ACH routing number (basic check)
   */
  validateRoutingNumber(routing_number) {
    if (!routing_number || routing_number.length !== 9) {
      return false;
    }

    // ABA routing number check digit algorithm
    const digits = routing_number.split('').map(Number);
    const checksum =
      3 * (digits[0] + digits[3] + digits[6]) +
      7 * (digits[1] + digits[4] + digits[7]) +
      (digits[2] + digits[5] + digits[8]);

    return checksum % 10 === 0;
  }

  /**
   * Mask sensitive account information for display
   */
  maskAccountNumber(account_number) {
    if (!account_number || account_number.length < 4) {
      return '****';
    }
    return '****' + account_number.slice(-4);
  }
}

module.exports = OperatorPaymentMethod;
