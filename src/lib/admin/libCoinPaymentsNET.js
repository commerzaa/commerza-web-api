/** Exports (C# namespace libCoinPaymentsNET, MLM Admin): { CoinPayments }
 *   class CoinPayments { constructor(privkey, pubkey)  -- throws Error("Private or Public Key is empty") like the C# ArgumentException
 *                        async CallAPI(cmd, parms = null) : object  (Dictionary<string, dynamic>; on failure { error: "..." }) }
 * Usage: const { CoinPayments } = require('../../lib/admin/libCoinPaymentsNET'); const r = await new CoinPayments(priv, pub).CallAPI('rates', { short: '1' });
 *   (also available as require('../../lib/admin/CoinPayments')).
 * No Member/API equivalent exists => ported.
 * PORT-NOTE: `parms` is a SortedList<string,string> in C# (sorted by the culture-sensitive default string comparer); a plain object or Map is accepted
 *   and its keys are sorted with localeCompare('en') before building the POST body (the order only matters for the HMAC of the exact body sent).
 * PORT-NOTE: WebClient.UploadString => axios POST; HTTP/network errors (legacy WebException) => "Exception while contacting CoinPayments.net: <msg>",
 *   anything else (e.g. invalid JSON) => "Unknown exception: <msg>".
 */
'use strict';
const crypto = require('crypto');
const { postText, netErrorMessage } = require('../_http');

/** Uri.EscapeDataString (RFC 3986: only A-Z a-z 0-9 - _ . ~ stay unescaped). */
function escapeDataString(v) {
  if (v === null || v === undefined) throw new TypeError('Value cannot be null. Parameter name: stringToEscape');
  return encodeURIComponent(String(v)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

class CoinPayments {
  constructor(privkey, pubkey) {
    this.s_privkey = '';
    this.s_pubkey = '';
    this.s_privkey = privkey;
    this.s_pubkey = pubkey;
    if (String(this.s_privkey).length === 0 || String(this.s_pubkey).length === 0) {
      throw new Error('Private or Public Key is empty');
    }
  }

  async CallAPI(cmd, parms = null) {
    let list;
    if (parms === null || parms === undefined) list = new Map();
    else if (parms instanceof Map) list = new Map(parms);
    else list = new Map(Object.entries(parms));
    list.set('version', '1');
    list.set('key', this.s_pubkey);
    list.set('cmd', cmd);

    const sortedKeys = [...list.keys()].sort((a, b) => a.localeCompare(b, 'en'));
    let post_data = '';
    for (const k of sortedKeys) {
      if (post_data.length > 0) post_data += '&';
      post_data += k + '=' + escapeDataString(list.get(k));
    }

    const hmac = crypto.createHmac('sha512', Buffer.from(String(this.s_privkey), 'utf8'))
      .update(Buffer.from(post_data, 'utf8')).digest('hex').toUpperCase();

    let ret = {};
    let resp;
    try {
      resp = await postText('https://www.coinpayments.net/api.php', post_data, {
        'Content-Type': 'application/x-www-form-urlencoded',
        HMAC: hmac,
      });
    } catch (e) {
      ret.error = 'Exception while contacting CoinPayments.net: ' + netErrorMessage(e);
      return ret;
    }
    try {
      const parsed = JSON.parse(resp);
      ret = parsed === null ? null : parsed;
    } catch (e) {
      ret = {};
      ret.error = 'Unknown exception: ' + e.message;
    }
    return ret;
  }
}

module.exports = { CoinPayments };
