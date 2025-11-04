const jwt = require('jsonwebtoken');
const redis = require('redis');

// Initialize Redis client for session management
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect();

/**
 * Authenticate JWT token middleware
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Check if token is blacklisted (logged out)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(403).json({ error: 'Token expired' });
        }
        return res.status(403).json({ error: 'Invalid token' });
      }

      req.user = user;
      next();
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Generate access token
 */
const generateAccessToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      userType: user.user_type
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '1h' }
  );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      userType: user.user_type
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

/**
 * Store refresh token in Redis
 */
const storeRefreshToken = async (userId, refreshToken) => {
  try {
    const expirySeconds = 7 * 24 * 60 * 60; // 7 days
    await redisClient.setEx(`refresh:${userId}`, expirySeconds, refreshToken);
  } catch (error) {
    console.error('Error storing refresh token:', error);
    throw error;
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = async (userId, refreshToken) => {
  try {
    const storedToken = await redisClient.get(`refresh:${userId}`);
    return storedToken === refreshToken;
  } catch (error) {
    console.error('Error verifying refresh token:', error);
    return false;
  }
};

/**
 * Blacklist access token (for logout)
 */
const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    const expiryTime = decoded.exp - Math.floor(Date.now() / 1000);

    if (expiryTime > 0) {
      await redisClient.setEx(`blacklist:${token}`, expiryTime, 'true');
    }
  } catch (error) {
    console.error('Error blacklisting token:', error);
    throw error;
  }
};

/**
 * Remove refresh token (for logout)
 */
const removeRefreshToken = async (userId) => {
  try {
    await redisClient.del(`refresh:${userId}`);
  } catch (error) {
    console.error('Error removing refresh token:', error);
    throw error;
  }
};

/**
 * Rate limiting middleware
 */
const rateLimitMiddleware = async (req, res, next) => {
  try {
    const identifier = req.user?.userId || req.ip;
    const key = `ratelimit:${identifier}`;

    const requests = await redisClient.incr(key);

    if (requests === 1) {
      await redisClient.expire(key, 60); // 1 minute window
    }

    const limit = process.env.RATE_LIMIT || 100;

    if (requests > limit) {
      return res.status(429).json({
        error: 'Too many requests. Please try again later.'
      });
    }

    next();
  } catch (error) {
    console.error('Rate limit error:', error);
    next(); // Continue on error to avoid blocking
  }
};

/**
 * Check user type middleware
 */
const requireUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Session management - store active sessions
 */
const createSession = async (userId, token) => {
  try {
    const sessionKey = `session:${userId}`;
    const expirySeconds = 60 * 60; // 1 hour

    await redisClient.setEx(sessionKey, expirySeconds, JSON.stringify({
      token,
      createdAt: new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error creating session:', error);
    throw error;
  }
};

/**
 * Get active session
 */
const getSession = async (userId) => {
  try {
    const sessionKey = `session:${userId}`;
    const session = await redisClient.get(sessionKey);

    return session ? JSON.parse(session) : null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

/**
 * Destroy session
 */
const destroySession = async (userId) => {
  try {
    const sessionKey = `session:${userId}`;
    await redisClient.del(sessionKey);
  } catch (error) {
    console.error('Error destroying session:', error);
    throw error;
  }
};

module.exports = {
  authenticateToken,
  generateAccessToken,
  generateRefreshToken,
  storeRefreshToken,
  verifyRefreshToken,
  blacklistToken,
  removeRefreshToken,
  rateLimitMiddleware,
  requireUserType,
  createSession,
  getSession,
  destroySession,
  redisClient
};
