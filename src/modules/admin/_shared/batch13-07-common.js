'use strict';
/**
 * Helpers private to admin port batch13-07 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: CheckAPI(API, Type), intParam(v), outIntStrictOf(rows, name), outDecStrictOf(rows, name), roundHalfEven(n),
 *          qsGet(req, name), jsonOrEmpty(res, data), fireAndForget(label, fn), PENDING_REQUEST_PROPS, FRANCHISE_DETAILS_PROPS,
 *          STOCK_DETAILS_PROPS
 */
const axios = require('axios');
const { col, str } = require('./batch11-common');

/**
 * Controllers/AdminPanel/sendMessageToMobile.cs  public static string CheckAPI(string API, string Type)
 * (the C# class lives in the Controllers folder and has no ported lib => implemented here).
 * HttpWebRequest.GetResponse() succeeds only for a 2xx/3xx-followed response; any exception => ErrorInsert + "Invalid ... API".
 */
async function CheckAPI(API, Type) {
  try {
    const baseurl = API;
    if (baseurl === null || baseurl === undefined) throw new Error('Value cannot be null.\r\nParameter name: requestUriString');
    await axios.get(String(baseurl), { maxRedirects: 50, responseType: 'arraybuffer' }); // WebResponse wb = ht.GetResponse();
    return 'Valid API';
  } catch (ExpObj) {
    try {
      const DataUtility = require('../../../lib/admin/DataUtility');
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'CheckAPI', 0, 'Controllers/AdminPanel/sendMessageToMobile');
    } catch (e) {
      console.error('[admin] ErrorInsert failed:', e.message);
    }
    if (Type === '1') return 'Invalid Transtional API';
    return 'Invalid Promotional API';
  }
}

/**
 * A string literal passed to an INT proc parameter (new SqlParameter("@X", "") / "0"): SQL Server converts '' to 0 implicitly,
 * PostgreSQL would reject ''. PORT-NOTE: '' => 0, numeric strings => number.
 */
function intParam(v) {
  if (v === '' || v === null || v === undefined) return v === '' ? 0 : v;
  return v;
}

/** Convert.ToInt32(spOutput.Value.ToString()) / int.Parse(...) on an OUT param of a row-returning proc:
 *  DBNull => "" => FormatException. PORT-NOTE: with no rows PostgreSQL cannot return the OUT value => 0. */
function outIntStrictOf(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}

/** decimal.Parse(<OUT>.Value.ToString()) on a row-returning proc (DBNull => FormatException). PORT-NOTE: no rows => 0. */
function outDecStrictOf(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}

/** Convert.ToInt32(decimal) / Convert.ToInt64(decimal): round half to even (banker's rounding) */
function roundHalfEven(n) {
  const x = Number(n);
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** Request.QueryString["name"] (case-insensitive, query string only; missing => null) */
function qsGet(req, name) {
  const q = req.query || {};
  const k = Object.keys(q).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) return null;
  const v = q[k];
  return Array.isArray(v) ? v.join(',') : String(v);
}

/** MVC JsonResult: Data == null => nothing is written (empty body, application/json) */
function jsonOrEmpty(res, data) {
  if (data === null || data === undefined) return res.type('application/json').send('');
  return res.json(data);
}

/** new System.Threading.Thread(delegate { ... }).Start() */
function fireAndForget(label, fn) {
  Promise.resolve().then(fn).catch((e) => console.error(`[admin] ${label} thread failed:`, e.message));
}

/** Pending_RequestController.cs class PendingRequest */
const PENDING_REQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region', 'StoreType',
  'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode', 'Paymentdate',
  'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];
/** Pending_RequestController.cs class FranchiseDetails */
const FRANCHISE_DETAILS_PROPS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];
/** ManageStock.cs class StockDetails */
const STOCK_DETAILS_PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'EMAILID', 'MRP',
  'COUNTRY', 'STATE', 'ADDRESS', 'CITY', 'PINCODE', 'Prname', 'Code', 'Name', 'PRcode', 'TKPID', 'TransferStock', 'ATTRIBUTE'];

module.exports = {
  CheckAPI, intParam, outIntStrictOf, outDecStrictOf, roundHalfEven, qsGet, jsonOrEmpty, fireAndForget,
  PENDING_REQUEST_PROPS, FRANCHISE_DETAILS_PROPS, STOCK_DETAILS_PROPS,
};
