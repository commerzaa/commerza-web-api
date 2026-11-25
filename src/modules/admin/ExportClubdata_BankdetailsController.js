'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ExportClubdata_BankdetailsController.cs
// (class ExportClubdata_BankdetailsController => /admin/ExportClubdata_Bankdetails/...). No RouteConfig entry.
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ExportClubdata_Bankdetails';

/** class banklist (BankWithdrawalRequestController.cs) */
const BANKLIST_PROPS = ['TABDID', 'Name', 'BankName', 'FileName', 'BankID', 'AccountNo'];
/** class Club_downloadExcel (Pending_Withdrawals.cs) */
const CLUB_PROPS = ['RowNumber', 'Date', 'UserName', 'Grossamount', 'ADMINCHARGE', 'TDS', 'NetAmount', 'AccountNo', 'AccountHolderName',
  'BankName', 'BranchName', 'IFSCCODE', 'Status', 'FileName', 'Clubgroup', 'TotalRequest', 'TotalAmount', 'TotalTransaction',
  'ProcessDate', 'ProcessBY', 'ProcessStatus', 'ProcessIPAddress', 'DrAccountNo'];

/** private string downloadfilename, FileName, BankName, DR_AccountNo (instance fields; a fresh controller per request => "") */
const newCtx = () => ({ downloadfilename: '', FileName: '', BankName: '', DR_AccountNo: '', ViewBag: {} });

/** [usp_clubhistory] call shared by the four bank exports (OUT params are result columns, unused). */
async function clubHistory(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username) {
  return mapRows(await db.proc(DB, 'usp_clubhistory', {
    WithDrawalFromDate: fromDate, WithDrawalToDate: toDate, LoginId: '', Phone: '', AccountNo: '', IFSCCODE: '', AccountHolderName: '',
    BANKNAME: '', BRANCHNAME: '', STARTROWINDEX: 1, MAXROWS: 1000000, Mode: '1', Username: username, STATUS: '',
    Userdownlinemember, SIDE: B.cvtInt(Side), orderbydate: '', ProcessBy: '', ProcessIPAddress: '', SearchField, SearchValue,
    select_Bank: ctx.BankName,
  }), CLUB_PROPS);
}

/**
 * Microsoft.Office.Interop.Excel: Workbooks.Open(~/WithdrawalsClubExcel/<FileName>) -> Worksheets[sheetName] -> fill -> SaveAs(out).
 * PORT-NOTE: Excel Interop replaced by SheetJS `xlsx` (lazy require; reads/writes both .xls and .xlsx templates). Cell locking and
 * AutoFit (`get_Range("A17","J17").EntireColumn.AutoFit()/Locked`) have no SheetJS community equivalent and are not reproduced.
 * When the template does not exist the legacy mWorkBook stayed null => NullReferenceException (reproduced).
 */
function openTemplate(ctx, sheetName) {
  const XLSX = require('xlsx');
  const p = B.mapPath('~/WithdrawalsClubExcel/' + ctx.FileName);
  let wb = null;
  if (fs.existsSync(p) && fs.statSync(p).isFile()) wb = XLSX.readFile(p, { cellStyles: true });
  if (!wb) throw B.nullRef(); // mWorkBook.Worksheets on null
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))'); // get_Item(name) not found
  return { XLSX, wb, ws };
}
/** mWSheet1.Cells[r, c] = v (1-based) */
function setCell(XLSX, ws, r, c, v) {
  const addr = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 });
  if (v instanceof Date) ws[addr] = { t: 'd', v };
  else ws[addr] = { t: 's', v: String(v) };
  const range = XLSX.utils.decode_range(ws['!ref'] || addr);
  range.s.r = Math.min(range.s.r, r - 1); range.s.c = Math.min(range.s.c, c - 1);
  range.e.r = Math.max(range.e.r, r - 1); range.e.c = Math.max(range.e.c, c - 1);
  ws['!ref'] = XLSX.utils.encode_range(range);
}
/** mWorkBook.SaveAs(Server.MapPath("~/WithdrawalsClubExcel/<name>")) */
function saveAs(XLSX, wb, name) {
  const out = B.mapPath('~/WithdrawalsClubExcel/' + name);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  XLSX.writeFile(wb, out, { bookType: /\.xlsx$/i.test(name) ? 'xlsx' : 'biff8' });
}
/** obj1[j].X.ToString() (null => NullReferenceException; the legacy "== null" checks were always false) */
const s = (item, name) => B.cellStr(item, name);

/**
 * PORT-NOTE: after SaveAs the legacy code did Response.ContentType = "application/force-download"; Response.End(). Inside the
 * background thread (Select_Bank) the request had already completed, so that threw and was swallowed by the catch
 * (ViewBag.filepath = message). When called as a direct action the response is ended empty with that content type (reproduced by
 * the route handlers via ctx.forceDownload).
 */
