'use strict';
// Ported from Member\Controllers\CustomerPanel\MyPointEarnings.cs (3 actions) - database: affiliate
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
// route-config: referral/my-earnings-points -> Index
router.all(['/member/MyPointEarnings/Index{/:id}', '/member/referral/my-earnings-points'], auth, asyncHandler(async (req, res) => {
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  let page = intOrNull(req.p.page);
  if (page === null) page = 1;
  const MaxRows = 50;
  const rows = await db.proc(DB, 'Usp_ActivityReportManager', {
    PLID: Number(req.user.plid), DATE: '', TEarnedByView: '0.00', TEarnedByShare: '0.00', TEarnedByBlog: '0.00', TEarnedByClassified: '0.00',
    TEarnedByBusinessListing: '0.00', TToatlEarned: '0.00', STARTROWINDEX: page, MAXROWS: MaxRows, MODE: '3', UserName: '',
  });
  const Model = mapRows(rows, ['SNO', 'DATE', 'EarnedByView', 'EarnedByShare', 'EarnedByBlog', 'EarnedByClassified', 'EarnedByBusinessListing', 'ToatlEarned']);
  const TotalRecord = parseInt(String(outv(rows, 'TOTALCOUNTPARAM')), 10);
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: MaxRows, SearchField, SearchValue, fromDate: fromdate, toDate: todate,
  });
}));

// auth
router.all('/member/MyPointEarnings/GetDataByDate{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'Usp_ActivityReportManager', {
    PLID: Number(req.user.plid), DATE: req.p.Date, TEarnedByView: '0.00', TEarnedByShare: '0.00', TEarnedByBlog: '0.00', TEarnedByClassified: '0.00',
    TEarnedByBusinessListing: '0.00', TToatlEarned: '0.00', STARTROWINDEX: '1', MAXROWS: '100', TOTALCOUNTPARAM: '0', MODE: req.p.Mode, UserName: '',
  });
  res.json(mapRows(rows, ['SNO', 'DATE', 'LinkOrTitle', 'EarnedPoints']));
}));

// auth
router.all('/member/MyPointEarnings/SubmitOrRequestPoints{/:id}', auth, asyncHandler(async (req, res) => {
  const Mode = req.p.Mode === undefined ? null : req.p.Mode; const Value = req.p.Value === undefined ? null : req.p.Value;
  let Result = '';
  if (Mode !== '0' && Value !== '') {
    // Convert.ToInt32(null) = 0, Convert.ToDecimal(null) = 0, invalid text => FormatException
    const m = Mode === null ? 0 : Number(String(Mode).trim());
    const v = Value === null ? 0 : Number(String(Value).trim());
    if (!Number.isInteger(m) || Number.isNaN(v) || (Value !== null && String(Value).trim() === '') || (Mode !== null && String(Mode).trim() === '')) {
      throw new Error('Input string was not in a correct format.');
    }
    const o = await db.procOne(DB, 'Usp_EarningsPointsManagement', { Mode: m, PLID: Number(req.user.plid), POINT: v, Date: '' });
    const k = o && Object.keys(o).find((x) => x.toLowerCase() === 'intoutputresult');
    Result = k && o[k] !== null ? String(o[k]) : '';
  } else {
    Result = 'Some Error in processing your request. Try Again!';
  }
  res.json(Result);
}));

module.exports = router;
