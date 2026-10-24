'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const net = require('net');

// WHY RATE LIMITING?
// Rate limiting protects the server from abuse, denial-of-service, and automated
// scrapers by capping how many requests a single client can make in a given timeframe.

/**
 * Extract and normalize client IP for rate-limiting keys.
 *
 * Rules:
 * 1. Development & Automated Tests (isProduction === false):
 *    Strictly ignores all forwarded headers (CF-Connecting-IP, X-Forwarded-For).
 *    Uses direct TCP socket address to prevent local test pollution.
 *
 * 2. Production on Render (isProduction === true):
 *    Cloudflare edge terminates TLS and overwrites the CF-Connecting-IP header.
 *    Validates that CF-Connecting-IP is a valid IPv4 or IPv6 address.
 *
 * 3. Fail-safe Fallback:
 *    If CF-Connecting-IP is absent or malformed in production, unverified traffic
 *    collapses into the normalized socket remoteAddress (or 'untrusted-edge-fallback')
 *    so forged headers cannot obtain fresh rate-limit buckets.
 *
 * 4. IPv6 Subnet Normalization (/56):
 *    Valid IPv6 addresses (from CF-Connecting-IP or fallback socket) are normalized
 *    to a /56 subnet key via express-rate-limit's ipKeyGenerator(ip, 56).
 *    Valid IPv4 addresses remain unchanged.
 *
 * @param {object} req Express request
 * @param {boolean} [isProduction=process.env.NODE_ENV === 'production']
 * @returns {string} Normalized rate-limit key
 */
function getRateLimitKey(req, isProduction = process.env.NODE_ENV === 'production') {
  let rawIp;

  if (!isProduction) {
    rawIp = req.socket?.remoteAddress || '127.0.0.1';
  } else {
    const cfIp = req.headers['cf-connecting-ip'];
    if (typeof cfIp === 'string' && net.isIP(cfIp.trim())) {
      rawIp = cfIp.trim();
    } else {
      rawIp = req.socket?.remoteAddress;
      if (!rawIp || !net.isIP(rawIp)) {
        return 'untrusted-edge-fallback';
      }
    }
  }

  // Normalizes IPv6 to a /56 subnet; leaves IPv4 unchanged
  return ipKeyGenerator(rawIp, 56);
}

/**
 * Factory for link-creation rate limiter.
 *
 * @param {object} [options={}] Custom overrides (e.g. for testing)
 * @returns {Function} Express middleware
 */
function createLinkCreateLimiter(options = {}) {
  return rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30,             // 30 link creations per minute
    keyGenerator: (req) => getRateLimitKey(req),
    standardHeaders: true,
    legacyHeaders: false,
    validate: { trustProxy: false, ip: false },
    handler: (req, res) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many link creation requests. Please try again later.',
        },
      });
    },
    ...options,
  });
}

// Default limiter instance used on POST /api/links
const linkCreateLimiter = createLinkCreateLimiter();

module.exports = { getRateLimitKey, createLinkCreateLimiter, linkCreateLimiter };
