const { Pool } = require('pg');
const OperatorPaymentMethod = require('../models/OperatorPaymentMethod');
const OperatorPayout = require('../models/OperatorPayout');
const Booking = require('../models/Booking');
const operatorPaymentService = require('../services/operatorPaymentService');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const paymentMethodModel = new OperatorPaymentMethod(pool);
const payoutModel = new OperatorPayout(pool);
const bookingModel = new Booking(pool);

class OperatorController {
  /**
   * Add a new payment method for operator
   */
  async addPaymentMethod(req, res) {
    try {
      const operator_id = req.user.operatorId; // Assumes operator_id is added to req.user
      const {
        payment_type,
        is_primary,
        // ACH fields
        ach_routing_number,
        ach_account_number,
        ach_account_type,
        ach_bank_name,
        // Coinbase fields
        coinbase_wallet_address,
        coinbase_wallet_id,
        coinbase_network,
        // Bank wire fields
        wire_bank_name,
        wire_swift_code,
        wire_account_number,
        wire_iban,
        wire_routing_number
      } = req.body;

      // Validate based on payment type
      if (payment_type === 'ach') {
        if (!ach_routing_number || !ach_account_number || !ach_account_type) {
          return res.status(400).json({ error: 'ACH details required' });
        }

        // Validate routing number
        if (!paymentMethodModel.validateRoutingNumber(ach_routing_number)) {
          return res.status(400).json({ error: 'Invalid routing number' });
        }
      } else if (payment_type === 'coinbase_wallet') {
        if (!coinbase_wallet_address) {
          return res.status(400).json({ error: 'Coinbase wallet address required' });
        }
      }

      const paymentMethod = await paymentMethodModel.create({
        operator_id,
        payment_type,
        is_primary,
        ach_routing_number,
        ach_account_number,
        ach_account_type,
        ach_bank_name,
        coinbase_wallet_address,
        coinbase_wallet_id,
        coinbase_network,
        wire_bank_name,
        wire_swift_code,
        wire_account_number,
        wire_iban,
        wire_routing_number
      });

      // Mask sensitive data
      if (paymentMethod.ach_account_number) {
        paymentMethod.ach_account_number = paymentMethodModel.maskAccountNumber(paymentMethod.ach_account_number);
      }

      res.status(201).json({
        message: 'Payment method added successfully',
        paymentMethod
      });
    } catch (error) {
      console.error('Error adding payment method:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all payment methods for operator
   */
  async getPaymentMethods(req, res) {
    try {
      const operator_id = req.user.operatorId;

      const paymentMethods = await paymentMethodModel.findByOperatorId(operator_id);

      // Mask sensitive data
      paymentMethods.forEach(method => {
        if (method.ach_account_number) {
          method.ach_account_number = paymentMethodModel.maskAccountNumber(method.ach_account_number);
        }
        if (method.wire_account_number) {
          method.wire_account_number = paymentMethodModel.maskAccountNumber(method.wire_account_number);
        }
      });

      res.json({ paymentMethods });
    } catch (error) {
      console.error('Error getting payment methods:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get specific payment method
   */
  async getPaymentMethod(req, res) {
    try {
      const { methodId } = req.params;
      const operator_id = req.user.operatorId;

      const paymentMethod = await paymentMethodModel.findById(methodId);

      if (!paymentMethod || paymentMethod.operator_id !== operator_id) {
        return res.status(404).json({ error: 'Payment method not found' });
      }

      // Mask sensitive data
      if (paymentMethod.ach_account_number) {
        paymentMethod.ach_account_number = paymentMethodModel.maskAccountNumber(paymentMethod.ach_account_number);
      }

      res.json({ paymentMethod });
    } catch (error) {
      console.error('Error getting payment method:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Set payment method as primary
   */
  async setPrimaryPaymentMethod(req, res) {
    try {
      const { methodId } = req.params;
      const operator_id = req.user.operatorId;

      const paymentMethod = await paymentMethodModel.setPrimary(methodId, operator_id);

      res.json({
        message: 'Primary payment method updated',
        paymentMethod
      });
    } catch (error) {
      console.error('Error setting primary payment method:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update payment method status
   */
  async updatePaymentMethodStatus(req, res) {
    try {
      const { methodId } = req.params;
      const { status } = req.body;

      const paymentMethod = await paymentMethodModel.updateStatus(methodId, status);

      res.json({
        message: 'Payment method status updated',
        paymentMethod
      });
    } catch (error) {
      console.error('Error updating payment method status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete payment method
   */
  async deletePaymentMethod(req, res) {
    try {
      const { methodId } = req.params;

      await paymentMethodModel.delete(methodId);

      res.json({ message: 'Payment method deleted successfully' });
    } catch (error) {
      console.error('Error deleting payment method:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verify bank account via Plaid
   */
  async verifyBankAccountPlaid(req, res) {
    try {
      const { public_token } = req.body;
      const operator_id = req.user.operatorId;

      const accountDetails = await operatorPaymentService.verifyBankAccountWithPlaid(public_token);

      // Create payment method
      const paymentMethod = await paymentMethodModel.create({
        operator_id,
        payment_type: 'ach',
        ach_routing_number: accountDetails.routingNumber,
        ach_account_number: accountDetails.accountNumber,
        ach_account_type: accountDetails.accountType,
        ach_bank_name: accountDetails.bankName,
        plaid_account_id: accountDetails.accountId,
        verification_status: 'verified',
        verification_method: 'plaid'
      });

      // Update verification
      await paymentMethodModel.updateVerification(paymentMethod.id, 'verified', 'plaid');

      res.json({
        message: 'Bank account verified successfully',
        paymentMethod
      });
    } catch (error) {
      console.error('Error verifying bank account:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Verify payment method
   */
  async verifyPaymentMethod(req, res) {
    try {
      const { methodId } = req.params;
      const { verification_method } = req.body;

      const paymentMethod = await paymentMethodModel.updateVerification(
        methodId,
        'verified',
        verification_method
      );

      res.json({
        message: 'Payment method verified',
        paymentMethod
      });
    } catch (error) {
      console.error('Error verifying payment method:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all payouts for operator
   */
  async getPayouts(req, res) {
    try {
      const operator_id = req.user.operatorId;
      const limit = parseInt(req.query.limit) || 50;

      const payouts = await payoutModel.findByOperatorId(operator_id, limit);

      res.json({ payouts });
    } catch (error) {
      console.error('Error getting payouts:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get specific payout details
   */
  async getPayoutDetails(req, res) {
    try {
      const { payoutId } = req.params;
      const operator_id = req.user.operatorId;

      const payout = await payoutModel.findById(payoutId);

      if (!payout || payout.operator_id !== operator_id) {
        return res.status(404).json({ error: 'Payout not found' });
      }

      res.json({ payout });
    } catch (error) {
      console.error('Error getting payout details:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payouts by booking
   */
  async getPayoutsByBooking(req, res) {
    try {
      const { bookingId } = req.params;

      const payouts = await payoutModel.findByBookingId(bookingId);

      res.json({ payouts });
    } catch (error) {
      console.error('Error getting payouts by booking:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payouts by status
   */
  async getPayoutsByStatus(req, res) {
    try {
      const { status } = req.params;
      const operator_id = req.user.operatorId;
      const limit = parseInt(req.query.limit) || 50;

      const payouts = await payoutModel.findByStatus(operator_id, status, limit);

      res.json({ payouts });
    } catch (error) {
      console.error('Error getting payouts by status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payout summary statistics
   */
  async getPayoutSummary(req, res) {
    try {
      const operator_id = req.user.operatorId;

      const summary = await payoutModel.getTotalPayouts(operator_id);

      res.json({ summary });
    } catch (error) {
      console.error('Error getting payout summary:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get payouts by date range
   */
  async getPayoutsByDateRange(req, res) {
    try {
      const operator_id = req.user.operatorId;
      const { start_date, end_date } = req.query;

      if (!start_date || !end_date) {
        return res.status(400).json({ error: 'start_date and end_date required' });
      }

      const payouts = await payoutModel.findByDateRange(operator_id, start_date, end_date);

      res.json({ payouts });
    } catch (error) {
      console.error('Error getting payouts by date range:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Process payout (Admin only)
   */
  async processPayout(req, res) {
    try {
      const { booking_id, operator_id, payment_method_id } = req.body;

      // Get booking details
      const booking = await bookingModel.findById(booking_id);
      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Get payment method
      const paymentMethod = await paymentMethodModel.findById(payment_method_id);
      if (!paymentMethod) {
        return res.status(404).json({ error: 'Payment method not found' });
      }

      // Validate payout eligibility
      const operator = { id: operator_id, status: 'approved' }; // TODO: Fetch actual operator
      const validation = operatorPaymentService.validatePayoutEligibility(operator, booking);

      if (!validation.eligible) {
        return res.status(400).json({
          error: 'Payout not eligible',
          reasons: validation.errors
        });
      }

      // Calculate fee
      const fee = operatorPaymentService.estimatePayoutFee(
        paymentMethod.payment_type,
        booking.tour_price_usd
      );

      // Create payout record
      const payout = await payoutModel.create({
        operator_id,
        booking_id,
        payment_method_id,
        amount_usdc: booking.tour_price_usd,
        amount_usd: booking.tour_price_usd,
        fee_amount: fee,
        payout_type: paymentMethod.payment_type,
        metadata: {
          booking_reference: booking.id,
          tour_name: booking.tour_name
        }
      });

      // Process the payout
      const result = await operatorPaymentService.processPayout({
        operator_id,
        booking_id,
        payment_method: paymentMethod,
        amount_usdc: booking.tour_price_usd,
        amount_usd: booking.tour_price_usd
      });

      // Update payout status
      await payoutModel.markProcessing(payout.id, {
        coinbase_transaction_id: result.payoutId,
        ach_transaction_id: result.payoutId,
        blockchain_tx_hash: result.transactionHash
      });

      // Update payment method last used
      await paymentMethodModel.updateLastUsed(payment_method_id);

      res.json({
        message: 'Payout processed successfully',
        payout,
        result
      });
    } catch (error) {
      console.error('Error processing payout:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Batch process payouts (Admin only)
   */
  async batchProcessPayouts(req, res) {
    try {
      const { payouts } = req.body;

      const results = [];

      for (const payoutRequest of payouts) {
        try {
          // Process each payout (reusing processPayout logic)
          const result = await this.processSinglePayout(payoutRequest);
          results.push({ success: true, ...result });
        } catch (error) {
          results.push({
            success: false,
            booking_id: payoutRequest.booking_id,
            error: error.message
          });
        }
      }

      res.json({
        message: 'Batch payout processing completed',
        results
      });
    } catch (error) {
      console.error('Error batch processing payouts:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update payout status (Admin only)
   */
  async updatePayoutStatus(req, res) {
    try {
      const { payoutId } = req.params;
      const { status, transaction_ids } = req.body;

      const payout = await payoutModel.updateStatus(payoutId, status, transaction_ids);

      res.json({
        message: 'Payout status updated',
        payout
      });
    } catch (error) {
      console.error('Error updating payout status:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Retry failed payout (Admin only)
   */
  async retryPayout(req, res) {
    try {
      const { payoutId } = req.params;

      const payout = await payoutModel.findById(payoutId);

      if (!payout) {
        return res.status(404).json({ error: 'Payout not found' });
      }

      if (payout.status !== 'failed') {
        return res.status(400).json({ error: 'Only failed payouts can be retried' });
      }

      if (payout.retry_count >= 3) {
        return res.status(400).json({ error: 'Maximum retry attempts reached' });
      }

      // Increment retry count
      await payoutModel.incrementRetry(payoutId);

      // Get payment method
      const paymentMethod = await paymentMethodModel.findById(payout.payment_method_id);

      // Retry the payout
      const result = await operatorPaymentService.processPayout({
        operator_id: payout.operator_id,
        booking_id: payout.booking_id,
        payment_method: paymentMethod,
        amount_usdc: payout.amount_usdc,
        amount_usd: payout.amount_usd
      });

      // Update status
      await payoutModel.markProcessing(payoutId, {
        coinbase_transaction_id: result.payoutId,
        ach_transaction_id: result.payoutId,
        blockchain_tx_hash: result.transactionHash
      });

      res.json({
        message: 'Payout retry initiated',
        payout,
        result
      });
    } catch (error) {
      console.error('Error retrying payout:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Helper: Process single payout (internal use)
   */
  async processSinglePayout(payoutRequest) {
    const { booking_id, operator_id, payment_method_id } = payoutRequest;

    const booking = await bookingModel.findById(booking_id);
    const paymentMethod = await paymentMethodModel.findById(payment_method_id);

    const fee = operatorPaymentService.estimatePayoutFee(
      paymentMethod.payment_type,
      booking.tour_price_usd
    );

    const payout = await payoutModel.create({
      operator_id,
      booking_id,
      payment_method_id,
      amount_usdc: booking.tour_price_usd,
      amount_usd: booking.tour_price_usd,
      fee_amount: fee,
      payout_type: paymentMethod.payment_type
    });

    const result = await operatorPaymentService.processPayout({
      operator_id,
      booking_id,
      payment_method: paymentMethod,
      amount_usdc: booking.tour_price_usd,
      amount_usd: booking.tour_price_usd
    });

    await payoutModel.markProcessing(payout.id, {
      coinbase_transaction_id: result.payoutId,
      ach_transaction_id: result.payoutId,
      blockchain_tx_hash: result.transactionHash
    });

    return { payout, result };
  }
}

module.exports = new OperatorController();
