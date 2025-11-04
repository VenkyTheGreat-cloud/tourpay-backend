const { Pool } = require('pg');

class Transaction {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    user_id,
    wallet_id,
    booking_id = null,
    transaction_type,
    amount_usdc,
    amount_cad = null,
    status = 'pending',
    payment_method,
    coinbase_transaction_id = null,
    blockchain_tx_hash = null,
    network_token_id = null
  }) {
    const query = `
      INSERT INTO transactions (
        user_id, wallet_id, booking_id, transaction_type, amount_usdc, amount_cad,
        status, payment_method, coinbase_transaction_id, blockchain_tx_hash, network_token_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      user_id, wallet_id, booking_id, transaction_type, amount_usdc, amount_cad,
      status, payment_method, coinbase_transaction_id, blockchain_tx_hash, network_token_id
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating transaction: ${error.message}`);
    }
  }

  async findById(id) {
    const query = 'SELECT * FROM transactions WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding transaction by ID: ${error.message}`);
    }
  }

  async findByUserId(user_id, limit = 50) {
    const query = 'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2';

    try {
      const result = await this.pool.query(query, [user_id, limit]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding transactions by user ID: ${error.message}`);
    }
  }

  async findByWalletId(wallet_id, limit = 50) {
    const query = 'SELECT * FROM transactions WHERE wallet_id = $1 ORDER BY created_at DESC LIMIT $2';

    try {
      const result = await this.pool.query(query, [wallet_id, limit]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding transactions by wallet ID: ${error.message}`);
    }
  }

  async findByBookingId(booking_id) {
    const query = 'SELECT * FROM transactions WHERE booking_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [booking_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding transactions by booking ID: ${error.message}`);
    }
  }

  async updateStatus(id, status, blockchain_tx_hash = null) {
    const query = `
      UPDATE transactions
      SET status = $1, blockchain_tx_hash = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [status, blockchain_tx_hash, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating transaction status: ${error.message}`);
    }
  }

  async complete(id, blockchain_tx_hash = null) {
    const query = `
      UPDATE transactions
      SET status = 'completed', blockchain_tx_hash = $1, completed_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [blockchain_tx_hash, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error completing transaction: ${error.message}`);
    }
  }

  async fail(id, error_message) {
    const query = `
      UPDATE transactions
      SET status = 'failed', error_message = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [error_message, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error failing transaction: ${error.message}`);
    }
  }

  async getByType(user_id, transaction_type, limit = 50) {
    const query = `
      SELECT * FROM transactions
      WHERE user_id = $1 AND transaction_type = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;

    try {
      const result = await this.pool.query(query, [user_id, transaction_type, limit]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting transactions by type: ${error.message}`);
    }
  }

  async getTotalVolume(user_id) {
    const query = `
      SELECT
        SUM(CASE WHEN transaction_type = 'deposit' THEN amount_usdc ELSE 0 END) as total_deposits,
        SUM(CASE WHEN transaction_type = 'payment' THEN amount_usdc ELSE 0 END) as total_payments,
        SUM(CASE WHEN transaction_type = 'refund' THEN amount_usdc ELSE 0 END) as total_refunds
      FROM transactions
      WHERE user_id = $1 AND status = 'completed'
    `;

    try {
      const result = await this.pool.query(query, [user_id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting transaction volume: ${error.message}`);
    }
  }
}

module.exports = Transaction;
