'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Royality_Reward_Eligibility_Admin.cs (class Royality_Reward_Eligibility_AdminController,
// no namespace => /admin/Royality_Reward_Eligibility_Admin/...). Database: affiliate (Db_Affiliate). Proc Usp_RoyalityStatusReport_Admin (@Mode 1).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { nInt, nStr, cellStr, tab, dec2, errorView } = require('./_shared/batch06-common');
const { nullableDateStr, writeXlsFile } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Royality_Reward_Eligibility_Admin';

/** public class Royality_Reward_Eligibility_list */
const ROYALITY_REWARD_ELIGIBILITY_PROPS = ['RowNumber', 'Level', 'TotalDownlineActiveMember', 'RequiredDownlineActiveMember', 'EligibilityStatus',
  'TotalBusiness', 'QualifyDate', 'RoyalityDescription'];

/** [Usp_RoyalityStatusReport_Admin] @username,@Mode */
async function statusReport(userName) {
  return mapRows(await db.proc(DB, 'Usp_RoyalityStatusReport_Admin', { username: userName, Mode: 1 }), ROYALITY_REWARD_ELIGIBILITY_PROPS);
}

/** public void ExportReport(string userName, int? page) - writes ~/AllExcelSheets/Royality_Reward_Eligibility_Report.xls, never sends it
 *  (the legacy Response.Redirect is commented out). */
async function ExportReport(req, userName, page, ViewBag) {
  if (userName === null) userName = '';
  if (page === null) page = 1;
  const list = await statusReport(userName);
  await writeXlsFile({
    req, relPath: 'AllExcelSheets/Royality_Reward_Eligibility_Report.xls', ViewBag, rows: list,
    headers: ['S.No.', 'Level', 'Your Active Member', 'Required Active Member', 'Eligibility Status', 'Total Business', 'Qualify Date', 'Royalty'],
    innerProc: 'Royality_Reward_Eligibility_list', outerProc: 'ExportReport',
    cells: (item, w) => {
      w('\n');
      w(tab(cellStr(item, 'RowNumber')) + ' \t');
      w(tab(cellStr(item, 'Level')) + ' \t');
      w(tab(cellStr(item, 'TotalDownlineActiveMember')) + ' \t');
      w(tab(cellStr(item, 'RequiredDownlineActiveMember')) + ' \t');
      w(tab(cellStr(item, 'EligibilityStatus')) + ' \t');
      w(tab(dec2(item.TotalBusiness)) + ' \t');
      w(tab(nullableDateStr(item.QualifyDate)) + ' \t'); // Nullable<DateTime>.ToString(): null => ""
      w(tab(cellStr(item, 'RoyalityDescription')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- ActionResult Index(string userName, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Royality-Reward-Eligibility-Report" -> Royality_Reward_Eligibility_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Royality-Reward-Eligibility-Report'], adminAuth, asyncHandler(async (req, res) => {
  let userName = nStr(req.p.userName);
  let page = nInt(req.p.page);
  if (userName === null) userName = '';
  const ViewBag = {};
  try {
    if (page === null) page = 1;
    const RoyalityRewardEligibilitylist = await statusReport(userName);
    ViewBag.CurrentPage = 0;
    ViewBag.GridPageSize = 0;
    ViewBag.TotalRecord = 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = 0;
    ViewBag.SearchValue = 0;
    ViewBag.userName = '';
    await ExportReport(req, userName, page, ViewBag);
    return res.json({ view: '~/Views/AdminPanel/Royality_Reward_Eligibility_Admin/Index.cshtml', Model: RoyalityRewardEligibilitylist, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'Usp_RoyalityStatusReport_Admin');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string userName, int? page)
// auth (PORT-NOTE: public method => routable in legacy; no session check; admin data => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, nStr(req.p.userName), nInt(req.p.page), {});
  res.send(''); // void action => empty response
}));

module.exports = router;
