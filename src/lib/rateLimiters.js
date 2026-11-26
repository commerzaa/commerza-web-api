'use strict';
const rateLimit = require('express-rate-limit');

const makeLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { trustProxy: false },
    handler: (_req, res) => {
      res.status(429).json({
        status: 'false',
        message: message || 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
      });
    },
  });

const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many login or registration attempts. Please try again in 15 minutes.',
});

const refreshLimiter = makeLimiter({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  message: 'Too many token refresh requests. Please try again shortly.',
});

const writeLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 80,
  message: 'Too many write requests. Please slow down and try again shortly.',
});

const readLimiter = makeLimiter({
  windowMs: 5 * 60 * 1000,
  limit: 300,
  message: 'Too many requests. Please slow down and try again shortly.',
});

/** Applies readLimiter to GET/HEAD and writeLimiter to mutating methods. */
function portalMethodLimiter(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return readLimiter(req, res, next);
  }
  return writeLimiter(req, res, next);
}

module.exports = {
  authLimiter,
  refreshLimiter,
  writeLimiter,
  readLimiter,
  portalMethodLimiter,
};
