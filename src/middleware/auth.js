'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * JWT authentication.
 * Token payload: { plid, userName, userType: 'member' | 'customer' | ..., clid?, ... }
 * Send as:  Authorization: Bearer <token>   (also accepted: x-access-token header, ?token= query)
 * Login endpoints (MemberSignIn, customer login, registration ...) return `token` in addition to the legacy response.
 */
function signToken(payload, options = {}) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn, ...options });
}

function extract(req) {
  const h = req.headers.authorization || '';
  if (/^bearer /i.test(h)) return h.slice(7).trim();
  return req.headers['x-access-token'] || req.query.token || null;
}

/** Protects a route. Responds with the same {status:"false"} envelope family the legacy API used. */
function auth(req, res, next) {
  const token = extract(req);
  if (!token) return res.status(401).json({ status: 'false', message: 'Authentication token is required' });
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    return next();
  } catch (e) {
    const expired = e.name === 'TokenExpiredError';
    return res.status(401).json({ status: 'false', message: expired ? 'Token expired' : 'Invalid token' });
  }
}

/** Sets req.user when a valid token is present but never rejects. */
function optionalAuth(req, res, next) {
  const token = extract(req);
  if (token) { try { req.user = jwt.verify(token, config.jwt.secret); } catch (_) { /* ignore */ } }
  next();
}

/** Restrict by token userType, e.g. router.post('/x', auth, requireType('member'), h) */
const requireType = (...types) => (req, res, next) =>
  (req.user && types.includes(req.user.userType)) ? next()
    : res.status(403).json({ status: 'false', message: 'Forbidden' });

module.exports = { signToken, auth, optionalAuth, requireType };
