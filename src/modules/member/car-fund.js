'use strict';
/** Port of Member/Controllers/CustomerPanel/Car_Fund.cs (Car_FundController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'Date', 'TOTALBV', 'POINTS', 'NETINCOME'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const totalOf = (rows, name) => { const n = parseInt(outCol(rows, name), 10); return Number.isNaN(n) ? 0 : n; };

// route-config: referral/Car-Fund -> Index
// auth
router.all(['/member/Car_Fund/Index{/:id}', '/member/referral/Car-Fund'], auth, asyncHandler(async (req, res) => {
  let Month = optInt(req.p.Month);
  let SearchField = req.p.SearchField;
  let SearchValue = req.p.SearchValue;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';

  let Car_Fund = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // (legacy looked up Member_Master.LOGINID into an unused local; not needed)
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    if (Month === null) Month = 0;
    // PORT-NOTE: @TotalCount / @TotalNetCommission OUT params are returned as columns of the result row.
    const rows = await proc(DB, 'usp_gen_cardfundincome', {
      plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(), month: Month,
    });
    Car_Fund = mapRows(rows, PROPS);
    const TotalRecord = parseInt(outCol(rows, 'totalcount'), 10);
    ViewBag.CurrentPage = page;
    ViewBag.Month = Month;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = Number.isNaN(TotalRecord) ? 0 : TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_GETEWALLET_REWARDS', 0, req.originalUrl.split('?')[0]);
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found")
  }
  return res.json({ view: '~/Views/CustomerPanel/Car_Fund/Index.cshtml', Model: Car_Fund, ViewBag });
}));

module.exports = router;
