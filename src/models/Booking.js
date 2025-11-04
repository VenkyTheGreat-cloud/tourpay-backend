const { Pool } = require('pg');

class Booking {
  constructor(pool) {
    this.pool = pool;
  }

  async create({
    user_id,
    tour_id,
    tour_operator_id,
    tour_name,
    tour_price_cad,
    tour_price_usd,
    number_of_travelers,
    travel_date,
    status = 'pending',
    payment_method
  }) {
    const query = `
      INSERT INTO bookings (
        user_id, tour_id, tour_operator_id, tour_name, tour_price_cad, tour_price_usd,
        number_of_travelers, travel_date, status, payment_method, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *
    `;
    const values = [
      user_id, tour_id, tour_operator_id, tour_name, tour_price_cad, tour_price_usd,
      number_of_travelers, travel_date, status, payment_method
    ];

    try {
      const result = await this.pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating booking: ${error.message}`);
    }
  }

  async findById(id) {
    const query = 'SELECT * FROM bookings WHERE id = $1';

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding booking by ID: ${error.message}`);
    }
  }

  async findByUserId(user_id) {
    const query = 'SELECT * FROM bookings WHERE user_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [user_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding bookings by user ID: ${error.message}`);
    }
  }

  async findByTourOperatorId(tour_operator_id) {
    const query = 'SELECT * FROM bookings WHERE tour_operator_id = $1 ORDER BY created_at DESC';

    try {
      const result = await this.pool.query(query, [tour_operator_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding bookings by tour operator ID: ${error.message}`);
    }
  }

  async updateStatus(id, status, smart_contract_tx_hash = null) {
    const query = `
      UPDATE bookings
      SET status = $1, smart_contract_tx_hash = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [status, smart_contract_tx_hash, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error updating booking status: ${error.message}`);
    }
  }

  async confirmAttendance(id, check_in_qr_code) {
    const query = `
      UPDATE bookings
      SET status = 'checked_in', check_in_qr_code = $1, check_in_time = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [check_in_qr_code, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error confirming attendance: ${error.message}`);
    }
  }

  async cancel(id, refund_amount = null) {
    const query = `
      UPDATE bookings
      SET status = 'cancelled', refund_amount = $1, cancelled_at = NOW(), updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [refund_amount, id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error cancelling booking: ${error.message}`);
    }
  }

  async complete(id) {
    const query = `
      UPDATE bookings
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error completing booking: ${error.message}`);
    }
  }

  async getUpcoming(user_id) {
    const query = `
      SELECT * FROM bookings
      WHERE user_id = $1 AND status IN ('confirmed', 'paid') AND travel_date >= CURRENT_DATE
      ORDER BY travel_date ASC
    `;

    try {
      const result = await this.pool.query(query, [user_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting upcoming bookings: ${error.message}`);
    }
  }

  async getPast(user_id) {
    const query = `
      SELECT * FROM bookings
      WHERE user_id = $1 AND (status = 'completed' OR travel_date < CURRENT_DATE)
      ORDER BY travel_date DESC
    `;

    try {
      const result = await this.pool.query(query, [user_id]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting past bookings: ${error.message}`);
    }
  }
}

module.exports = Booking;
