'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Recieved_BTC_Payments.cs (class Recieved_BTC_PaymentsController => /admin/Recieved_BTC_Payments/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, Usp_Fund_Transfer_Only_BTC_Payment, USP_EXCEL_DOWNLOAD_HISTORY,
// Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed, Usp_Fund_Transfer. Table: MEMBER_MASTER.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqDec, reqLong, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, dec2, outStr, cvtIntStrict, mapPath,
} = require('./_shared/batch12-common');
const { gaCheck, cfgInt16 } = require('./_shared/batch12-b-common');
const { rowsOut, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'Recieved_BTC_Payments';

/** class BTC_PaymentsList */
const BTC_PAYMENTS_PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId', 'FullName',
  'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber',
  'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [Usp_Fund_Transfer_Only_BTC_Payment] @MODE,@REGNO,@BYUSERREGNO,@TYPE,@AMOUNT,@REMARK,@STRRESULT OUT,@TOTALCOUNT OUT,@FROMDATE,@TODATE,@STARTROWINDEX,
 *  @MAXROWS,@TFHID,@EMAILID,@MINAMOUNT,@MAXAMOUNT,@ISVERIFIEDBYADMIN,@ORDERBYFIELD,@PaymentMode  (C# null values are not sent => proc default) */
const btcList = (o) => db.proc(DB, 'Usp_Fund_Transfer_Only_BTC_Payment', omitNull({
  Mode: '2', RegNo: '0', ByUserRegNo: '0', Type: 'Cr', Amount: '0', Remark: o.Username, FromDate: o.fromdate, ToDate: o.todate,
  StartRowIndex: o.page, MaxRows: o.MaxRows, TFHID: 0, EMAILID: o.Emailid, MINAMOUNT: o.minamount, MAXAMOUNT: o.maxamount,
  IsVerifiedByAdmin: o.IsVerifiedByAdmin, ORDERBYFIELD: o.OrderBy, PaymentMode: o.Paymentmode,
}));

/** public void ExportReport(string fromdate, string Paymentmode, string todate, string OrderBy, string Username, string Emailid, string minamount,
 *  string Mode, string maxamount, string IsVerifiedByAdmin) */
async function ExportReport(req, res, ViewBag, fromdate, Paymentmode, todate, OrderBy, Username, Emailid, minamount, Mode, maxamount, IsVerifiedByAdmin) {
  const userid = req.user.emp_id;
  const Filename = 'Recieved_BTC_Payments_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  void Mode;
  const Obj = mapRows(await btcList({
    Username, fromdate, todate, page: 1, MaxRows: 9999999, Emailid, minamount, maxamount, IsVerifiedByAdmin, OrderBy, Paymentmode,
  }), BTC_PAYMENTS_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Recieved_BTC_Payments.xls', downloadName: ' Recieved_BTC_Payments.xls', Filename,
      // (the legacy "Full Name" header contains a literal TAB before " \t")
      rawHeaders: 'S.No. \tRequest Date \tUsername \tEmailId \tFull Name\t \tAmount \tTransaction No \tStatus \t',
      headers: [],
      rows: Obj,
      innerProc: 'PayitForword_list',
      outerProc: 'USP_PAID_FORWORDLIST_BYADMIN',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'Date')) + ' \t');
        w(tab(cellStr(item, 'Username')) + ' \t');
        w(tab(cellStr(item, 'EmailId')) + ' \t');
        w(tab(cellStr(item, 'FullName')) + ' \t');
        w(tab(dec2(item.Amount)) + ' \t');
        w(tab(cellStr(item, 'ReferenceNumber')) + ' \t');
        const v = Number(item.IsVerifiedByAdmin);
        w(tab(v === 2 ? 'Rejected' : (v === 0 ? (Number(item.GeneratedBy) === 1 ? 'Credited' : 'Pending') : 'Approved')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string btnexel, string fromdate, string Paymentmode,
//   string DownloadProcessedExcel, string todate, string OrderBy, string Username, string Emailid, string minamount, string Mode, string maxamount,
//   string IsVerifiedByAdmin)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Recieved-BTC-Payments" -> Recieved_BTC_Payments/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Recieved-BTC-Payments'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  const btnexel = nStr(req.p.btnexel);
  let fromdate = nStr(req.p.fromdate);
  let Paymentmode = nStr(req.p.Paymentmode);
  let DownloadProcessedExcel = nStr(req.p.DownloadProcessedExcel);
  let todate = nStr(req.p.todate);
  let OrderBy = nStr(req.p.OrderBy);
  let Username = nStr(req.p.Username);
  let Emailid = nStr(req.p.Emailid);
  let minamount = nStr(req.p.minamount);
  let Mode = nStr(req.p.Mode);
  let maxamount = nStr(req.p.maxamount);
  let IsVerifiedByAdmin = nStr(req.p.IsVerifiedByAdmin);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = cfgInt16('DynamicPagging'); // Convert.ToInt16(AppSettings["DynamicPagging"])
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  if (OrderBy === null) OrderBy = '';
  if (Paymentmode === null) Paymentmode = '2';
  if (Paymentmode === '') Paymentmode = '2';
  if (Emailid === null) Emailid = '';
  if (DownloadProcessedExcel === null) DownloadProcessedExcel = '';
  if (Mode === null) Mode = '';
  if (IsVerifiedByAdmin === null) IsVerifiedByAdmin = '-1';
  if (maxamount === null) maxamount = '0';
  if (maxamount === '') maxamount = '';
  if (minamount === '') minamount = '';
  if (minamount === null) minamount = '0';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await btcList({
    Username, fromdate, todate, page, MaxRows, Emailid, minamount, maxamount, IsVerifiedByAdmin, OrderBy, Paymentmode,
  });
  const Obj = mapRows(rows, BTC_PAYMENTS_PROPS);
  // Convert.ToInt32(TotalCount.Value.ToString()) (DBNull => FormatException). PORT-NOTE: with no rows PG cannot return the OUT value => 0.
  const tc = rowsOut(rows, 'TotalCount');
  const TotalRecord = tc === null ? 0 : cvtIntStrict(tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.Paymentmode = Paymentmode;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.OrderBy = OrderBy;
  ViewBag.minamount = minamount;
  ViewBag.maxamount = maxamount;
  ViewBag.IsVerifiedByAdmin = IsVerifiedByAdmin;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromdate, Paymentmode, todate, OrderBy, Username, Emailid, minamount, Mode, maxamount,
      IsVerifiedByAdmin);
    if (r.sent) return undefined;
  }
  if (Mode !== '') { /* empty block in legacy */ }
  void DownloadProcessedExcel;
  return res.json({ view: '~/Views/AdminPanel/Recieved_BTC_Payments/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.fromdate), nStr(req.p.Paymentmode), nStr(req.p.todate), nStr(req.p.OrderBy), nStr(req.p.Username),
    nStr(req.p.Emailid), nStr(req.p.minamount), nStr(req.p.Mode), nStr(req.p.maxamount), nStr(req.p.IsVerifiedByAdmin));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void DownloadExcelForBulkApprovalProcessed(string FromDate, string ToDate, string Paymentmode)
// auth (reads Session["Admin_User"].Emp_LoginID / Emp_Name; legacy threw NullReferenceException without a session)
// PORT-NOTE: Microsoft.Office.Interop.Excel replaced by exceljs (lazy require, not installed: needs `npm i exceljs`). The workbook gets the same
// bold "Arial Narrow" header row (16 columns), auto-fit columns, columns 1-14 locked and the sheet protected (no password); like the legacy
// code NO data row is written (the per-row loop only increments a counter). exceljs writes the OOXML format into the legacy ".xls" file name.
router.all(`/admin/${C}/DownloadExcelForBulkApprovalProcessed{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let FromDate = nStr(req.p.FromDate);
  let ToDate = nStr(req.p.ToDate);
  const Paymentmode = nStr(req.p.Paymentmode);
  const ViewBag = {};
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  const MaxRows = 10000;
  const Page = '1';
  // [Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed] @Mode,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@Paymentmode
  const Obj = mapRows(await db.proc(DB, 'Usp_Bulk_Data_Download_Fund_Transfer_Execll_Processed', omitNull({
    Mode: '2', FromDate, ToDate, StartRowIndex: Page, MaxRows, Paymentmode,
  })), BTC_PAYMENTS_PROPS);
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  const headers = ['ROWNUMBER', 'TFHID', 'REGNO', 'AMOUNT', 'DATE', 'USERNAME', 'PAYMENTMODE', 'RECEIPT', 'BANKNAME', 'BRANCHNAME', 'REFERENCENUMBER',
    'REFERENCEDATE', 'MEMBER REMARK', 'YOUR USER ID', 'YOUR REMARK', 'PAYMENT STATUS'];
  headers.forEach((h, i) => {
    const cell = worksheet.getRow(1).getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, name: 'Arial Narrow' };
  });
  let row = 2;
  for (const Items of Obj) {
    try {
      void Items;
      row += 1;
    } catch (exp) {
      ViewBag.filepath = exp.message;
    }
  }
  const LoginIDNew = req.user.emp_loginid === null || req.user.emp_loginid === undefined ? '' : String(req.user.emp_loginid);
  const MemberNameNew = req.user.emp_name === null || req.user.emp_name === undefined ? '' : String(req.user.emp_name); // Convert.ToString
  const rel = '~/TopupRequestList/i-wallet-top-up-request-by-user_' + LoginIDNew + '_' + MemberNameNew + '.xls';
  const filePath = mapPath(rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  // worksheet.Columns.AutoFit()
  for (let c = 1; c <= 16; c += 1) worksheet.getColumn(c).width = Math.max(10, headers[c - 1].length + 2);
  // worksheet.Columns.Locked = false; columns 1..14 Locked = true; worksheet.Protect()
  for (let c = 1; c <= 16; c += 1) worksheet.getColumn(c).protection = { locked: c <= 14 };
  await worksheet.protect('', {});
  await workbook.xlsx.writeFile(filePath);
  // Response.Redirect("~/TopupRequestList/i-wallet-top-up-request-by-user_<LoginID>_<Name>.xls")
  return res.json({ redirect: rel.replace(/^~/, '') });
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth-by-check (legacy: Session null => Response.Redirect("/"), then NullReferenceException on Emp_Master.Emp_ID)
router.all(`/admin/${C}/AddFunds{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Amount = reqDec(req.p.Amount, 'Amount');
  const Id = reqLong(req.p.Id, 'Id');
  const Username = nStr(req.p.Username);
  const Remark = nStr(req.p.Remark);
  const GAKEY = nStr(req.p.GAKEY);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const EmpId = req.user.emp_id;
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  if (Id <= 0) return res.json('Error^Some error occured.Try typing username again.');
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  // [Usp_Fund_Transfer] @Mode,@RegNo,@ByUserRegNo,@Type,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,@MaxRows
  const row = await db.procOne(DB, 'Usp_Fund_Transfer', omitNull({
    Mode: '1', RegNo: Id, ByUserRegNo: '0', Type: 'Cr', Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
  }));
  const ret = outStr(row, 'StrResult');
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult ApproveReject(string GAKEY, long RegNo, long ID, string mode, string Remarks)
// auth-by-check (legacy: Session null => Response.Redirect("/"), then NullReferenceException on Emp_Master.Emp_ID)
router.all(`/admin/${C}/ApproveReject{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RegNo = reqLong(req.p.RegNo, 'RegNo');
  const ID = reqLong(req.p.ID, 'ID');
  const GAKEY = nStr(req.p.GAKEY);
  const mode = nStr(req.p.mode);
  const Remarks = nStr(req.p.Remarks);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const EmpId = req.user.emp_id;
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  if (req.user.emp_code === null || req.user.emp_code === undefined) throw new Error('Object reference not set to an instance of an object.');
  const ActivityByUser = String(req.user.emp_code) + ' ' + '(' + (req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name) + ')';
  // [Usp_Fund_Transfer] @Mode,...,@MaxRows,@TFHID,@emailid,@minamount,@maxamount,@IsVerifiedByAdmin,@ORDERBYFIELD,@PaymentMode,@ActivityByUser
  const row = await db.procOne(DB, 'Usp_Fund_Transfer', omitNull({
    Mode: '5', RegNo, ByUserRegNo: '0', Type: mode, Amount: '0', Remark: Remarks, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
    TFHID: ID, emailid: '', minamount: '0', maxamount: '0', IsVerifiedByAdmin: '-1', ORDERBYFIELD: 'AVDESC', PaymentMode: '0', ActivityByUser,
  }));
  const ret = outStr(row, 'StrResult');
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (legacy had no session check; returns member data => adminAuth)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const memberid = nStr(req.p.memberid);
  let getval = 'Invalid';
  try {
    // PORT-NOTE: the legacy query concatenated memberid into the SQL (injection hole); it is parameterised here.
    const dr = await db.queryOne(DB, `select mm.regno, coalesce(mm.fname, '') || ' ' || coalesce(mm.mname, '') || ' ' || coalesce(mm.lname, '') as mmbername,
        mm.emailid from member_master mm where mm.username = @memberid limit 1`, { memberid: memberid === null ? '' : memberid });
    if (dr) {
      const s = (v) => (v === null || v === undefined ? '' : String(v));
      getval = s(dr.regno) + '^' + s(dr.mmbername) + '^' + s(dr.emailid);
    } else {
      getval = 'Invalid';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(getval);
}));

module.exports = router;
