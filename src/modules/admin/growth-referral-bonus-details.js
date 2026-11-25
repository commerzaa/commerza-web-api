'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GrowthReferralBonusDetails.cs (class GrowthReferralBonusDetailsController => /admin/GrowthReferralBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc: USP_EARNING_REPORT (MODE 7).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, cvtInt, errorView } = require('./_shared/batch08-common');
const { outVal, REFERRAL_BONUS_DETAILS_PROPS } = require('./_shared/batch08-d2-common');

const router = express.Router();
const C = 'GrowthReferralBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/growth-referral-bonus-details" -> GrowthReferralBonusDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/growth-referral-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
  let page = nInt(req.p.page);
  let date = '';
  const myquery = req.query ? req.query.myquery : undefined; // Request.QueryString["myquery"]
  if (myquery !== undefined && myquery !== null) {
    date = String(Array.isArray(myquery) ? myquery.join(',') : myquery);
    if (date.trim() !== '') {
      date = await UtilityClass.Decryptword(date);
    }
  } else {
    // Response.Redirect("/AdminPanel/earning-statements") (ends the request)
    return res.json({ redirect: '/AdminPanel/earning-statements' });
  }
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_EARNING_REPORT', {
      StartRowIndex: page, MaxRows, FROMDATE: date, TODATE: '', MODE: 7,
    });
    const Obj = mapRows(rows, REFERRAL_BONUS_DETAILS_PROPS);
    const tc = outVal(rows, 'TOTALCOUNT');
    const TotalRecord = cvtInt(tc === '' ? 'x' : tc); // Convert.ToInt32(DBNull.ToString()) => FormatException
    const ViewBag = {};
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    const tg = outVal(rows, 'TotalGrowthDirectIncome');
    if (tg === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
    ViewBag.TotalGrowthDirectIncome = Number(tg).toFixed(2);
    return res.json({ view: '~/Views/AdminPanel/GrowthReferralBonusDetails/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_EARNING_REPORT');
  }
}));

module.exports = router;
