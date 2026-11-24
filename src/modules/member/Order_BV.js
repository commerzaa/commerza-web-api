'use strict';
// Ported from Member\Controllers\CustomerPanel\Order_BV.cs (Order_BVController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Order_BV';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameters are read from columns of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
const PROPS = ['ROWNUMBER', 'Date', 'TOTALBV', 'PRODUCTNAME'];

// route-config: referral/9ary549hSIg5GrgfzfTJgZzYWYRmdC1hdwnkAAS4217
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/9ary549hSIg5GrgfzfTJgZzYWYRmdC1hdwnkAAS4217'], ...guard, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  let ddlcustpage = req.p.ddlcustpage === undefined || req.p.ddlcustpage === null || req.p.ddlcustpage === '' ? null : parseInt(req.p.ddlcustpage, 10);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  let Order_BV = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // legacy also read Member_Master.LOGINID into an unused local - dropped
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'usp_gen_allpurchasebvmember', {
      PLID: Math.trunc(Plid), STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
      FROMDATE: fromdate.trim(), TODATE: todate.trim(), TOTALNETCOMMISSION: 0,
    });
    Order_BV = mapRows(rows, PROPS);
    const TotalRecord = numOut(rows, 'totalcount');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  res.json({ Model: Order_BV, ViewBag });
}));

module.exports = router;
