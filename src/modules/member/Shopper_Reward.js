'use strict';
// Ported from Member\Controllers\CustomerPanel\Shopper_Reward.cs (1 action) - database: affiliate
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}

// auth
// route-config: referral/Shopper-Reward-income-report -> Index
router.all(['/member/Shopper_Reward/Index{/:id}', '/member/referral/Shopper-Reward-income-report'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const fromDate = nz(req.p.fromDate); const toDate = nz(req.p.toDate);
  // RoleMaster parameter is bound but never used by the legacy action
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let Model = [];
  const out = {};
  try {
    const Plid = Number(req.user.plid);
    const rows = await db.proc(DB, 'USP_SHOPPERREWARD_INCOME', {
      REGNO: Plid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate, TODATE: toDate,
    });
    Model = mapRows(rows, ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'MONTHBV', 'NETINCOME']);
    const TotalRecord = parseInt(String(outv(rows, 'TOTALCOUNT')), 10);
    const TotalAllIncome = parseFloat(String(outv(rows, 'NETINCOME')));
    if (Number.isNaN(TotalRecord) || Number.isNaN(TotalAllIncome)) throw new Error('Input string was not in a correct format.');
    Object.assign(out, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, TotalAllIncome, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate, toDate, ddlcustpage,
    });
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'insert_email_newsletter', req);
  }
  res.json({ Model, ...out });
}));

module.exports = router;
