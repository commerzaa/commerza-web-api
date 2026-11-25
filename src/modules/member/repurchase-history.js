'use strict';
// Ported from Member\Controllers\CustomerPanel\Repurchase_History.cs (1 action) - database: affiliate
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
// route-config: referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4Q -> Index
router.all(['/member/Repurchase_History/Index{/:id}', '/member/referral/G3pAMJ553_slash_EVT87l9cm75NKIzwKMUX4Q'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  let Username = nz(req.p.Username);
  let PaymentMode = req.p.PaymentMode === undefined || req.p.PaymentMode === null ? '0' : String(req.p.PaymentMode);
  // Request.QueryString.ToString() = raw query string
  let regno = req.originalUrl.indexOf('?') >= 0 ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : '';
  if (regno !== null && regno !== '') {
    regno = await UtilityClass.Decryptword(regno);
    if (regno !== null && regno !== '' && regno === String(req.user.plid)) {
      Username = req.user.username;
    }
  }
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_REPURCHASE_HISTORY', {
    PLID: Plid, StartRowIndex: page, MaxRows, SearchField: '', SearchValue: '', FROMDATE: fromdate.trim(), ToDate: todate.trim(),
    Username, PaymentMode,
  });
  const Model = mapRows(rows, ['TFLID', 'rownumber', 'PURCHASEDATE', 'USERNAME', 'ALLPACKAGENAME', 'TOTALPAIDINCURRENCY', 'MODENAME', 'REFNUM', 'STATUS',
    'REMARK', 'TotalPayableAmount', 'TASMID', 'IsOrderCanCancel', 'CoinRate', 'PAIDFROM']);
  const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10) || 0;
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, Username, PaymentMode, ddlcustpage,
  });
}));

module.exports = router;
