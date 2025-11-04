const coinbaseService = require('../services/coinbaseService');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Booking = require('../models/Booking');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const walletModel = new Wallet(pool);
const transactionModel = new Transaction(pool);
const bookingModel = new Booking(pool);

class WebhookController {
  /**
   * Handle Coinbase webhook events
   */
  async handleCoinbaseWebhook(req, res) {
    try {
      const signature = req.headers['x-cc-webhook-signature'];
      const payload = req.body.toString();

      // Verify webhook signature
      const isValid = coinbaseService.verifyWebhookSignature(payload, signature);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const event = JSON.parse(payload);

      // Handle different event types
      switch (event.type) {
        case 'charge:confirmed':
          await this.handleChargeConfirmed(event.data);
          break;

        case 'charge:failed':
          await this.handleChargeFailed(event.data);
          break;

        case 'charge:pending':
          await this.handleChargePending(event.data);
          break;

        case 'wallet:funded':
          await this.handleWalletFunded(event.data);
          break;

        case 'transaction:completed':
          await this.handleTransactionCompleted(event.data);
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling Coinbase webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  /**
   * Handle blockchain event webhooks
   */
  async handleBlockchainWebhook(req, res) {
    try {
      const { event, data } = req.body;

      switch (event) {
        case 'BookingCreated':
          await this.handleBookingCreatedEvent(data);
          break;

        case 'PaymentProcessed':
          await this.handlePaymentProcessedEvent(data);
          break;

        case 'PaymentReleased':
          await this.handlePaymentReleasedEvent(data);
          break;

        case 'RefundProcessed':
          await this.handleRefundProcessedEvent(data);
          break;

        default:
          console.log(`Unhandled blockchain event: ${event}`);
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Error handling blockchain webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  // Coinbase event handlers

  async handleChargeConfirmed(data) {
    console.log('Charge confirmed:', data);

    try {
      // Update transaction status
      const transaction = await transactionModel.findById(data.metadata.transaction_id);

      if (transaction) {
        await transactionModel.complete(
          transaction.id,
          data.blockchain?.transaction_id
        );

        // Update wallet balance
        await walletModel.addBalance(transaction.wallet_id, data.amount);
      }
    } catch (error) {
      console.error('Error handling charge confirmed:', error);
    }
  }

  async handleChargeFailed(data) {
    console.log('Charge failed:', data);

    try {
      const transaction = await transactionModel.findById(data.metadata.transaction_id);

      if (transaction) {
        await transactionModel.fail(transaction.id, data.failure_reason || 'Charge failed');
      }
    } catch (error) {
      console.error('Error handling charge failed:', error);
    }
  }

  async handleChargePending(data) {
    console.log('Charge pending:', data);

    try {
      const transaction = await transactionModel.findById(data.metadata.transaction_id);

      if (transaction) {
        await transactionModel.updateStatus(transaction.id, 'pending');
      }
    } catch (error) {
      console.error('Error handling charge pending:', error);
    }
  }

  async handleWalletFunded(data) {
    console.log('Wallet funded:', data);

    try {
      const wallet = await walletModel.findByUserId(data.metadata.user_id);

      if (wallet) {
        await walletModel.addBalance(wallet.id, data.amount);

        // Create transaction record
        await transactionModel.create({
          user_id: data.metadata.user_id,
          wallet_id: wallet.id,
          transaction_type: 'deposit',
          amount_usdc: data.amount,
          status: 'completed',
          payment_method: 'coinbase_onramp',
          coinbase_transaction_id: data.transaction_id
        });
      }
    } catch (error) {
      console.error('Error handling wallet funded:', error);
    }
  }

  async handleTransactionCompleted(data) {
    console.log('Transaction completed:', data);

    try {
      const transaction = await transactionModel.findById(data.metadata.transaction_id);

      if (transaction) {
        await transactionModel.complete(
          transaction.id,
          data.blockchain_transaction_id
        );
      }
    } catch (error) {
      console.error('Error handling transaction completed:', error);
    }
  }

  // Blockchain event handlers

  async handleBookingCreatedEvent(data) {
    console.log('Booking created on blockchain:', data);

    try {
      const { bookingId, transactionHash } = data;

      const booking = await bookingModel.findById(bookingId);

      if (booking) {
        await bookingModel.updateStatus(bookingId, 'confirmed', transactionHash);
      }
    } catch (error) {
      console.error('Error handling booking created event:', error);
    }
  }

  async handlePaymentProcessedEvent(data) {
    console.log('Payment processed on blockchain:', data);

    try {
      const { bookingId, amount, transactionHash } = data;

      const booking = await bookingModel.findById(bookingId);

      if (booking) {
        await bookingModel.updateStatus(bookingId, 'paid', transactionHash);
      }
    } catch (error) {
      console.error('Error handling payment processed event:', error);
    }
  }

  async handlePaymentReleasedEvent(data) {
    console.log('Payment released on blockchain:', data);

    try {
      const { bookingId, tourOperator, amount, transactionHash } = data;

      const booking = await bookingModel.findById(bookingId);

      if (booking) {
        await bookingModel.updateStatus(bookingId, 'completed', transactionHash);
      }
    } catch (error) {
      console.error('Error handling payment released event:', error);
    }
  }

  async handleRefundProcessedEvent(data) {
    console.log('Refund processed on blockchain:', data);

    try {
      const { bookingId, user, refundAmount, transactionHash } = data;

      const booking = await bookingModel.findById(bookingId);

      if (booking) {
        await bookingModel.cancel(bookingId, refundAmount);

        // Create refund transaction
        await transactionModel.create({
          user_id: booking.user_id,
          wallet_id: booking.wallet_id,
          booking_id: bookingId,
          transaction_type: 'refund',
          amount_usdc: refundAmount,
          status: 'completed',
          payment_method: 'blockchain',
          blockchain_tx_hash: transactionHash
        });
      }
    } catch (error) {
      console.error('Error handling refund processed event:', error);
    }
  }
}

module.exports = new WebhookController();
