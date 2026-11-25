'use strict';
// Ported from Franchise\Controllers\CustomerPanel\ExportClubdata_BankdetailsController.cs  (database: shopping — Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const P = '/franchise/ExportClubdata_Bankdetails';

// Club_downloadExcel properties (C# class declared at the bottom of the .cs file)
const CLUB_PROPS = ['RowNumber', 'Date', 'UserName', 'Grossamount', 'ADMINCHARGE', 'TDS', 'NetAmount', 'AccountNo',
  'AccountHolderName', 'BankName', 'BranchName', 'IFSCCODE', 'Status', 'FileName', 'Clubgroup', 'TotalRequest',
  'TotalAmount', 'TotalTransaction', 'ProcessDate', 'ProcessBY', 'ProcessStatus', 'ProcessIPAddress', 'DrAccountNo'];

// legacy instance fields (per request here)
function newState() { return { downloadfilename: '', FileName: '', BankName: '', DR_AccountNo: '' }; }

// USP_CLUBHISTORY_RESELLERWISE call shared by the four bank exports
async function clubHistory(fromDate, toDate, SearchField, SearchValue, BankName, DID) {
  // PORT-NOTE: OUT parameters (@TOTALWITHDRAWALPOINTS, @TOTALPAYABLEAMOUNT, @RECORDCOUNT, @SUMWITHDRAWALAMT, @totalTDS,
  // @TotalAdminC, @SUMWITHDRAWLPOINTS1, @TotalAmt) are never read by the C#; they are not sent in the PostgreSQL call.
  const rows = await db.proc('shopping', 'usp_clubhistory_resellerwise', {
    WithDrawalFromDate: fromDate,
    WithDrawalToDate: toDate,
    LoginId: '',
    Phone: '',
    AccountNo: '',
    IFSCCODE: '',
    AccountHolderName: '',
    BANKNAME: '',
    BRANCHNAME: '',
    STARTROWINDEX: 1,
    MAXROWS: 1000000,
    Mode: '1',
    Username: '',
    STATUS: '',
    Userdownlinemember: '',
    SIDE: 0,
    orderbydate: '',
    ProcessBy: '',
    ProcessIPAddress: '',
    SearchField,
    SearchValue,
    select_Bank: BankName,
    DID,
  });
  return mapRows(rows, CLUB_PROPS);
}

// Opens the bank's template workbook (Microsoft.Office.Interop.Excel replacement => exceljs)
async function openTemplate(FileName, sheetName) {
  // PORT-NOTE: requires the "exceljs" package (not installed yet). Excel Interop is Windows/Office-only.
  const ExcelJS = require('exceljs');
  const file = path.join(config.uploadDir, 'WithdrawalsClubExcel', FileName);
  const wb = new ExcelJS.Workbook();
  // legacy: workbook stays null when the template is missing => NullReferenceException => caught
  if (fs.existsSync(file)) await wb.xlsx.readFile(file);
  else throw new Error('Object reference not set to an instance of an object.');
  const ws = wb.getWorksheet(sheetName);
  if (!ws) throw new Error('Template sheet not found: ' + sheetName);
  return { wb, ws };
}

async function saveWorkbook(wb, name) {
  const dir = path.join(config.uploadDir, 'WithdrawalsClubExcel');
  fs.mkdirSync(dir, { recursive: true });
  await wb.xlsx.writeFile(path.join(dir, name));
}

const s = (v) => (v === null || v === undefined ? '' : String(v));

async function ICICIBANK(st, DID, fromDate, toDate, SearchField, SearchValue) {
  const obj1 = await clubHistory(fromDate, toDate, SearchField, SearchValue, st.BankName, DID);
  const { wb, ws } = await openTemplate(st.FileName, 'NEFT Converter');
  ws.name = 'NEFT Converter';
  let Filename = '';
  let k = 17;
  for (let j = 0; j < obj1.length; j++) {
    const o = obj1[j];
    ws.getCell(k, 1).value = s(o.RowNumber);
    ws.getCell(k, 2).value = st.DR_AccountNo;
    ws.getCell(k, 3).value = s(o.Grossamount);
    const ACname = s(o.AccountHolderName);
    ws.getCell(k, 4).value = ACname.length > 30 ? ACname.substring(0, 30) : ACname;
    ws.getCell(k, 5).value = s(o.IFSCCODE);
    ws.getCell(k, 6).value = "'" + s(o.AccountNo);
    ws.getCell(k, 7).value = '10';
    ws.getCell(k, 8).value = '';
    ws.getCell(k, 9).value = '';
    if (Filename === '') Filename = s(o.FileName);
    k = k + 1;
  }
  st.downloadfilename = Filename;
  await saveWorkbook(wb, 'Withdrawal_' + Filename + '.xlsx');
}

async function AXISBANK(st, DID, fromDate, toDate, SearchField, SearchValue) {
  const obj1 = await clubHistory(fromDate, toDate, SearchField, SearchValue, st.BankName, DID);
  const { wb, ws } = await openTemplate(st.FileName, 'Sheet1');
  ws.name = 'Sheet1';
  let Filename = '';
  ws.getCell(1, 2).value = st.DR_AccountNo;
  let k = 6;
  for (let j = 0; j < obj1.length; j++) {
    const o = obj1[j];
    ws.getCell(k, 1).value = s(o.AccountHolderName);
    ws.getCell(k, 2).value = "'" + s(o.AccountNo);
    ws.getCell(k, 3).value = s(o.IFSCCODE);
    ws.getCell(k, 4).value = 'NEFT';
    ws.getCell(k, 5).value = new Date(new Date().setHours(0, 0, 0, 0));
    ws.getCell(k, 6).value = s(o.NetAmount);
    ws.getCell(k, 7).value = 'INR';
    if (Filename === '') Filename = s(o.FileName);
    k = k + 1;
  }
  await saveWorkbook(wb, 'Withdrawal_' + Filename + '.xls');
}

