'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberPasswordChangeHistory.cs (class MemberPasswordChangeHistoryController => /MemberPasswordChangeHistory/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, col, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, netFormat, outIntOf, trimS,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MemberPasswordChangeHistory';

/** class passwordchangehistory */
const PROPS = ['ROWNUMBER', 'UserName', 'EMAIL', 'IPAddress', 'Status', 'Date', 'Type', 'OldPassword', 'Newpassword', 'LONGITUDE', 'LATITUDE'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
async function ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'MemberPasswordChangeHistory_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // [USP_ChangePasswordHistory_Report] @STARTROWINDEX,@MAXROWS,@FROMDATE,@TODATE,@SEARCHFIEL,@SEARCHVALUE,@TOTALCOUNT OUT  (CommandTimeout 1000)
  const rows = await db.proc(DB, 'USP_ChangePasswordHistory_Report', {
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: trimS(SearchField), SEARCHVALUE: trimS(SearchValue),
  });
  const AllFreeEpinList = mapRows(rows, PROPS);
  if (AllFreeEpinList.length > 0) {
    // SECURITY: legacy exports the DECRYPTED old/new member passwords into the sheet (kept, see report).
    return writeXlsExport({
      req, res, ViewBag, sheet: 'MemberPasswordChangeHistory.xls', Filename,
      headers: ['S.No.', 'Username', 'Date', 'IP Address', 'Old Password', 'New Password', 'Type', 'Status'],
      rows: AllFreeEpinList, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: async (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'UserName')) + ' \t');
        w(tab(netFormat(col(item, 'Date'), 'dd-MMM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'IPAddress')) + ' \t');
        const oldpass = String(await UtilityClass.Decryptword(col(item, 'OldPassword')));
        const newpass = String(await UtilityClass.Decryptword(col(item, 'Newpassword')));
        w(tab(oldpass) + ' \t');
        w(tab(newpass) + ' \t');
        w(tab(cellStr(item, 'Type')) + ' \t');
        w(tab(cellStr(item, 'Status')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string btnexel, string SearchValue,
//   string fromdate, string todate, int? page, int? ddlcustpage)
// auth (reads Session["Admin_User"]; Session == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/MemberPasswordChangeHistory" -> MemberPasswordChangeHistory/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MemberPasswordChangeHistory'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = cvtInt(value); // Convert.ToInt16(value)
  }
  let orderbydate = nStr(req.p.orderbydate); if (orderbydate === null) orderbydate = '';
  const ViewBag = {};
  const ip = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let fromdate = nStr(req.p.fromdate); if (fromdate === null) fromdate = '';
  let todate = nStr(req.p.todate); if (todate === null) todate = '';
  let page = nInt(req.p.page);
  try {
    const MaxRows = dynamicpagging;
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_ChangePasswordHistory_Report', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      orderbydate,
    });
    const AllFreeEpinList = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, orderbydate, dynamicpagging, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
    });
    await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, fromdate, todate, SearchField, SearchValue, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/MemberPasswordChangeHistory/Index.cshtml', Model: AllFreeEpinList, ...ViewBag });
  } catch (ex) {
    if (res.headersSent) return undefined;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' }); // (no ErrorInsert in this catch)
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('fromdate'), v('todate'), v('SearchField'), v('SearchValue'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
