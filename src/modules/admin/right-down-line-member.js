'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\RightDownLine_Member.cs
// (class RightDownLine_MemberController => /admin/RightDownLine_Member/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, toInt32, outParseInt, outParseDec, nre,
} = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'RightDownLine_Member';

/** class RightDownLineMember (Index model) */
const RDLM_PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName', 'LCount',
  'RCount', 'SideName', 'DepositedATC'];
/** class AllDownlineMemberLeftRight (declared in All_Downline_Member_List.cs; ExportReport model) */
const ADMLR_PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName', 'LCount',
  'RCount', 'SideName', 'DepositedATC', 'PARENTID'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';
// (`private List<RightDownLineMember> ExcelList` is never used)

const trimS = (v) => { if (v === null || v === undefined) throw nre(); return String(v).trim(); };

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault() => row.userName ("" when no row) */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = @Plid limit 1', { Plid: 1 });
  return row ? row.username : '';
}

// public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level)
async function ExportReport(req, res, a, ViewBag) {
  let { page } = a;
  const { SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, Name, Side, Level } = a;
  const userid = req.user.emp_id;
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const loginid = await rootLoginId();
  const MaxRows = 50; // (unused, like legacy)
  void MaxRows;
  if (page === null) page = 1;
  // (no @ActivationStatus / @Userdownlinemember / @TotalInvesment => proc defaults)
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows: '1000000', SearchField, SearchValue, fromDate: trimS(fromdate), ToDate: trimS(todate),
    levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: trimS(Name), Username: trimS(Username), EmailID: trimS(EmailID),
    SponserID: trimS(SponserID), CheckAdminSide: toInt32('0'),
  });
  const LRMember = mapRows(rows, ADMLR_PROPS);
  if (LRMember.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'All_Downline_Member_List.xls', Filename,
      headers: ['s.No.', 'Username', 'Joining Date', 'Sponsor Name', 'Side(Left/Right)', 'Total Invesment', 'Status'],
      rows: LRMember,
      // legacy per-row and outer catches did not call ErrorInsert (bare catch / ViewBag.filepath = ex.Message)
      cells: (item, w) => {
        w(tab(cs(item.ROWNUMBER)) + ' \t');
        w(tab(cs(item.userName)) + ' \t');
        w(tab(cs(item.RegDate)) + ' \t');
        w(tab(cs(item.sponser_username)) + ' \t');
        if (item.side === 1) w(tab('Left') + ' \t');
        else w(tab('Right') + ' \t');
        w(tab(cs(item.DepositedATC)) + ' \t');
        w(tab(cs(item.status)) + ' \t');
      },
    });
  }
  return { sent: false };
}

function readArgs(req) {
  return {
    SearchField: nstr(req.p.SearchField), SearchValue: nstr(req.p.SearchValue), fromdate: nstr(req.p.fromdate), todate: nstr(req.p.todate),
    Username: nstr(req.p.Username), EmailID: nstr(req.p.EmailID), SponserID: nstr(req.p.SponserID), page: nint(req.p.page),
    Name: nstr(req.p.Name), Side: nint(req.p.Side), Level: nstr(req.p.Level),
  };
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string btnexel, string Userdownlinemember, int? ActiveDeactive)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/RightDownLine-Member" -> RightDownLine_Member/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/RightDownLine-Member'], adminAuth, asyncHandler(async (req, res) => {
  const a = readArgs(req);
  let btnexel = nstr(req.p.btnexel);
  let Userdownlinemember = nstr(req.p.Userdownlinemember);
  let ActiveDeactive = nint(req.p.ActiveDeactive);
  const ViewBag = {};
  // (no try/catch in legacy: errors are unhandled => 500)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (a.SearchField === null) a.SearchField = '';
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK @url,@ISACTIVE out
  if (ActiveDeactive === null) ActiveDeactive = 0;
  if (a.SearchValue === null) a.SearchValue = '';
  if (a.fromdate === null) a.fromdate = '';
  if (a.todate === null) a.todate = '';
  if (a.Username === null) a.Username = '';
  if (a.EmailID === null) a.EmailID = '';
  if (a.SponserID === null) a.SponserID = '';
  if (a.Name === null) a.Name = '';
  if (a.Side === null) a.Side = 2;
  if (a.Level === null) a.Level = '';
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const loginid = await rootLoginId();
  const MaxRows = toInt32(50);
  if (a.page === null) a.page = 1;
  // db.Database.CommandTimeout = 10000
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: a.page, MaxRows, SearchField: a.SearchField, SearchValue: a.SearchValue, fromDate: a.fromdate.trim(),
    ToDate: a.todate.trim(), levenumber: toInt32(a.Level === '' ? '0' : a.Level), side: a.Side, Name: a.Name.trim(), Username: a.Username.trim(),
    EmailID: a.EmailID.trim(), SponserID: a.SponserID.trim(), CheckAdminSide: toInt32('0'), ActivationStatus: ActiveDeactive, Userdownlinemember,
  });
  const LRMember = mapRows(rows, RDLM_PROPS);
  const TotalRecord = outParseInt(rows, 'TotalCount');
  const TotalInvesments = outParseDec(rows, 'TotalInvesment'); // Convert.ToDecimal(TotalInvesment.Value.ToString())
  ViewBag.CurrentPage = a.page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TotalInvesments = TotalInvesments;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = a.fromdate;
  ViewBag.toDate = a.todate;
  ViewBag.side = a.Side;
  ViewBag.SponserID = a.SponserID;
  ViewBag.Name = a.Name;
  ViewBag.Username = a.Username;
  ViewBag.Level = a.Level;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, a, ViewBag);
    if (r.sent) return undefined;
  }
  return view(res, '~/Views/AdminPanel/RightDownLine_Member/Index.cshtml', LRMember, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, readArgs(req), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
