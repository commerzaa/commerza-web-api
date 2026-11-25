'use strict';
/**
 * Shared helpers for portal batch 04 (ClusterofferShopingPortal CustomerPanel controllers).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, NRE, csStr, mvcStr, mvcIntN, mvcInt, mvcDecimal, toInt32, outOf, mapPath, rep, ddMMyyyy, mobileViewBag,
 *          recharge report (rechargeReport), earning history (earningHistory), updatemerchantkyc, fire, redirect, multerAny
 */
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const ps = require('./portal-session');

const DB = 'shopping';

/** new NullReferenceException() */
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** C# string value or '' (ToStringOrEmpty / Convert.ToString on null => '') */
const csStr = (v) => (v === undefined || v === null ? '' : String(v));

/** MVC default model binder for a string action parameter: missing or "" => null. */
function mvcStr(v) {
  if (v === undefined || v === null) return null;
  if (Array.isArray(v)) v = v.join(',');
  const s = String(v);
  return s.trim() === '' ? null : s;
}

/** MVC binder for int? / Int64?: invalid or missing => null. */
function mvcIntN(v) {
  if (v === undefined || v === null || Array.isArray(v)) return null;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/** MVC binder for a non-nullable int action parameter: missing/invalid => ArgumentException (HTTP 500 in legacy). */
function mvcInt(v, name, method) {
  const n = mvcIntN(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32' for method '${method}'. An optional parameter must be a reference type, a nullable type, or be declared as an optional parameter.`);
    e.status = 500;
    throw e;
  }
  return n;
}

/** MVC binder for decimal / double model properties: invalid or missing => 0 (model error ignored). */
function mvcDecimal(v) {
  if (v === undefined || v === null || Array.isArray(v)) return 0;
  const n = Number(String(v).trim());
  return String(v).trim() !== '' && Number.isFinite(n) ? n : 0;
}

/** Convert.ToInt32(string) (throws FormatException like C#). null => 0. */
function toInt32(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Value was either too large or too small for an Int32.');
    // Convert.ToInt32(double) rounds to even
    const f = Math.floor(v); const d = v - f;
    const r = d > 0.5 || (d === 0.5 && f % 2 !== 0) ? f + 1 : f;
    return r;
  }
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(s, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}

/** Value of a stored-procedure OUTPUT parameter (column of the first result row, case-insensitive). undefined when absent. */
function outOf(rows, name) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
}

/** Server.MapPath("~/Folder") => <uploadDir>/<Folder> */
function mapPath(folder) {
  const base = config.uploadDir || path.join(process.cwd(), 'uploads');
  return path.join(base, csStr(folder).replace(/^~?[\\/]+/, ''));
}

/** C# string.Replace(old, new) (all occurrences; null new => ''). */
const rep = (s, k, v) => String(s).split(k).join(v === null || v === undefined ? '' : String(v));

/** DateTime.Now.ToString("dd-MM-yyyy") */
function ddMMyyyy(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin"; else "" */
function mobileViewBag(req) {
  return ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
}

const RECHARGE_PROPS = ['ROWNUMBER', 'ID', 'CLID', 'NAME', 'MOBILENO', 'OPERATORTYPE', 'OPERRATORNAME', 'OPERATORSERVICE', 'AMOUNT', 'STATUS',
  'TRANSACTIONID', 'RECHARGEDATE', 'ISANDROIDORWEB', 'MLMWALLET', 'CUSTOMERWALLET', 'PAYUMONEY', 'REMARKS'];

/**
 * Completed_Recharge / Falied_Recharge Index body (identical except @STATUS and the order of the null checks).
 * Returns { Model, ViewBag }.
 */
async function rechargeReport(req, status) {
  const { mapRows } = require('../../../utils/shape');
  const UtilityClass = require('../../../lib/portal/UtilityClass');
  const ViewBag = {};
  const SearchField = csStr(mvcStr(req.p.SearchField));
  const SearchValue = csStr(mvcStr(req.p.SearchValue));
  const Fromdate = csStr(mvcStr(req.p.Fromdate));
  const Todate1 = csStr(mvcStr(req.p.Todate1));
  const RechargeType = csStr(mvcStr(req.p.RechargeType));
  const OperatorWise = csStr(mvcStr(req.p.OperatorWise));
  const TransID = csStr(mvcStr(req.p.TransID));
  ViewBag.masterpageshow = mobileViewBag(req);
  // Convert.ToInt32(AppSettings["DID"].ToString())
  if (config.app.DID === undefined || config.app.DID === null) throw NRE();
  const DID = toInt32(String(config.app.DID));
  const MaxRows = await UtilityClass.GridPageSize();
  let page = mvcIntN(req.p.page);
  if (page === null) page = 1;
  const Clid = Number(req.user.plid);
  // DBO.USP_GET_CUSTOMER_ALLRECHARGE_REPORTS ... @TOTALCOUNT out (returned as column "totalcount")
  const rows = await db.proc(DB, 'usp_get_customer_allrecharge_reports', {
    mode: 1,
    startrowindex: page,
    maxrows: MaxRows,
    fromdate: Fromdate.trim(),
    todate: Todate1.trim(),
    searchfield: SearchField.trim(),
    searchvalue: SearchValue.trim(),
    status,
    clid: Clid,
    did: DID,
    rechargetype: RechargeType,
    operatorwise: OperatorWise,
    transid: TransID,
  });
  const tc = outOf(rows, 'totalcount');
  const TotalRecord = toInt32(tc === undefined || tc === null ? 0 : Number(tc));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = Fromdate;
  ViewBag.toDate = Todate1;
  return { Model: mapRows(rows, RECHARGE_PROPS), ViewBag };
}

const EARNING_HISTORY_PROPS = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints', 'EarnedTaskLevelPoints',
  'TotalEarnedPoints', 'Status', 'PayId'];

