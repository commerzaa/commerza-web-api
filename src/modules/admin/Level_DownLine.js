'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Level_DownLine.cs (class Level_DownLineController, no namespace => /Level_DownLine/...)
// Database: affiliate (Db_Affiliate). Table: member_master. Procs: USP_LEVELDOWNLINE, USP_EXCEL_DOWNLOAD_HISTORY (+ CheckPermissions).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, col, cellStr, tab, nowStamp, cvtInt, nullRef, perms, excelHistory, writeXlsExport,
} = require('./_shared/batch08_common');
const { outVal, rootLoginId } = require('./_shared/batch08D2_common');

const router = express.Router();
const C = 'Level_DownLine';

/** class LevelDownLine */
const LD_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount',
  'RCount', 'SideName', 'PARENTID', 'RANKNAME'];
// class LevelDownLine_new (ROWNUMBER, LOGINID, NAME, USERNAME, PARENTID, ROOTID, SPONSERID, REGDATE, ACTIVATEDON, EMPLEVEL, REGNO, KITPRICE,
// STATUS) is declared in the C# file but never used.

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
// `private List<LevelDownLine> ExcelList` is never used.
let url = '';
let url1 = '';

const trimNR = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).trim(); }; // string.Trim() on null => NRE
const strictInt = (s) => cvtInt(s === '' ? 'x' : s); // int.Parse(DBNull.ToString()) => FormatException

// ---------------------------------------------------------------- public void ExportReport(string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus, int? LEVENUMBERto, int? LEVENUMBERfrom, string orderbydate, int? RANKID)
async function ExportReport(req, res, ViewBag, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus,
  LEVENUMBERto, LEVENUMBERfrom, orderbydate, RANKID) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const loginid = await rootLoginId();
  const MaxRows = 50;
  if (page === null) page = 1;
  // PORT-NOTE: legacy passed @level as the raw string and named the side parameter "@SIDE " (trailing space); here SIDE is bound normally.
  const params = { LoginID: loginid, StartRowIndex: page, MaxRows, SearchField: '', SearchValue: '' };
  params.fromDate = trimNR(fromdate);
  params.ToDate = trimNR(todate);
  params.level = Level;
  params.LEVENUMBERfrom = LEVENUMBERfrom;
  params.LEVENUMBERto = LEVENUMBERto;
  params.side = Side;
  params.Name = trimNR(Name);
  params.Username = trimNR(Username);
  params.EmailID = trimNR(EmailID);
  params.SponserID = trimNR(SponserID);
  params.CheckAdminSide = 0;
  params.ActivationStatus = cvtInt(ActivationStatus);
  params.orderbydate = orderbydate;
  params.RANKID = RANKID;
  const rows = await db.proc(DB, 'USP_LEVELDOWNLINE', params);
  const LRMember = mapRows(rows, LD_PROPS);
  strictInt(outVal(rows, 'TOTALCOUNT')); // int TotalRecord = int.Parse(spOutputL.Value.ToString()) (unused)
  if (LRMember.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Level_Downline_List.xls', Filename,
      headers: ['S.No.', 'Name', 'Username', 'Sponsor', 'Parent Name', 'Join Date', 'Rank', 'Level'],
      rows: LRMember,
      innerProc: 'ExportReport',
      outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'rownumber')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'userName')) + ' \t');
        w(tab(cellStr(item, 'spounser_userName')) + ' \t');
        w(tab(cellStr(item, 'PARENTID')) + ' \t');
        w(tab(cellStr(item, 'RegDate')) + ' \t');
        w(tab(cellStr(item, 'RANKNAME')) + ' \t');
        w(tab(cellStr(item, 'EmpLevel')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string SearchValue, string SearchField, string orderbydate, string btnexel, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus, int? LEVENUMBERto, int? LEVENUMBERfrom, int? RANKID, string MainSearch)
// auth ([SessionExpireCheck] + Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Level_DownLine" -> Level_DownLine/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Level_DownLine'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let SearchValue = nStr(req.p.SearchValue);
  let SearchField = nStr(req.p.SearchField);
  let orderbydate = nStr(req.p.orderbydate);
  let btnexel = nStr(req.p.btnexel);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let Username = nStr(req.p.Username);
  let EmailID = nStr(req.p.EmailID);
  let SponserID = nStr(req.p.SponserID);
  let page = nInt(req.p.page);
  let Name = nStr(req.p.Name);
  let Side = nInt(req.p.Side);
  let Level = nStr(req.p.Level);
  let ActivationStatus = nStr(req.p.ActivationStatus);
  let LEVENUMBERto = nInt(req.p.LEVENUMBERto);
  let LEVENUMBERfrom = nInt(req.p.LEVENUMBERfrom);
  let RANKID = nInt(req.p.RANKID);
  let MainSearch = nStr(req.p.MainSearch);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromdate === null) fromdate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (MainSearch === null) MainSearch = '';
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Username === null) Username = '';
  if (EmailID === null) EmailID = '';
  if (Level === null) Level = '';
  if (LEVENUMBERfrom === null) LEVENUMBERfrom = 0;
  if (LEVENUMBERto === null) LEVENUMBERto = 0;
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (Side === null) Side = 0;
  if (btnexel === null) btnexel = '';
  if (Level === null) Level = '0'; // (unreachable, Level already "")
  if (RANKID === null) RANKID = 0;
  if (ActivationStatus === null) ActivationStatus = '0';
  const Empid = req.user.emp_id;
  const p = await perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;

  // (no try/catch in the legacy action: exceptions => 500)
  let loginid = '';
  if (MainSearch === '') {
    // select USERNAME from MEMBER_MASTER with(nolock) where Regno=1  (.FirstOrDefault() => null when no row)
    const r = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
    loginid = r ? col(r, 'username') : null;
  } else {
    loginid = MainSearch;
  }
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_LEVELDOWNLINE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    level: cvtInt(Level === '' ? '0' : Level), LEVENUMBERfrom, LEVENUMBERto, side: Side, Name: Name.trim(), Username: Username.trim(),
    EmailID: EmailID.trim(), SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: cvtInt(ActivationStatus), orderbydate, RANKID,
  });
  const LRMember = mapRows(rows, LD_PROPS);
  const TotalRecord = strictInt(outVal(rows, 'TotalCount'));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.LEVENUMBERfrom = LEVENUMBERfrom;
  ViewBag.LEVENUMBERto = LEVENUMBERto;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus,
      LEVENUMBERto, LEVENUMBERfrom, orderbydate, RANKID);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Level_DownLine/Index.cshtml', Model: LRMember, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromdate'), v('todate'), v('Username'), v('EmailID'), v('SponserID'), nInt(req.p.page),
    v('Name'), nInt(req.p.Side), v('Level'), v('ActivationStatus'), nInt(req.p.LEVENUMBERto), nInt(req.p.LEVENUMBERfrom), v('orderbydate'),
    nInt(req.p.RANKID));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
