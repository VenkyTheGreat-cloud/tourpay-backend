const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// POST /api/payments/process - Process payment for booking
router.post('/process', authenticateToken, paymentController.processPayment);

// POST /api/payments/release - Release payment to tour operator
router.post('/release', authenticateToken, paymentController.releasePayment);

// POST /api/payments/refund - Process refund
router.post('/refund', authenticateToken, paymentController.processRefund);

// GET /api/payments/:transactionId - Get payment details
router.get('/:transactionId', authenticateToken, paymentController.getPaymentDetails);

// GET /api/payments/booking/:bookingId - Get payments for a booking
router.get('/booking/:bookingId', authenticateToken, paymentController.getBookingPayments);

module.exports = router;
