'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\House_Fund.cs (House_FundController) - 1 action: Index */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/House_Fund';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const need = (v) => { if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.'); return Number(v); };
const HOUSE_PROPS = ['ROWNUMBER', 'Date', 'TOTALBV', 'POINTS', 'NETINCOME'];

// route-config: referral/House-Fund
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// PORT-NOTE: OUT parameter @TotalCount of USP_GEN_HOUSEDFUNDINCOME is read from the "totalcount" column of the first result row.
// The legacy call passed a literal 0 positionally for the 9th parameter (@TOTALNETCOMMISSION), sent here by name.
router.all([`${P}/Index{/:id}`, '/member/referral/House-Fund'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let page = intOrNull(req.p.page);
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  let House_Fund = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    let loginid = '';
    const row = await queryOne(DB, 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
    if (row != null) loginid = row.loginid;
    void loginid;
    const MaxRows = await UtilityClass.GridPageSize();
    if (page == null) page = 1;
    const rows = await proc(DB, 'usp_gen_housedfundincome', {
      plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      fromdate: fromdate.trim(), todate: todate.trim(), totalnetcommission: 0,
    });
    House_Fund = mapRows(rows, HOUSE_PROPS);
    const TotalRecord = need(outv(rows, 'totalcount'));
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
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: House_Fund, ...ViewBag });
}));

module.exports = router;
