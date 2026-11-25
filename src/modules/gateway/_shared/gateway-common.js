'use strict';
/**
 * Shared helpers for src/modules/gateway/*.js (Payment Gateway MVC port). Lives in a sub-folder, so
 * src/modules/gateway.js (which mounts only *.js files of src/modules/gateway/) does NOT mount it as a router.
 *
 * Contents: C# conversion emulation (Convert.ToDecimal/ToInt32/.ToString NRE), JavaScriptSerializer/Json() output,
 * Newtonsoft JObject/JToken.ToString emulation, HttpWebRequest JSON POST, ASP.NET Session emulation (gateway session
 * token + src/utils/sessionStore), ENCRYPTBYPASSPHRASE/DECRYPTBYPASSPHRASE replacement, Generatehash512 / Sha512,
 * RemotePost (PayU auto-submit form), and the SQL statements that are repeated verbatim in several controllers.
 */
const crypto = require('crypto');
const axios = require('axios');
const db = require('../../../db');
const { mapRow } = require('../../../utils/shape');
const { signToken } = require('../../../middleware/auth');
const sessionStore = require('../../../utils/sessionStore');

const DB = 'shopping'; // Web.config DataBaseContext: initial catalog=Db_Shopping

/* ------------------------------------------------------------------ C# conversion emulation */
const isNull = (v) => v === null || v === undefined;
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FMT = () => new Error('Input string was not in a correct format.');
/** Convert.ToString(x) / string concatenation of a possibly-null value => "" */
const str = (v) => (isNull(v) ? '' : String(v));
/** x.ToString() on a possibly-null reference => NullReferenceException */
const nn = (v) => { if (isNull(v)) throw NRE(); return String(v); };

/**
 * Convert.ToDecimal(string) (NumberStyles.Number): null => 0, invalid => FormatException.
 * Returns the canonical System.Decimal string (scale kept, e.g. "100.50"), so decimal.ToString() is reproduced.
 */
function decStr(v) {
  if (isNull(v)) return '0';
  if (typeof v === 'number') { if (!Number.isFinite(v)) throw FMT(); return String(v); }
  const s = String(v).trim().replace(/,/g, '');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) throw FMT();
  const int = m[2].replace(/^0+/, '') || '0';
  const frac = m[3] || '';
  const sign = m[1] === '-' && !(/^0*$/.test(int) && /^0*$/.test(frac)) ? '-' : '';
  return sign + int + (frac ? '.' + frac : '');
}
/** Convert.ToDecimal(x) as a JS number (PORT-NOTE: System.Decimal arithmetic => IEEE double) */
const toDec = (v) => Number(decStr(v));
/** Convert.ToInt32(string): null => 0, non-integer => FormatException */
function toInt32(v) {
  if (isNull(v)) return 0;
  if (typeof v === 'number') return Math.trunc(v);
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw FMT();
  return parseInt(s, 10);
}
/** Convert.ToInt32/ToInt64(decimal): banker's rounding (MidpointRounding.ToEven) */
function bankers(n) {
  const f = Math.floor(n);
  const d = n - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(n);
}
/** MVC model binding of a `decimal?` action parameter: missing/blank/invalid => null; else canonical decimal string */
function bindNullableDecimal(v) {
  if (isNull(v) || String(v).trim() === '') return null;
  try { return decStr(v); } catch (e) { return null; }
}
/** MVC model binding of a non-nullable Int64 action parameter (missing/invalid => ArgumentException before the action runs) */
function bindInt64(v, name, method) {
  if (isNull(v) || !/^\s*[+-]?\d+\s*$/.test(String(v))) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int64' for method '${method}'. An optional parameter must be a reference type, a nullable type, or be declared as an optional parameter.`);
  }
  return String(v).trim();
}
/** decimal.ToString("0.00") / ("f2") (round half away from zero) */
function fixed2(v) {
  const n = Number(v);
  const r = Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9) / 100;
  return r.toFixed(2);
}
/** SqlParameter with a null Value in a text command => "The parameterized query ... expects the parameter ..., which was not supplied." */
function sp(v, name) {
  if (isNull(v)) throw new Error(`The parameterized query expects the parameter '${name}', which was not supplied.`);
  return v;
}
/** Legacy concatenated numeric SQL literal ("... WHERE PMID=" + PMID): anything that is not a number was a T-SQL syntax/conversion error */
function sqlNumberLiteral(v) {
  const s = str(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error("Incorrect syntax near '" + s + "'.");
  return s;
}

const pad = (n, l = 2) => String(n).padStart(l, '0');
/** DateTime.Now.ToString("yyyyMMddHHmmssffff") */
function tranIdNow() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}0`;
}
/** DateTime.Now.ToString() - PORT-NOTE: culture dependent in .NET; en-US "M/d/yyyy h:mm:ss tt" used */
function netNow() {
  const d = new Date();
  const h = d.getHours();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${h < 12 ? 'AM' : 'PM'}`;
}

