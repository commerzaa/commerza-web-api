'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Royalty_Reward.cs (class Common.Controllers.AdminPanel.Royalty_RewardController
// => /admin/Royalty_Reward/...). Database: affiliate (Db_Affiliate). Procs USP_ROYALTYREWARD_REPORT, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  nInt, nStr, perms, nowStamp, netFormat, excelHistory, writeXlsExport, cellStr, tab, dec2, errorView, trimNull, mapPath,
} = require('./_shared/batch06-common');
const { outIntOf } = require('./_shared/batch11-common');
const { decOutOf } = require('./_shared/batch13-05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Royalty_Reward';

/** public class GetRoyalty_Reward */
const GET_ROYALTY_REWARD_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS',
  'NETINCOME'];

// PORT-NOTE: `private static string Url, Url1` - static fields shared by all requests (ExportReport uses the Url of the last Index call).
let Url = '';
let Url1 = '';

/** [USP_ROYALTYREWARD_REPORT] @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@NETINCOME OUT,
 *  @TOTALTDS OUT,@TOTALINCOME OUT  (@SEARCHFIELD is NOT trimmed, @SEARCHVALUE is) */
async function royaltyReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate) {
  return db.proc(DB, 'USP_ROYALTYREWARD_REPORT', {
    REGNO: '0', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: trimNull(SearchValue), FROMDATE: fromDate, TODATE: toDate,
  });
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage) */
async function ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'RoyaltyRewardReport' + userid + '_' + nowStamp();
  await excelHistory(userid, Url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); // Convert.ToInt32(int?) (null => 0)
  if (Page === null) Page = 1;
  const list = mapRows(await royaltyReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate), GET_ROYALTY_REWARD_PROPS);
  if (list.length > 0) {
    const vb = {};
    const x = await writeXlsExport({
      req, res, sheet: 'RoyaltyReward_IncomeReport.xls', Filename, ViewBag: vb, rows: list,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Date', 'Total BV', 'Distribute BV', 'Total Member', 'Total Income', 'TDS', 'Net Income'],
      innerProc: 'GetReferalIncome', outerProc: 'GetReferalIncome',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILENO')) + ' \t');
        w(tab(netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(dec2(item.TOTALBV)) + ' \t');
        w(tab(dec2(item.DISTRIBUTEBV)) + ' \t');
        w(tab(cellStr(item, 'TOTALMEMBER')) + ' \t');
        w(tab(dec2(item.TOTALINCOME)) + ' \t');
        w(tab(dec2(item.TDS)) + ' \t');
        w(tab(dec2(item.NETINCOME)) + ' \t');
      },
    });
    // The legacy outer catch did NOT overwrite ViewBag.filepath with the error message: keep the file path.
    if (vb.filepath !== undefined) ViewBag.filepath = mapPath('AllExcelSheets/RoyaltyReward_IncomeReport.xls');
    return x;
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? Dynamicpagging, string SearchField, string SearchValue,
//   string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Royalty-Reward-income-report" -> Royalty_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Royalty-Reward-income-report{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let Dynamicpagging = nInt(req.p.Dynamicpagging);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let Page = nInt(req.p.Page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let BtnExcel = nStr(req.p.BtnExcel);
  Url1 = legacyUrl(req).slice(1);
  Url = '~' + Url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Dynamicpagging === null) Dynamicpagging = 100;
  if (BtnExcel === null) BtnExcel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const p = await perms(Empid, Url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  try {
    const MaxRows = Number(Dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await royaltyReport(Page, MaxRows, SearchField, SearchValue, fromDate, toDate);
    const listRoyalty_Reward = mapRows(rows, GET_ROYALTY_REWARD_PROPS);
    const TotalRecord = outIntOf(rows, 'TOTALCOUNT');
    const TotalAllIncome = decOutOf(rows, 'TOTALINCOME');
    const TotalNetAllIncome = decOutOf(rows, 'NETINCOME');
    const TotalSumTds = decOutOf(rows, 'TOTALTDS');
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.Dynamicpagging = Dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalAllIncome = TotalAllIncome;
    ViewBag.TotalSumTds = TotalSumTds;
    ViewBag.TotalNetAllIncome = TotalNetAllIncome;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (BtnExcel === 'Export Excel') {
      const x = await ExportReport(req, res, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Royalty_Reward/Index.cshtml', Model: listRoyalty_Reward, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nStr(req.p.fromDate), nStr(req.p.toDate),
    nInt(req.p.Page), nInt(req.p.ddlcustpage), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
