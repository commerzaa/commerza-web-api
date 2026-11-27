'use strict';
/**
 * Password hashing for partner staff / delivery boys (dbo.commerza_partner_staff).
 * New passwords are stored as one-way scrypt hashes: "scrypt$<saltB64>$<hashB64>".
 * Rows migrated from the old table may still hold the legacy reversible 3DES value (Encryptword) or plain
 * text; verifyStaffPassword accepts those and reports `needsRehash` so the caller can upgrade them on login.
 */
const crypto = require('crypto');
const { Encryptword } = require('../utils/crypto');

const PREFIX = 'scrypt';
const KEYLEN = 64;

function hashStaffPassword(raw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(raw), salt, KEYLEN);
  return `${PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

function verifyStaffPassword(stored, raw) {
  const s = String(stored || '');
  const pw = String(raw || '');
  if (!s || !pw) return { valid: false, needsRehash: false };
  if (s.startsWith(`${PREFIX}$`)) {
    const [, saltB64, hashB64] = s.split('$');
    if (!saltB64 || !hashB64) return { valid: false, needsRehash: false };
    const expected = Buffer.from(hashB64, 'base64');
    const actual = crypto.scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length || KEYLEN);
    const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    return { valid, needsRehash: false };
  }
  const enc = Encryptword(pw);
  const valid = (enc && s === enc) || s === pw;
  return { valid: Boolean(valid), needsRehash: Boolean(valid) };
}

/**
 * At least 8 chars with an upper-case letter, a lower-case letter and a digit
 * (plus a special character when `requireSpecial`). Returns an error string or null.
 */
function checkStrongPassword(raw, { required = true, requireSpecial = false } = {}) {
  const s = String(raw || '');
  if (!s) return required ? 'Password is required' : null;
  if (s.length < 8) return 'Password must be at least 8 characters';
  if (s.length > 64) return 'Password must be 64 characters or fewer';
  if (!/[a-z]/.test(s) || !/[A-Z]/.test(s) || !/\d/.test(s)) {
    return 'Password must contain upper-case, lower-case letters and a number';
  }
  if (requireSpecial && !/[^A-Za-z0-9]/.test(s)) return 'Password must contain a special character';
  return null;
}

module.exports = { hashStaffPassword, verifyStaffPassword, checkStrongPassword };
