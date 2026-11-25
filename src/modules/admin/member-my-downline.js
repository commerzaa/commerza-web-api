'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MemberMyDownlineController.cs
// (namespace Common.Controllers.AdminPanel, class MemberMyDownlineController => /MemberMyDownline/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Exceldownloadhistory = require('../../lib/admin/Exceldownloadhistory');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, perms, nowStamp, writeXlsExport, tab, cellStr, col, nullRef, outIntOf, decOutIntOf, trimS, firstCol,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'MemberMyDownline';

/** class AllDownlineMemberLeftRight (Controllers/AdminPanel/All_Downline_Member_List.cs) */
const PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username', 'root_userName', 'LCount',
  'RCount', 'SideName', 'DepositedATC', 'PARENTID'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

/** decimal.ToString("0") (.NET Framework rounds half away from zero) */
function dec0(v) {
  if (v === null || v === undefined) throw nullRef();
  const n = Number(v);
  return String(Math.sign(n) * Math.round(Math.abs(n)));
}

/** USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE (identical call in Index and ExportReport) */
async function downline(loginid, page, MaxRows, SearchField, SearchValue, fromdate, todate, Level, Side, ActivationStatus) {
  // @LoginID,@StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@levenumber,@side,@TotalCount out,@TotalLRBV out,
  // @TOTALLRINCOME out,@Name,@Username,@EmailID,@SponserID,@CheckAdminSide,@ActivationStatus,@Userdownlinemember,@totalInvesment out,
  // @orderbydate,@FromLevel,@TOLevel,@Orderbylevel,@MAINSEARCH   (CommandTimeout 2000)
  return db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: trimS(fromdate), ToDate: trimS(todate),
    levenumber: cvtInt(Level === '' ? '0' : Level), side: Side, Name: '', Username: '', EmailID: '', SponserID: '', CheckAdminSide: 0,
    ActivationStatus: cvtInt(ActivationStatus), Userdownlinemember: '', orderbydate: '', FromLevel: 0, TOLevel: 0, Orderbylevel: 0, MAINSEARCH: '',
  });
}

// [SessionExpireCheck] public void ExportReport(string plid, string fromdate, string todate, string SearchField, string SearchValue, int? page,
//   string Name, int? Side, string btnexel, string Level, string ActivationStatus)
async function ExportReport(req, res, plid, fromdate, todate, SearchField, SearchValue, page, Name, Side, btnexel, Level, ActivationStatus, ViewBag) {
  const Emp_ID = req.user.emp_id;
  if (plid === null || plid === undefined) plid = '';
  const loginid = plid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null || page === undefined) page = 1;
  const rows = await downline(loginid, page, MaxRows, SearchField, SearchValue, fromdate, todate, Level, Side, ActivationStatus);
  const AllEPinRequestsList = mapRows(rows, PROPS);
  outIntOf(rows, 'totalcount'); // int TotalRecord = int.Parse(...) (unused)
  decOutIntOf(rows, 'totalinvesment'); // decimal totalBV = Convert.ToDecimal(...) (unused)
  await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
  const Filename = plid + 'Downline_' + Emp_ID + '_' + nowStamp();
  if (AllEPinRequestsList.length > 0) {
    try {
      await Exceldownloadhistory.Excel_history(Emp_ID, url, Filename);
      // no per-row try/catch in legacy: any row error goes to the outer catch (so the rows are rendered up front)
      let body = 'S.No. \tName \tUsername \tAmount \tSate name \tCity name \tContact \tJoin Date \tActivation Date \tC Points\t';
      for (const item of AllEPinRequestsList) {
        body += '\n';
        body += tab(cellStr(item, 'ROWNUMBER')) + ' \t';
        body += tab(cellStr(item, 'Name')) + ' \t';
        body += tab(cellStr(item, 'userName')) + ' \t';
        body += tab(cellStr(item, 'PaidBV')) + ' \t';
        body += tab(cellStr(item, 'status')) + ' \t'; // (header says "Sate name", legacy wrote status)
        body += tab(cellStr(item, 'CityName')) + ' \t';
        body += tab(cellStr(item, 'Mobile')) + ' \t';
        body += tab(cellStr(item, 'RegDate')) + ' \t';
        body += tab(cellStr(item, 'DOC')) + ' \t';
        body += tab(dec0(col(item, 'kitprice'))) + ' \t';
      }
      return await writeXlsExport({
        req, res, ViewBag, sheet: 'All_Member_List.xls', Filename, rawHeaders: body, rows: [], cells: () => {},
        outerProc: plid + '_Downline_list',
      });
    } catch (ExpObj) {
      if (res.headersSent) return { sent: true };
      await errorInsert(req, ExpObj, plid + '_Downline_list');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(string plid, string fromdate, string todate, string SearchField,
//   string SearchValue, int? page, string Name, int? Side, string btnexel, string Level, string ActivationStatus)
// auth ([SessionExpireCheck] => redirect "~/secure-admin-login-.../logout")
// route-config: "AdminPanel/MyDownlineList" -> MemberMyDownline/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MyDownlineList'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let plid = nStr(req.p.plid);
  let fromdate = nStr(req.p.fromdate); if (fromdate === null) fromdate = '';
  let todate = nStr(req.p.todate); if (todate === null) todate = '';
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let Name = nStr(req.p.Name); if (Name === null) Name = '';
  let Side = nInt(req.p.Side); if (Side === null) Side = 0;
  let Level = nStr(req.p.Level); if (Level === null) Level = '';
  let ActivationStatus = nStr(req.p.ActivationStatus); if (ActivationStatus === null) ActivationStatus = '0';
  const btnexel = nStr(req.p.btnexel);
  let page = nInt(req.p.page);
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await perms(Empid, url)); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  if (plid === null) plid = '';
  const loginid = plid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await downline(loginid, page, MaxRows, SearchField, SearchValue, fromdate, todate, Level, Side, ActivationStatus);
  const LRMember = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  // PORT-NOTE: decimal OUT param without Scale => ADO.NET returned it rounded to an integer; no rows => 0.
  const totalBV = decOutIntOf(rows, 'totalinvesment');
  Object.assign(ViewBag, {
    userid: loginid, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate: fromdate,
    toDate: todate, side: Side, SearchField, SearchValue, Level, ActivationStatus, totalBV,
  });
  await UtilityClass.GridNumbersPerPage(); // int Noofpage (unused)
  // SqlQuery<int>("select STATUS from TBL_SUBMENUROLE_MEMBERPANEL where sid in (12,98)").FirstOrDefault()
  const tsRows = await db.query(DB, 'select status from tbl_submenurole_memberpanel where sid in (12, 98)', {});
  let TreeStatus = tsRows.length ? firstCol(tsRows) : 0;
  if (TreeStatus === null) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
  TreeStatus = Number(TreeStatus);
  ViewBag.TreeStatus = TreeStatus === 1 ? 1 : 0;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, plid, fromdate, todate, SearchField, SearchValue, page, Name, Side, btnexel, Level, ActivationStatus, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '/Views/AdminPanel/MemberMyDownline/index.cshtml', Model: LRMember, ...ViewBag });
}));

// ---------------------------------------------------------------- [SessionExpireCheck] public void ExportReport(...)
// auth ([SessionExpireCheck]; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('plid'), v('fromdate'), v('todate'), v('SearchField'), v('SearchValue'), nInt(req.p.page), v('Name'),
    nInt(req.p.Side), v('btnexel'), v('Level'), v('ActivationStatus'), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
