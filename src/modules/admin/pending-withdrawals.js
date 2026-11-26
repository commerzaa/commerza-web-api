'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pending_Withdrawals.cs (class Pending_WithdrawalsController => /admin/Pending_Withdrawals/...)
// Database: affiliate (Db_Affiliate).
// Config: APIURLCLUBDATA, DynamicPagging, Currency
const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const { DB, nre, nint, nstr, toInt32, view } = require('./_shared/batch02-common');
const { firstCol } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Pending_Withdrawals';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

const mapPath = (v) => path.join(config.uploadDir, String(v || '').replace(/^~?[\\/]*/, ''));
const s = (v) => (v === null || v === undefined ? '' : String(v)); // int?.ToString()

/** JToken.ToString(): missing key => NullReferenceException; null => ""; arrays/objects => indented JSON (empty array => "[]") */
function jstr(obj, key) {
  const v = obj && typeof obj === 'object' ? obj[key] : undefined;
  if (v === undefined) throw nre();
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'object') return Array.isArray(v) && v.length === 0 ? '[]' : JSON.stringify(v, null, 2);
  return String(v);
}
/** JObject.Parse(text) */
function jobjectParse(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { throw new Error(`Unexpected character encountered while parsing value: ${String(text).slice(0, 1)}. Path '', line 0, position 0.`); }
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Error reading JObject from JsonReader. Current JsonReader item is not an object.');
  return o;
}
/** JArray.Parse(text) */
function jarrayParse(text) {
  let a;
  try { a = JSON.parse(text); } catch (e) { throw new Error(`Unexpected character encountered while parsing value: ${String(text).slice(0, 1)}. Path '', line 0, position 0.`); }
  if (!Array.isArray(a)) throw new Error('Error reading JArray from JsonReader. Current JsonReader item is not an array.');
  return a;
}
/** Convert.ToInt32(string) ("" => FormatException) */
function cInt(v) {
  const t = String(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** Convert.ToDecimal(string) */
function cDec(v) {
  const t = String(v).trim();
  if (t === '' || !Number.isFinite(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
const orEmpty = (x) => (x === '' ? '' : x);

/** class saerchparam serialised by JavaScriptSerializer (every property, declaration order, nulls kept) */
function saerchparam(o) {
  const keys = ['Authentication', 'wherecome', 'APIKEY', 'Plid', 'page', 'maxrows', 'orderbydate', 'SearchField', 'SearchValue', 'fromDate', 'toDate',
    'ByStatus', 'OrderBy', 'releasepayout', 'btnexel', 'Userdownlinemember', 'Side', 'ProcessBy', 'ProcessIPAddress'];
  const out = {};
  for (const k of keys) out[k] = o[k] === undefined ? null : o[k];
  return out;
}

/** HttpWebRequest POST application/json => response text (non-2xx => WebException) */
async function postJson(fullUrl, body) {
  const r = await axios.post(fullUrl, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (x) => x,
  });
  return String(r.data);
}

/** select isnull(CLUBDESC,'') from SETTINGS where CAPTION='apikey' and active=1  (SqlQuery<string>.FirstOrDefault()) */
async function apiKey() {
  return firstCol(await db.query(DB, "select coalesce(clubdesc, '') as clubdesc from settings where caption = 'apikey' and active = 1", {}));
}

/** System.Net.Dns.GetHostEntry(Dns.GetHostName()).AddressList[1] (if more than one address)
 *  PORT-NOTE: approximated with os.networkInterfaces() (all addresses, IPv6 + IPv4). */
function serverIp() {
  const addr = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) addr.push(a.address);
  return addr.length > 1 ? addr[1] : '';
}

/**
 * public void ExportReportReadOnly(string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus,
 *                                  int? page, string OrderBy, string releasepayout, string Userdownlinemember, int? Side)
 * Returns true when the file was sent. Exceptions outside the inner try propagate (like legacy).
 */
async function ExportReportReadOnly(req, res, a, ViewBag) {
  // PORT-NOTE: Microsoft.Office.Interop.Excel replaced by exceljs (lazy). Template ~/WithdrawalsClubExcel/NEFT-Converter-bulk-Upload.xlsx,
  // sheet "NEFT Converter", rows from 17. AutoFit and the Locked flags (no sheet protection => no effect) are approximated.
  const ExcelJS = require('exceljs'); // eslint-disable-line global-require
  const tpl = mapPath('~/WithdrawalsClubExcel/NEFT-Converter-bulk-Upload.xlsx');
  let mWorkBook = null;
  if (fs.existsSync(tpl)) {
    mWorkBook = new ExcelJS.Workbook();
    await mWorkBook.xlsx.readFile(tpl);
  }
  if (!mWorkBook) throw nre(); // mWorkBook.Worksheets on null
  const mWSheet1 = mWorkBook.getWorksheet('NEFT Converter');
  if (!mWSheet1) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
  mWSheet1.name = 'NEFT Converter';
  const userid = req.user.emp_id; // eslint-disable-line no-unused-vars
  let Filename = '';
  const APIKEY = await apiKey();
  const IpAddress = serverIp();
  const Empid = req.user.emp_id;
  const obj1 = [];
  const OBjSendReceive = saerchparam({
    Authentication: '', wherecome: 'web', APIKEY, Plid: '0', page: s(a.page), maxrows: '1000', orderbydate: a.orderbydate,
    SearchField: a.SearchField, SearchValue: a.SearchValue, fromDate: a.fromDate, toDate: a.toDate, ByStatus: a.ByStatus, OrderBy: a.OrderBy,
    releasepayout: a.releasepayout, Userdownlinemember: a.Userdownlinemember, Side: s(a.Side), ProcessBy: String(Empid), ProcessIPAddress: IpAddress,
  });
  ViewBag.hide_tds_admin = 0;
  ViewBag.totalWithdrawal = 0;
  ViewBag.SumofWithdrawal = 0;
  const APIURL = config.app.APIURLCLUBDATA;
  const Return = await postJson(s(APIURL) + 'execlClubedData-Bank-Withdrawal-Pending', OBjSendReceive);
  const ObjProductDetails = jobjectParse(Return);
  const Flag = jstr(ObjProductDetails, 'Flag');
  if (Flag === 'success') {
    const Details = jstr(ObjProductDetails, 'Message');
    if (Details !== '[]') {
      const obj = jarrayParse(Details);
      for (let i = 0; i < obj.length; i++) {
        const o = obj[i];
        obj1.push({
          RowNumber: cInt(orEmpty(jstr(o, 'RowNumber'))),
          UserName: jstr(o, 'USERNAME'),
          FileName: jstr(o, 'Filename'),
          Grossamount: cDec(jstr(o, 'Grossamount') === '' ? '0.00' : jstr(o, 'Grossamount')),
          ADMINCHARGE: cDec(jstr(o, 'ADMINCHARGE') === '' ? '0.00' : jstr(o, 'ADMINCHARGE')),
          TDS: cDec(jstr(o, 'TDS') === '' ? '0.00' : jstr(o, 'TDS')),
          NetAmount: cDec(jstr(o, 'NetAmount') === '' ? '0.00' : jstr(o, 'NetAmount')),
          AccountNo: jstr(o, 'ACCOUNTNO'),
          BankName: jstr(o, 'BANKNAME'),
          BranchName: jstr(o, 'BRANCHNAME'),
          IFSCCODE: jstr(o, 'IFSCCODE'),
          AccountHolderName: jstr(o, 'ACCOUNTHOLDERNAME'),
          Status: jstr(o, 'Status'),
          DrAccountNo: jstr(o, 'DrAccountNo'),
        });
      }
    }
  }
  if (obj1.length > 0) {
    try {
      let k = 17;
      for (let j = 0; j < obj1.length; j++) {
        const cur = config.app.Currency || ''; // eslint-disable-line no-unused-vars
        const it = obj1[j];
        const set = (c, v) => { mWSheet1.getRow(k).getCell(c).value = v; };
        set(1, String(it.RowNumber));
        mWSheet1.getRow(k).getCell(1).protection = { locked: true };
        set(2, "'" + it.DrAccountNo); // (.ToString() == null is never true)
        set(3, String(it.Grossamount));
        set(4, it.AccountHolderName);
        set(5, it.IFSCCODE);
        set(6, "'" + it.AccountNo);
        set(7, '10');
        set(8, '');
        set(9, '');
        if (Filename === '') Filename = it.FileName;
        k += 1;
      }
      for (let c = 1; c <= 10; c++) mWSheet1.getColumn(c).protection = { locked: true }; // A17:J17 EntireColumn.Locked = true
      const outDir = mapPath('~/WithdrawalsClubExcel');
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `Withdrawal_${Filename}.xlsx`);
      await mWorkBook.xlsx.writeFile(outFile);
      // Response.Redirect("~/WithdrawalsClubExcel/Withdrawal_<Filename>.xlsx") => the saved file is sent directly
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', `attachment;filename=Withdrawal_${Filename} .xlsx`);
      res.send(fs.readFileSync(outFile));
      return true;
    } catch (ExpObj) {
      if (res.headersSent) return true;
      await errorInsert(req, ExpObj, 'USP_BANKWITHDRAWLREQUESTREPORT');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, string btnexelreadonly)
// auth (reads Session["Admin_User"]; legacy NullReference was caught => error view)
// route-config: "AdminPanel/Pending-Withdrawals" -> Pending_Withdrawals/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pending-Withdrawals'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  const orderbydate = nstr(req.p.orderbydate);
  let SearchField = nstr(req.p.SearchField);
  let SearchValue = nstr(req.p.SearchValue);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let ByStatus = nstr(req.p.ByStatus);
  let page = nint(req.p.page);
  let OrderBy = nstr(req.p.OrderBy);
  const releasepayout = nstr(req.p.releasepayout);
  const btnexel = nstr(req.p.btnexel);
  let Userdownlinemember = nstr(req.p.Userdownlinemember);
  let Side = nint(req.p.Side);
  const btnexelreadonly = nstr(req.p.btnexelreadonly);
  const ViewBag = {};
  const out = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // loginid / phone / accountno / ifsccode / accountholdername / bankname / branchname / username are computed but never used (legacy)
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  // else: emailid/mobile/accnum/ifsc/accholname/bankname/branchname/username => <var> = SearchValue.Trim() (values never used)
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = toInt32(value); // Convert.ToInt16(value)
  }
  const MaxRows = toInt32(dynamicpagging);
  const obj1 = [];
  try {
    const APIKEY = await apiKey();
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid); Employee_Master EM = ...; EM.Emp_ID
    const EM = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!EM) throw nre();
    out.token = issueAdminToken(EM);
    // #region DataList By API
    const OBjSendReceive = saerchparam({
      Authentication: '', wherecome: 'web', APIKEY, Plid: '0', page: s(page), maxrows: String(MaxRows), orderbydate, SearchField, SearchValue,
      fromDate, toDate, ByStatus, OrderBy, releasepayout, Userdownlinemember, Side: s(Side),
    });
    let TotalRecord = 0;
    ViewBag.hide_tds_admin = 0;
    ViewBag.totalWithdrawal = 0;
    ViewBag.SumofWithdrawal = 0;
    const APIURL = config.app.APIURLCLUBDATA;
    const Return = await postJson(s(APIURL) + 'Bank-Withdrawal-Pending', OBjSendReceive);
    const ObjProductDetails = jobjectParse(Return);
    const Flag = jstr(ObjProductDetails, 'Flag');
    if (Flag === 'success') {
      const Details = jstr(ObjProductDetails, 'Message');
      if (Details !== '[]') {
        const obj = jarrayParse(Details);
        for (let i = 0; i < obj.length; i++) {
          const o = obj[i];
          const g = (k, d) => { const x = jstr(o, k); return x === '' ? d : x; };
          const userinfo = {
            RowNumber: cInt(orEmpty(jstr(o, 'RowNumber'))),
            UserName: jstr(o, 'UserName'),
            Date: jstr(o, 'Date'),
            Grossamount: cDec(g('Grossamount', '0.00')),
            ADMINCHARGE: cDec(g('ADMINCHARGE', '0.00')),
            TDS: cDec(g('TDS', '0.00')),
            NetAmount: cDec(g('NetAmount', '0.00')),
            AccountNo: jstr(o, 'AccountNo'),
            BankName: jstr(o, 'BankName'),
            BranchName: jstr(o, 'BranchName'),
            IFSCCODE: jstr(o, 'IFSCCODE'),
            AccountHolderName: jstr(o, 'AccountHolderName'),
            Status: jstr(o, 'Status'),
            Name: null,
          };
          // (class Pending_Withdrawals property order)
          obj1.push({
            RowNumber: userinfo.RowNumber, Date: userinfo.Date, UserName: userinfo.UserName, Grossamount: userinfo.Grossamount,
            ADMINCHARGE: userinfo.ADMINCHARGE, TDS: userinfo.TDS, NetAmount: userinfo.NetAmount, AccountNo: userinfo.AccountNo,
            AccountHolderName: userinfo.AccountHolderName, BankName: userinfo.BankName, BranchName: userinfo.BranchName, IFSCCODE: userinfo.IFSCCODE,
            Status: userinfo.Status, Name: userinfo.Name,
          });
          TotalRecord = obj.length;
          ViewBag.hide_tds_admin = cInt(jstr(ObjProductDetails, 'hide_tds_admin'));
          ViewBag.totalWithdrawal = cInt(jstr(ObjProductDetails, 'totalWithdrawal'));
          ViewBag.SumofWithdrawal = cInt(jstr(ObjProductDetails, 'SumofWithdrawal'));
        }
      }
    }
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.Userdownlinemember = Userdownlinemember;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = ByStatus;
    ViewBag.OrderBy = OrderBy;
    if (btnexel === 'Export Excel') {
      // (empty in legacy: //ExportReport(...))
    }
    // #endregion DataList By API
    if (btnexelreadonly === 'Club Excel ReadOnly') {
      const sent = await ExportReportReadOnly(req, res, {
        orderbydate, SearchField, SearchValue, fromDate, toDate, ByStatus, page, OrderBy, releasepayout, Userdownlinemember, Side,
      }, ViewBag);
      if (sent) return undefined;
    }
    ViewBag.APIerror = 1;
    return view(res, '~/Views/AdminPanel/Pending_Withdrawals/Index.cshtml', obj1, { ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return view(res, '~/Views/AdminPanel/Pending_Withdrawals/Index.cshtml', obj1, { ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReportReadOnly(string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string Userdownlinemember, int? Side)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportReadOnly{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  const sent = await ExportReportReadOnly(req, res, {
    orderbydate: P('orderbydate'), SearchField: P('SearchField'), SearchValue: P('SearchValue'), fromDate: P('fromDate'), toDate: P('toDate'),
    ByStatus: P('ByStatus'), page: nint(req.p.page), OrderBy: P('OrderBy'), releasepayout: P('releasepayout'),
    Userdownlinemember: P('Userdownlinemember'), Side: nint(req.p.Side),
  }, {});
  if (!sent) res.send(''); // void action => empty response
}));

// public static void SetFileReadAccess(string FileName, bool SetReadOnly) / public static bool IsFileReadOnly(string FileName):
// static => not MVC actions and never called; ported as internal helpers.
function SetFileReadAccess(FileName, SetReadOnly) { // eslint-disable-line no-unused-vars
  const st = fs.statSync(FileName);
  fs.chmodSync(FileName, SetReadOnly ? (st.mode & ~0o222) : (st.mode | 0o200)); // eslint-disable-line no-bitwise
}
function IsFileReadOnly(FileName) { // eslint-disable-line no-unused-vars
  try { fs.accessSync(FileName, fs.constants.W_OK); return false; } catch (e) { return true; }
}
router.helpers = { SetFileReadAccess, IsFileReadOnly };

module.exports = router;
