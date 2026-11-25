'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Coupon_History.cs
// (namespace Common.Controllers.AdminPanel, class Coupon_HistoryController => /admin/Coupon_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch05_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Coupon_History';

/** class Coupon_History */
const CH_PROPS = ['ROWNUMBER', 'COUPONNO', 'TRANSFERED', 'CREATEDDATE', 'TRANSFERDATE', 'TRANSFERTO', 'SUBSCRIPTIONHEADING', 'PRICE', 'TRANSFERFROM'];

// ---------------------------------------------------------------- ActionResult Index(int? page, string fromDate, string toDate, string CrDrType, string TrType, string username, int? ddlcustpage)
// auth (admin report; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Coupon-History" -> Coupon_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Coupon-History'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.nInt(req.p.page);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let CrDrType = B.nStr(req.p.CrDrType);
  let TrType = B.nStr(req.p.TrType);
  let username = B.nStr(req.p.username);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (username === null) username = '';
  let Obj = [];
  const ViewBag = {};
  try {
    const MaxRows = Number(ddlcustpage);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_ADMINCOUPONLIST', {
      STARTROWINDEX: Number(page), MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: fromDate, TODATE: toDate,
      KID: Number(page), orderbydate: 'desc', Status: '',
    });
    Obj = mapRows(rows, CH_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    // PORT-NOTE: @TotalCount OUT read from the result row column "totalcount" (no row => 0).
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found") (ends the response)
  }
  return res.json({ view: '~/Views/AdminPanel/Coupon_History/Index.cshtml', Model: Obj, ...ViewBag });
}));

module.exports = router;
