'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\HelpingSetting.cs (class Helping_SettingController, no namespace => /admin/Helping_Setting/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, reqInt, reqDec, col, str, tab, cellStr, nowStamp, excelHistory, writeXlsExport,
} = require('./_shared/batch08_common');
const { pagePerm, excelLinkRaw } = require('./_shared/batch08D2_common');
const { HELPING_SETTING_LIST_PROPS, netParseInt, netDecimalString } = require('./_shared/batch08A2_common');

const router = express.Router();
const C = 'Helping_Setting';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- public void ExportReport(string ConditionCode)
async function ExportReport(req, res, ConditionCode, ViewBag) {
  const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
  const Filename = 'Helping_Setting' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  // SqlParameter("@ConditionCode", null) is not sent => "expects the parameter ... which was not supplied"
  if (ConditionCode === null) throw new Error("The parameterized query expects the parameter '@ConditionCode', which was not supplied.");
  const rows = await db.proc(DB, 'USP_GetHelpingSetting', { ConditionCode }); // (not trimmed here, unlike Index)
  const Obj = mapRows(rows, HELPING_SETTING_LIST_PROPS);
  if (Obj.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Helping_Setting.xls', Filename, downloadName: ' Helping_Setting.xls', // "attachment; filename= Helping_Setting.xls"
      headers: ['S.No.', 'Condition', 'Condition Code', 'Condition Value'],
      rows: Obj,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT', // (sic) legacy PROCEDURENAME
      cells: (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'CONDITION')) + ' \t');
        w(tab(cellStr(item, 'CONDITIONCODE')) + ' \t');
        w(tab(netDecimalString(item.CONDITIONVALUE)) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string ConditionCode, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Helping-Setting" -> Helping_Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Helping-Setting'], adminAuth, asyncHandler(async (req, res) => {
  let ConditionCode = nStr(req.p.ConditionCode);
  let page = nInt(req.p.page);
  let btnexel = nStr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const p = await pagePerm(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (btnexel === null) btnexel = '';
  // USP_EXCEL_LINK @url,@ISACTIVE out ; Convert.ToInt32(v == "0" ? "0" : v)
  const ex = await excelLinkRaw(url);
  const isactive = netParseInt(ex === '0' ? '0' : ex);
  ViewBag.excelactive = isactive;
  let Obj = [];
  if (ConditionCode === null) ConditionCode = '';
  try {
    if (page === null) page = 1;
    Obj = mapRows(await db.proc(DB, 'USP_GetHelpingSetting', { ConditionCode: ConditionCode.trim() }), HELPING_SETTING_LIST_PROPS);
  } catch (Exp) {
    // Response.Redirect("/page-not-found") ends the request (ThreadAbortException).
    // PORT-NOTE: the ErrorInsert block after the redirect ("Usp_TransactionHistory") was therefore never reached in legacy; not executed.
    return res.json({ redirect: '/page-not-found' });
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ConditionCode, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/HelpingSetting/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string ConditionCode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.ConditionCode), {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public JsonResult UpdateStatus(int HSID, int Status)
// auth (PORT-NOTE: legacy had no session check; it changes a system setting => adminAuth)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const HSID = reqInt(req.p.HSID, 'HSID');
  const Status = reqInt(req.p.Status, 'Status');
  const row = await db.procOne(DB, 'USP_UpdateHelpingSetting', {
    HSID, Status, ConVal: 0.00, Mode: '1', EditBy: 0, IP: '',
  });
  const OutputResult = str(col(row, 'Output'));
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- public JsonResult AddConditionValue(int HSID, decimal ConVal)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddConditionValue{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const HSID = reqInt(req.p.HSID, 'HSID');
  const ConVal = reqDec(req.p.ConVal, 'ConVal');
  const host = req.hostname || '';
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') {
    IAddress = '67.225.214.45';
  } else {
    IAddress = await GetIP.GetLocalIP(req);
  }
  const empId = req.user.emp_id;
  const row = await db.procOne(DB, 'USP_UpdateHelpingSetting', {
    HSID, Status: 0, ConVal, Mode: '2', EditBy: empId, IP: IAddress,
  });
  const OutputResult = str(col(row, 'Output'));
  return res.json(OutputResult);
}));

module.exports = router;
