'use strict';
// Ported from Member\Controllers\CustomerPanel\DiamandReport.cs (1 action) - database: affiliate
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
// route-config: none (no friendly URL maps to DiamandReport in RouteConfig.cs)
router.all('/member/DiamandReport/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  let page = intOrNull(req.p.page);
  const Name = nz(req.p.Name); // bound but unused (SP receives '')
  let Side = intOrNull(req.p.Side); if (Side === null) Side = 0;
  const Level = nz(req.p.Level);
  const ActivationStatus = req.p.ActivationStatus === undefined || req.p.ActivationStatus === null ? '0' : String(req.p.ActivationStatus);
  const Plid = Number(req.user.plid);
  const mm = await db.queryOne(DB, 'select username from member_master where regno=@plid limit 1', { plid: Plid });
  const loginid = mm ? mm.username : '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const lvl = parseInt(Level === '' ? '0' : Level, 10);
  const act = parseInt(ActivationStatus, 10);
  if (Number.isNaN(lvl) || Number.isNaN(act)) throw new Error('Input string was not in a correct format.');
  const rows = await db.proc(DB, 'USP_NEW_Member_GET_MEMBER_DOWNLINELIST_SIDE_WISE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(), levenumber: lvl,
    side: Side, Name: '', Username: '', EmailID: '', SponserID: '', CheckAdminSide: 0, ActivationStatus: act, Userdownlinemember: '',
    orderbydate: '', FromLevel: 0, TOLevel: 0, Orderbylevel: 0, MAINSEARCH: '',
  });
  const Model = mapRows(rows, ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
    'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount',
    'SideName', 'TITLE', 'PackageAmt', 'STATENAME']);
  const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10);
  const totalBV = parseFloat(String(outv(rows, 'totalInvesment')));
  if (Number.isNaN(TotalRecord) || Number.isNaN(totalBV)) throw new Error('Input string was not in a correct format.');
  const ts = await db.scalar(DB, 'select status from TBL_SUBMENUROLE_MEMBERPANEL where sid=12 limit 1');
  const TreeStatus = Number(ts) === 1 ? 1 : 0;
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), fromDate: fromdate, toDate: todate,
    side: Side, SearchField, SearchValue, Level, ActivationStatus, totalBV, TreeStatus,
  });
  void Name;
}));

module.exports = router;
