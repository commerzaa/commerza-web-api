'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Withdrawal_History.cs (class Withdrawal_HistoryController => /admin/Withdrawal_History/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'Withdrawal_History';

/** class INSERTWITHDRAWALDATAINEXCEL */
const EXCELDATA_PROPS = ['ROWNUMBER', 'TRANSACTIONTYPE', 'BENEFICIARYNAME', 'BENEFICIARYACCOUNT', 'DEBITACCOUNTNO', 'IFSC', 'REMARKS', 'CURRENCY',
  'TRANSACTIONDATE', 'AMOUNT', 'Date'];
/** class WithdrawalHistory */
const WH_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'CRDRTYPE', 'WITHDRAWALAMT', 'WithDrawlPoints', 'ADMINCHARGE', 'TDS', 'TDS_PER', 'STATUS', 'DATE',
  'REJECTAMT', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'EMAILID', 'MOBILE', 'PANNO', 'PAID_MODE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

/** OUT column of a row-returning proc as the raw value (no rows => 0, PORT-NOTE: PG cannot return OUT values without a row) */
const outRaw = (rows, name) => (rows && rows[0] ? B.col(rows[0], name) : 0);

// public void getdate()
async function getdate(ViewBag) {
  // [usp_getdatepayoutbeforedownload]
  ViewBag.datepaypout = mapRows(await db.proc(DB, 'usp_getdatepayoutbeforedownload', {}), EXCELDATA_PROPS);
}

// [USP_WITHDRAWALHISTORY_REPORT] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TRANSACTIONTYPE,@Status,
//   @TOTALCOUNT OUT,@totalwithdrawal OUT,@totalTDS OUT,@totalAdminCharges OUT[,@orderbydate]
const report = (p) => db.proc(DB, 'USP_WITHDRAWALHISTORY_REPORT', p);

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string TransactionType, string ListStatus, int? page, string OrderBy, string releasepayout, string Userdownlinemember, int? Side)
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, TransactionType, ListStatus, page, OrderBy, releasepayout, Userdownlinemember, Side) {
  void releasepayout;
  const userid = req.user.emp_id;
  const Filename = 'WithdrawalHistoryReport_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (TransactionType === null) TransactionType = '';
  if (ListStatus === null) ListStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  const rows = await report({
    STARTROWINDEX: page, MAXROWS: 100000000, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate,
    TODATE: toDate, TRANSACTIONTYPE: TransactionType, Status: ListStatus,
  });
  const Obj = mapRows(rows, WH_PROPS);
  const TotalRecord = B.outIntOf(rows, 'TOTALCOUNT'); void TotalRecord;
  const totaltds = B.cvtDecObj(outRaw(rows, 'totalTDS'));
  const TOTALWithdrawalAmt = B.cvtDecObj(outRaw(rows, 'totalwithdrawal'));
  const totalAdmincharge = B.cvtDecObj(outRaw(rows, 'totalAdminCharges'));
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'WithdrawalHistoryReport.xls', Filename, downloadName: ' WithdrawalHistoryReport.xls',
      headers: ['S.No.', 'Date', 'Username', 'EmailId', 'MobileNo.', 'PANNo.', 'Name', 'A/c Holder', 'Bank', 'Account No.', 'IFSC', 'Branch',
        'Amin Charge', 'TDS', 'Withdrawal Amt', 'Status'],
      rows: Obj, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'DATE', 'USERNAME', 'EMAILID', 'MOBILE', 'PANNO', 'NAME', 'ACCOUNTHOLDERNAME', 'BANKNAME']) {
          w(B.tab(B.cellStr(item, k)) + ' \t');
        }
        w(B.tab("'" + B.cellStr(item, 'ACCOUNTNO')) + ' \t');
        w(B.tab(B.cellStr(item, 'IFSC')) + ' \t');
        w(B.tab(B.cellStr(item, 'BRANCHNAME')) + ' \t');
        w(B.tab(B.dec2(item.ADMINCHARGE)) + ' \t');
        w(B.tab(B.dec2(item.TDS)) + ' \t');
        w(B.tab(B.dec2(item.WITHDRAWALAMT)) + ' \t');
        w(B.tab(B.cellStr(item, 'STATUS')) + ' \t');
      },
      trailer: (w) => {
        w('\n');
        for (let i = 0; i < 11; i++) w(' \t');
        w('Total: \t');
        w(B.dec2(totalAdmincharge) + ' \t');
        w(B.dec2(totaltds) + ' \t');
        w(B.dec2(TOTALWithdrawalAmt) + ' \t');
        w(' \t');
      },
    });
  }
  return { sent: false };
}

