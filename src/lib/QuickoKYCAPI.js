/** Exports (static, all async, return response text; on HTTP error the .NET HttpStatusCode name e.g. "Unauthorized"; "ApiCallIssue" on non-web errors): Authenticate(); AuthorizeToken(access_token); AadhaarVerfication(access_token, aadhaar_number); VerifyPAN(access_token, consent, reason, pan); FetchPAN(access_token, consent, reason, pan); PANAadhaarLinkStatus(access_token, pan, aadhaar_number); FetchBankDetailsByIFSC(ifsc) | FetchBankDetailsByIFSC(access_token, ifsc, account_number, name, mobile) (C# overloads, dispatched on argument count); GetTimestamp(value: Date) */
'use strict';
const config = require('../config');
const { queryOne } = require('../db');
const { postText, getText, jsSerialize } = require('./_http');

const HTTP_STATUS_NAMES = {
  300: 'MultipleChoices', 301: 'MovedPermanently', 302: 'Found', 303: 'SeeOther', 304: 'NotModified', 305: 'UseProxy', 307: 'TemporaryRedirect',
  400: 'BadRequest', 401: 'Unauthorized', 402: 'PaymentRequired', 403: 'Forbidden', 404: 'NotFound', 405: 'MethodNotAllowed',
  406: 'NotAcceptable', 407: 'ProxyAuthenticationRequired', 408: 'RequestTimeout', 409: 'Conflict', 410: 'Gone', 411: 'LengthRequired',
  412: 'PreconditionFailed', 413: 'RequestEntityTooLarge', 414: 'RequestUriTooLong', 415: 'UnsupportedMediaType',
  416: 'RequestedRangeNotSatisfiable', 417: 'ExpectationFailed', 426: 'UpgradeRequired',
  500: 'InternalServerError', 501: 'NotImplemented', 502: 'BadGateway', 503: 'ServiceUnavailable', 504: 'GatewayTimeout', 505: 'HttpVersionNotSupported',
};
const statusName = (code) => HTTP_STATUS_NAMES[code] || String(code); // Convert.ToString(HttpStatusCode)

const VERSION = 'v3.1.3';
const authHeaders = (access_token) => ({
  'Content-Type': 'application/json',
  Authorization: access_token,
  'x-api-key': config.app.QuickoApiKey,
  'x-api-version': VERSION,
});

/** Shared error mapping of the legacy catch blocks (WebException with response => status name). */
function mapError(e) {
  if (e && e.isAxiosError) {
    if (e.response) return statusName(e.response.status);
    // WebException without a response: HttpWebResponse cast of null then .StatusCode => NullReferenceException in legacy
    throw new Error('Object reference not set to an instance of an object.');
  }
  return 'ApiCallIssue';
}

async function Authenticate() {
  const BaseURl = 'https://api.quicko.com/authenticate';
  let StrPostData = '';
  const ObjApi = await queryOne('affiliate', "SELECT coalesce(APIKEY,'') AS APIKEY, coalesce(SECRETKEY,'') AS SECRETKEY FROM TBL_MASTER_ONLINEKYC WHERE STATUS=1 LIMIT 1");
  // (legacy would throw NullReferenceException here when no active row exists - same TypeError below)
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': ObjApi.apikey,
    'x-api-secret': ObjApi.secretkey,
    'x-api-version': VERSION,
  };
  try {
    StrPostData = await postText(BaseURl, '', headers);
  } catch (e) {
    if (e && e.isAxiosError) {
      if (e.response) return statusName(e.response.status);
      // WebException without response: falls through, returns "" (legacy)
    } else {
      return 'ApiCallIssue';
    }
  }
  return StrPostData;
}

async function AuthorizeToken(access_token) {
  const BaseURl = 'https://api.quicko.com/oauth/authorize?request_token=' + access_token + '';
  try {
    return await postText(BaseURl, '', authHeaders(access_token));
  } catch (e) { return mapError(e); }
}

async function AadhaarVerfication(access_token, aadhaar_number) {
  const BaseURl = 'https://api.quicko.com/aadhaar/verify';
  const StrPostData = jsSerialize({ aadhaar_number });
  try {
    return await postText(BaseURl, StrPostData, authHeaders(access_token));
  } catch (e) { return mapError(e); }
}

async function quickoGet(url, access_token) {
  try {
    return await getText(url, authHeaders(access_token));
  } catch (e) { return mapError(e); }
}

const VerifyPAN = async (access_token, consent, reason, pan) =>
  quickoGet('https://api.quicko.com/pans/' + pan + '/verify?consent=' + consent + '&reason=' + reason + '', access_token);

const FetchPAN = async (access_token, consent, reason, pan) =>
  quickoGet('https://api.quicko.com/pans/' + pan + '?consent=' + consent + '&reason=' + reason + '', access_token);

const PANAadhaarLinkStatus = async (access_token, pan, aadhaar_number) =>
  quickoGet('https://api.quicko.com/pans/' + pan + '/pan-aadhaar-status?aadhaar_number=' + aadhaar_number + '', access_token);

/** C# overloads: (ifsc) and (access_token, ifsc, account_number, name, mobile). */
async function FetchBankDetailsByIFSC(...args) {
  if (args.length === 1) {
    const ifsc = args[0];
    const BaseURl = 'https://api.quicko.com/bank/' + ifsc + '';
    try {
      return await getText(BaseURl, { 'Content-Type': 'application/json', 'x-api-version': VERSION });
    } catch (e) { return mapError(e); }
  }
  const [access_token, ifsc, account_number, name, mobile] = args;
  return quickoGet('https://api.quicko.com/bank/' + ifsc + '/accounts/' + account_number + '/verify?name=' + name + '&mobile=' + mobile + '', access_token);
}

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = { Authenticate, AuthorizeToken, AadhaarVerfication, VerifyPAN, FetchPAN, PANAadhaarLinkStatus, FetchBankDetailsByIFSC, GetTimestamp };
