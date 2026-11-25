'use strict';
/**
 * Helpers private to admin port batch13-10 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: hostAddress(index), strictIntOut(rows, name), strictDecOut(rows, name), sqlInt(v), queryString(req, name),
 *          dbFirstCol(rows), cStr(v), cell(row, k), ticks(), cvtInt16(v), EWALLET_LIST_PROPS, userBonusDetails(req, res, opts)
 */
const os = require('os');
const { col, str } = require('./batch11-common');

/**
 * Dns.GetHostEntry(Dns.GetHostName()).AddressList[index] when AddressList.Length > index, else "" (the SERVER address, not the client's).
 * PORT-NOTE: the .NET AddressList order (IPv6 first, then IPv4) may differ from os.networkInterfaces() order.
 */
function hostAddress(index) {
  const addr = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) for (const a of ifs[name] || []) if (!a.internal) addr.push(a.address);
  return addr.length > index ? String(addr[index]) : '';
}

/**
 * int.Parse(spOutput.Value.ToString()) on an OUT param of a row-returning proc (DBNull => "" => FormatException).
 * PORT-NOTE: with no rows the PG function cannot return the OUT value => 0.
 */
function strictIntOut(rows, name) {
  if (!rows || !rows.length) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?\d+(\.0+)?$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}

/**
 * Convert.ToDecimal / decimal.Parse(spOutput.Value.ToString()) on an OUT param of a row-returning proc (DBNull => FormatException).
 * PORT-NOTE: with no rows the PG function cannot return the OUT value => 0.
 */
function strictDecOut(rows, name) {
  if (!rows || !rows.length) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}

/** A string passed to an INT proc parameter: SQL Server converts '' (and whitespace) to 0; anything else is passed through. */
function sqlInt(v) {
  if (v === null || v === undefined) return v;
  return String(v).trim() === '' ? 0 : v;
}

/** Request.QueryString["name"] (query string only, case-insensitive key; missing => null) */
function queryString(req, name) {
  const q = req.query || {};
  const k = Object.keys(q).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) return null;
  const v = q[k];
  return Array.isArray(v) ? v.join(',') : String(v);
}

/** SqlQuery<string>(...).FirstOrDefault(): first column of the first row (null when no row) */
const dbFirstCol = (rows) => (rows && rows[0] ? rows[0][Object.keys(rows[0])[0]] : null);

/** DataRow[x].ToString() : DBNull => "" */
const cStr = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString() : String(v)));

/** DataRow[col] : ArgumentException when the column does not exist */
function cell(row, k) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, k)) throw new Error(`Column '${k}' does not belong to table .`);
  return row[k];
}

/** DateTime.Now.Ticks.ToString() */
const ticks = () => (BigInt(Date.now()) * 10000n + 621355968000000000n).toString();

/** Convert.ToInt16(string): null => 0, invalid => FormatException */
function cvtInt16(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!/^[-+]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(s, 10);
  if (n > 32767 || n < -32768) throw new Error('Value was either too large or too small for an Int16.');
  return n;
}

module.exports = { hostAddress, strictIntOut, strictDecOut, sqlInt, queryString, dbFirstCol, cStr, cell, ticks, cvtInt16 };

/** public class Ewallet_list (Ewallet_Report.cs) */
const EWALLET_LIST_PROPS = ['ROWNUMBER', 'REGNO', 'Name', 'LOGINID', 'EmailId', 'UserName', 'Phone', 'ReferralIncome', 'LeadershipBonus',
  'GrowthReferralBonus', 'GrowthLeadershipBonus', 'GrowthBonus', 'DepositedATC', 'Payable', 'Withdrawal', 'Available', 'DirectIncome', 'PLID',
  'HoldWalletBalanceByAdmin'];

/**
 * Shared body of the User*BonusDetails controllers (UserReferralBonusDetails, UserLeadershipBonusDetails, UserGrowthReferralBonusDetails,
 * UserGrowthLeadershipBonusDetails, UserGrowthBonusDetails): identical C# except @MODE, the OUT total put in ViewBag, the view,
 * whether the decrypt catch calls ErrorInsert and whether the DB part is inside a try.
 * opts: { mode, total (OUT param name == ViewBag key), view, decryptErrorInsert (bool), tryWrap (bool) }
 */
async function userBonusDetails(req, res, opts) {
  const db = require('../../../db');
  const { mapRows } = require('../../../utils/shape');
  const UtilityClass = require('../../../lib/admin/UtilityClass');
  const { errorInsert } = require('./admin-session');
  const { nInt, cvtInt, errorView } = require('./batch11-common');
  let page = nInt(req.p.page);
  let RegNo = 0;
  let QueryString = '';
  const q = queryString(req, 'myquery');
  // Response.Redirect(url) ends the response (ThreadAbortException) => nothing after it runs
  const redirect = () => res.json({ redirect: '/AdminPanel/ewallet-report' });
  if (q !== null) {
    try {
      QueryString = q;
      if (RegNo === 0) RegNo = cvtInt(await UtilityClass.Decryptword(QueryString)); // Convert.ToInt64 ("" => FormatException)
    } catch (ExpObj) {
      if (opts.decryptErrorInsert) await errorInsert(req, ExpObj, 'Index');
      return redirect();
    }
  } else {
    return redirect();
  }
  const body = async () => {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    // [USP_WALLERT_STATEMENT] @STARTROWINDEX,@MAXROWS,@ORDERBYFIELD,@ASC,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@MODE,@LOGINID,@ASCDESCAMOUNT,
    //   @RECORDCOUNT OUT,@TOTALREFERRAL OUT,@TOTALLEADERSHIP OUT,@TOTALGROWTHREFERRAL OUT,@TOTALPAYABLE OUT,@TOTALWITHDRAWAL OUT,@TOTALAVAILABLE OUT,
    //   @TOTALGROWTHLEADERSIP OUT,@TOTALDEPOSITEDATC OUT,@TOTALGROWTHBONUS OUT
    // PORT-NOTE: @ASC is BIT; legacy passed '' which SQL Server converts to 0 => '0' is sent.
    const rows = await db.proc('affiliate', 'USP_WALLERT_STATEMENT', {
      STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: '', ASC: '0', SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '',
      MODE: opts.mode, LOGINID: String(RegNo), ASCDESCAMOUNT: '', // Sending Regno in @LOGINID to get the details
    });
    const Obj = mapRows(rows, EWALLET_LIST_PROPS);
    const TotalRecord = strictIntOut(rows, 'RECORDCOUNT');
    const ViewBag = {};
    ViewBag[opts.total] = strictDecOut(rows, opts.total);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    return res.json({ view: opts.view, Model: Obj, ...ViewBag });
  };
  if (!opts.tryWrap) return body();
  try {
    return await body();
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_WALLERT_STATEMENT');
  }
}

module.exports.EWALLET_LIST_PROPS = EWALLET_LIST_PROPS;
module.exports.userBonusDetails = userBonusDetails;
