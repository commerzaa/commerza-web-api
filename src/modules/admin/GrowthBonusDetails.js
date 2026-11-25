'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GrowthBonusDetails.cs (class GrowthBonusDetailsController, no namespace => /GrowthBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc: USP_EARNING_REPORT (MODE 3).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nInt, cvtInt } = require('./_shared/batch08_common');
const { outVal, REFERRAL_BONUS_DETAILS_PROPS } = require('./_shared/batch08D2_common');

const router = express.Router();
const C = 'GrowthBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/growth-bonus-details" -> GrowthBonusDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/growth-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
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
  // (no try/catch in the legacy action: exceptions => 500)
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_EARNING_REPORT', {
    StartRowIndex: page, MaxRows, FROMDATE: date, TODATE: '', MODE: 3,
  });
  const Obj = mapRows(rows, REFERRAL_BONUS_DETAILS_PROPS);
  const tc = outVal(rows, 'TOTALCOUNT');
  const TotalRecord = cvtInt(tc === '' ? 'x' : tc); // Convert.ToInt32(DBNull.ToString()) => FormatException
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  const tmi = outVal(rows, 'TOTALMATCHINGINCOME'); // param[5]
  if (tmi === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
  ViewBag.TotalGrowthBonus = Number(tmi).toFixed(2);
  return res.json({ view: '~/Views/AdminPanel/GrowthBonusDetails/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
