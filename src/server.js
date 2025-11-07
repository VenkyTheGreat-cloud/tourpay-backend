require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./config/logger');
const pool = require('./config/database');

// Import routes
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const leadsRoutes = require('./routes/leadsRoutes');
const walletRoutes = require('./routes/walletRoutes');

// TODO: Uncomment these when controllers are implemented
// const tokenRoutes = require('./routes/tokenRoutes');
// const bookingRoutes = require('./routes/bookingRoutes');
// const paymentRoutes = require('./routes/paymentRoutes');
// const webhookRoutes = require('./routes/webhookRoutes');
// const operatorRoutes = require('./routes/operatorRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  process.env.APP_URL || 'http://localhost:3001',
  'http://localhost:8000',
  'http://localhost:5173', // Vite dev server
  'https://tourpay.ca',
  'https://www.tourpay.ca',
  'https://admin.tourpay.ca',
  'https://cute-sherbet-3be10c.netlify.app'
];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth/admin', adminAuthRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/wallet', walletRoutes);

// TODO: Uncomment these when controllers are implemented
// app.use('/api/tokens', tokenRoutes);
// app.use('/api/bookings', bookingRoutes);
// app.use('/api/payments', paymentRoutes);
// app.use('/api/operators', operatorRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'TourPay API',
    version: '1.0.0',
    description: 'Blockchain-based payment platform for Canadian tour industry',
    documentation: '/api/docs'
  });
});

// Test endpoint for Coinbase Onramp (no auth required - for testing only)
app.post('/api/test/coinbase-onramp', async (req, res) => {
  try {
    const coinbaseService = require('./services/coinbaseService');
    const { v4: uuidv4 } = require('uuid');

    const { amount = 100, currency = 'CAD', walletAddress } = req.body;

    // Use provided wallet or generate test wallet
    const testWalletAddress = walletAddress || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';

    const onrampSession = await coinbaseService.createOnrampSession({
      userId: uuidv4(),
      destinationWalletAddress: testWalletAddress,
      amount,
      currency
    });

    res.json({
      success: true,
      message: 'Coinbase Onramp session created (test mode - no auth)',
      ...onrampSession,
      walletAddress: testWalletAddress,
      testMode: true
    });
  } catch (error) {
    logger.error('Error in test onramp endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    pool.end(() => {
      logger.info('Database pool closed');
      process.exit(0);
    });
  });
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`TourPay API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Base RPC URL: ${process.env.BASE_RPC_URL || 'Not configured'}`);
});

module.exports = app;
