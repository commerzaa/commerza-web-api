'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_UpLineMember_list.cs (class All_UpLineMember_listController => /All_UpLineMember_list/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, toInt32, toDecimal, toStr, tab, nowStamp, tsvExport } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'All_UpLineMember_list';

/** class AllUplineMemberLeftRight */
const PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName',
  'LCount', 'RCount', 'SideName', 'DepositedATC'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
// (`private List<AllUplineMemberLeftRight> ExcelList` instance field is never used.)
let url = '';
let url1 = '';

const lastLoginId = async () => db.scalar(DB, 'select username from member_master order by regno desc limit 1', {});

/** public void ExportReport(SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level) {
  const userid = req.user.emp_id;
  const Filename = `All_UpLineMember_list${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  const loginid = await lastLoginId();
  if (page === null) page = 1;
  const nn = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return v; };
  // USP_NEW_Member_GET_MEMBER_UPLINE_SIDE_WISE with 17 params (no @ActivationStatus/@Userdownlinemember/@TotalInvesment/@orderbydate)
  const LRMember = mapRows(await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_UPLINE_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows: '1000000', SearchField, SearchValue,
    fromDate: nn(fromdate).trim(), ToDate: nn(todate).trim(), levenumber: toInt32(Level === '' ? '0' : Level), side: Side,
    Name: nn(Name).trim(), Username: nn(Username).trim(), EmailID: nn(EmailID).trim(), SponserID: nn(SponserID).trim(), CheckAdminSide: 0,
  }), PROPS);
  if (LRMember.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'All_UpLineMember_list.xls', filename: Filename, rows: LRMember, innerProc: 'LRMember',
      outerProc: 'USP_NEW_Member_GET_MEMBER_UPLINE_SIDE_WISE',
      headers: ['s.No. \t', 'Username \t', 'Joining Date \t', 'Sponsor Name \t', 'Side(Left/Right) \t', 'Total Invesment \t', 'Status \t'],
      cells: (item, w) => {
        w(tab(toStr(item.ROWNUMBER)) + ' \t');
        w(tab(toStr(item.userName)) + ' \t');
        w(tab(toStr(item.RegDate)) + ' \t');
        w(tab(toStr(item.sponser_username)) + ' \t');
        if (Number(item.side) === 1 && item.side !== null) w(tab('Left') + ' \t');
        else w(tab('Right') + ' \t');
        w(tab(toStr(item.DepositedATC)) + ' \t');
        w(tab(toStr(item.status)) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level, string btnexel, string Userdownlinemember)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/All-UpLineMember-list" -> All_UpLineMember_list/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-UpLineMember-list'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let Username = sv(req.p.Username);
  let EmailID = sv(req.p.EmailID);
  let SponserID = sv(req.p.SponserID);
  let page = nint(req.p.page);
  let Name = sv(req.p.Name);
  let Side = nint(req.p.Side);
  let Level = sv(req.p.Level);
  let btnexel = sv(req.p.btnexel);
  let Userdownlinemember = sv(req.p.Userdownlinemember);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Username === null) Username = '';
  if (EmailID === null) EmailID = '';
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (Side === null) Side = 0;
  if (Level === null) Level = '';
  if (btnexel === null) btnexel = '';
  if (Userdownlinemember === null) Userdownlinemember = '';
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);

  const loginid = await lastLoginId();
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [USP_NEW_Member_GET_MEMBER_UPLINE_SIDE_WISE] ... @TotalCount out,@TotalLRBV out,@TOTALLRINCOME out, ... @TotalInvesment out,@orderbydate
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_UPLINE_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: toInt32(Level === '' ? '0' : Level), side: Side, Name: Name.trim(), Username: Username.trim(), EmailID: EmailID.trim(),
    SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: 0, Userdownlinemember, orderbydate,
  });
  const LRMember = mapRows(rows, PROPS);
  const tc = str(col(rows[0], 'totalcount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
  const TotalInvesments = toDecimal(str(col(rows[0], 'totalinvesment')) || 'x'); // Convert.ToDecimal(DBNull.ToString()=="") => FormatException
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
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
    if (await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/All_UpLineMember_list/Index.cshtml', Model: LRMember, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromdate, string todate, string Username, string EmailID, string SponserID, int? page, string Name, int? Side, string Level)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue), sv(req.p.fromdate), sv(req.p.todate),
    sv(req.p.Username), sv(req.p.EmailID), sv(req.p.SponserID), nint(req.p.page), sv(req.p.Name), nint(req.p.Side), sv(req.p.Level));
  if (!sent) res.send('');
}));

module.exports = router;
