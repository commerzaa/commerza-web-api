'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

/**
 * JWT authentication.
 * Token payload: { plid, userName, userType: 'member' | 'customer' | ..., clid?, ... }
 * Send as:  Authorization: Bearer <token>   (also accepted: x-access-token header, ?token= query)
 * Login endpoints (MemberSignIn, customer login, registration ...) return `token` in addition to the legacy response.
 *
 * Server-side logout: customer tokens from /api/CustomerSignIn and /api/CustomerSignUp carry `lsid`, the clhid of
 * their row in db_shopping.dbo.tbl_customerloginhistory. The token is accepted only while that row has status = 1;
 * /api/CustomerLogout and /api/CustomerLogoutAll set it to 0. Tokens without `lsid` (legacy portal logins, tokens
 * issued before this check existed) are not tracked and stay valid until they expire.
 *
 * Customer access tokens are short-lived (config.jwt.customerExpiresIn). When one expires the API answers 401 with
 * code 'TOKEN_EXPIRED'; the client then calls /api/CustomerRefreshToken with its refresh token to get a new pair.
 */
function signToken(payload, options = {}) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn, ...options });
}

function extract(req) {
  const h = req.headers.authorization || '';
  if (/^bearer /i.test(h)) return h.slice(7).trim();
  return req.headers['x-access-token'] || req.query.token || null;
}

/** False when the token belongs to a session that has been logged out. */
async function isSessionActive(user) {
  if (!user) return true;
  if (user.userType === 'customer' && user.lsid !== undefined && user.lsid !== null) {
    const lsid = Number(user.lsid);
    const plid = Number(user.clid !== undefined ? user.clid : user.plid);
    if (!Number.isInteger(lsid) || !Number.isInteger(plid)) return false;
    const status = await db.scalar('shopping',
      'select status from dbo.tbl_customerloginhistory where clhid = @lsid and plid = @plid', { lsid, plid });
    return status === 1;
  }
  if ((user.userType === 'merchant' || user.userType === 'admin' || user.userType === 'delivery_boy') && user.sid !== undefined && user.sid !== null) {
    const sid = Number(user.sid);
    if (!Number.isInteger(sid) || sid <= 0) return false;
    const active = await db.scalar('shopping',
      'select 1 from dbo.commerza_refresh_tokens where id = @sid and revoked_at is null limit 1', { sid });
    return active === 1;
  }
  return true;
}

/** Protects a route. Responds with the same {status:"false"} envelope family the legacy API used. */
async function auth(req, res, next) {
  const token = extract(req);
  if (!token) return res.status(401).json({ status: 'false', message: 'Authentication token is required' });
  let user;
  try {
    user = jwt.verify(token, config.jwt.secret);
  } catch (e) {
    // `code` lets clients tell an expired token (refresh it via /api/CustomerRefreshToken) from a bad one
    const expired = e.name === 'TokenExpiredError';
    return res.status(401).json(expired
      ? { status: 'false', message: 'Token expired', code: 'TOKEN_EXPIRED' }
      : { status: 'false', message: 'Invalid token', code: 'TOKEN_INVALID' });
  }
  try {
    if (!(await isSessionActive(user))) return res.status(401).json({ status: 'false', message: 'Session has been logged out', code: 'SESSION_ENDED' });
  } catch (e) {
    return next(e);
  }
  req.user = user;
  return next();
}

/** Sets req.user when a valid, still-active token is present but never rejects. */
async function optionalAuth(req, res, next) {
  const token = extract(req);
  if (token) {
    let user = null;
    try { user = jwt.verify(token, config.jwt.secret); } catch (_) { /* ignore */ }
    try {
      if (user && await isSessionActive(user)) req.user = user;
    } catch (e) {
      return next(e);
    }
  }
  return next();
}

/** Restrict by token userType, e.g. router.post('/x', auth, requireType('member'), h) */
const requireType = (...types) => (req, res, next) =>
  (req.user && types.includes(req.user.userType)) ? next()
    : res.status(403).json({ status: 'false', message: 'Forbidden' });

module.exports = { signToken, auth, optionalAuth, requireType };
