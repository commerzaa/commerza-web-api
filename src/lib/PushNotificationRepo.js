/** Exports (static, all async): sendnotification(_m: pushNotificationmoel): void; GetAccessTokenAsync(): string; SendFcmMessage(_m: pushNotificationmoel): void; GetTokes(): string[] */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../config');
const { query } = require('../db');

const projectId = () => config.app.FcmProjectId || 'clusteroffer-74cf9';
const FCM_URL = () => `https://fcm.googleapis.com/v1/projects/${projectId()}/messages:send`;

/** Legacy FCM call with the raw "server_key" bearer. _m.Token is inserted as-is (expected to be a JSON array text). Throws on non-2xx (EnsureSuccessStatusCode). */
async function sendnotification(_m) {
  const api_key = config.app.server_key;
  const s = (v) => (v == null ? '' : v); // C# string concat renders null as ""
  const content = '{\r\n    "registration_ids":' + s(_m.Token) + ',\r\n    "notification":{\r\n        "body":"' + s(_m.body) + '",\r\n        "title":"' + s(_m.Title) + '",\r\n        "subtitle":"' + s(_m.subtitle) + '",\r\n        "icon":"' + s(_m.icon) + '",\r\n        "sound":"' + s(_m.sound) + '"\r\n    }\r\n}';
  const response = await axios.post(FCM_URL(), content, {
    headers: { Authorization: 'Bearer ' + api_key, 'Content-Type': 'application/json' },
    responseType: 'text', transformResponse: [(d) => d],
  });
  return response.data;
}

let cachedToken = null; // { token, exp }

/**
 * Google OAuth2 service-account flow (replaces GoogleCredential.FromStream(...).CreateScoped(...).GetAccessTokenForRequestAsync()).
 * Key file path comes from config.app.FcmServiceAccountFile (env FCM_SERVICE_ACCOUNT_FILE).
 */
async function GetAccessTokenAsync() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.token;
  const file = config.app.FcmServiceAccountFile;
  if (!file) throw new Error('FCM_SERVICE_ACCOUNT_FILE is not configured');
  const sa = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const scopes = 'https://www.googleapis.com/auth/firebase.messaging';
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: scopes, aud: tokenUri, iat: now, exp: now + 3600 });
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url');
  const body = new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + signature }).toString();
  const r = await axios.post(tokenUri, body, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
  cachedToken = { token: r.data.access_token, exp: Date.now() + (r.data.expires_in || 3600) * 1000 };
  return cachedToken.token;
}

/** FCM HTTP v1: one request per comma separated token; responses are ignored (legacy). */
async function SendFcmMessage(_m) {
  const accessToken = await GetAccessTokenAsync();
  if (_m.Token) {
    for (const tok of String(_m.Token).split(',')) {
      const rootObj = {
        message: {
          token: tok,
          data: { body: '', title: '', key_1: _m.key_1 === undefined ? null : _m.key_1, key_2: _m.key_2 === undefined ? null : _m.key_2 },
          notification: { title: _m.Title === undefined ? null : _m.Title, body: _m.body === undefined ? null : _m.body, image: _m.icon === undefined ? null : _m.icon },
        },
      };
      // legacy did not check the status code nor catch errors from PostAsync(...).Result for HTTP errors
      await axios.post(FCM_URL(), JSON.stringify(rootObj), {
        headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json', 'Content-Type': 'application/json' },
        validateStatus: () => true,
        responseType: 'text', transformResponse: [(d) => d],
      });
    }
  }
}

async function GetTokes() {
  const rows = await query('affiliate', 'select * from get_push_notification_tokes()');
  return rows.map((r) => r[Object.keys(r)[0]]);
}

module.exports = { sendnotification, GetAccessTokenAsync, SendFcmMessage, GetTokes };