function endResponse(ctx) { ctx.forceDownload = true; }

/** public void ICICIBANK(...) */
async function ICICIBANK(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username) {
  try {
    const obj1 = await clubHistory(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username);
    const { XLSX, wb, ws } = openTemplate(ctx, 'NEFT Converter');
    let Filename = '';
    let k = 17;
    let ACname = '';
    for (let j = 0; j < obj1.length; j++) {
      const cur = config.app.Currency || ''; void cur; // read, unused (like the C#)
      setCell(XLSX, ws, k, 1, s(obj1[j], 'RowNumber'));
      setCell(XLSX, ws, k, 2, ctx.DR_AccountNo);
      setCell(XLSX, ws, k, 3, s(obj1[j], 'Grossamount'));
      ACname = s(obj1[j], 'AccountHolderName');
      if (ACname.length > 30) setCell(XLSX, ws, k, 4, ACname.substring(0, 30));
      else setCell(XLSX, ws, k, 4, s(obj1[j], 'AccountHolderName'));
      setCell(XLSX, ws, k, 5, s(obj1[j], 'IFSCCODE'));
      setCell(XLSX, ws, k, 6, "'" + s(obj1[j], 'AccountNo'));
      setCell(XLSX, ws, k, 7, '10');
      setCell(XLSX, ws, k, 8, '');
      setCell(XLSX, ws, k, 9, '');
      if (Filename === '') Filename = s(obj1[j], 'FileName');
      k += 1;
    }
    ctx.downloadfilename = Filename;
    saveAs(XLSX, wb, 'Withdrawal_' + Filename + '.xlsx');
    endResponse(ctx);
  } catch (ExpObj) {
    ctx.ViewBag.filepath = ExpObj.message;
  }
}

/** public void AXISBANK(...) */
async function AXISBANK(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username) {
  try {
    const obj1 = await clubHistory(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username);
    const { XLSX, wb, ws } = openTemplate(ctx, 'Sheet1');
    let Filename = '';
    setCell(XLSX, ws, 1, 2, ctx.DR_AccountNo);
    let k = 6;
    for (let j = 0; j < obj1.length; j++) {
      const cur = config.app.Currency || ''; void cur;
      setCell(XLSX, ws, k, 1, s(obj1[j], 'AccountHolderName'));
      setCell(XLSX, ws, k, 2, "'" + s(obj1[j], 'AccountNo'));
      setCell(XLSX, ws, k, 3, s(obj1[j], 'IFSCCODE'));
      setCell(XLSX, ws, k, 4, 'NEFT');
      const today = new Date(); today.setHours(0, 0, 0, 0); // System.DateTime.Now.Date
      setCell(XLSX, ws, k, 5, today);
      setCell(XLSX, ws, k, 6, s(obj1[j], 'NetAmount'));
      setCell(XLSX, ws, k, 7, 'INR');
      if (Filename === '') Filename = s(obj1[j], 'FileName');
      k += 1;
    }
    saveAs(XLSX, wb, 'Withdrawal_' + Filename + '.xls');
    endResponse(ctx);
  } catch (ExpObj) {
    ctx.ViewBag.filepath = ExpObj.message;
  }
}

/** public void IndusindBank(...) */
async function IndusindBank(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username) {
  try {
    const obj1 = await clubHistory(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username);
    const { XLSX, wb, ws } = openTemplate(ctx, 'Sheet1');
    let Filename = '';
    let k = 2;
    for (let j = 0; j < obj1.length; j++) {
      const cur = config.app.Currency || ''; void cur;
      setCell(XLSX, ws, k, 1, s(obj1[j], 'RowNumber'));
      setCell(XLSX, ws, k, 29, ctx.DR_AccountNo);
      setCell(XLSX, ws, k, 4, s(obj1[j], 'Grossamount'));
      setCell(XLSX, ws, k, 5, s(obj1[j], 'AccountHolderName'));
      setCell(XLSX, ws, k, 25, s(obj1[j], 'IFSCCODE'));
      setCell(XLSX, ws, k, 3, "'" + s(obj1[j], 'AccountNo'));
      setCell(XLSX, ws, k, 7, '');
      setCell(XLSX, ws, k, 8, '');
      setCell(XLSX, ws, k, 9, '');
      if (Filename === '') Filename = s(obj1[j], 'FileName');
      k += 1;
    }
    saveAs(XLSX, wb, 'Withdrawal_' + Filename + '.xls');
    endResponse(ctx);
  } catch (ExpObj) {
    ctx.ViewBag.filepath = ExpObj.message;
  }
}

