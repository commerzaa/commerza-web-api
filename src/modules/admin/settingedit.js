'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Settingedit.cs (class SettingeditController => /admin/Settingedit/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + internal function ; Updatesetting -> route.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Settingedit';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class Settingedit */
const PROPS = ['rowNumber', 'SID', 'CAPTION', 'LIMITS', 'ACTIVE'];

/** USP_SETTINGEDIT @StartRowIndex,@MaxRows,@SID,@LIMIT,@MODE,@ACTIVE,@TotalCount out */
const settingEdit = (p) => db.proc(DB, 'USP_SETTINGEDIT', p);

/** public void ExportReport() */
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Manage_Setting' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  // PORT-NOTE: @ACTIVE '' (int parameter) was converted to 0 by SQL Server; 0 is passed.
  const AllTransferList = mapRows(await settingEdit({ StartRowIndex: 1, MaxRows: 999999, SID: '0', LIMIT: '', MODE: 2, ACTIVE: 0 }), PROPS);
  if (AllTransferList.length > 0) {
    let srno = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Manage_Setting.xls', Filename,
      headers: ['S.No.', 'Caption', 'Limit', 'Active'],
      rows: AllTransferList, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(srno)) + ' \t');
        w(B.tab(B.cellStr(item, 'CAPTION')) + ' \t');
        w(B.tab(B.dec2(item.LIMITS)) + ' \t');
        w(B.tab(Number(item.ACTIVE) === 1 ? 'Active' : 'INACTIVE') + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/Settingedit" -> Settingedit/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Settingedit'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let page = B.nInt(req.p.page);
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging; // AppSettings["DynamicPagging"]
    dynamicpagging = B.cvtInt(value === undefined ? null : value); // Convert.ToInt16(string)
  }
  const perm = await B.inlinePerms(Employeeid, url); // inline USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelLink(url); // inline USP_EXCEL_LINK
  if (btnexel === null) btnexel = '';
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // PORT-NOTE: @ACTIVE '' (int parameter) was converted to 0 by SQL Server; 0 is passed.
  const rows = await settingEdit({ StartRowIndex: page, MaxRows, SID: '0', LIMIT: '', MODE: 2, ACTIVE: 0 });
  const AllTransferList = mapRows(rows, PROPS);
  const TotalRecord = B.outIntOf(rows, 'TotalCount'); // Convert.ToInt32(spOutput.Value)
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = 100;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Settingedit/Index.cshtml', Model: AllTransferList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult Updatesetting(int SID, string limit, string status)
// auth (PORT-NOTE: legacy had no session check on this admin settings update - protected here)
router.all(`/admin/${C}/Updatesetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SID = B.reqInt(req.p.SID, 'SID');
  const limit = B.nStr(req.p.limit);
  const status = B.nStr(req.p.status);
  const IntOutPutResult = '';
  // PORT-NOTE: @StartRowIndex '' / @MaxRows '' (int parameters) were converted to 0 by SQL Server; 0 is passed.
  // limit / status null => SqlParameter not supplied => exception (500), like legacy.
  B.need({ LIMIT: limit, ACTIVE: status });
  await settingEdit({ StartRowIndex: 0, MaxRows: 0, SID, LIMIT: limit, MODE: 1, ACTIVE: status });
  return res.json(IntOutPutResult);
}));

module.exports = router;
