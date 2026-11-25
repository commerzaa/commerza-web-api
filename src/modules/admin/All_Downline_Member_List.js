'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Downline_Member_List.cs (class All_Downline_Member_ListController)
// Database: affiliate (Db_Affiliate). Table: member_master.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, toInt32, toDec, outStr, col, view, perms, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'All_Downline_Member_List';

/** class AllDownlineMemberLeftRight */
const ADMLR_PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName', 'LCount',
  'RCount', 'SideName', 'DepositedATC', 'PARENTID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
// `private List<AllDownlineMemberLeftRight> ExcelList` is never used.
let url = '';
let url1 = '';

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()?.userName */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  return row ? (col(row, 'username') ?? null) : '';
}

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level)
async function ExportReport(req, res, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const loginid = await rootLoginId();
  const MaxRows = 50; // Convert.ToInt32(50) (unused)
  void MaxRows;
  if (page === null) page = 1;
  for (const v of [fromdate, todate, Level, Name, Username, EmailID, SponserID]) if (v === null) throw nre();
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows: '1000000', SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: Name.trim(), Username: Username.trim(), EmailID: EmailID.trim(),
    SponserID: SponserID.trim(), CheckAdminSide: 0,
  });
  const LRMember = mapRows(rows, ADMLR_PROPS);
  if (LRMember.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'All_Downline_Member_List.xls', Filename,
      headers: ['S.No.', 'Name', 'Username', 'Joining Date', 'PARENTID', 'Sponsor Name', 'Side(Left/Right)', 'Total Invesment', 'Status', 'Join Date', 'Level'],
      rows: LRMember,
      innerProc: 'ExportReport',
      outerProc: 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE',
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.Name)) + ' \t');
        w(tab(cs(item.userName)) + ' \t');
        w(tab(cs(item.RegDate)) + ' \t');
        w(tab(cs(item.PARENTID)) + ' \t');
        w(tab(cs(item.sponser_username)) + ' \t');
        if (item.side === 1) w(tab('Left') + ' \t'); else w(tab('Right') + ' \t');
        w(tab(cs(item.DepositedATC)) + ' \t');
        w(tab(cs(item.status)) + ' \t');
        w(tab(cs(item.DOC)) + ' \t');
        w(tab(cs(item.EmpLevel)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string btnexel, string Userdownlinemember, int? FromLevel, int? ToLevel, int? orderbylevel, string MainSearch)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/all-downline-member-list" -> All_Downline_Member_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/all-downline-member-list'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromdate = nstr(req.p.fromdate);
  let todate = nstr(req.p.todate);
  let Username = nstr(req.p.Username);
  let EmailID = nstr(req.p.EmailID);
  let SponserID = nstr(req.p.SponserID);
  let page = nint(req.p.page);
  let Name = nstr(req.p.Name);
  let Side = nint(req.p.Side);
  let Level = nstr(req.p.Level);
  let btnexel = nstr(req.p.btnexel);
  let Userdownlinemember = nstr(req.p.Userdownlinemember);
  let FromLevel = nint(req.p.FromLevel);
  let ToLevel = nint(req.p.ToLevel);
  let orderbylevel = nint(req.p.orderbylevel);
  let MainSearch = nstr(req.p.MainSearch);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (FromLevel === null) FromLevel = 0;
  if (ToLevel === null) ToLevel = 0;
  if (orderbylevel === null) orderbylevel = 0;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  if (EmailID === null) EmailID = '';
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (Side === null) Side = 0;
  if (Level === null) Level = '';
  if (btnexel === null) btnexel = '';
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (MainSearch === null) MainSearch = '';
  await perms(url, req.user.emp_id, ViewBag);
  try {
    const loginid = await rootLoginId();
    const MaxRows = toInt32(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
      LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
      levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: Name.trim(), Username: Username.trim(), EmailID: EmailID.trim(),
      SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: 0, Userdownlinemember, orderbydate: orderbydate.trim(), FromLevel,
      TOLevel: ToLevel, Orderbylevel: orderbylevel, MAINSEARCH: MainSearch,
    });
    const LRMember = mapRows(rows, ADMLR_PROPS);
    const tc = outStr(col(rows[0], 'totalcount'));
    const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
    const TotalInvesments = toDec(outStr(col(rows[0], 'totalinvesment'))); // Convert.ToDecimal(Value.ToString()) ("" => FormatException => catch)
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, dynamicpagging, orderbydate, TotalRecord, TotalInvesments, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, orderbylevel, SearchValue, SearchField, toDate: todate, side: Side, SponserID, Name, Username, Level,
    });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/All_Downline_Member_List/Index.cshtml', LRMember, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, v('SearchField'), v('SearchValue'), v('fromdate'), v('todate'), v('Username'), v('EmailID'), v('SponserID'),
    nint(req.p.page), v('Name'), nint(req.p.Side), v('Level'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
