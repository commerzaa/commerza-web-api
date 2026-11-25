'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/all_members.cs (all_membersController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc, query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const MEMBER_PROPS = ['ROWNUMBER', 'REFRAL_ID', 'LOGINID', 'USERNAME', 'PHONE', 'PLID', 'DOC', 'ACCOUNTTYPE', 'COUNTRY', 'JOINEDVIA', 'STATUS', 'IPADDRESS',
  'ENGAGEDIN', 'ENGTOOLTIP', 'FULLNAME', 'Emailid', 'DID', 'Reference_Username', 'CustomerWallet', 'MLMWallet'];
const QUALIFICATION_PROPS = ['NAME', 'QID'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
/** int? binding => null when missing/invalid */
const optInt = (v) => { const n = parseInt(v, 10); return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n; };
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/all-members
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/all_members/Index{/:id}', '/franchise/franchisee/all-members'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ORDERBY = nn(p.ORDERBY);
  let GENDER = optInt(p.GENDER); if (GENDER === null) GENDER = 0;
  let QUALIFICATION = optInt(p.QUALIFICATION); if (QUALIFICATION === null) QUALIFICATION = 0;
  let userid = optInt(p.userid); if (userid === null) userid = 0;
  let Isdownload = optInt(p.Isdownload); if (Isdownload === null) Isdownload = 0;
  const MOBILE = nn(p.MOBILE);
  const SearchField = nn(p.SearchField);
  const EGGAGETYPES = nn(p.EGGAGETYPES);
  const USERTYPE = nn(p.USERTYPE);
  const ACCNTTYPE = nn(p.ACCNTTYPE);
  const SearchValue = nn(p.SearchValue);
  const fromDate = nn(p.fromDate);
  const toDate = nn(p.toDate);
  let asc = p.asc; if (asc === undefined || asc === null) asc = '0'; // (not used further, legacy passes false)
  let mode = optInt(p.mode); if (mode === null) mode = 0;
  const orderByField = nn(p.orderByField);
  const CID = nn(p.CID);
  let page = optInt(p.page);

  const DID = Number(req.user.did);
  const ViewBag = { DID: String(DID) };
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @RECORDCOUNT OUT is read from the first result row (column "recordcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_resselerlogindetails', {
    startrowindex: page, maxrows: MaxRows, orderbyfield: orderByField, asc: false, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: fromDate, todate: toDate, mode, cid: CID, accnttype: ACCNTTYPE, usertype: USERTYPE, eggagetypes: EGGAGETYPES, orderby: ORDERBY,
    mobile: MOBILE, isdownload: Isdownload, userid, qualification: QUALIFICATION, gender: GENDER, did: DID,
  });
  const AllEPinRequestsList = mapRows(rows, MEMBER_PROPS);
  const TotalRecord = totalOf(rows, 'recordcount');
  const QUALIFICATIONlist = mapRows(await query(DB, 'select qid, name from tblqualification where status = 1'), QUALIFICATION_PROPS);
  ViewBag.QUALIFICATIONlis = QUALIFICATIONlist;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchValue = SearchValue;
  ViewBag.SearchField = SearchField;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.MOBILE = MOBILE;
  return res.json({ view: '~/Views/all_members/Index.cshtml', Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