/** Earnings.Index / LeadershipBonus.Index body (identical C#). Returns { Model, ViewBag }. */
async function earningHistory(req) {
  const { mapRows } = require('../../../utils/shape');
  const UtilityClass = require('../../../lib/portal/UtilityClass');
  const ViewBag = {};
  let ddlcustpage = mvcIntN(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = csStr(mvcStr(req.p.SearchField));
  const SearchValue = csStr(mvcStr(req.p.SearchValue));
  const fromdate = csStr(mvcStr(req.p.fromdate));
  const todate = csStr(mvcStr(req.p.todate));
  const Plid = Number(req.user.plid);
  // var row = db._Member_Master.Where(a => a.PLID == Plid).FirstOrDefault(); loginid = row.LOGINID (value unused by the view)
  const row = await db.queryOne(DB, 'select loginid from member_master where plid = @plid limit 1', { plid: Plid });
  let loginid = ''; // eslint-disable-line no-unused-vars
  if (row) loginid = row.loginid;
  const MaxRows = toInt32(ddlcustpage);
  let page = mvcIntN(req.p.page);
  if (page === null) page = 1;
  // [usp_member_Earning_history] @plid,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@TotalCount out (@Mode default 1)
  const rows = await db.proc(DB, 'usp_member_earning_history', {
    plid: toInt32(Plid),
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: SearchField.trim(),
    searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(),
    todate: todate.trim(),
  });
  const tc = outOf(rows, 'totalcount');
  const TotalRecord = toInt32(tc === undefined || tc === null ? 0 : Number(tc));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  return { Model: mapRows(rows, EARNING_HISTORY_PROPS), ViewBag };
}

/**
 * CommonController.updatemerchantkyc(double plid) (public static helper of Controllers/CommonController.cs, inlined here).
 * PORT-NOTE: concatenated T-SQL parameterised; `with(nolock)/with(Rowlock)` dropped. SqlQuery<int>.FirstOrDefault() on no row => 0.
 */
async function updatemerchantkyc(plid) {
  let result = 0;
  try {
    const n = (v) => (v === undefined || v === null ? 0 : Number(v));
    // "Select distinct count(1) from KYC ..." => the count itself
    const countkyc = n(await db.scalar(DB, 'select distinct count(1) from kyc where isaprove = 0 and regno = @plid', { plid }));
    const countbankverifyied = n(await db.scalar(DB, 'select count(1) from bank_accounts_merchant where plid = @plid and active::int = 1 and isaprove = 0', { plid }));
    const Entitype = n(await db.scalar(DB, 'select distinct entitytype from tbl_businesskycdetails where plid = @plid limit 1', { plid }));
    if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
      await db.exec(DB, 'update portal_login set iskycapproved = 2 where plid = @plid and active::int = 1', { plid });
      result = 1;
    } else if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
      await db.exec(DB, 'update portal_login set iskycapproved = 2 where plid = @plid and active::int = 1', { plid });
      result = 1;
    } else {
      result = 0;
    }
    return result;
  } catch (Ex) {
    throw new Error(Ex.message);
  }
}

/** new Thread(delegate { ... }).Start() => fire and forget (errors only logged, like an unobserved background thread). */
function fire(fn) {
  Promise.resolve().then(fn).catch((e) => console.error('[portal batch-04 background]', e && e.message));
}

/** RedirectToAction / Redirect => 200 JSON { redirect } (MVC guide 1). */
function redirect(res, url, extra) {
  return res.json({ redirect: url, ...(extra || {}) });
}

/** multipart/form-data parser (memory storage) for HttpPostedFileBase fields; passes through non-multipart requests. */
function multerAny() {
  const multer = require('multer');
  const up = multer({ storage: multer.memoryStorage() }).any();
  return (req, res, next) => {
    const ct = String((req.headers && req.headers['content-type']) || '');
    if (!/multipart\/form-data/i.test(ct)) return next();
    return up(req, res, (err) => {
      if (err) return next(err);
      // re-run the ASP.NET-style binder so req.p sees the multipart text fields
      try { require('../../../middleware/params')(req, res, () => {}); } catch (_) { /* keep previous req.p */ }
      return next();
    });
  };
}

module.exports = {
  DB, NRE, csStr, mvcStr, mvcIntN, mvcInt, mvcDecimal, toInt32, outOf, mapPath, rep, ddMMyyyy, mobileViewBag,
  RECHARGE_PROPS, rechargeReport, EARNING_HISTORY_PROPS, earningHistory, updatemerchantkyc, fire, redirect, multerAny,
};
