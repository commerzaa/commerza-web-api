'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/unverified_members.cs (unverified_membersController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const UNVERIFIED_PROPS = ['ROWNUMBER', 'REFRAL_ID', 'LOGINID', 'USERNAME', 'PLID', 'DOC', 'ACCOUNTTYPE', 'COUNTRY', 'JOINEDVIA', 'MOBILE', 'IPADDRESS',
  'ENGAGEDIN', 'ENGTOOLTIP', 'FULLNAME', 'PASSWORD', 'Email'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { const n = parseInt(v, 10); return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n; };
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/unverified-members
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/unverified_members/Index{/:id}', '/franchise/franchisee/unverified-members'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ORDERBY = nn(p.ORDERBY);
  let QUALIFICATION = optInt(p.QUALIFICATION); if (QUALIFICATION === null) QUALIFICATION = 0;
  let userid = optInt(p.userid); if (userid === null) userid = 0;
  let Isdownload = optInt(p.Isdownload); if (Isdownload === null) Isdownload = 0;
  const MOBILE = nn(p.MOBILE);
  const SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const fromDate = nn(p.fromDate);
  const toDate = nn(p.toDate);
  let mode = optInt(p.mode); if (mode === null) mode = 0;
  const orderByField = nn(p.orderByField);
  const CID = nn(p.CID);
  let page = optInt(p.page);

  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @RECORDCOUNT OUT is read from the first result row (column "recordcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_register_reseller_new', {
    startrowindex: page, maxrows: MaxRows, orderbyfield: orderByField, asc: false, searchfield: SearchField, searchvalue: SearchValue,
    cid: CID, fromdate: fromDate, todate: toDate, mode, mobile: MOBILE, orderby: ORDERBY, did: DID,
  });
  const AllEPinRequestsList = mapRows(rows, UNVERIFIED_PROPS);
  const TotalRecord = totalOf(rows, 'recordcount');
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate, QUALIFICATION, userid, ORDERBY, Isdownload,
  };
  return res.json({ view: '~/Views/unverified_members/Index.cshtml', Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
