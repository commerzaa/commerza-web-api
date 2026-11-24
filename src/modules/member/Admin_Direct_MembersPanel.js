'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Admin_Direct_MembersPanel.cs (Admin_Direct_MembersPanelController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DAL_Dashboard = require('../../lib/member/DAL_Dashboard');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['rowNumbernew', 'ROWNUMBER', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'UserName', 'ImageName', 'SpLoginId',
  'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISCcode', 'Pending_Amount', 'Process_Amount', 'Reject_Amount', 'Total_GH',
  'GHPAmount', 'GHTAmount', 'GHCAmount', 'GHRAmount', 'STATUS'];
const HELP_PROPS = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date', 'Expire_Date', 'BTC_Address', 'InvestID',
  'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status', 'RemainTime', 'pending'];
const MEMBER_PROPS = ['REGNO', 'LOGINID', 'RANKID', 'TITLE', 'FNAME', 'MNAME', 'LNAME', 'USERNAME', 'FATH_HUS_NAME', 'DOB', 'GENDER', 'MARITAL_STATUS', 'ADDRESS',
  'CID', 'CTID', 'STATENAME', 'CITYNAME', 'PINCODE', 'MOBILE', 'EMAILID', 'KID', 'EPIN_NO', 'REGDATE', 'DOC', 'INTROREGNO', 'PARENTREGNO', 'IPADD', 'IMAGENAME',
  'ACTIVE', 'STATUS', 'NOMNAME', 'NOMREL', 'NOMDOB', 'PANNO', 'SPONSERID', 'ROOTID', 'LEFTID', 'RIGHTID', 'KYCSTATUS', 'KYCCOMMENT', 'KITPRICE',
  'IsMobileSelfVerified', 'IsEmailSelfVerified', 'IsProfileSelfVerified', 'IsReferralAccepted', 'DefaultSponserSide', 'side'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/f3E2AmCR3gE=  (Admin_Direct_MembersPanel / Index, optional id)
// auth
router.all(['/member/Admin_Direct_MembersPanel/Index{/:id}', '/member/referral/f3E2AmCR3gE={/:id}'], auth, asyncHandler(async (req, res) => {
  const ddlcustpage = toInt(req.p.ddlcustpage, 500);
  const SearchField = req.p.SearchField === undefined || req.p.SearchField === null ? '0' : String(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const levelnumber = nn(req.p.levelnumber);
  const ViewBag = {};
  if (SearchField === '0') ViewBag.lable = '0';
  if (SearchField === '1') ViewBag.lable = '1';
  const loginid = String(req.user.username); // ((Login)Session["plid"]).UserName
  ViewBag.loginid = loginid;
  const r = await queryOne(DB, 'select RANKID from member_master where UserName = @loginid LIMIT 1', { loginid });
  const Ret = r ? Number(r.rankid) : 0; // FirstOrDefault<Int64>() => 0
  ViewBag.loginid = Ret;
  const MaxRows = 100;
  const page = toInt(req.p.page, 1);
  // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row (column totalcount); 0 when DBNull / no rows.
  const rows = await proc(DB, 'usp_direct_tree_list_helping', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromdate.trim(), todate: todate.trim(),
    levenumber: Math.trunc(Ret), username: '', emailid: '', sponserid: '', referraltype: 0, status: 0, side: 0, checkadminside: 1, mobile: '',
  });
  const AllFreeEpinList = mapRows(rows, PROPS);
  let TotalRecord = 0;
  if (rows[0]) {
    const k = Object.keys(rows[0]).find((x) => x.toLowerCase() === 'totalcount');
    if (k !== undefined && rows[0][k] !== null && rows[0][k] !== undefined) TotalRecord = parseInt(rows[0][k], 10) || 0;
  }
  Object.assign(ViewBag, {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate: fromdate,
    toDate: levelnumber, // legacy overwrote ViewBag.toDate with levelnumber
    ddlcustpage,
  });
  return res.json({ view: '~/Views/CustomerPanel/Admin_Direct_MembersPanel/Index.cshtml', Model: AllFreeEpinList, ViewBag });
}));

// ---- Downline_Help_History -----------------------------------------------------------------------------
// auth
router.all('/member/Admin_Direct_MembersPanel/Downline_Help_History{/:id}', auth, asyncHandler(async (req, res) => {
  const loginid = req.p.loginid;
  const sessionloginid = req.user.loginid; // ((Login)Session["plid"]).LoginID
  let li = [];
  const row = await queryOne(DB, 'SELECT REGNO FROM member_master WHERE LOGINID = @loginid LIMIT 1', { loginid });
  if (loginid !== sessionloginid) {
    if (row) {
      const Regno = row.regno;
      li = await new DAL_Dashboard().Dashboard_Help_Requests_List(Regno);
    }
  } else if (row) {
    const Regno = row.regno;
    li = await new DAL_Dashboard().Dashboard_Help_Requests_List1(Regno);
  }
  return res.json(li);
}));

// ---- sponser_details -----------------------------------------------------------------------------------
// auth (legacy had no session check)
router.all('/member/Admin_Direct_MembersPanel/sponser_details{/:id}', auth, asyncHandler(async (req, res) => {
  const emailid = req.p.emailid;
  // OrderByDescending(EMAILID) on rows that all share the same EMAILID: first row
  const row = await queryOne(DB, 'SELECT * FROM member_master WHERE EMAILID = @emailid ORDER BY EMAILID DESC LIMIT 1', { emailid });
  return res.json(mapRow(row, MEMBER_PROPS)); // null when no row (Json(null))
}));

// ---- ShowPopUpDetailsGH --------------------------------------------------------------------------------
// auth (legacy had no session check)
router.all('/member/Admin_Direct_MembersPanel/ShowPopUpDetailsGH{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const rows = await proc(DB, 'usp_getprovidehelphistory', { loginid: req.p.loginid });
    return res.json(mapRows(rows, HELP_PROPS));
  } catch (e) {
    // legacy: empty catch
  }
  return res.json('error');
}));

// ---- ShowPopUpDetailsPH --------------------------------------------------------------------------------
// auth (legacy had no session check)
router.all('/member/Admin_Direct_MembersPanel/ShowPopUpDetailsPH{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const rows = await proc(DB, 'usp_gethelphistory', { loginid: req.p.loginid });
    return res.json(mapRows(rows, HELP_PROPS));
  } catch (e) {
    // legacy: empty catch
  }
  return res.json('error');
}));

module.exports = router;
