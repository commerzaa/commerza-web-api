'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Bank_Account_List.cs (class Bank_Account_ListController => /Bank_Account_List/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { DB, col, str, sv, nint, reqInt, toInt32, toStr, nullRef, tab, nowStamp, pagePermissions, tsvExport } = require('./_shared/batch03_common');
const { MEMBERDETAILS_PROPS } = require('./_shared/batch03_models');

const router = express.Router();
const C = 'Bank_Account_List';

/** class BankAccountList */
const PROPS = ['rowNumber', 'acid', 'accountHolderName', 'accountNo', 'bankName', 'branchName', 'ifscCode', 'LoginId', 'membername', 'userName',
  'NomineeName', 'BitCoinWalletAddress', 'AcHolderName', 'PaypalEmail', 'MoneygarmName', 'MoneygarmAddress', 'Regdate'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public void ExportReport(string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = `Bank_Account_List_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // eslint-disable-next-line no-unused-vars
  const MaxRows = await UtilityClass.GridPageSize();
  if (SearchField === null || SearchValue === null) nullRef();
  // USP_BANKDETAILS (5 params here: no @orderbydate/@FromDate/@ToDate)
  const bankdetails = mapRows(await db.proc(DB, 'USP_BANKDETAILS', {
    StartRowIndex: 1, MaxRows: 999999, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
  }), PROPS);
  if (bankdetails.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'Bank_Account_List.xls', filename: Filename, rows: bankdetails, innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      headers: ['S.No. \t', 'Username \t', 'Name \t', 'Account No \t', 'Bank Name \t', 'Nominee \t', 'IFSC Code \t', 'Bitcoin Wallet \t',
        'PayPal Email \t', 'A/C Holder \t', 'MoneyGram Name \t', 'MoneyGram Address \t'],
      cells: (item, w) => {
        for (const k of ['rowNumber', 'userName', 'membername', 'accountNo', 'bankName', 'NomineeName', 'ifscCode', 'BitCoinWalletAddress',
          'PaypalEmail', 'AcHolderName', 'MoneygarmName', 'MoneygarmAddress']) w(tab(toStr(item[k])) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- ViewResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, int? page, string btnexel, string FromDate, string ToDate)
// auth (Session null => Response.Redirect("/"))
// route-config: "AdminPanel/Bank-Account-List" -> Bank_Account_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Bank-Account-List'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let orderbydate = sv(req.p.orderbydate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let page = nint(req.p.page);
  let btnexel = sv(req.p.btnexel);
  let FromDate = sv(req.p.FromDate);
  let ToDate = sv(req.p.ToDate);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = toInt32(config.app.DynamicPagging); // Convert.ToInt16(AppSettings["DynamicPagging"])
  if (orderbydate === null) orderbydate = '';
  if (ToDate === null) ToDate = '';
  if (FromDate === null) FromDate = '';
  if (SearchField === null) SearchField = '';
  if (btnexel === null) btnexel = '';
  if (SearchValue === null) SearchValue = '';
  // USP_EXCEL_LINK executed, output ignored: isactive = 0
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  ViewBag.excelactive = 0;
  const perm = await pagePermissions(req.user.emp_id, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_BANKDETAILS', {
      StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), orderbydate, FromDate, ToDate,
    });
    const bankdetails = mapRows(rows, PROPS);
    const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull.ToString()) => FormatException
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.datetype = orderbydate;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, SearchField, SearchValue)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Bank_Account_List/Index.cshtml', Model: bankdetails, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_BANKDETAILS');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.SearchField), sv(req.p.SearchValue));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetMemeberDetails(double regno)
// auth (PORT-NOTE: legacy had NO session check although usp_GetMemberDetails returns member details incl. Password - protected here)
router.all(`/admin/${C}/GetMemeberDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqInt(req.p.regno, 'regno', 'System.Double');
  const row = await db.procOne(DB, 'usp_GetMemberDetails', { regno });
  if (!row) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(row, MEMBERDETAILS_PROPS));
}));

module.exports = router;
