'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Atc_Topup_Request.cs (class Atc_Topup_RequestController => /Atc_Topup_Request/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, reqInt, toInt32, toStr, nullRef, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Atc_Topup_Request';

/** class ATC_Fund_History */
const PROPS = ['RowNumber', 'TAFHID', 'RegNo', 'Type', 'ATC', 'AmountInINR', 'Date', 'ByUser', 'Remark', 'Status', 'GeneratedBy', 'Username',
  'EMAILID', 'FULLNAME', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber', 'ReferenceDate',
  'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(string Username, string fromdate, string todate) */
async function ExportReport(req, res, ViewBag, Username, fromdate, todate) {
  const userid = req.user.emp_id;
  const Filename = `Atc_Topup_Request_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  try {
    const Obj = mapRows(await db.proc(DB, 'Usp_ATC_Fund_Transfer', {
      Mode: '1', RegNo: '0', Type: 'Cr', Amount: '0', Remark: Username, FromDate: fromdate, ToDate: todate, StartRowIndex: 1, MaxRows: 9999999,
    }), PROPS);
    if (Obj.length > 0) {
      return await tsvExport({
        req, res, ViewBag, sheet: 'Atc_Topup_Request.xls', filename: Filename, rows: Obj, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
        headers: ['S.No. \t', 'Request Date \t', 'Username \t', 'EmailId \t', 'Name \t', 'INR Amount \t', 'Status \t'],
        cells: (item, w) => {
          w(tab(toStr(item.RowNumber)) + ' \t');
          w(tab(toStr(item.Date)) + ' \t');
          w(tab(toStr(item.Username)) + ' \t');
          w(tab(toStr(item.EMAILID)) + ' \t');
          w(tab(toStr(item.FULLNAME)) + ' \t');
          if (item.AmountInINR === null || item.AmountInINR === undefined) nullRef();
          w(tab(Number(item.AmountInINR).toFixed(2)) + ' \t');
          w(tab(toStr(item.IsVerifiedByAdmin)) + ' \t');
        },
      });
    }
  } catch (ex) {
    if (res.headersSent) return true;
    // legacy: catch (Exception ex) { } (swallowed)
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? page, string btnexel, string fromdate, string todate, string Username)
// auth (reads Session["Admin_User"] before its null check)
// route-config: "AdminPanel/Coin-topup-request" -> Atc_Topup_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Coin-topup-request'], adminAuth, asyncHandler(async (req, res) => {
  let page = nint(req.p.page);
  let btnexel = sv(req.p.btnexel);
  let fromdate = sv(req.p.fromdate);
  let todate = sv(req.p.todate);
  let Username = sv(req.p.Username);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  const MaxRows = 50;
  if (page === null) page = 1;
  let Obj = [];
  try {
    const rows = await db.proc(DB, 'Usp_ATC_Fund_Transfer', {
      Mode: '1', RegNo: '0', Type: 'Cr', Amount: '0', Remark: Username, FromDate: fromdate, ToDate: todate, StartRowIndex: page, MaxRows,
    });
    Obj = mapRows(rows, PROPS);
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Convert.ToInt32(DBNull.ToString()) => FormatException
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.Username = Username;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_ATC_Fund_Transfer');
    return res.json({ redirect: 'page-not-found' }); // Response.Redirect("page-not-found")
  }
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, Username, fromdate, todate)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Atc_Topup_Request/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string Username, string fromdate, string todate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.Username), sv(req.p.fromdate), sv(req.p.todate));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult ApproveReject(string GAKEY, long RegNo, long ID, string mode, string Remarks)
// auth (Session null => Response.Redirect("/"))
router.all(`/admin/${C}/ApproveReject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GAKEY = sv(req.p.GAKEY);
  const RegNo = reqInt(req.p.RegNo, 'RegNo', 'System.Int64');
  const ID = reqInt(req.p.ID, 'ID', 'System.Int64');
  const mode = sv(req.p.mode);
  const Remarks = sv(req.p.Remarks);
  const EmpId = req.user.emp_id;
  let IsGoogleAuthenticated = '';
  const gaObj = await new Admin_Security_Key().Get_Security_Key(EmpId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return res.json('Error^Enter your GA Key.'); // PORT-NOTE: MVC binds "" as null, so (as in legacy) this rarely fires
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    // legacy called Get_Security_Key three more times (nested identical null checks)
    let objs = await new Admin_Security_Key().Get_Security_Key(EmpId);
    if (objs) {
      objs = await objs.Get_Security_Key(EmpId);
      if (objs) {
        objs = await objs.Get_Security_Key(EmpId);
        if (objs) {
          const ValidRandomNo = await objs.Get_GA_Key(EmpId);
          if (!(await objs.Check_GaKeyForEnableTime(EmpId, ValidRandomNo, GAKEY))) {
            if (GAKEY !== '') return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
          }
        }
      }
    }
  }
  // [Usp_ATC_Fund_Transfer] @Mode=2 ... @TAFHID  (ExecuteSqlCommand)
  const row = await db.procOne(DB, 'Usp_ATC_Fund_Transfer', {
    Mode: '2', RegNo, Type: mode, Amount: '0', Remark: Remarks, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100', TAFHID: ID,
  });
  const ret = str(col(row, 'strresult'));
  return res.json(ret);
}));

module.exports = router;
