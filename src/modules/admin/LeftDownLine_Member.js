'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LeftDownLine_Member.cs (class LeftDownLine_MemberController, no namespace => /LeftDownLine_Member/...)
// Database: affiliate (Db_Affiliate). Table: member_master. Procs: USP_EXCEL_LINK, USP_GETEXCELPERMISIONSTATUS (via CheckPermissions),
// USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, cellStr, tab, nowStamp, cvtInt, cvtDec, nullRef, excelHistory, writeXlsExport,
} = require('./_shared/batch08_common');
const {
  outVal, rootLoginId, pagePerm, excelLinkRaw, ALL_DOWNLINE_LR_PROPS,
} = require('./_shared/batch08D2_common');

const router = express.Router();
const C = 'LeftDownLine_Member';

/** class LeftDownLineMember (model of the Index list) */
const LDM_PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName', 'LCount',
  'RCount', 'SideName', 'DepositedATC'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
// `private List<LeftDownLineMember> ExcelList` is never used.
let url = '';
let url1 = '';

const trimNR = (v) => { if (v === null || v === undefined) throw nullRef(); return String(v).trim(); }; // string.Trim() on null => NRE

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'All_Downline_Member_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const loginid = await rootLoginId();
  const MaxRows = 50; // Convert.ToInt32(50) (unused here: MAXROWS is "1000000")
  void MaxRows;
  if (page === null) page = 1;
  // PORT-NOTE: the legacy call names only 17 parameters (no @ActivationStatus/@Userdownlinemember/@TotalInvesment) -> proc defaults apply.
  const params = { LoginID: loginid, StartRowIndex: page, MaxRows: '1000000', SearchField, SearchValue };
  params.fromDate = trimNR(fromdate);
  params.ToDate = trimNR(todate);
  params.levenumber = cvtInt(Level === '' ? '0' : Level);
  params.side = Side;
  params.Name = trimNR(Name);
  params.Username = trimNR(Username);
  params.EmailID = trimNR(EmailID);
  params.SponserID = trimNR(SponserID);
  params.CheckAdminSide = 0;
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', params);
  const LRMember = mapRows(rows, ALL_DOWNLINE_LR_PROPS); // SqlQuery<AllDownlineMemberLeftRight>
  if (LRMember.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'All_Downline_Member_List.xls', Filename,
      headers: ['s.No.', 'Name', 'Username', 'Joining Date', 'Sponsor Name', 'Side(Left/Right)', 'Total Invesment', 'Status'],
      rows: LRMember,
      // per-row catch { wr.Close(); } and outer catch { ViewBag.filepath = ex.Message; } have no ErrorInsert
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'userName')) + ' \t');
        w(tab(cellStr(item, 'RegDate')) + ' \t');
        w(tab(cellStr(item, 'sponser_username')) + ' \t');
        if (item.side !== null && Number(item.side) === 1) w(tab('Left') + ' \t'); else w(tab('Right') + ' \t');
        w(tab(cellStr(item, 'DepositedATC')) + ' \t');
        w(tab(cellStr(item, 'status')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string btnexel, string Userdownlinemember, int? ActiveDeactive)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/LeftDownLine-Member" -> LeftDownLine_Member/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/LeftDownLine-Member'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromdate = nStr(req.p.fromdate);
  let todate = nStr(req.p.todate);
  let Username = nStr(req.p.Username);
  let EmailID = nStr(req.p.EmailID);
  let SponserID = nStr(req.p.SponserID);
  let page = nInt(req.p.page);
  let Name = nStr(req.p.Name);
  let Side = nInt(req.p.Side);
  let Level = nStr(req.p.Level);
  let btnexel = nStr(req.p.btnexel);
  let Userdownlinemember = nStr(req.p.Userdownlinemember);
  let ActiveDeactive = nInt(req.p.ActiveDeactive);
  const ViewBag = {};

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (ActiveDeactive === null) ActiveDeactive = 0;
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  if (EmailID === null) EmailID = '';
  // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(Value == "0" ? "0" : Value) (DBNull => "" => FormatException, uncaught)
  const xl = await excelLinkRaw(url);
  ViewBag.excelactive = cvtInt(xl === '0' ? '0' : (xl === '' ? 'x' : xl));
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (Side === null) Side = 1;
  if (Level === null) Level = '';
  if (btnexel === null) btnexel = '';
  if (Userdownlinemember === null) Userdownlinemember = '';
  const Employeeid = req.user.emp_id;
  const perm = await pagePerm(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;

  // (no try/catch in the legacy action: exceptions => 500)
  const loginid = await rootLoginId();
  const MaxRows = 50;
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: cvtInt(Level === '' ? '0' : Level), side: Side, Name: Name.trim(), Username: Username.trim(), EmailID: EmailID.trim(),
    SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: ActiveDeactive, Userdownlinemember,
  });
  const LRMember = mapRows(rows, LDM_PROPS);
  const tc = outVal(rows, 'TotalCount');
  const TotalRecord = cvtInt(tc === '' ? 'x' : tc); // int.Parse(DBNull.ToString()) => FormatException
  const ti = outVal(rows, 'TotalInvesment');
  const TotalInvesments = cvtDec(ti === '' ? 'x' : ti); // Convert.ToDecimal("") => FormatException
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.TotalInvesments = TotalInvesments;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.Level = Level;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/LeftDownLine_Member/Index.cshtml', Model: LRMember, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('SearchField'), v('SearchValue'), v('fromdate'), v('todate'), v('Username'), v('EmailID'),
    v('SponserID'), nInt(req.p.page), v('Name'), nInt(req.p.Side), v('Level'));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
