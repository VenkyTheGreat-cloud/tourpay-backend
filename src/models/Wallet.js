const { Pool } = require('pg');

class Wallet {
  constructor(pool) {
    this.pool = pool;
  }

  async create({ user_id, coinbase_wallet_id, coinbase_wallet_address, network = 'base', initial_balance = '0' }) {
    const query = `
      INSERT INTO wallets (user_id, coinbase_wallet_id, coinbase_wallet_address, network, balance_usdc, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
    const values = [user_id, coinbase_wallet_id, coinbase_wallet_address, network, initial_balance];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating wallet: ${error.message}`);
    }
  }

  async findByUserId(user_id) {
    const query = 'SELECT * FROM wallets WHERE user_id = $1';

    try {
      const result = await this.pool.query(query, [user_id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding wallet by user ID: ${error.message}`);
    }
  }

  async findById(id) {
    const query = 'SELECT * FROM wallets WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding wallet by ID: ${error.message}`);
    }
  }

  async updateBalance(wallet_id, new_balance) {
    const query = `
      UPDATE wallets
      SET balance_usdc = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [new_balance, wallet_id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating wallet balance: ${error.message}`);
    }
  }

  async getBalance(wallet_id) {
    const query = 'SELECT balance_usdc FROM wallets WHERE id = $1';

    try {
      const result = await this.pool.query(query, [wallet_id]);
      return result.rows[0]?.balance_usdc || '0';
    } catch (error) {
      throw new Error(`Error getting wallet balance: ${error.message}`);
    }
  }

  async deductBalance(wallet_id, amount) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const checkBalance = await client.query(
        'SELECT balance_usdc FROM wallets WHERE id = $1 FOR UPDATE',
        [wallet_id]
      );

      const currentBalance = parseFloat(checkBalance.rows[0].balance_usdc);
      const deductAmount = parseFloat(amount);

      if (currentBalance < deductAmount) {
        throw new Error('Insufficient balance');
      }

      const newBalance = (currentBalance - deductAmount).toFixed(2);

      const result = await client.query(
        'UPDATE wallets SET balance_usdc = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newBalance, wallet_id]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error deducting wallet balance: ${error.message}`);
    } finally {
      client.release();
    }
  }

  async addBalance(wallet_id, amount) {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const checkBalance = await client.query(
        'SELECT balance_usdc FROM wallets WHERE id = $1 FOR UPDATE',
        [wallet_id]
      );

      const currentBalance = parseFloat(checkBalance.rows[0].balance_usdc);
      const addAmount = parseFloat(amount);
      const newBalance = (currentBalance + addAmount).toFixed(2);

      const result = await client.query(
        'UPDATE wallets SET balance_usdc = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [newBalance, wallet_id]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Error adding wallet balance: ${error.message}`);
    } finally {
      client.release();
    }
  }
}

module.exports = Wallet;
