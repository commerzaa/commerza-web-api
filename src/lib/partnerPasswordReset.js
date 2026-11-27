'use strict';
/**
 * Token-based password recovery for partner owners (portal_login).
 *
 * Replaces the legacy flow that emailed the stored password in plain text. A random token is emailed as a link;
 * only its SHA-256 hash is stored, it expires after 30 minutes and works once. Resetting revokes all of the
 * partner's open sessions.
 *
 * Email goes out through SMTP_HOST / SMTP_PORT / SMTP_USERNAME / SMTP_PASSWORD (.env). When SMTP is not
 * configured and NODE_ENV is not production, the link is printed to the server console so the flow can be tested.
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const db = require('../db');
const config = require('../config');
const { Encryptword } = require('../utils/crypto');
const { ensureRefreshTokenTable } = require('./refreshTokens');

const DB = 'shopping';
const TOKEN_TTL_MINUTES = 30;
const PORTAL_URL = (process.env.PARTNER_PORTAL_URL || 'http://localhost:5174').replace(/\/+$/, '');

let tableReady = null;
function ensureResetTable() {
  if (!tableReady) {
    tableReady = db.query(
      DB,
      `CREATE SCHEMA IF NOT EXISTS dbo;
       CREATE TABLE IF NOT EXISTS dbo.commerza_partner_password_resets (
         id BIGSERIAL PRIMARY KEY,
         plid BIGINT NOT NULL,
         token_hash CHAR(64) NOT NULL UNIQUE,
         expires_at TIMESTAMP NOT NULL,
         used_at TIMESTAMP,
         request_ip VARCHAR(64) NOT NULL DEFAULT '',
         created_at TIMESTAMP NOT NULL DEFAULT NOW()
       );
       CREATE INDEX IF NOT EXISTS ix_commerza_partner_password_resets_plid
         ON dbo.commerza_partner_password_resets (plid, created_at);`
    ).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function smtpTransport() {
  const a = config.app || {};
  if (!a.SMPT_HOST || !a.SMPT_Username) return null;
  const port = Number(a.SMPT_PORT || 587);
  return nodemailer.createTransport({
    host: a.SMPT_HOST,
    port,
    secure: String(a.SMTP_EnableSSL).toLowerCase() === 'true' || port === 465,
    auth: { user: a.SMPT_Username, pass: a.SMPT_Password },
  });
}

async function sendResetEmail(to, name, link) {
  const transport = smtpTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[password-reset] SMTP not configured. Reset link for ${to}: ${link}`);
      return;
    }
    throw new Error('Email service is not configured');
  }
  const from = (config.app && (config.app.CompanySendMailEmailId || config.app.SMPT_Username)) || '';
  await transport.sendMail({
    from: `Commerzaa Partners <${from}>`,
    to,
    subject: 'Reset your Commerzaa partner password',
    text: `Hi ${name || 'Partner'},\n\nUse this link to set a new password (valid for ${TOKEN_TTL_MINUTES} minutes):\n${link}\n\nIf you didn't ask for this, ignore this email — your password stays the same.`,
    html: `<p>Hi ${escapeHtml(name || 'Partner')},</p>
<p>Use the button below to set a new password for your Commerzaa partner account. The link is valid for ${TOKEN_TTL_MINUTES} minutes and can be used once.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0071e3;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="color:#64748b;font-size:13px">If you didn't ask for this, ignore this email — your password stays the same.</p>`,
  });
}

/**
 * Starts a reset for the partner owning `email`. Always resolves without saying whether the account exists.
 * At most 3 links per account per 30 minutes.
 */
async function requestPasswordReset(email, requestIp = '') {
  await ensureResetTable();
  const owner = await db.queryOne(
    DB,
    `SELECT plid, emailid, loginid, fname FROM portal_login
     WHERE lower(emailid) = lower(@email) OR lower(loginid) = lower(@email)
     ORDER BY plid LIMIT 1`,
    { email }
  );
  if (!owner) return;

  const recent = await db.scalar(
    DB,
    `SELECT COUNT(*)::int FROM dbo.commerza_partner_password_resets
     WHERE plid = @plid AND created_at > NOW() - make_interval(mins => @ttl::int)`,
    { plid: owner.plid, ttl: TOKEN_TTL_MINUTES }
  );
  if (Number(recent) >= 3) return;

  const token = crypto.randomBytes(32).toString('base64url');
  await db.exec(
    DB,
    `INSERT INTO dbo.commerza_partner_password_resets (plid, token_hash, expires_at, request_ip)
     VALUES (@plid, @hash, NOW() + make_interval(mins => @ttl::int), @ip)`,
    { plid: owner.plid, hash: sha256(token), ttl: TOKEN_TTL_MINUTES, ip: String(requestIp).slice(0, 64) }
  );

  const to = /@/.test(owner.emailid || '') ? owner.emailid : email;
  await sendResetEmail(to, owner.fname, `${PORTAL_URL}/reset-password?token=${encodeURIComponent(token)}`);
}

/** Sets a new password from a valid token. Returns null on success or an error message. */
async function resetPasswordWithToken(token, newPassword) {
  await ensureResetTable();
  await ensureRefreshTokenTable();
  const hash = sha256(String(token || ''));

  return db.tx(DB, async (t) => {
    const row = await t.queryOne(
      `SELECT id, plid FROM dbo.commerza_partner_password_resets
       WHERE token_hash = @hash AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      { hash }
    );
    if (!row) return 'This reset link is invalid or has expired.';

    // portal_login keeps the legacy 3DES format: other legacy apps verify partner passwords with it.
    await t.exec('UPDATE portal_login SET password = @pw WHERE plid = @plid', {
      pw: Encryptword(newPassword) || newPassword,
      plid: row.plid,
    });
    await t.exec(
      'UPDATE dbo.commerza_partner_password_resets SET used_at = NOW() WHERE plid = @plid AND used_at IS NULL',
      { plid: row.plid }
    );
    // Sign the owner out everywhere (staff sessions use subject_key "staff:<id>" and are left alone).
    await t.exec(
      `UPDATE dbo.commerza_refresh_tokens SET revoked_at = NOW()
       WHERE user_type = 'merchant' AND subject_id = @plid AND subject_key NOT LIKE 'staff:%' AND revoked_at IS NULL`,
      { plid: row.plid }
    );
    return null;
  });
}

module.exports = { requestPasswordReset, resetPasswordWithToken };
