'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\WebSiteCoinRate.cs (class WebSiteCoinRateController => /admin/WebSiteCoinRate/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'WebSiteCoinRate';

/** class WebSiteCoinRate */
const COINRATE_PROPS = ['Row', 'TAIRM', 'INR', 'Emp_Name', 'ActivityReport', 'Status'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

/** Select INR From Tbl_WebSite_Atc_INR_Ratio_Master where Status=1 (SqlQuery<decimal>.FirstOrDefault(): no row => 0) */
async function coinRate() {
  const rows = await db.query(DB, 'select inr from tbl_website_atc_inr_ratio_master where status = 1 limit 1', {});
  if (!rows[0]) return 0;
  const v = rows[0].inr;
  if (v === null || v === undefined) throw new Error('The cast to value type \'System.Decimal\' failed because the materialized value is null.');
  return Number(v);
}
/** [Usp_CoinRateWebSite] @Mode = "2" */
const coinRateList = async () => mapRows(await db.proc(DB, 'Usp_CoinRateWebSite', { Mode: '2' }), COINRATE_PROPS);

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Web_Site_Coin_Rate_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  ViewBag.COINRATE = await coinRate();
  const coinrate = await coinRateList();
  if (coinrate.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Web_Site_Coin_Rate.xls', Filename,
      headers: ['s.No.', 'INR', 'Updated By', 'updated Report'],
      rows: coinrate, innerProc: null, outerProc: null, // bare `catch { wr.Close(); }` / `catch (Exception ex) { ViewBag.filepath = ex.Message; }`
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'Row')) + ' \t');
        w(B.tab(B.dec2(item.INR)) + ' \t');
        w(B.tab(B.cellStr(item, 'Emp_Name')) + ' \t');
        w(B.tab(B.cellStr(item, 'ActivityReport')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Web-Site-CoinRate" -> WebSiteCoinRate/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Web-Site-CoinRate'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = B.nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  try {
    const Employeeid = req.user.emp_id;
    if (btnexel === null) btnexel = '';
    const ip = await B.inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
    ViewBag.isactive = ip.isactive;
    ViewBag.isedit = ip.isedit;
    ViewBag.COINRATE = await coinRate();
    const coinrate = await coinRateList();
    // USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "" ? "0" : v)
    const el = B.outStr(await db.procOne(DB, 'USP_EXCEL_LINK', { url }), 'isactive');
    ViewBag.excelactive = B.cvtIntStrict(el === '' ? '0' : el);
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/WebSiteCoinRate/Index.cshtml', Model: coinrate, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ view: '~/Views/AdminPanel/WebSiteCoinRate/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult UpdateATCRateAndWithdrawalSettings(string ATCRate, string ATCRates)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateATCRateAndWithdrawalSettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const userid = req.user.emp_id;
  // [Usp_CoinRateWebSite] @ATCRate,@ATCRates,@UserId,@Mode,@IntResult OUT (strings converted to decimal by the server, errors => 500)
  const row = await db.procOne(DB, 'Usp_CoinRateWebSite', {
    ATCRate: B.nStr(req.p.ATCRate), ATCRates: B.nStr(req.p.ATCRates), UserId: userid, Mode: '1',
  });
  const OutPutMessage = B.outStr(row, 'intresult');
  return res.json(OutPutMessage);
}));

module.exports = router;