// public void ExportReportReadOnly(string DDLSTATE)
// PORT-NOTE: Microsoft.Office.Interop.Excel replaced by exceljs (lazy require). Template "/Withdrawals/MDMC_Template1.xlsx" (under
// config.uploadDir), sheet "Sheet1" renamed "WithdrawalList". Column AutoFit of A1:I1 is not available in exceljs (skipped).
// The legacy SaveAs used a hard-coded developer path "D:\All Softwares\...\AllExcelSheets\<Filename>.xlsx" and redirected to
// ~/AllExcelSheets/<Filename>.xlsx; the workbook is saved to <uploadDir>/AllExcelSheets/<Filename>.xlsx and sent directly.
async function ExportReportReadOnly(req, res, ViewBag, DDLSTATE) {
  const ExcelJS = require('exceljs'); // new Excel.Application() (throws when Excel/exceljs is unavailable)
  let mWorkBook = null;
  const tpl = B.mapPath('/Withdrawals/MDMC_Template1.xlsx');
  if (fs.existsSync(tpl)) {
    mWorkBook = new ExcelJS.Workbook();
    await mWorkBook.xlsx.readFile(tpl);
  }
  if (!mWorkBook) throw B.nullRef(); // mWorkBook.Worksheets on null
  const mWSheet1 = mWorkBook.getWorksheet('Sheet1');
  if (!mWSheet1) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
  mWSheet1.name = 'WithdrawalList';

  const userid = req.user.emp_id;
  const Filename = 'MDMC_Template1' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // [USP_INSERTWITHDRAWALEXCELDATA] @date = Convert.ToDateTime(DDLSTATE)
  const Obj = mapRows(await db.proc(DB, 'USP_INSERTWITHDRAWALEXCELDATA', { date: B.cvtDateTime(DDLSTATE) }), EXCELDATA_PROPS);
  if (Obj.length > 0) {
    try {
      let k = 3;
      const cs = (v) => { if (v === null || v === undefined) throw B.nullRef(); return v instanceof Date ? B.netDateString(v) : String(v); };
      for (let j = 0; j < Obj.length; j++) {
        const cur = config.app.Currency || '';
        const it = Obj[j];
        const row = mWSheet1.getRow(k);
        const bn = cs(it.BENEFICIARYNAME);
        row.getCell(1).value = bn === '' ? '' : bn;
        row.getCell(1).protection = { locked: true };
        const list = [];
        const CellData = 'Pending,Reject,Approve';
        for (const Itmes of CellData.trim().split(',')) list.push(Itmes.trim());
        const FlatList = list.join(',');
        row.getCell(10).dataValidation = {
          type: 'list', allowBlank: true, operator: 'between', formulae: [`"${FlatList}"`], showInputMessage: true, showErrorMessage: true,
          errorStyle: 'stop',
        };
        const ba = cs(it.BENEFICIARYACCOUNT);
        row.getCell(2).value = ba === '' ? '' : ba;
        const ifsc = cs(it.IFSC);
        row.getCell(3).value = ifsc === '' ? '' : ifsc;
        const tt = it.TRANSACTIONTYPE;
        if (tt === '1' && tt !== '0') row.getCell(4).value = 'NEFT';
        else if (tt === '2' && tt !== '0') row.getCell(4).value = 'RTGS';
        else if (tt === '3' && tt !== '0') row.getCell(4).value = 'BANK';
        else row.getCell(4).value = 'N/A';
        row.getCell(5).value = '';
        row.getCell(6).value = B.netDateString(it.TRANSACTIONDATE === null || it.TRANSACTIONDATE === undefined ? (() => { throw B.nullRef(); })() : new Date(it.TRANSACTIONDATE));
        const amt = B.dec2(it.AMOUNT);
        row.getCell(7).value = amt === '0' ? '' : amt;
        row.getCell(8).value = cur;
        row.getCell(9).value = '';
        k += 1;
      }
      // mWSheet1.Columns.Locked = false; A1:I1 EntireColumn.Locked = true; Protect(no password)
      for (let c = 10; c <= 16384 && c <= Math.max(mWSheet1.columnCount, 10); c++) mWSheet1.getColumn(c).protection = { locked: false };
      for (let c = 1; c <= 9; c++) mWSheet1.getColumn(c).protection = { locked: true };
      await mWSheet1.protect('', {});
      const dir = B.mapPath('~/AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const saved = path.join(dir, Filename + '.xlsx');
      await mWorkBook.xlsx.writeFile(saved);
      const dl = B.mapPath('~/DownloadedExcel');
      const filepath1 = path.join(dl, Filename + '.xlsx');
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=' + Filename + ' .xlsx');
      res.send(fs.readFileSync(saved));
      return { sent: true };
    } catch (ExpObj) {
      if (res.headersSent) return { sent: true };
      await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWLREQUESTREPORT');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate,
//   string TransactionType, string ListStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, string btnexelreadonly, string DDLSTATE)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/withdrawal-history" -> Withdrawal_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/withdrawal-history'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let TransactionType = B.nStr(req.p.TransactionType);
  let ListStatus = B.nStr(req.p.ListStatus);
  let page = B.nInt(req.p.page);
  let OrderBy = B.nStr(req.p.OrderBy);
  const releasepayout = B.nStr(req.p.releasepayout);
  let btnexel = B.nStr(req.p.btnexel);
  let Userdownlinemember = B.nStr(req.p.Userdownlinemember);
  let Side = B.nInt(req.p.Side);
  const btnexelreadonly = B.nStr(req.p.btnexelreadonly);
  const DDLSTATE = B.nStr(req.p.DDLSTATE);
  const ViewBag = {};
  await getdate(ViewBag);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = B.dynPaging();
  let Obj = [];
  try {
    const MaxRows = B.cvtInt(dynamicpagging);
    if (Userdownlinemember === null) Userdownlinemember = '';
    if (OrderBy === null) OrderBy = '';
    if (fromDate === null) fromDate = '';
    if (toDate === null) toDate = '';
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    if (TransactionType === null) TransactionType = '';
    if (orderbydate === null) orderbydate = '';
    if (ListStatus === null) ListStatus = '';
    if (page === null) page = 1;
    if (Side === null) Side = 0;
    if (btnexel === null) btnexel = '';
    const Empid = req.user.emp_id;
    const p = await B.perms(Empid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    ViewBag.excelactive = p.excelactive;
    const rows = await report({
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate,
      TODATE: toDate, TRANSACTIONTYPE: TransactionType, Status: ListStatus, orderbydate,
    });
    Obj = mapRows(rows, WH_PROPS);
    const TotalRecord = B.outIntOf(rows, 'TOTALCOUNT');
    const SumofWithdrawal = B.cvtDecObj(outRaw(rows, 'TOTALCOUNT')); // (sic) Convert.ToDecimal(TOTALCOUNT.Value)
    const totalwithdrwal = B.cvtDecObj(outRaw(rows, 'totalwithdrawal'));
    ViewBag.totalWithdrawal = SumofWithdrawal;
    ViewBag.totalw = totalwithdrwal;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.CurrentPage = page;
    ViewBag.ListStatus = ListStatus;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = TransactionType;
    ViewBag.OrderBy = OrderBy;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWLREQUESTREPORT');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.ATCCoin = '0.00000000';
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, TransactionType, ListStatus, page, OrderBy,
      releasepayout, Userdownlinemember, Side);
    if (r.sent) return undefined;
  }
  if (btnexelreadonly === 'Export Excel ReadOnly') {
    const r = await ExportReportReadOnly(req, res, ViewBag, DDLSTATE);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Withdrawal_History/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate),
    B.nStr(req.p.TransactionType), B.nStr(req.p.ListStatus), B.nInt(req.p.page), B.nStr(req.p.OrderBy), B.nStr(req.p.releasepayout),
    B.nStr(req.p.Userdownlinemember), B.nInt(req.p.Side));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void getdate()
// auth (PORT-NOTE: legacy had no session check; admin payout data => adminAuth). Void action => empty response.
router.all(`/admin/${C}/getdate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await getdate({});
  res.send('');
}));

// ---------------------------------------------------------------- public void ExportReportReadOnly(string DDLSTATE)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportReadOnly{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReportReadOnly(req, res, {}, B.nStr(req.p.DDLSTATE));
  if (!r.sent) res.send('');
}));

module.exports = router;
