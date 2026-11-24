/**
 * Exports (static class InvictaWalletAPI, all async, return string): GetCoinLiveRate(); GetWalletBalance(WalletName, accesstoken); GetRefreshToken();
 *   DebitWallet(WalletName, Amount: decimal, TrnRefNo, TrnDate, Remarks, accesstoken); CreditWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
 *   StandAloneCreditWallet(WalletName, Email, Amount, TrnRefNo, TrnDate, Remarks); CheckPaymentStatus(TrnId, accesstoken)
 * PORT-NOTE: WalletAPIURL from config.app.WalletAPIURL; AES key of EsPayAES.Crypt.Encrypt from config.app.EsPayAESKey (the hard coded key in the C# is not copied).
 * PORT-NOTE: EsPayAES.Crypt.Encrypt lives in a binary reference (dll, source not available). Implemented as AES-256-CBC, key = UTF-8 bytes of the key, IV = first 16 bytes
 *   of the key, PKCS7, base64 output. UNVERIFIED against the dll - confirm with the wallet API owner.
 * PORT-NOTE: legacy WebException handling returns Convert.ToString(HttpStatusCode) (enum name e.g. "BadRequest"); reproduced via a status-name map. A WebException without
 *   a response (network failure) made legacy dereference null => NullReferenceException propagates; reproduced (throws TypeError).
 * PORT-NOTE: CheckPaymentStatus is a GET with ContentLength = 0 and legacy called GetRequestStream() on it, which throws ProtocolException => legacy always returned "ApiCallIssue"; reproduced.
 */
'use strict';
const crypto = require('crypto');
const config = require('../../config');
const { getText, postJson, jsSerialize } = require('../_http');

const STATUS_NAMES = {
  100: 'Continue', 101: 'SwitchingProtocols', 200: 'OK', 201: 'Created', 202: 'Accepted', 203: 'NonAuthoritativeInformation', 204: 'NoContent', 205: 'ResetContent',
  206: 'PartialContent', 300: 'MultipleChoices', 301: 'Moved', 302: 'Found', 303: 'SeeOther', 304: 'NotModified', 305: 'UseProxy', 307: 'RedirectKeepVerb',
  400: 'BadRequest', 401: 'Unauthorized', 402: 'PaymentRequired', 403: 'Forbidden', 404: 'NotFound', 405: 'MethodNotAllowed', 406: 'NotAcceptable',
  407: 'ProxyAuthenticationRequired', 408: 'RequestTimeout', 409: 'Conflict', 410: 'Gone', 411: 'LengthRequired', 412: 'PreconditionFailed', 413: 'RequestEntityTooLarge',
  414: 'RequestUriTooLong', 415: 'UnsupportedMediaType', 416: 'RequestedRangeNotSatisfiable', 417: 'ExpectationFailed', 426: 'UpgradeRequired',
  500: 'InternalServerError', 501: 'NotImplemented', 502: 'BadGateway', 503: 'ServiceUnavailable', 504: 'GatewayTimeout', 505: 'HttpVersionNotSupported',
};

const _walletUrl = () => '' + (((config && config.app) || {}).WalletAPIURL || '');

/** Shared catch block: WebException => status name; other => "ApiCallIssue". */
function failure(err) {
  if (err && err.isAxiosError) {
    if (!err.response) throw new TypeError('Object reference not set to an instance of an object.');
    const code = err.response.status;
    return STATUS_NAMES[code] || String(code);
  }
  return 'ApiCallIssue';
}

async function GetCoinLiveRate() {
  const BaseURl = 'https://account.trebleu.com/api/get-coin-rate';
  try {
    return await getText(BaseURl, { 'Content-Type': 'application/json' });
  } catch (e) {
    return failure(e);
  }
}

async function GetWalletBalance(WalletName, accesstoken) {
  const BaseURl = _walletUrl() + '/api/WalletPayment/GetWalletBalance';
  const body = { WalletName, Param1: null, Param2: null, Param3: null, Param4: null, Param5: null };
  try {
    return await postJson(BaseURl, jsSerialize(body), { Authorization: 'Bearer ' + accesstoken });
  } catch (e) {
    return failure(e);
  }
}

async function GetRefreshToken() {
  const BaseURl = 'https://ssotrebleu.azurewebsites.net/GetAccessToken/GetNewAccessToken';
  try {
    return await getText(BaseURl, { 'Content-Type': 'application/json' });
  } catch (e) {
    return failure(e);
  }
}

async function _walletTxn(path, WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  const BaseURl = '' + _walletUrl() + path;
  const body = { WalletName, Amount, TrnRefNo, TrnDate, Remarks, CallBackUrl: '', Param2: null, Param3: null, Param4: null, Param5: null };
  try {
    return await postJson(BaseURl, jsSerialize(body), { Authorization: 'Bearer ' + accesstoken });
  } catch (e) {
    return failure(e);
  }
}

async function DebitWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  return _walletTxn('/api/WalletPayment/DebitWallet', WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
}

async function CreditWallet(WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken) {
  return _walletTxn('/api/WalletPayment/CreditWallet', WalletName, Amount, TrnRefNo, TrnDate, Remarks, accesstoken);
}

function _esPayEncrypt(plain, key) {
  const k = Buffer.from(key, 'utf8');
  const cipher = crypto.createCipheriv('aes-256-cbc', k, k.subarray(0, 16));
  return Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]).toString('base64');
}

async function StandAloneCreditWallet(WalletName, Email, Amount, TrnRefNo, TrnDate, Remarks) {
  const BaseURl = '' + _walletUrl() + '/api/WalletPayment/CreditWalletV2';
  const txn = { WalletName, Email, Amount, TrnRefNo, TrnDate, Remarks, CallBackUrl: '', Param2: null, Param3: null, Param4: null, Param5: null };
  try {
    const key = '' + (((config && config.app) || {}).EsPayAESKey || '');
    const pre = _esPayEncrypt(jsSerialize(txn), key);
    return await postJson(BaseURl, jsSerialize({ Request: pre }), {});
  } catch (e) {
    return failure(e);
  }
}

async function CheckPaymentStatus(TrnId, accesstoken) {
  // legacy: GET + GetRequestStream() => ProtocolException => caught by the generic handler
  return 'ApiCallIssue';
}

module.exports = { GetCoinLiveRate, GetWalletBalance, GetRefreshToken, DebitWallet, CreditWallet, StandAloneCreditWallet, CheckPaymentStatus };
