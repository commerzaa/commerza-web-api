'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Shopper_RewardController.cs (class Shopper_RewardController => /admin/Shopper_Reward/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'Shopper_Reward';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class GetShopperReward */
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'MONTHBV', 'NETINCOME'];

/** [USP_SHOPPERREWARD_INCOME] @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@NETINCOME OUT */
function shopperReward(p) {
  B.need(p);
  return db.proc(DB, 'USP_SHOPPERREWARD_INCOME', p);
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage) {
  const userid = req.user.emp_id;
  const Filename = ' ShopperRewardIncome' + userid + '_' + B.nowStamp(); // (leading space kept)
  await B.excelHistory(userid, url, Filename);
  const MaxRows = ddlcustpage === null ? 0 : Number(ddlcustpage); void MaxRows; // computed, unused (legacy)
  if (Page === null) Page = 1;
  const list = mapRows(await shopperReward({
    REGNO: '0', STARTROWINDEX: Page, MAXROWS: 9999999, SEARCHFIELD: SearchField, SEARCHVALUE: B.trimS(SearchValue), FROMDATE: fromDate,
    TODATE: toDate,
  }), PROPS);
  if (list.length > 0) {
    // PORT-NOTE: legacy set content-disposition "UpgradeLevelIncome.xls" but redirected to ~/AllExcelSheets/ShopperReward_IncomeReport.xls,
    // so the browser saved the redirect target's name; that name is used.
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'ShopperReward_IncomeReport.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Date', 'MonthBV', 'Achive'],
      rows: list, innerProc: 'GetReferalIncome', outerProc: 'USP_DIRECTINCOME_REPORT',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILENO')) + ' \t');
        w(B.tab(B.netFormat(item.DATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.dec2(item.MONTHBV)) + ' \t');
        w(B.tab(B.dec2(item.NETINCOME)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? Dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? Page, int? ddlcustpage, string BtnExcel)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/Shopper-Reward-income-report" -> Shopper_Reward/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Shopper-Reward-income-report'], adminAuth, asyncHandler(async (req, res) => {
  let Dynamicpagging = B.nInt(req.p.Dynamicpagging);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Page = B.nInt(req.p.Page);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let BtnExcel = B.nStr(req.p.BtnExcel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Dynamicpagging === null) Dynamicpagging = 100;
  if (BtnExcel === null) BtnExcel = '';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  try {
    const MaxRows = Number(Dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await shopperReward({
      REGNO: '0', STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate,
      TODATE: toDate,
    });
    const listShopperRe = mapRows(rows, PROPS);
    const tc = B.outOf(rows, 'TOTALCOUNT');
    const TotalRecord = B.cvtIntStrict(tc === '' ? '0' : tc); // int.Parse(v == "" ? "0" : v)
    const TotalAllIncome = B.outDecOf(rows, 'NETINCOME'); // decimal.Parse(TotalIncome.Value.ToString())
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.Dynamicpagging = Dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TotalAllIncome = TotalAllIncome;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
    if (BtnExcel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, Page, ddlcustpage);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Shopper_Reward/Index.cshtml', Model: listShopperRe, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_DIRECTINCOME_REPORT');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, v('SearchField'), v('SearchValue'), v('fromDate'), v('toDate'), B.nInt(req.p.Page), B.nInt(req.p.ddlcustpage));
  if (!r.sent) res.send('');
}));

module.exports = router;
