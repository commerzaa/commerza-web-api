'use strict';
/**
 * Shared body of Controllers/AdminPanel/Daily_Commissionwallet_Summary.cs (Mode "4"), Daily_Growthwallet_Summary.cs (Mode "3") and
 * Daily_Shoppingwallet_Summary.cs (Mode "5"): identical C# apart from the controller name, @Mode, file names and the permission block.
 * Exports: DES_PROPS, scale0(v), build(opts) -> express.Router
 *   opts: { C (controller), indexPaths[], exportPaths (literal route paths, registered by the controller files), mode ('3'|'4'|'5'), inlinePerms (Growth: USP_GETEXCELPERMISIONSTATUS + USP_EXCEL_LINK ("" => 0) instead of
 *           CheckPermissions), filePrefix (Filename prefix) }
 * Not a router file itself (lives in _shared/).
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const sessionStore = require('../../../utils/sessionStore');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./adminSession');
const { pagePermissions } = require('./loginLogCommon');
const B = require('./batch05_common');

const DB = 'affiliate';

/** class DailyEwallet_Summary (Daily_Ewallet_Summary.cs) */
const DES_PROPS = ['ROWNUMBER', 'Date', 'Credit', 'Debit', 'Balance', 'Requested', 'Pending', 'Rejected'];

/** decimal OUT SqlParameter without Scale => value rounded to scale 0 by SqlClient.
 *  PORT-NOTE: reproduced with Math.round; DBNull => undefined (the legacy `Value.ToString() != ""` check skipped it). */
function scale0(v) {
  if (v === null || v === undefined || v === '') return undefined;
  return Math.round(Number(v));
}

/** USP_EXCEL_LINK with `Value.ToString() == "" ? "0" : Value` (Growth variant) */
async function excelLinkEmpty0(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = B.str(B.col(row, 'isactive'));
  const n = parseInt(v === '' ? '0' : v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

function build(opts) {
  const { C, mode, inlinePerms, filePrefix } = opts;
  const router = express.Router();
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests of this controller.
  let url = '';
  let url1 = '';

  /** public void ExportReport(string From, string To, int? page, int? ddlcustpage) */
  async function ExportReport(req, res, ViewBag, From, To, page, ddlcustpage) {
    const userid = req.user.emp_id;
    const Filename = filePrefix + userid + '_' + B.nowStamp();
    await B.excelHistory(userid, url, Filename);
    const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
    if (page === null || page === undefined) page = 1;
    if (From === null || From === undefined || To === null || To === undefined) throw B.nullRef(); // From.Trim()
    // dbo.Usp_Daily_Ewallet_Summary without @orderbydate (CommandTimeout 1000 s => pg pool timeout)
    const AllEPinRequestsList = mapRows(await db.proc(DB, 'Usp_Daily_Ewallet_Summary', {
      Credit: '0', Debit: '0', Balance: '0', Mode: mode, StartRowIndex: page, MaxRowIndex: ddlcustpage, FROM: From.trim(), TO: To.trim(),
    }), DES_PROPS);
    if (AllEPinRequestsList.length > 0) {
      return B.writeXlsExport({
        req, res, ViewBag, sheet: 'Daily_Ewallet_Summary.xls', Filename,
        headers: ['S.No.', 'Date', 'Credit', 'Debit'],
        rows: AllEPinRequestsList, innerProc: 'Usp_Daily_Ewallet_Summary', outerProc: 'USP_ALL_MEMBERLIST',
        cells: (item, w) => {
          w('\n');
          w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
          w(B.tab(B.cellStr(item, 'Date')) + ' \t');
          w(B.tab(B.dec2(item.Credit)) + ' \t');
          w(B.tab(B.dec2(item.Debit)) + ' \t');
        },
      });
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
  // auth ([SessionExpireCheck])
  // route-config: "AdminPanel/<Daily-...-Summary>" -> <C>/Index
  router.all(opts.indexPaths, adminAuth, asyncHandler(async (req, res) => {
    let dynamicpagging = B.nInt(req.p.dynamicpagging);
    let orderbydate = B.nStr(req.p.orderbydate);
    let From = B.nStr(req.p.From);
    let To = B.nStr(req.p.To);
    let page = B.nInt(req.p.page);
    let ddlcustpage = B.nInt(req.p.ddlcustpage);
    let btnexel = B.nStr(req.p.btnexel);
    sessionStore.set(req, 'DATE', '');
    sessionStore.set(req, 'TYPE', '');
    url1 = legacyUrl(req).slice(1);
    url = '~' + url1;
    if (ddlcustpage === null) ddlcustpage = 100;
    if (From === null) From = '';
    if (To === null) To = '';
    if (btnexel === null) btnexel = '';
    if (dynamicpagging === null) dynamicpagging = 100;
    if (orderbydate === null) orderbydate = '';
    const MaxRows = Number(dynamicpagging);
    const Employeeid = req.user.emp_id;
    const ViewBag = {};
    if (inlinePerms) {
      const perm = await pagePermissions(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
      ViewBag.isactive = perm.isactive;
      ViewBag.isedit = perm.isedit;
      ViewBag.excelactive = await excelLinkEmpty0(url);
    } else {
      Object.assign(ViewBag, await B.perms(Employeeid, url)); // CheckPermissions
    }
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'Usp_Daily_Ewallet_Summary', {
      Credit: '0', Debit: '0', Balance: '0', Mode: mode, StartRowIndex: page, MaxRowIndex: MaxRows, FROM: From.trim(), TO: To.trim(), orderbydate,
    });
    const AllEPinRequestsList = mapRows(rows, DES_PROPS);
    const r0 = rows[0] || null;
    // PORT-NOTE: OUT params (@TotalCount/@TotalCredit/@TotalDebit/@TotalBalance) read from the first result row.
    const tc = B.str(B.col(r0, 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    const cr = scale0(B.col(r0, 'totalcredit')); if (cr !== undefined) ViewBag.TotalCr = cr;
    const dr = scale0(B.col(r0, 'totaldebit')); if (dr !== undefined) ViewBag.TotalDr = dr;
    const bal = scale0(B.col(r0, 'totalbalance')); if (bal !== undefined) ViewBag.totalBal = bal;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, From, To, page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: `~/Views/AdminPanel/${C}/Index.cshtml`, Model: AllEPinRequestsList, ...ViewBag });
  }));

  // ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
  // auth (public method => routable; reads Session["Admin_User"]; [SessionExpireCheck] in the Growth controller)
  router.all(opts.exportPaths, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, {}, B.nStr(req.p.From), B.nStr(req.p.To), B.nInt(req.p.page), B.nInt(req.p.ddlcustpage));
    if (!r.sent) res.send('');
  }));

  return router;
}

module.exports = { DES_PROPS, scale0, build, excelLinkEmpty0 };
