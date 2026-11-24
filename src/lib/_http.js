/** Exports: private shared helpers for ported DAL libs (no C# equivalent): getText, postText, postJson, jsSerialize, netErrorMessage, safeUrl, ErrorInsert, jstr, toDecimal, toInt64, outValue */
'use strict';
const axios = require('axios');

const DEFAULT_TIMEOUT = 100000; // HttpWebRequest default (100 s)

/** .NET Uri escapes spaces / non-ASCII in a raw concatenated URL; node's http would throw instead. */
function safeUrl(u) {
  try { return new URL(u).href; } catch (_) { return u; }
}

/** Message like the .NET WebException one (used where C# returned ex.Message). */
function netErrorMessage(e) {
  if (e && e.response) return `The remote server returned an error: (${e.response.status}) ${e.response.statusText || ''}.`;
  return (e && e.message) || String(e);
}

const rawOpts = (headers, timeout, extra) => ({
  headers: headers || {},
  timeout: timeout || DEFAULT_TIMEOUT,
  responseType: 'text',
  transformResponse: [(d) => d],
  maxRedirects: 5,
  ...extra,
});

/** HTTP GET => body text. Throws (axios error, has .response) on non-2xx / network error, like HttpWebRequest.GetResponse. */
async function getText(url, headers, timeout) {
  const r = await axios.get(safeUrl(url), rawOpts(headers, timeout));
  return typeof r.data === 'string' ? r.data : String(r.data == null ? '' : r.data);
}

/** HTTP POST with a raw string body => body text. */
async function postText(url, body, headers, timeout) {
  const r = await axios.post(safeUrl(url), body, rawOpts(headers, timeout));
  return typeof r.data === 'string' ? r.data : String(r.data == null ? '' : r.data);
}

const postJson = (url, bodyString, headers, timeout) =>
  postText(url, bodyString, { 'Content-Type': 'application/json', ...(headers || {}) }, timeout);

/** JavaScriptSerializer.Serialize equivalent (it additionally escapes < > & '). */
function jsSerialize(obj) {
  return JSON.stringify(obj)
    .replace(/</g, '\u003c').replace(/>/g, '\u003e').replace(/&/g, '\u0026').replace(/'/g, '\u0027');
}

/** DataUtility.ErrorInsert(code, message, procedureName, line, errorUrl) - never throws. */
async function ErrorInsert(err, procedureName, errorUrl) {
  try {
    const DataUtility = require('./DataUtility');
    const inst = typeof DataUtility === 'function' ? new DataUtility() : DataUtility;
    await inst.ErrorInsert(0, (err && err.message) || String(err), procedureName, 0, errorUrl);
  } catch (e) {
    console.error('ErrorInsert failed:', e.message);
  }
}

/** JToken.ToString(): missing key => NullReferenceException (TypeError here), null => "". */
function jstr(v) {
  if (v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Convert.ToDecimal(string): throws FormatException on invalid input. */
function toDecimal(s) {
  const t = String(s == null ? '' : s).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
function toInt64(s) {
  const t = String(s == null ? '' : s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}

/** Reads a stored-procedure OUT parameter from the single result row (case-insensitive), else first column. */
function outValue(row, name) {
  if (!row) return '';
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  const v = k !== undefined ? row[k] : row[Object.keys(row)[0]];
  return v == null ? '' : String(v);
}

module.exports = { getText, postText, postJson, jsSerialize, netErrorMessage, safeUrl, ErrorInsert, jstr, toDecimal, toInt64, outValue, DEFAULT_TIMEOUT };
