'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Travel_Fund.cs (Travel_FundController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Travel_Fund';
const PROPS = ['ROWNUMBER', 'Date', 'TOTALBV', 'POINTS', 'NETINCOME'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/Travel-Fund" -> Travel_Fund/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/Travel-Fund'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let Month = toInt(req.p.Month);
  let page = toInt(req.p.page);
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (Month == null) Month = 0;
  let Travel_Fund = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // (legacy also looked up member_master LOGINID here but never used it)
    const MaxRows = await UtilityClass.GridPageSize();
    if (page == null) page = 1;
    // the trailing positional argument (0) of the legacy EXEC is the @TOTALNETCOMMISSION OUT parameter
    const rows = await proc(DB, 'usp_gen_travelfund', {
      plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), month: Month,
    });
    Travel_Fund = mapRows(rows, PROPS);
    // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 when there are no rows)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, Month, ddlcustpage,
    });
  } catch (ExpObj) {
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.path); } catch (e) { console.error(e.message); }
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  res.json({ Model: Travel_Fund, ViewBag });
}));

module.exports = router;
