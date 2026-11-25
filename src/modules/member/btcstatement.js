'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/BTCSTATEMENT.cs  (BTCSTATEMENTController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/BTCSTATEMENT';
const PROPS = ['ROWNUMBER', 'FromGeneratedDateAndTimeDate', 'Amount', 'USERNAME', 'BtcAddress', 'Status', 'COINCODE', 'COINRATE', 'TXTID', 'STATUSURL', 'QRCODE', 'CONFIRMNEED', 'IsPaidtoEwallet'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index(string SearchField, string SearchValue, string fromdate, string todate, int? page, int? ddlcustpage)  [SessionExpireCheck]
// route-config: referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rfgdgdf4upfJtpcnNhZhGZ0LWE=
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/xN7ZZCwoYQ5rxh4YU0RZ8Hh3rfgdgdf4upfJtpcnNhZhGZ0LWE='], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  let AllFreeEpinList = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    let page = toInt(req.p.page);
    if (page === null) page = 1;
    const plid = Number(req.user.plid);
    // PORT-NOTE: @TOTALCOUNT / @TOTALAMOUNT OUT are read from the first result row (0 when no rows)
    const rows = await proc(DB, 'usp_btc_statement', {
      startrowindex: page, maxrows: MaxRows, fromdate, todate, searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(), plid: Math.trunc(plid),
    });
    AllFreeEpinList = mapRows(rows, PROPS);
    const tc = outv(rows[0], 'totalcount');
    const TotalRecord = parseInt(tc === null || tc === undefined || String(tc) === '' ? '0' : String(tc), 10) || 0;
    const ta = parseFloat(outv(rows[0], 'totalamount'));
    const TOTALAMOUNTS = Number.isNaN(ta) ? 0 : ta;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.TOTALAMOUNTS = TOTALAMOUNTS;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    await errInsert(req, 'USP_BTC_STATEMENT', Exp);
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ view: '~/Views/CustomerPanel/BTCSTATEMENT/Index.cshtml', Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
