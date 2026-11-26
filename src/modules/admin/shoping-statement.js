'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Shoping_Statement.cs (class Shoping_StatementController => /admin/Shoping_Statement/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index -> route (+2 route-config URLs) ; ExportReport (public void => routable) -> route + internal function.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Shoping_Statement';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class Shoping_Statement */
const PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance'];

/**
 * [USP_SHOPINGSTATEMENTHISTORY] @PLID,@FromDate,@ToDate,@UserName,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,@CrDrType,@TrType,
 *   @cramount out,@dramount out,@avalibalefund out,@GrossCoinWallet out,@UsedCoinWallet out,@GrossCommissionWallet out,
 *   @UsedCommissionWallet out,@IncomeType,@AvailableCommissionWallet out[,@ISHOLD],@orderbydate
 * (OUT params come back as result columns.) Null-valued inputs => "parameter not supplied" exception, like the EF text command.
 */
function statement(p) {
  B.need(p);
  return db.proc(DB, 'USP_SHOPINGSTATEMENTHISTORY', p);
}

/** public void ExportReport(string fromDate, string toDate, string CrDrType, string IncomeType, string orderbydate, string Username, string TrType) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, CrDrType, IncomeType, orderbydate, Username, TrType) {
  const userid = req.user.emp_id;
  const Filename = 'MemberTeamBusinessAdmin_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const PLid = 0;
  const Obj = mapRows(await statement({
    PLID: PLid, FromDate: fromDate, UserName: Username, TrType: B.cvtInt(TrType), StartRowIndex: 1, MaxRows: 999999, ToDate: toDate,
    CrDrType, IncomeType, orderbydate,
  }), PROPS);
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'MemberTeamBusinessAdmin.xls', Filename,
      headers: ['S.No.', 'UserName', 'Mobile No.', 'Date', 'Particulars', 'Type', 'Amount', 'Balance'],
      rows: Obj, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'UserName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'ProcessDate')) + ' \t');
        w(B.tab(B.cellStr(item, 'Remark')) + ' \t');
        const dramounts = B.cvtDec(B.cellStr(item, 'Dr_Amount')); // Convert.ToDecimal(item.Dr_Amount.ToString())
        if (B.toInt16(dramounts) > 0) w(B.tab('Dr') + ' \t');
        else w(B.tab('Cr') + ' \t');
        if (B.toInt16(dramounts) > 0) w(B.tab(B.dec2(item.Dr_Amount)) + ' \t');
        else w(B.tab(B.dec2(item.Cr_Amount)) + ' \t');
        w(B.tab(B.dec2(item.Balance)) + ' \t');
      },
    });
  }
  return { sent: false };
}

/** Index(int? dynamicpagging, string orderbydate, string btnexel, int? page, string fromDate, string toDate, string Username, string CrDrType, string TrType, string Type, int? ddlcustpage) */
async function Index(req, res, routeType) {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let btnexel = B.nStr(req.p.btnexel);
  let page = B.nInt(req.p.page);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Username = B.nStr(req.p.Username);
  let CrDrType = B.nStr(req.p.CrDrType);
  let TrType = B.nStr(req.p.TrType);
  // route-config defaults (Type = 1 / Type = 2) are route values => they win over the query string
  const Type = routeType !== undefined ? routeType : B.nStr(req.p.Type);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.inlinePerms(Employeeid, url); // inline USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelLink(url); // inline USP_EXCEL_LINK
  if (Type === '1') ViewBag.Title = 'Shopping Statement';
  else ViewBag.Title = 'Coupen Statement';
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (btnexel === null) btnexel = '';
  if (orderbydate === null) orderbydate = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Username === null) Username = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  ViewBag.Type = Type;
  const IncomeType = Type;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const PLid = 0;
    const rows = await statement({
      PLID: PLid, FromDate: fromDate, UserName: Username, TrType: B.cvtInt(TrType), StartRowIndex: page, MaxRows, ToDate: toDate,
      CrDrType, IncomeType, ISHOLD: 0, orderbydate,
    });
    Obj = mapRows(rows, PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = B.outIntOf(rows, 'TotalCount');
    const cramountt = B.outDecOf(rows, 'cramount'); // Convert.ToDouble(cramount.Value.ToString())
    const dramountt = B.outDecOf(rows, 'dramount');
    const avalibalefundd = B.outDecOf(rows, 'avalibalefund');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.cramount = cramountt;
    ViewBag.dramount = dramountt;
    ViewBag.avalibalefund = avalibalefundd;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") BEFORE its ErrorInsert block; the redirect ends the request
    // (ThreadAbortException), so the ErrorInsert never ran - not logged here either.
    return res.json({ redirect: '/page-not-found' });
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate, CrDrType, IncomeType, orderbydate, Username, TrType);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Shoping_Statement/Index.cshtml', Model: Obj, ...ViewBag });
}

// ---------------------------------------------------------------- Index(...)
// auth (reads Session["Admin_User"])
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler((req, res) => Index(req, res, undefined)));
// auth
// route-config: "AdminPanel/Shoping-Statement" -> Shoping_Statement/Index, Type = 1
router.all('/admin/AdminPanel/Shoping-Statement', adminAuth, asyncHandler((req, res) => Index(req, res, '1')));
// auth
// route-config: "AdminPanel/Coupen-Statement" -> Shoping_Statement/Index, Type = 2
router.all('/admin/AdminPanel/Coupen-Statement', adminAuth, asyncHandler((req, res) => Index(req, res, '2')));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('fromDate'), v('toDate'), v('CrDrType'), v('IncomeType'), v('orderbydate'), v('Username'), v('TrType'));
  if (!r.sent) res.send('');
}));

module.exports = router;
