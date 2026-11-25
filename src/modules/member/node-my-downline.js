'use strict';
// Ported from Member\Controllers\CustomerPanel\NodeMyDownline.cs (1 action) - database: affiliate
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
// route-config: referral/node-auto-purchase -> Index
router.all(['/member/NodeMyDownline/Index{/:id}', '/member/referral/node-auto-purchase'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage); let page = intOrNull(req.p.page);
  let Status = intOrNull(req.p.Status);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Status === null) Status = 0;
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const fromdate = nz(req.p.fromdate); const todate = nz(req.p.todate);
  let levelnumber = nz(req.p.levelnumber);
  const out = {};
  if (SearchField === '0') out.lable = '0';
  if (SearchField === '1') out.lable = '1';
  const Username = nz(req.p.Username); const Emailid = nz(req.p.Emailid); const SponserID = nz(req.p.SponserID);
  const LeftRight = req.p.LeftRight === undefined || req.p.LeftRight === null ? '0' : String(req.p.LeftRight);
  const ReferralType = 1; // legacy forces ReferralType = 1
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  levelnumber = '0';
  const rows = await db.proc(DB, 'USP_DIRECT_TREE_LIST', {
    LoginID: req.user.username, StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(),
    fromDate: fromdate.trim(), ToDate: todate.trim(), levenumber: levelnumber, Username: Username.trim(), EmailID: Emailid.trim(),
    SponserID: SponserID.trim(), ReferralType, STATUS: Status, SIDE: LeftRight,
  });
  const Model = mapRows(rows, ['rownumber', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'Status', 'paystatus', 'UserName',
    'ImageName', 'SpLoginId', 'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISDcode', 'COUNTRYNAME', 'TITLE',
    'KITPRICE', 'JoiningType', 'SIDE', 'STATENAME', 'CITYNAME', 'PackageAmt']);
  const TotalRecord = parseInt(String(outv(rows, 'TotalCount')), 10) || 0;
  res.json({
    Model, ...out, CurrentPage: page, LeftRight, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, Username, EmailID: Emailid, ReferralType, levelnumber, ddlcustpage,
  });
}));

module.exports = router;
