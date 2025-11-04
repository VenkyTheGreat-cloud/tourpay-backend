const express = require('express');
const router = express.Router();
const { authenticateToken, requireUserType } = require('../middleware/auth');
const operatorController = require('../controllers/operatorController');

// All routes require authentication and operator role
const requireOperator = [authenticateToken, requireUserType('operator', 'admin')];

// Payment Methods
router.post('/payment-methods', requireOperator, operatorController.addPaymentMethod);
router.get('/payment-methods', requireOperator, operatorController.getPaymentMethods);
router.get('/payment-methods/:methodId', requireOperator, operatorController.getPaymentMethod);
router.put('/payment-methods/:methodId/primary', requireOperator, operatorController.setPrimaryPaymentMethod);
router.put('/payment-methods/:methodId/status', requireOperator, operatorController.updatePaymentMethodStatus);
router.delete('/payment-methods/:methodId', requireOperator, operatorController.deletePaymentMethod);

// Bank Account Verification
router.post('/payment-methods/verify/plaid', requireOperator, operatorController.verifyBankAccountPlaid);
router.post('/payment-methods/:methodId/verify', requireOperator, operatorController.verifyPaymentMethod);

// Payouts
router.get('/payouts', requireOperator, operatorController.getPayouts);
router.get('/payouts/:payoutId', requireOperator, operatorController.getPayoutDetails);
router.get('/payouts/booking/:bookingId', requireOperator, operatorController.getPayoutsByBooking);
router.get('/payouts/status/:status', requireOperator, operatorController.getPayoutsByStatus);

// Payout Statistics
router.get('/payouts/stats/summary', requireOperator, operatorController.getPayoutSummary);
router.get('/payouts/stats/date-range', requireOperator, operatorController.getPayoutsByDateRange);

// Admin routes for processing payouts
router.post('/payouts/process', [authenticateToken, requireUserType('admin')], operatorController.processPayout);
router.post('/payouts/batch-process', [authenticateToken, requireUserType('admin')], operatorController.batchProcessPayouts);
router.put('/payouts/:payoutId/status', [authenticateToken, requireUserType('admin')], operatorController.updatePayoutStatus);
router.post('/payouts/:payoutId/retry', [authenticateToken, requireUserType('admin')], operatorController.retryPayout);

module.exports = router;
