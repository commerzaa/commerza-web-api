'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ReferralBonusDetails.cs (class ReferralBonusDetailsController => /admin/ReferralBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc: USP_EARNING_REPORT (MODE 2). Model: Ewallet_list (Ewallet_Report.cs).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, errorView, cvtIntStrict } = require('./_shared/batch12-common');
const { EWALLET_LIST_PROPS, rowsOut } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'ReferralBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/referral-bonus-details" -> ReferralBonusDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/referral-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  let page = nInt(req.p.page);
  let date = '';
  const myquery = req.query ? req.query.myquery : undefined; // Request.QueryString["myquery"]
  if (myquery !== undefined && myquery !== null) {
    date = String(Array.isArray(myquery) ? myquery.join(',') : myquery);
    if (date.trim() !== '') {
      date = await UtilityClass.Decryptword(date);
    }
  } else {
    // Response.Redirect("/AdminPanel/earning-statements") (endResponse = true => the request ends here)
    return res.json({ redirect: '/AdminPanel/earning-statements' });
  }
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    // [USP_EARNING_REPORT] @StartRowIndex,@MaxRows,@FROMDATE,@TODATE,@TOTALDIRECTINCOME out,@TOTALMATCHINGINCOME out,@TOTALADVERTSPOINTS out,
    //   @TOTALREPURCHASE out,@TOTALPAYBLEAMT out,@TOTALCOUNT out,@MODE,@TOTALLEVELINCOME out,@TOTALTASKLEVELINCOME out,@TotalGrowthDirectIncome out
    const rows = await db.proc(DB, 'USP_EARNING_REPORT', {
      StartRowIndex: page, MaxRows, FROMDATE: date, TODATE: '', MODE: 2,
    });
    const Obj = mapRows(rows, EWALLET_LIST_PROPS);
    // PORT-NOTE: with no rows PG cannot return the OUT values => TotalRecord 0 / TotalReferralBonus "0.00".
    const tc = rowsOut(rows, 'TOTALCOUNT');
    const TotalRecord = tc === null ? 0 : cvtIntStrict(tc); // Convert.ToInt32(param[9].Value.ToString()) (DBNull => FormatException)
    const ViewBag = {};
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    const tdi = rowsOut(rows, 'TOTALDIRECTINCOME'); // param[4]
    if (tdi === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
    ViewBag.TotalReferralBonus = Number(tdi === null ? 0 : tdi).toFixed(2);
    return res.json({ view: '~/Views/AdminPanel/ReferralBonusDetails/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_EARNING_REPORT');
  }
}));

module.exports = router;
