'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Leadership_Income.cs (Leadership_IncomeController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Leadership_Income';
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBUSINESS', 'DISTRIBUTEBUSINESS', 'TOTALPOINT', 'PERPOINTVALUE', 'SELFPOINT',
  'TOTALINCOME', 'TDS', 'NETINCOME'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/Leadership-Income-report" -> Leadership_Income/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Leadership-Income-report'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, RoleMaster, fromDate, toDate } = req.p;
  let page = toInt(req.p.page);
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (RoleMaster == null) RoleMaster = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  let listLeaderShip = [];
  const ViewBag = {};
  const npe = () => new Error('Object reference not set to an instance of an object.');
  try {
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_leadership_income', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue.trim(), fromdate: fromDate, todate: toDate,
    });
    listLeaderShip = mapRows(rows, PROPS);
    // PORT-NOTE: OUT parameters (@TOTALCOUNT, @NETINCOME, @TOTALINCOME) are read from the columns of the first result row
    const first = rows.length ? rows[0] : {};
    const TotalRecord = parseInt(first.totalcount === null || first.totalcount === undefined || first.totalcount === '' ? '0' : String(first.totalcount), 10);
    // legacy naming kept: TotalAllIncome <- @NETINCOME out, TotalNetAllIncome <- @TOTALINCOME out
    if (first.netincome === null || first.netincome === undefined) throw npe();
    const TotalAllIncome = parseFloat(first.netincome);
    if (first.totalincome === null || first.totalincome === undefined) throw npe();
    const TotalNetAllIncome = parseFloat(first.totalincome);
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, TotalAllIncome, TotalNetAllIncome,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, ddlcustpage,
    });
  } catch (ExpObj) {
    // legacy swallowed the error after logging it and still returned the view with whatever list was loaded
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'insert_email_newsletter', 0, req.path); } catch (e) { console.error(e.message); }
  }
  res.json({ Model: listLeaderShip, ViewBag });
}));

module.exports = router;
