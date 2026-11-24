'use strict';
// Ported from Member\Controllers\CustomerPanel\Force_Matrics_Downline.cs (1 action) - database: affiliate
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
// route-config: referral/8FTN_plus_WYOT_slash_Udq91TGJMNm_slash_fzMy5u1tRa -> Index
router.all(['/member/Force_Matrics_Downline/Index{/:id}', '/member/referral/8FTN_plus_WYOT_slash_Udq91TGJMNm_slash_fzMy5u1tRa'], auth, asyncHandler(async (req, res) => {
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  const SearchValue = nz(req.p.SearchValue); const SearchField = nz(req.p.SearchField);
  const SponserID = nz(req.p.SponserID); const Name = nz(req.p.Name);
  const Level = nz(req.p.Level);
  const ActivationStatus = req.p.ActivationStatus === undefined || req.p.ActivationStatus === null ? '0' : String(req.p.ActivationStatus);
  let Side = intOrNull(req.p.Side); if (Side === null) Side = 0;
  let page = intOrNull(req.p.page);
  const Username = nz(req.p.Username); // bound but only echoed back (SP receives '')
  const Plid = Number(req.user.plid);
  const mm = await db.queryOne(DB, 'select username from member_master where regno=@plid limit 1', { plid: Plid });
  const loginid = mm ? mm.username : '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const lvl = parseInt(Level === '' ? '0' : Level, 10);
  const act = parseInt(ActivationStatus, 10);
  if (Number.isNaN(lvl) || Number.isNaN(act)) throw new Error('Input string was not in a correct format.');
  const rows = await db.proc(DB, 'USP_FORCEMATRIXONEBYONEDOWNLINE', {
    LoginID: loginid, StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate: fromdate.trim(), ToDate: todate.trim(),
    levenumber: lvl, side: Side, Name: Name.trim(), Username: '', EmailID: '', SponserID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: act,
  });
  const Model = mapRows(rows, ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
    'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount',
    'SideName', 'TITLE']);
  const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10);
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  res.json({
    Model, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate, toDate: todate, Name, Username, side: Side, SponserID, Level, ActivationStatus,
  });
}));

module.exports = router;
