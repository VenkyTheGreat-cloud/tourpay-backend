const { Pool } = require('pg');

class NetworkToken {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    user_id,
    wallet_id,
    token_type,
    token_identifier,
    token_data = {},
    status = 'active',
    device_id = null
  }) {
    const query = `
      INSERT INTO network_tokens (
        user_id, wallet_id, token_type, token_identifier, token_data, status, device_id,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      RETURNING *
    `;
    const values = [user_id, wallet_id, token_type, token_identifier, JSON.stringify(token_data), status, device_id];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating network token: ${error.message}`);
    }
  }

  async findById(id) {
    const query = 'SELECT * FROM network_tokens WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding network token by ID: ${error.message}`);
    }
  }

  async findByUserId(user_id) {
    const query = 'SELECT * FROM network_tokens WHERE user_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [user_id]);
      result.rows.forEach(row => {
        row.token_data = JSON.parse(row.token_data || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding network tokens by user ID: ${error.message}`);
    }
  }

  async findByWalletId(wallet_id) {
    const query = 'SELECT * FROM network_tokens WHERE wallet_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [wallet_id]);
      result.rows.forEach(row => {
        row.token_data = JSON.parse(row.token_data || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding network tokens by wallet ID: ${error.message}`);
    }
  }

  async findByTokenIdentifier(token_identifier) {
    const query = 'SELECT * FROM network_tokens WHERE token_identifier = $1';

    try {
      const result = await this.pool.query(query, [token_identifier]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding network token by identifier: ${error.message}`);
    }
  }

  async findByType(user_id, token_type) {
    const query = 'SELECT * FROM network_tokens WHERE user_id = $1 AND token_type = $2 AND status = $3';

    try {
      const result = await this.pool.query(query, [user_id, token_type, 'active']);
      result.rows.forEach(row => {
        row.token_data = JSON.parse(row.token_data || '{}');
      });
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding network tokens by type: ${error.message}`);
    }
  }

  async updateStatus(id, status) {
    const query = `
      UPDATE network_tokens
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [status, id]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating network token status: ${error.message}`);
    }
  }

  async updateTokenData(id, token_data) {
    const query = `
      UPDATE network_tokens
      SET token_data = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [JSON.stringify(token_data), id]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating network token data: ${error.message}`);
    }
  }

  async incrementUsageCount(id) {
    const query = `
      UPDATE network_tokens
      SET usage_count = usage_count + 1, last_used_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error incrementing usage count: ${error.message}`);
    }
  }

  async deactivate(id) {
    const query = `
      UPDATE network_tokens
      SET status = 'inactive', deactivated_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      if (result.rows[0]) {
        result.rows[0].token_data = JSON.parse(result.rows[0].token_data || '{}');
      }
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error deactivating network token: ${error.message}`);
    }
  }

  async delete(id) {
    const query = 'DELETE FROM network_tokens WHERE id = $1 RETURNING id';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting network token: ${error.message}`);
    }
  }
}

module.exports = NetworkToken;
