'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Purchase_Coin_For_Hold_NewlistController.cs  (Purchase_Coin_For_Hold_NewlistController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Purchase_Coin_For_Hold_Newlist';
const PROPS = ['ROWNUMBER', 'PaymentMode', 'TotalPaidInYourCurrency', 'TotalCoinHold', 'ModeName', 'PurchaseDate', 'Maturitydate'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
async function errInsert(req, name, e) {
  try { const DataUtility = require('../../lib/member/DataUtility'); await new DataUtility().ErrorInsert(0, e && e.message, name, 0, req.path); } catch (_) { /* ErrorInsert must never throw */ }
}

// Index(int? page, string fromDate, string toDate)
// route-config: referral/Wi3n3r0P5aUrCPvp3Z0ohA==
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/Wi3n3r0P5aUrCPvp3Z0ohA=='], auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt(req.p.page);
  if (page === null) page = 1;
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  let Obj = [];
  const ViewBag = {};
  try {
    // PORT-NOTE: @INTRESULT OUT is read from the "intresult" column of the first result row (0 when no rows)
    const rows = await proc(DB, 'usp_purchase_coin_for_hold_new_list', {
      tachmid: '0', fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, plid: Plid,
    });
    Obj = mapRows(rows, PROPS);
    const tr = parseInt(outv(rows[0], 'intresult'), 10);
    const TotalRecord = Number.isNaN(tr) ? 0 : tr;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    await errInsert(req, 'USP_PURCHASE_COIN_FOR_HOLD_NEW_LIST', ExpObj);
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ view: '~/Views/CustomerPanel/Purchase_Coin_For_Hold_Newlist/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
