'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LevelShoppingDetails.cs (class LevelShoppingDetailsController => /LevelShoppingDetails/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, col, cvtInt, perms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf, firstCol,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'LevelShoppingDetails';

/** class LevelShoppingDetails */
const PROPS = ['ROWNUMBER', 'LOGINID', 'SPONSERID', 'ROOTID', 'EMPLEVEL', 'NAME', 'MOBILE', 'CITYNAME', 'REGDATE', 'STATUS', 'EMAILID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PAIDBV', 'USERNAME', 'SIDE', 'SPOUNSER_USERNAME', 'ACTIVE', 'KITPRICE', 'REGNO', 'root_username', 'TITLE',
  'STATENAME', 'PARENTID', 'RANKNAME', 'RANKID', 'ORDERAMOUNT', 'BV', 'PV', 'CashBack', 'ORDERNO', 'ORDERDATE'];
/** class LevelDownLine (Controllers/AdminPanel/Level_DownLine.cs) */
const LEVEL_DOWNLINE = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID',
  'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName',
  'LCount', 'RCount', 'SideName', 'PARENTID', 'RANKNAME'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
// `private List<LevelShoppingDetails> ExcelList` is never used.
let url = '';
let url1 = '';

// public void ExportReport(string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side,
//   string Level, string ActivationStatus, int? LEVENUMBERfrom, int? LEVENUMBERto, string orderbydate, int? RANKID)
async function ExportReport(req, res, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus, LEVENUMBERfrom,
  LEVENUMBERto, orderbydate, RANKID, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()
  let loginid = '';
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  if (row) loginid = col(row, 'username');
  const MaxRows = 50;
  if (page === null) page = 1;
  const nullRefTrim = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return String(v).trim(); };
  const rows = await db.proc(DB, 'USP_LEVELDOWNLINE', {
    LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: nullRefTrim(fromdate),
    TODATE: nullRefTrim(todate), level: Level, LEVENUMBERfrom, LEVENUMBERto, SIDE: Side, NAME: nullRefTrim(Name), USERNAME: nullRefTrim(Username),
    EMAILID: nullRefTrim(EmailID), SPONSERID: nullRefTrim(SponserID), CheckAdminSide: 0, ActivationStatus: cvtInt(ActivationStatus),
    orderbydate, RANKID,
  });
  const LRMember = mapRows(rows, LEVEL_DOWNLINE);
  outIntOf(rows, 'totalcount'); // int TotalRecord = int.Parse(spOutputL.Value.ToString()) (unused)
  if (LRMember.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Level_Downline_List.xls', Filename,
      headers: ['S.No.', 'Name', 'Username', 'Sponsor', 'Joining Date', 'Activation Date'],
      rows: LRMember, innerProc: 'ExportReport', outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'rownumber')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'userName')) + ' \t');
        w(tab(cellStr(item, 'spounser_userName')) + ' \t');
        w(tab(cellStr(item, 'RegDate')) + ' \t');
        w(tab(cellStr(item, 'DOC')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string SearchField, string SearchValue, string orderbydate,
//   string btnexel, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level,
//   string ActivationStatus, int? LEVENUMBERfrom, int? LEVENUMBERto, int? RANKID, string MainSearch)
// auth ([SessionExpireCheck] + Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/LevelShoppingDetails" -> LevelShoppingDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/LevelShoppingDetails'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const fromdate = s0(req.p.fromdate);
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const MainSearch = s0(req.p.MainSearch);
  const todate = s0(req.p.todate);
  const orderbydate = s0(req.p.orderbydate);
  const Username = s0(req.p.Username);
  const EmailID = s0(req.p.EmailID);
  let LEVENUMBERfrom = nInt(req.p.LEVENUMBERfrom); if (LEVENUMBERfrom === null) LEVENUMBERfrom = 0;
  let LEVENUMBERto = nInt(req.p.LEVENUMBERto); if (LEVENUMBERto === null) LEVENUMBERto = 0;
  const SponserID = s0(req.p.SponserID);
  const Name = s0(req.p.Name);
  let Side = nInt(req.p.Side); if (Side === null) Side = 0;
  const btnexel = s0(req.p.btnexel);
  const Level = nStr(req.p.Level) === null ? '0' : nStr(req.p.Level);
  let RANKID = nInt(req.p.RANKID); if (RANKID === null) RANKID = 0;
  const ActivationStatus = nStr(req.p.ActivationStatus) === null ? '0' : nStr(req.p.ActivationStatus);
  let page = nInt(req.p.page);
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url));
  let loginid = '';
  if (MainSearch === '') {
    loginid = firstCol(await db.query(DB, 'select username from member_master where regno = 1', {}));
  } else {
    loginid = MainSearch;
  }
  const MaxRows = dynamicpagging;
  if (page === null) page = 1;
  // [USP_SHOPPINGLEVELDOWNLINE] ... @TotalCount out,@TotalLRBV out,@TOTALLRINCOME out ...
  const rows = await db.proc(DB, 'USP_SHOPPINGLEVELDOWNLINE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, fromDate: fromdate.trim(),
    ToDate: todate.trim(), LEVENUMBERfrom, side: Side, Name: Name.trim(), Username: Username.trim(), EmailID: EmailID.trim(),
    SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: cvtInt(ActivationStatus), LEVENUMBERto, orderbydate, RANKID,
  });
  const LRMember = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, dynamicpagging, orderbydate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, LEVENUMBERto, SearchField, SearchValue, MainSearch, Name, Username, side: Side, SponserID, Level,
    ActivationStatus,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus,
      LEVENUMBERfrom, LEVENUMBERto, orderbydate, RANKID, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/LevelShoppingDetails/Index.cshtml', Model: LRMember, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('fromdate'), v('todate'), v('Username'), v('EmailID'), v('SponserID'), nInt(req.p.page), v('Name'),
    nInt(req.p.Side), v('Level'), v('ActivationStatus'), nInt(req.p.LEVENUMBERfrom), nInt(req.p.LEVENUMBERto), v('orderbydate'),
    nInt(req.p.RANKID), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