async function IndusindBank(st, DID, fromDate, toDate, SearchField, SearchValue) {
  const obj1 = await clubHistory(fromDate, toDate, SearchField, SearchValue, st.BankName, DID);
  const { wb, ws } = await openTemplate(st.FileName, 'Sheet1');
  ws.name = 'Sheet1';
  let Filename = '';
  let k = 2;
  for (let j = 0; j < obj1.length; j++) {
    const o = obj1[j];
    ws.getCell(k, 1).value = s(o.RowNumber);
    ws.getCell(k, 29).value = st.DR_AccountNo;
    ws.getCell(k, 4).value = s(o.Grossamount);
    ws.getCell(k, 5).value = s(o.AccountHolderName);
    ws.getCell(k, 25).value = s(o.IFSCCODE);
    ws.getCell(k, 3).value = "'" + s(o.AccountNo);
    ws.getCell(k, 7).value = '';
    ws.getCell(k, 8).value = '';
    ws.getCell(k, 9).value = '';
    if (Filename === '') Filename = s(o.FileName);
    k = k + 1;
  }
  await saveWorkbook(wb, 'Withdrawal_' + Filename + '.xls');
}

async function IDFCBank(st, DID, fromDate, toDate, SearchField, SearchValue) {
  const obj1 = await clubHistory(fromDate, toDate, SearchField, SearchValue, st.BankName, DID);
  const { wb, ws } = await openTemplate(st.FileName, 'Sheet1');
  ws.name = 'Sheet1';
  let Filename = '';
  let k = 3;
  const cur = config.app.Currency;
  for (let j = 0; j < obj1.length; j++) {
    const o = obj1[j];
    ws.getCell(k, 5).value = st.DR_AccountNo;
    ws.getCell(k, 7).value = s(o.Grossamount);
    ws.getCell(k, 1).value = s(o.AccountHolderName);
    ws.getCell(k, 3).value = s(o.IFSCCODE);
    ws.getCell(k, 2).value = "'" + s(o.AccountNo);
    ws.getCell(k, 8).value = cur;
    ws.getCell(k, 9).value = '';
    if (Filename === '') Filename = s(o.FileName);
    k = k + 1;
  }
  await saveWorkbook(wb, 'Withdrawal_' + Filename + '.xls');
}

// public void actions: Response.ContentType = "application/force-download"; Response.End(); exceptions => ViewBag.filepath
function voidAction(fn) {
  return asyncHandler(async (req, res) => {
    const st = newState();
    const q = req.p;
    const DID = req.user.did;
    try {
      await fn(st, DID, q.fromDate, q.toDate, q.SearchField, q.SearchValue);
      res.setHeader('Content-Type', 'application/force-download');
      res.end();
    } catch (ExpObj) {
      res.json({ filepath: ExpObj.message });
    }
  });
}

// auth
router.all(P + '/Select_Bank{/:id}', auth, asyncHandler(async (req, res) => {
  const redirect = { redirect: 'Customer_Bank_Transfer/Index' };
  let BankID = req.p.BankID;
  let SearchField = req.p.SearchField;
  let SearchValue = req.p.SearchValue;
  let fromDate = req.p.fromDate;
  let toDate = req.p.toDate;
  let username = '';
  if (SearchField == null || SearchValue == null) {
    SearchField = '';
    SearchValue = '';
  } else if (SearchField === 'username') {
    username = String(SearchValue).trim();
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  try {
    const BankDetailsAdmin = await db.queryOne('shopping',
      'select BanKID,BankName,Filename,AccountNo from Tbl_Admin_BankDetails where status=1 and TABDID=@BankID',
      { BankID: parseInt(BankID, 10) });
    const d = mapRows([BankDetailsAdmin], ['BankID', 'BankName', 'FileName', 'AccountNo'])[0];
    if (!BankDetailsAdmin) throw new Error('Object reference not set to an instance of an object.');
    BankID = d.BankID;
    const st = newState();
    st.FileName = d.FileName;
    st.DR_AccountNo = d.AccountNo;
    st.BankName = d.BankName;
    const DID = req.user.did;
    // PORT-NOTE: C# started a background Thread (which lost the HttpContext/Session); here the export runs
    // in the background with the DID taken from the JWT and the response is returned immediately.
    const bg = (fn) => { setImmediate(() => { fn(st, DID, fromDate, toDate, SearchField, SearchValue).catch((e) => console.error(e.message)); }); };
    if (BankID === 1) bg(ICICIBANK);
    if (BankID === 2) bg(AXISBANK);
    if (BankID === 5) bg(IndusindBank);
    if (BankID === 11) bg(IDFCBank);
    return res.json(redirect);
  } catch (ex) {
    return res.json(redirect);
  }
}));

// auth
router.all(P + '/ICICIBANK{/:id}', auth, voidAction(async (st, DID, f, t, sf, sv) => {
  // legacy: called directly, instance fields are empty strings
  return ICICIBANK(st, DID, f, t, sf, sv);
}));
// auth
router.all(P + '/AXISBANK{/:id}', auth, voidAction((st, DID, f, t, sf, sv) => AXISBANK(st, DID, f, t, sf, sv)));
// auth
router.all(P + '/IndusindBank{/:id}', auth, voidAction((st, DID, f, t, sf, sv) => IndusindBank(st, DID, f, t, sf, sv)));
// auth
router.all(P + '/IDFCBank{/:id}', auth, voidAction((st, DID, f, t, sf, sv) => IDFCBank(st, DID, f, t, sf, sv)));

module.exports = router;