/** public void IDFCBank(...) */
async function IDFCBank(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username) {
  try {
    const obj1 = await clubHistory(ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, Side, username);
    const { XLSX, wb, ws } = openTemplate(ctx, 'Sheet1');
    let Filename = '';
    let k = 3;
    const cur = config.app.Currency || '';
    for (let j = 0; j < obj1.length; j++) {
      setCell(XLSX, ws, k, 5, ctx.DR_AccountNo);
      setCell(XLSX, ws, k, 7, s(obj1[j], 'Grossamount'));
      setCell(XLSX, ws, k, 1, s(obj1[j], 'AccountHolderName'));
      setCell(XLSX, ws, k, 3, s(obj1[j], 'IFSCCODE'));
      setCell(XLSX, ws, k, 2, "'" + s(obj1[j], 'AccountNo'));
      setCell(XLSX, ws, k, 8, cur);
      setCell(XLSX, ws, k, 9, '');
      if (Filename === '') Filename = s(obj1[j], 'FileName');
      k += 1;
    }
    saveAs(XLSX, wb, 'Withdrawal_' + Filename + '.xls');
    endResponse(ctx);
  } catch (ExpObj) {
    ctx.ViewBag.filepath = ExpObj.message;
  }
}

// private void DisplayThread1..4 => fire-and-forget calls (new Thread(...).Start())
const DisplayThread1 = (ctx, ...a) => ICICIBANK(ctx, ...a);
const DisplayThread2 = (ctx, ...a) => AXISBANK(ctx, ...a);
const DisplayThread3 = (ctx, ...a) => IndusindBank(ctx, ...a);
const DisplayThread4 = (ctx, ...a) => IDFCBank(ctx, ...a);
const startThread = (fn) => { setImmediate(() => { fn().catch((e) => console.error('[admin] ExportClubdata thread:', e.message)); }); };

// ---------------------------------------------------------------- Select_Bank(int BankID, string SearchField, string SearchValue, string fromDate, string toDate, string Userdownlinemember, int? Side)
// auth (PORT-NOTE: legacy had no session check, but it exports member bank account data - admin only)
router.all(`/admin/${C}/Select_Bank{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let BankID = B.reqInt(req.p.BankID, 'BankID');
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Userdownlinemember = B.nStr(req.p.Userdownlinemember);
  let Side = B.nInt(req.p.Side);
  const ctx = newCtx();
  let username = '';
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'username') {
    username = SearchValue.trim();
  }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Side === null) Side = 0;
  try {
    const row = await db.queryOne(DB,
      'select bankid, bankname, filename, accountno from tbl_admin_bankdetails where status = 1 and tabdid = @BankID limit 1', { BankID });
    const BankDetailsAdmin = row ? mapRow(row, BANKLIST_PROPS) : null;
    if (!BankDetailsAdmin) throw B.nullRef();
    BankID = BankDetailsAdmin.BankID === null ? 0 : Number(BankDetailsAdmin.BankID);
    ctx.FileName = BankDetailsAdmin.FileName;
    ctx.DR_AccountNo = BankDetailsAdmin.AccountNo;
    ctx.BankName = BankDetailsAdmin.BankName;
    const args = [ctx, fromDate, toDate, Userdownlinemember, SearchField, SearchValue, String(Side), username];
    if (BankID === 1) startThread(() => DisplayThread1(...args));
    if (BankID === 2) startThread(() => DisplayThread2(...args));
    if (BankID === 5) startThread(() => DisplayThread3(...args));
    if (BankID === 11) startThread(() => DisplayThread4(...args));
    return res.json({ redirect: '/Club_History/Index' });
  } catch (ex) {
    return res.json({ redirect: '/Club_History/Index' });
  }
}));

/** Direct-call wrapper of the four public void bank actions (fresh controller instance => FileName/BankName/DR_AccountNo = ""). */
function bankAction(fn) {
  return asyncHandler(async (req, res) => {
    const ctx = newCtx();
    const v = (k) => B.nStr(req.p[k]);
    await fn(ctx, v('fromDate'), v('toDate'), v('Userdownlinemember'), v('SearchField'), v('SearchValue'), v('Side'), v('username'));
    if (ctx.forceDownload) res.set('Content-Type', 'application/force-download');
    res.send(''); // void action
  });
}

// ---------------------------------------------------------------- public void ICICIBANK / AXISBANK / IndusindBank / IDFCBank (routable public methods)
// auth (same reason as Select_Bank)
router.all(`/admin/${C}/ICICIBANK{/:id}`, adminAuth, bankAction(ICICIBANK));
// auth
router.all(`/admin/${C}/AXISBANK{/:id}`, adminAuth, bankAction(AXISBANK));
// auth
router.all(`/admin/${C}/IndusindBank{/:id}`, adminAuth, bankAction(IndusindBank));
// auth
router.all(`/admin/${C}/IDFCBank{/:id}`, adminAuth, bankAction(IDFCBank));

module.exports = router;
