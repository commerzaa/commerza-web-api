'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LeadershipBonusDetails.cs (class LeadershipBonusDetailsController, no namespace => /LeadershipBonusDetails/...)
// Database: affiliate (Db_Affiliate). Proc: USP_EARNING_REPORT (MODE 5).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nInt, cvtInt, errorView } = require('./_shared/batch08_common');
const { outVal, REFERRAL_BONUS_DETAILS_PROPS } = require('./_shared/batch08D2_common');

const router = express.Router();
const C = 'LeadershipBonusDetails';

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/leadership-bonus-details" -> LeadershipBonusDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/leadership-bonus-details'], adminAuth, asyncHandler(async (req, res) => {
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
      StartRowIndex: page, MaxRows, FROMDATE: date, TODATE: '', MODE: 5,
    });
    const Obj = mapRows(rows, REFERRAL_BONUS_DETAILS_PROPS);
    const TotalRecord = cvtInt(outVal(rows, 'TOTALCOUNT') === '' ? 'x' : outVal(rows, 'TOTALCOUNT')); // Convert.ToInt32(DBNull.ToString()) => FormatException
    const ViewBag = {};
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    const tli = outVal(rows, 'TOTALLEVELINCOME');
    if (tli === '') throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
    ViewBag.TotalLeadershipBonus = Number(tli).toFixed(2);
    return res.json({ view: '~/Views/AdminPanel/LeadershipBonusDetails/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_EARNING_REPORT');
  }
}));

module.exports = router;
