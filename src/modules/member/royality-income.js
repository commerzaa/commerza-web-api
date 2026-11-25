'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Royality_Income.cs (Royality_IncomeController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Royality_Income';
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const ROYALITY_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'DATE', 'TOTALINCOME', 'ADMINCHARGE', 'TDS', 'NETINCOME', 'TOTALBUSSINESS', 'TOTALACHIVER', 'TransactionType'];

// route-config: referral/1X_slash_c_plus_UA1SFKc2FmEZnQtYQRR==
// auth ([SessionExpireCheck])
// PORT-NOTE: the OUT parameters @TOTALCOUNT / @TOTALAMOUNT are not used by the legacy action (TotalRecord is hard-coded 0), so they are not read.
router.all([`${P}/Index{/:id}`, '/member/referral/1X_slash_c_plus_UA1SFKc2FmEZnQtYQRR=='], auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  let page = intOrNull(req.p.page);
  let { fromDate, toDate } = req.p;
  if (page == null) page = 1;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let Obj = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_royalityincome', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfiel: '', searchvalue: '', incometype: 1,
    });
    Obj = mapRows(rows, ROYALITY_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    const TotalRecord = 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_RoyalityHistory', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
