const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const bookingController = require('../controllers/bookingController');

// POST /api/bookings - Create a new booking
router.post('/', authenticateToken, bookingController.createBooking);

// GET /api/bookings - Get all user bookings
router.get('/', authenticateToken, bookingController.getUserBookings);

// GET /api/bookings/upcoming - Get upcoming bookings
router.get('/upcoming', authenticateToken, bookingController.getUpcomingBookings);

// GET /api/bookings/past - Get past bookings
router.get('/past', authenticateToken, bookingController.getPastBookings);

// GET /api/bookings/:bookingId - Get specific booking details
router.get('/:bookingId', authenticateToken, bookingController.getBookingDetails);

// POST /api/bookings/:bookingId/cancel - Cancel a booking
router.post('/:bookingId/cancel', authenticateToken, bookingController.cancelBooking);

// POST /api/bookings/:bookingId/checkin - Check-in to a booking
router.post('/:bookingId/checkin', authenticateToken, bookingController.checkInBooking);

// POST /api/bookings/:bookingId/complete - Complete a booking (tour operator)
router.post('/:bookingId/complete', authenticateToken, bookingController.completeBooking);

module.exports = router;
