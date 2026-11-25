'use strict';
/**
 * Private helpers of admin batch04 (main part: BINARYRate .. BTCSTATEMENT). Not a router (lives in _shared/).
 * Exports: excelHistory(userid, url, Filename), strTrim(v), nstr(req,name), ni(req,name), viewPerms(req, url, order)
 */
const db = require('../../../db');
const CheckPermissions = require('../../../lib/admin/CheckPermissions');
const { pagePermissions, excelLink } = require('./login-log-common');
const { NRE } = require('./batch04-b-common');

const DB = 'affiliate';

/** [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE('1'),@STRRESULT OUT */
async function excelHistory(userid, url, Filename) {
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
}

/** x.Trim() (NullReferenceException on null, like legacy) */
const strTrim = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).trim(); };

/**
 * The legacy permission prologue of the paged Index actions. `order` lists the steps in legacy order:
 *  'bal'   = CheckPermissions.GetPageActionPermission + GetExcelPermission
 *  'link'  = USP_EXCEL_LINK @url,@ISACTIVE out => ViewBag.excelactive
 *  'perm'  = USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF => ViewBag.isactive / isedit (Convert.ToInt16("" => "0"))
 * Fills and returns a ViewBag object.
 */
async function viewPerms(req, url, order = ['bal', 'link', 'perm'], ViewBag = {}) {
  for (const step of order) {
    if (step === 'bal') {
      const r = await CheckPermissions.GetPageActionPermission(url, req.user.emp_id);
      ViewBag.isactive = r._opIsDownloadAllowed;
      ViewBag.isedit = r._opIsEditAllowed;
      ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
    } else if (step === 'link') {
      ViewBag.excelactive = await excelLink(url);
    } else if (step === 'perm') {
      const p = await pagePermissions(req.user.emp_id, url);
      ViewBag.isactive = p.isactive;
      ViewBag.isedit = p.isedit;
    }
  }
  return ViewBag;
}

module.exports = { excelHistory, strTrim, viewPerms };

/** decimal.ToString("0.00") of a non-nullable decimal property (null => NullReferenceException-like, as a DBNull mapping failure) */
function dec2(v) {
  if (v === null || v === undefined) throw NRE();
  const n = Number(v);
  const r = (n < 0 ? -1 : 1) * Math.round(Math.abs(n) * 100) / 100; // MidpointRounding.AwayFromZero
  return r.toFixed(2);
}
/** decimal.Parse(x.ToString()) (DBNull => "" => FormatException) */
function decParse(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (s === '' || Number.isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
Object.assign(module.exports, { dec2, decParse });

/** Convert.ToInt32/ToInt64(string): null => 0, otherwise strict parse (FormatException) */
function cvInt(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** Convert.ToDecimal(string): null => 0, otherwise strict parse (FormatException) */
function cvDec(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s.replace(/,/g, ''))) throw new Error('Input string was not in a correct format.');
  return Number(s.replace(/,/g, ''));
}
Object.assign(module.exports, { cvInt, cvDec });
