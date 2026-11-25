'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Manual_Get_Help.cs (class Manual_Get_HelpController => /Manual_Get_Help/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_ManualGiveHelpList, Usp_ManualGetHelpList, Usp_Give_Help_List, usp_ManualGiveRequestHelp.
// Config: CurrencySymbol. External HTTP: https://bitpay.com/api/rates/<CurrencySymbol>.
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, reqInt, cvtDec, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, dec2, outStr, outIntOf, nullRef,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Manual_Get_Help';

/** class GiveHelpList (Controllers/AdminPanel/Give_Help.cs) */
const GIVE_HELP = ['rowNumber', 'GiveID', 'InvestID', 'Help_Date', 'LoginId', 'Name', 'Emailid', 'Mobile', 'UserName', 'SpLoginId', 'SpName', 'SpEmailid',
  'SpMobile', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'Remain_Amount', 'Process_Amount', 'LinkCount', 'CountDown', 'Regno'];
/** class GetHelpList (Controllers/AdminPanel/GetHelp.cs) */
const GET_HELP = ['rowNumber', 'GetID', 'RequestID', 'Request_Date', 'LoginId', 'Name', 'Emailid', 'Mobile', 'UserName', 'SpLoginId', 'SpName', 'SpEmailid',
  'SpMobile', 'SpUserName', 'Request_Amount', 'Confirm_Amount', 'Remain_Amount', 'Process_Amount', 'CountDown'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string orderBy)
async function ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, orderBy, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  if (SearchValue === null) throw nullRef();
  // dbo.Usp_Give_Help_List @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@message out
  const list = mapRows(await db.proc(DB, 'Usp_Give_Help_List', {
    StartRowIndex: 1, MaxRows: 9999999, SearchField, SearchValue: SearchValue.trim(), fromDate, ToDate: toDate,
  }), GIVE_HELP);
  if (list.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Manual.xls', Filename,
      headers: ['S.No.', 'Name', 'Mobile No', 'Email id', 'Sponser By', 'Invest Id', 'Amount', 'Confirm Amount', 'Process Amount', 'Remain Amount', 'Date'],
      rows: list, innerProc: 'AllEPinRequestsList', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'Name')) + ' \t');
        w(tab(cellStr(item, 'Mobile')) + ' \t');
        w(tab(cellStr(item, 'Emailid')) + ' \t');
        w(tab(cellStr(item, 'SpEmailid')) + ' \t');
        w(tab(cellStr(item, 'InvestID')) + ' \t');
        w(tab(dec2(item.Help_Amount)) + ' \t');
        w(tab(dec2(item.Confirm_Amount)) + ' \t');
        w(tab(dec2(item.Process_Amount)) + ' \t');
        w(tab(dec2(item.Remain_Amount)) + ' \t');
        w(tab(cellStr(item, 'Help_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, string orderBy, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Manual-Get-Help" -> Manual_Get_Help/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manual-Get-Help'], adminAuth, asyncHandler(async (req, res) => {
  const btnexel = s0(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue);
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  const orderBy = nStr(req.p.orderBy);
  const MaxRows = await UtilityClass.GridPageSize();
  let page = nInt(req.p.page); if (page === null) page = 1;
  // dbo.Usp_ManualGiveHelpList @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@message out  (@MaxRows = 50)
  const giveRows = await db.proc(DB, 'Usp_ManualGiveHelpList', {
    StartRowIndex: page, MaxRows: 50, SearchField, SearchValue: SearchValue.trim(), fromDate, ToDate: toDate,
  });
  ViewBag.GiveHelpList = mapRows(giveRows, GIVE_HELP);
  // [DBO].[Usp_ManualGetHelpList] @SearchField,@SearchValue,@fromDate,@ToDate
  ViewBag.GetHelpList = mapRows(await db.proc(DB, 'Usp_ManualGetHelpList', { SearchField, SearchValue, fromDate, ToDate: toDate }), GET_HELP);
  const TotalRecord = outIntOf(giveRows, 'message');
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, orderBy, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Manual_Get_Help/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string orderBy)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, v('SearchField'), v('SearchValue'), v('fromDate'), v('toDate'), v('orderBy'), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByUserName(int GetID, int Giveid, string BTC)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/GetDetailsByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GetID = reqInt(req.p.GetID, 'GetID');
  const Giveid = reqInt(req.p.Giveid, 'Giveid');
  // DBO.usp_ManualGiveRequestHelp @GetID,@Giveid,@BTC,@StrResult out  (the @RemainAmoutOut parameter object was created but never passed)
  const row = await db.procOne(DB, 'usp_ManualGiveRequestHelp', { GetID, Giveid, BTC: cvtDec(nStr(req.p.BTC)) });
  return res.json(outStr(row, 'strresult'));
}));

// ---------------------------------------------------------------- JsonResult BitcoinRate()
// auth (coordinator rule: no public admin routes except master data; legacy had no session check)
router.all(`/admin/${C}/BitcoinRate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const CurrencySymbol = config.app.CurrencySymbol;
  try {
    const UrlForHit = 'https://bitpay.com/api/rates/' + (CurrencySymbol === undefined || CurrencySymbol === null ? '' : CurrencySymbol);
    const r = await axios.get(UrlForHit, { responseType: 'text', transformResponse: (x) => x }); // WebClient.DownloadString
    const ObjATCRateManagement = JSON.parse(r.data); // JObject.Parse
    if (Array.isArray(ObjATCRateManagement) || ObjATCRateManagement === null || typeof ObjATCRateManagement !== 'object') {
      throw new Error('Error reading JObject from JsonReader. Current JsonReader item is not an object.');
    }
    if (ObjATCRateManagement.rate === undefined) throw nullRef();
    const abc = typeof ObjATCRateManagement.rate === 'object' ? JSON.stringify(ObjATCRateManagement.rate) : String(ObjATCRateManagement.rate);
    return res.json(abc);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'BitcoinRate');
    // PORT-NOTE: Json(ExpObj) serialised the Exception object; the main public properties are returned.
    return res.json({ ClassName: 'System.Exception', Message: ExpObj.message, StackTrace: ExpObj.stack || null, Source: null, InnerException: null });
  }
}));

module.exports = router;
