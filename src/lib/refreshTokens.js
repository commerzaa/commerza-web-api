'use strict';
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { signToken } = require('../middleware/auth');

const DB = 'shopping';
const REFRESH_DAYS = config.jwt.refreshExpiresDays || 30;
let tableReady = null;

/** Ensures dbo.commerza_refresh_tokens exists for partner/admin refresh token sessions. */
function ensureRefreshTokenTable() {
  if (!tableReady) {
    tableReady = db.query(
      DB,
      `CREATE SCHEMA IF NOT EXISTS dbo;
       CREATE TABLE IF NOT EXISTS dbo.commerza_refresh_tokens (
         id BIGSERIAL PRIMARY KEY,
         user_type VARCHAR(20) NOT NULL,
         subject_id BIGINT NOT NULL DEFAULT 0,
         subject_key VARCHAR(200) NOT NULL DEFAULT '',
         payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
         token_hash CHAR(64) NOT NULL,
         expires_at TIMESTAMP NOT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT NOW(),
         rotated_at TIMESTAMP,
         revoked_at TIMESTAMP
       );
       CREATE INDEX IF NOT EXISTS ix_commerza_refresh_tokens_subject
         ON dbo.commerza_refresh_tokens (user_type, subject_id, subject_key);`
    ).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');

function newRefreshToken(sid) {
  const token = `${sid}.${crypto.randomBytes(32).toString('base64url')}`;
  return { token, hash: sha256(token) };
}

function parseRefreshToken(raw) {
  const m = /^(\d{1,18})\.[A-Za-z0-9_-]{43}$/.exec(String(raw || '').trim());
  return m ? { id: Number(m[1]), hash: sha256(String(raw || '').trim()) } : null;
}

function issueAccessToken(payload, sid) {
  const token = signToken(
    { ...payload, sid },
    { expiresIn: config.jwt.portalExpiresIn }
  );
  const decoded = jwt.decode(token) || {};
  const expiresIn = decoded.exp && decoded.iat ? decoded.exp - decoded.iat : 900;
  return { token, expiresIn };
}

/** Creates a persistent refresh-token session and returns { token, refreshToken, expiresIn, sid }. */
async function createSession({ userType, subjectId = 0, subjectKey = '', payload }) {
  await ensureRefreshTokenTable();
  const sid = await db.tx(DB, async (t) => {
    const id = await t.scalar(
      `INSERT INTO dbo.commerza_refresh_tokens
         (user_type, subject_id, subject_key, payload_json, token_hash, expires_at)
       VALUES (@userType, @subjectId, @subjectKey, @payloadJson::jsonb, '', NOW() + make_interval(days => @days))
       RETURNING id`,
      {
        userType,
        subjectId: Number(subjectId || 0),
        subjectKey: String(subjectKey || ''),
        payloadJson: JSON.stringify(payload || {}),
        days: REFRESH_DAYS,
      }
    );
    return Number(id);
  });

  const refresh = newRefreshToken(sid);
  await db.query(
    DB,
    'UPDATE dbo.commerza_refresh_tokens SET token_hash = @hash WHERE id = @id',
    { id: sid, hash: refresh.hash }
  );

  const access = issueAccessToken(payload, sid);
  return { ...access, refreshToken: refresh.token, sid };
}

/** Validates and rotates a single-use refresh token, returning { token, refreshToken, expiresIn } or { error }. */
async function rotateSession(rawRefreshToken, expectedUserType, validateFn) {
  const parsed = parseRefreshToken(rawRefreshToken);
  if (!parsed) return { error: 'Invalid refresh token. Please sign in again.' };
  await ensureRefreshTokenTable();

  return db.tx(DB, async (t) => {
    const row = await t.queryOne(
      `SELECT id, user_type, subject_id, subject_key, payload_json,
              (expires_at > NOW()) AS live, revoked_at
       FROM dbo.commerza_refresh_tokens
       WHERE id = @id AND token_hash = @hash AND user_type = @userType
       LIMIT 1`,
      { id: parsed.id, hash: parsed.hash, userType: expectedUserType }
    );
    if (!row) return { error: 'Invalid refresh token. Please sign in again.' };
    if (row.revoked_at) return { error: 'Session has been logged out. Please sign in again.' };
    if (!row.live) return { error: 'Your session has expired. Please sign in again.' };

    if (typeof validateFn === 'function') {
      const errMsg = await validateFn(t, row);
      if (errMsg) return { error: errMsg };
    }

    const next = newRefreshToken(row.id);
    const updated = await t.exec(
      `UPDATE dbo.commerza_refresh_tokens
       SET token_hash = @nextHash,
           rotated_at = NOW(),
           expires_at = NOW() + make_interval(days => @days)
       WHERE id = @id AND token_hash = @hash AND revoked_at IS NULL`,
      { id: row.id, hash: parsed.hash, nextHash: next.hash, days: REFRESH_DAYS }
    );
    if (updated !== 1) return { error: 'Invalid refresh token. Please sign in again.' };

    const payload = typeof row.payload_json === 'string' ? JSON.parse(row.payload_json) : (row.payload_json || {});
    const access = issueAccessToken(payload, Number(row.id));
    return { ...access, refreshToken: next.token };
  });
}

/** Revokes a session by sid so both its refresh token and access token are rejected. */
async function revokeSession(sid) {
  const id = Number(sid);
  if (!Number.isInteger(id) || id <= 0) return;
  await ensureRefreshTokenTable();
  await db.query(
    DB,
    'UPDATE dbo.commerza_refresh_tokens SET revoked_at = NOW() WHERE id = @id AND revoked_at IS NULL',
    { id }
  );
}

module.exports = {
  ensureRefreshTokenTable,
  createSession,
  rotateSession,
  revokeSession,
};