/* ------------------------------------------------------------------ JavaScriptSerializer / Json() */
/** JavaScriptSerializer string encoding (also escapes < > & ' as \u00xx) */
function jsStr(v) {
  if (isNull(v)) return 'null';
  return JSON.stringify(String(v)).replace(/[<>&']/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}
/** JavaScriptSerializer.Serialize for plain values (strings, numbers, decimal strings wrapped via {__dec}, arrays, objects) */
function jss(v) {
  if (isNull(v)) return 'null';
  if (typeof v === 'object' && v.__dec !== undefined) return String(v.__dec);
  if (typeof v === 'string') return jsStr(v);
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(jss).join(',') + ']';
  return '{' + Object.keys(v).map((k) => jsStr(k) + ':' + jss(v[k])).join(',') + '}';
}
/** return Json(x, JsonRequestBehavior.AllowGet) */
function sendJson(res, v) {
  return res.status(200).type('application/json; charset=utf-8').send(jss(v));
}
/** Json(decimalValue): JavaScriptSerializer writes decimals with their scale (e.g. 10.00) */
const dec = (s) => ({ __dec: s });

/** new ResellerApi { MemberID, WalletID, Amount, Type, TransactionID } serialised with JavaScriptSerializer (all public props, declaration order) */
function serializeResellerApi({ MemberID = null, WalletID = 0, Amount = '0', Type = null, TransactionID = null }) {
  return `{"MemberID":${jsStr(MemberID)},"WalletID":${WalletID},"Amount":${Amount},"Type":${jsStr(Type)},"TransactionID":${jsStr(TransactionID)}}`;
}

/* ------------------------------------------------------------------ Newtonsoft emulation */
/** JObject.Parse(text) */
function jObjectParse(text) {
  const o = JSON.parse(String(text));
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Error reading JObject from JsonReader.');
  return o;
}
/** obj[key].ToString() for a JToken: missing => NRE, JSON null => "", string => raw, number => .NET double ToString, array/object => indented JSON */
function jTok(obj, key) {
  if (isNull(obj)) throw NRE();
  const v = obj[key];
  if (v === undefined) throw NRE();
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return JSON.stringify(v, null, 2).replace(/\n/g, '\r\n');
}
/** JArray.Parse(obj["Details"].ToString()) */
function jArrayFrom(obj, key) {
  const v = obj[key];
  if (Array.isArray(v)) return v;
  const p = JSON.parse(jTok(obj, key));
  if (!Array.isArray(p)) throw new Error('Error reading JArray from JsonReader.');
  return p;
}
/** arr[0] on a JArray (ArgumentOutOfRangeException when empty) */
function jAt(arr, i) {
  if (i >= arr.length) throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.');
  return arr[i];
}
/**
 * Json(JArray) through JavaScriptSerializer: a JArray is an IList<JToken>, a JObject an IDictionary<string,JToken>,
 * and a JValue an empty IEnumerable<JToken> => every scalar value is written as [] (legacy quirk, reproduced).
 */
function jssJToken(v) {
  if (Array.isArray(v)) return v.map(jssJToken);
  if (v !== null && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = jssJToken(v[k]); return o; }
  return [];
}

/* ------------------------------------------------------------------ HttpWebRequest JSON POST */
/** HttpWebRequest POST application/json; returns the response body text (non-2xx => WebException => throws) */
async function webPostJson(url, body) {
  const r = await axios.post(String(url), body, {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    transformResponse: [(d) => d],
    timeout: 100000, // HttpWebRequest default timeout
  });
  return String(r.data);
}

/* ------------------------------------------------------------------ ASP.NET Session emulation */
/**
 * The gateway has no login: ASP.NET Session was a cookie-scoped bag filled by Home/Index (and PaymentOnline/Index).
 * PORT-NOTE: the session is now keyed by a gateway session JWT ({ userType: 'gateway', plid: 'gw-<uuid>' }) issued by
 * Home/Index when the caller has no token, and stored server-side in src/utils/sessionStore. Clients must send it back
 * (Authorization: Bearer / ?token=). Without a token sessionStore falls back to the client IP.
 */
function ensureGatewaySession(req) {
  if (req.user) return null;
  const payload = { userType: 'gateway', plid: 'gw-' + crypto.randomUUID() };
  req.user = payload;
  return signToken(payload);
}
const sget = (req, k) => { const v = sessionStore.get(req, k); return v === undefined ? null : v; };
const sset = (req, k, v) => sessionStore.set(req, k, v);

/* ------------------------------------------------------------------ ENCRYPTBYPASSPHRASE / DECRYPTBYPASSPHRASE */
// PORT-NOTE: SQL Server ENCRYPTBYPASSPHRASE has no PostgreSQL equivalent. Same replacement as src/modules/_payment/helpers.js
// (AES-256-CBC, key = SHA-256(passphrase), random IV prefix, "0x"+HEX like CONVERT(VARCHAR(MAX), varbinary, 1)) so tokens
// minted here are accepted by the ported shopping portal and vice versa.
function encryptByPassphrase(pass, text) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(String(pass), 'utf8').digest(), iv);
  return '0x' + Buffer.concat([iv, c.update(String(text), 'utf8'), c.final()]).toString('hex').toUpperCase();
}
function decryptByPassphrase(pass, tokenHex) {
  try {
    const b = Buffer.from(String(tokenHex).replace(/^0x/i, ''), 'hex');
    const d = crypto.createDecipheriv('aes-256-cbc', crypto.createHash('sha256').update(String(pass), 'utf8').digest(), b.subarray(0, 16));
    return Buffer.concat([d.update(b.subarray(16)), d.final()]).toString('utf8');
  } catch (e) { return null; } // DECRYPTBYPASSPHRASE returns NULL on failure
}
/**
 * TokenQuery: SELECT CONVERT(VARCHAR(MAX),CAST(ENCRYPTBYPASSPHRASE('<Session UserName><Session RefrenceId>', '<Session Response>')AS VARBINARY(2000)), 1)
 * Session["Response"].ToString() => NRE when null.
 */
function makeToken(req) {
  return encryptByPassphrase(str(sget(req, 'UserName')) + str(sget(req, 'RefrenceId')), nn(sget(req, 'Response')));
}
/**
 * SELECT CONVERT(VARCHAR(MAX),DECRYPTBYPASSPHRASE('<Key>',CAST(<Token> AS VARBINARY(2000))))  (Token was concatenated raw into SQL)
 * A Token that is not a valid T-SQL binary/number literal was a SQL error => throws.
 */
function decryptTokenSql(Key, Token) {
  const t = str(Token).trim();
  if (/^0x[0-9a-f]*$/i.test(t)) return decryptByPassphrase(str(Key), t);
  if (/^\d+$/.test(t)) return null;
  throw new Error("Incorrect syntax near 'AS'.");
}

/* ------------------------------------------------------------------ hashing */
/** Generatehash512(string text): SHA512 over UTF-8, lower-case hex ({0:x2}); null => ArgumentNullException */
function Generatehash512(text) {
  if (isNull(text)) throw new Error('Value cannot be null.\r\nParameter name: s');
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}
/** private static string Sha512(string input) - same digest, ToString("x2") then ToLower() */
function Sha512(input) {
  if (isNull(input)) throw new Error('Value cannot be null.\r\nParameter name: s');
  return crypto.createHash('sha512').update(Buffer.from(String(input), 'utf8')).digest('hex').toLowerCase();
}
/** Random rnd = new Random(); Generatehash512(rnd.ToString() + DateTime.Now).Substring(0, 20) - rnd.ToString() is the type name "System.Random" */
const newOrderId = () => Generatehash512('System.Random' + netNow()).substring(0, 20);

/* ------------------------------------------------------------------ RemotePost (nested class of PaymentOnlineController) */
class RemotePost {
  constructor() {
    this.Inputs = []; // NameValueCollection (Add on an existing key appends ",value")
    this.Url = '';
    this.Method = 'post';
    this.FormName = 'form1';
  }

  Add(name, value) {
    const e = this.Inputs.find((x) => x[0].toLowerCase() === String(name).toLowerCase());
    if (e) { if (!isNull(value)) e[1] = e[1] === null ? String(value) : e[1] + ',' + value; } else this.Inputs.push([String(name), isNull(value) ? null : String(value)]);
  }

  /** Response.Clear(); Response.Write(...auto-submit form...); Response.End() */
  Post(res) {
    let h = '';
    h += '<html><head>';
    h += `</head><body onload="document.${this.FormName}.submit()">`;
    h += `<form name="${this.FormName}" method="${this.Method}" action="${this.Url}" >`;
    for (const [k, v] of this.Inputs) h += `<input name="${k}" type="hidden" value="${v === null ? '' : v}">`;
    h += '</form>';
    h += '</body></html>';
    return res.status(200).type('html').send(h);
  }
}

/* ------------------------------------------------------------------ repeated SQL */
/** C# class OnlinePaymentUserDetails (property names restored with mapRow) */
const OnlinePaymentUserDetails = ['ORDER_BV', 'ORDER_PV', 'ORDER_CASHBACK', 'USERNAME', 'NAME', 'PHONE', 'EMAILID', 'AMOUNT', 'JPPOINTS',
  'SUCCESSURL', 'FAILUREURL', 'INPROCESSURL', 'CANCELLEDURL', 'COMPANYNAME', 'COMPANYLOGO', 'SHOPPINGWALLET', 'RESELLERWALLET', 'APIURL',
  'SMSAPI', 'COMPANYPGMERCHANTKEY', 'COMPANYPGSALT', 'RazorPayDataKey', 'PMID', 'COMPNAYNAME', 'TRANSATIONPAYUMONEYRATE',
  'TRANSATIONRAZORPAYRATE', 'IS_PAYU_ACTIVE', 'PAYU_RATE', 'PAYU_DATAKEY', 'PAYU_SALTKEY'];
/**
 * SqlQuery<OnlinePaymentUserDetails>("[Usp_PaymentGatewayMaster] @Mode,@OrderNumber,@Source,@Successurl,@Failureurl,@Inprocessurl,@Canceledurl").FirstOrDefault()
 * PORT-NOTE: EF maps the FIRST result set; the PostgreSQL function must return the user-details row as its result.
 */
async function Usp_PaymentGatewayMaster(Mode, OrderNumber, Source, Successurl, Failureurl, Inprocessurl, Canceledurl) {
  const row = await db.procOne(DB, 'usp_paymentgatewaymaster', {
    mode: Mode, ordernumber: OrderNumber, source: Source, successurl: Successurl,
    failureurl: Failureurl, inprocessurl: Inprocessurl, canceledurl: Canceledurl,
  });
  return row ? mapRow(row, OnlinePaymentUserDetails) : null;
}
/** Select TOP(1) ISNULL(AMOUNT,0) From TBL_ORDERONLINEREQUESTS WHERE TRANSACTIONID='<Session RefrenceId>' (FirstOrDefault decimal => 0) */
async function getOrderAmount(transactionId) {
  const v = await db.scalar(DB, 'select coalesce(amount,0) from tbl_orderonlinerequests where transactionid = @t limit 1', { t: str(transactionId) });
  return v === null ? 0 : Number(v);
}
/** Select TOP(1) OrderId From TBL_ORDERONLINEREQUESTS WHERE TRANSACTIONID='...' (FirstOrDefault string => null) */
async function getActualOrderId(transactionId) {
  const v = await db.scalar(DB, 'select orderid from tbl_orderonlinerequests where transactionid = @t limit 1', { t: str(transactionId) });
  return v === null ? null : String(v);
}
/**
 * SELECT ISNULL((CASHBACKWALLETUSED+CASHWALLETUSED+EWALLETUSED[+CODPAYMENT]+(VOUCHERWALLETUSED*<mult>)),0) FROM TBL_ORDERPAYMENT_HISTORY WHERE ORDERID='<ActualOrderId>'
 * (no TOP in legacy; FirstOrDefault). The multiplier (500/1000) and the CODPAYMENT term differ between call sites and are passed in.
 */
async function getPaidAmount(actualOrderId, voucherMultiplier, includeCod) {
  const sql = `select coalesce((cashbackwalletused+cashwalletused+ewalletused${includeCod ? '+codpayment' : ''}+(voucherwalletused*${Number(voucherMultiplier)})),0) from tbl_orderpayment_history where orderid = @o limit 1`;
  const v = await db.scalar(DB, sql, { o: str(actualOrderId) });
  return v === null ? 0 : Number(v);
}
/** DBO.USP_CUSTOMERWALLETSUSED_TRACK @TRANSID,@MLMWALLETUSED,@CUSTOMERWALLETUSED,@VOUCHERUSED,@ONLINEAMOUNT */
async function USP_CUSTOMERWALLETSUSED_TRACK(TRANSID, MLMWALLETUSED, CUSTOMERWALLETUSED, VOUCHERUSED, ONLINEAMOUNT) {
  await db.proc(DB, 'usp_customerwalletsused_track', {
    transid: sp(TRANSID, '@TRANSID'), mlmwalletused: sp(MLMWALLETUSED, '@MLMWALLETUSED'), customerwalletused: sp(CUSTOMERWALLETUSED, '@CUSTOMERWALLETUSED'),
    voucherused: sp(VOUCHERUSED, '@VOUCHERUSED'), onlineamount: sp(ONLINEAMOUNT, '@ONLINEAMOUNT'),
  });
}

module.exports = {
  DB, isNull, NRE, FMT, str, nn, decStr, toDec, toInt32, bankers, bindNullableDecimal, bindInt64, fixed2, sp, sqlNumberLiteral,
  tranIdNow, netNow, jsStr, jss, sendJson, dec, serializeResellerApi, jObjectParse, jTok, jArrayFrom, jAt, jssJToken, webPostJson,
  ensureGatewaySession, sget, sset, encryptByPassphrase, decryptByPassphrase, makeToken, decryptTokenSql,
  Generatehash512, Sha512, newOrderId, RemotePost, OnlinePaymentUserDetails, Usp_PaymentGatewayMaster,
  getOrderAmount, getActualOrderId, getPaidAmount, USP_CUSTOMERWALLETSUSED_TRACK,
};
