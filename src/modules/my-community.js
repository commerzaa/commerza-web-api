'use strict';
/** Port of Controllers/MemberPanelCntrl/MyCommunityController.cs (11 routes) */
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { query, proc, scalar } = require('../db');
const { mapRows, netDate } = require('../utils/shape');
const DataUtility = require('../lib/DataUtility');

const router = express.Router();

// ---- helpers (ASP.NET binding / Convert semantics) ----
const S = (v) => (v === undefined || v === null || v === '' ? null : String(v));
const I = (v) => {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  return /^[+-]?\d+$/.test(s) ? parseInt(s, 10) : null;
};
const toInt = (v) => { // Convert.ToInt32 / ToInt64 (null string => 0, bad format => throws)
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
};
const mapD = (rows, props, dates) => mapRows(rows, props).map((r) => {
  for (const d of dates) if (d in r) r[d] = netDate(r[d]);
  return r;
});

const MyDownlineProps = ['rownumber', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'Status', 'paystatus', 'UserName', 'ImageName', 'SpLoginId', 'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISDcode', 'COUNTRYNAME', 'TITLE', 'KITPRICE', 'JoiningType', 'SIDE', 'STATENAME', 'CITYNAME'];
const UnilevelProps = ['RegNo', 'LoginId', 'Name', 'ImageName', 'USERNAME', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount', 'TotalReferralCount', 'FNAME', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'PARENTUSERNAME'];
const AllDownlineProps = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE', 'PackageAmt', 'STATENAME'];
const RePurchaseProps = ['RowNumber', 'ORDERDATE', 'ORDERNO', 'ORDERAMOUNT', 'BV', 'PV', 'CashBack', 'Mobile', 'MERCHANTNAME', 'ADDRESS', 'MERCHANTMOBILE'];
const MerchantProps = ['ROWNUMBER', 'TOTALAMOUNT', 'PER', 'CPOINT', 'AMOUNT', 'ORDERNO', 'DATE', 'REMARKS', 'MID', 'MERCHANTNAME', 'ADDRESS', 'MERCHANTMOBILE', 'USERNAME', 'NAME', 'MOBILE', 'EMAILID'];

async function logError(req, e, procName) {
  const ut = new DataUtility();
  await ut.ErrorInsert(0, e.message, procName, 0, req.path);
}

// Shared body of DirectRefferalList / AutoPurchaseNode (USP_DIRECT_TREE_LIST)
async function directTreeList(loginId, p, b) {
  return mapD(await proc('affiliate', 'usp_direct_tree_list', {
    loginid: loginId,
    startrowindex: b.page,
    maxrows: b.maxRows,
    searchfield: b.SearchField.trim(),
    searchvalue: b.SearchValue.trim(),
    fromdate: b.fromdate.trim(),
    todate: b.todate.trim(),
    levenumber: b.levelnumber,
    username: b.name.trim(),
    emailid: b.Emailid.trim(),
    sponserid: b.SponserID.trim(),
    referraltype: b.ReferralType,
    status: b.Status,
    side: b.LeftRight,
  }), MyDownlineProps, ['DOC']);
}

// auth
router.post('/api/DirectRefferalList', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) return res.json({ status: 'flase', message: 'Invlaid user' });
  const b = {
    ddlcustpage: I(p.ddlcustpage) ?? 100,
    Status: I(p.Status) ?? 0,
    SearchField: S(p.SearchField) ?? '',
    SearchValue: S(p.SearchValue) ?? '',
    fromdate: S(p.fromdate) ?? '',
    todate: S(p.todate) ?? '',
    name: S(p.name) ?? '',
    Emailid: S(p.Emailid) ?? '',
    SponserID: S(p.SponserID) ?? '',
    ReferralType: I(p.ReferralType) ?? 0,
    LeftRight: S(p.LeftRight) ?? '0',
    page: I(p.page) ?? 1,
    levelnumber: '0',
  };
  b.maxRows = b.ddlcustpage;
  // PORT-NOTE: @TotalCount OUT parameter is not requested (value was unused in the response).
  const list = await directTreeList(S(p.username), p, b);
  res.json([{ Status: 'true', data: list }]);
}));

// auth
router.post('/api/MyDownlineList', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) return res.json({ status: 'false', message: 'Invlid user' });
  const fromdate = S(p.fromdate) ?? '';
  const todate = S(p.todate) ?? '';
  const SearchField = S(p.SearchField) ?? '';
  const SearchValue = S(p.SearchValue) ?? '';
  const Side = I(p.Side) ?? 0;
  const Level = S(p.Level) ?? '';
  const ActivationStatus = S(p.ActivationStatus) ?? '0';
  const page = I(p.page) ?? 1;

  const Plid = toInt(plid);
  let loginid = '';
  const row = await query('affiliate', 'select username from member_master where regno = @plid limit 1', { plid: Plid });
  if (row.length > 0) loginid = row[0].username;
  const MaxRows = 100;

  // PORT-NOTE: OUT params (@TotalCount, @TotalLRBV, @TOTALLRINCOME, @totalInvesment) are not requested;
  // they were only parsed and never returned.
  const LRMember = mapD(await proc('affiliate', 'usp_new_member_get_member_downlinelist_side_wise', {
    loginid,
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: SearchField,
    searchvalue: SearchValue,
    fromdate: fromdate.trim(),
    todate: todate.trim(),
    levenumber: toInt(Level === '' ? '0' : Level),
    side: Side,
    name: '',
    username: '',
    emailid: '',
    sponserid: '',
    checkadminside: 0,
    activationstatus: toInt(ActivationStatus),
    userdownlinemember: '',
    orderbydate: '',
    fromlevel: 0,
    tolevel: 0,
    orderbylevel: 0,
    mainsearch: '',
  }), AllDownlineProps, ['DOC']);

  let treestatus = false;
  const ts = await scalar('affiliate', 'select status from tbl_submenurole_memberpanel where sid in (12,98) limit 1');
  const TreeStatus = ts == null ? 0 : (ts === true ? 1 : (ts === false ? 0 : Number(ts)));
  treestatus = TreeStatus === 1;
  res.json([{ status: 'true', treeviewstatus: treestatus, data: LRMember }]);
}));

// auth
router.post('/api/AutoPurchaseNode', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) return res.json({ status: 'false', message: 'Invalid user' });
  const b = {
    ddlcustpage: I(p.ddlcustpage) ?? 100,
    Status: I(p.Status) ?? 0,
    SearchField: S(p.SearchField) ?? '',
    SearchValue: S(p.SearchValue) ?? '',
    fromdate: S(p.fromdate) ?? '',
    todate: S(p.todate) ?? '',
    name: S(p.Username) ?? '',
    Emailid: S(p.Emailid) ?? '',
    SponserID: S(p.SponserID) ?? '',
    ReferralType: 1, // forced to 1 in legacy code
    LeftRight: S(p.LeftRight) ?? '0',
    page: I(p.page) ?? 1,
    levelnumber: '0',
  };
  b.maxRows = b.ddlcustpage;
  const Plid = toInt(plid);
  const list = await directTreeList(Plid, p, b);
  res.json([{ status: 'true', data: list }]);
}));

// auth
router.post('/api/OnlineShoppingCP_points', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) return res.json({ status: 'false', message: 'Invalid user' });
  const SearchField = S(p.SearchField) ?? '';
  const SearchValue = S(p.SearchValue) ?? '';
  const RoleMaster = S(p.RoleMaster) ?? '';
  const fromDate = S(p.fromDate) ?? '';
  const toDate = S(p.toDate) ?? '';
  const MaxRows = 100;
  const page = I(p.page) ?? 1;
  const responseData = [];
  try {
    const Plid = toInt(plid);
    const list = mapD(await proc('affiliate', 'sp_userrepurchase_details', {
      startrowindex: page,
      maxrows: MaxRows,
      searchfield: SearchField.trim(),
      searchvalue: SearchValue.trim(),
      rolename: RoleMaster.trim(),
      fromdate: fromDate.trim(),
      todate: toDate.trim(),
      regno: Plid,
    }), RePurchaseProps, ['ORDERDATE']);
    responseData.push({ status: 'true', message: 'success', data: list });
  } catch (e) {
    console.error(e);
    await logError(req, e, 'insert_email_newsletter');
    responseData.push({ status: 'false', message: 'error', _error: e.message });
  }
  res.json(responseData);
}));

// auth
router.post('/api/MerchantTransferCashback', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const plid = S(p.plid);
  if (plid == null) return res.json({ status: 'false', message: 'Invalid User' });
  const SearchField = S(p.SearchField) ?? '';
  const SearchValue = S(p.SearchValue) ?? '';
  const fromDate = S(p.fromDate) ?? '';
  const toDate = S(p.toDate) ?? '';
  const MaxRows = 1000;
  const page = I(p.page) ?? 1;
  const responseData = [];
  try {
    const Plid = toInt(plid);
    const list = mapD(await proc('affiliate', 'sp_usermertant_details', {
      regno: Plid,
      startrowindex: page,
      maxrows: MaxRows,
      searchfield: SearchField.trim(),
      searchvalue: SearchValue.trim(),
      fromdate: fromDate.trim(),
      todate: toDate.trim(),
    }), MerchantProps, ['DATE']);
    responseData.push({ status: 'true', message: 'success', data: list });
  } catch (e) {
    console.error(e);
    await logError(req, e, 'insert_email_newsletter');
    responseData.push({ status: 'false', message: 'error', _error: e.message });
  }
  res.json(responseData);
}));

// Tree helpers
async function tree(procName, plid, username, mode) {
  return mapRows(await proc('affiliate', procName, { plid, username, mode }), UnilevelProps);
}
async function treeWithLookup(lookupProc, treeProc, req, res) {
  const username = S(req.p.username) ?? '';
  let Plid = I(req.p.Plid);
  if (Plid === null) {
    // non-nullable Int64 action parameter missing / invalid => Web API model binding failure
    return res.status(400).json({ Message: 'The request is invalid.' });
  }
  if (username !== '') {
    const r = await proc('affiliate', lookupProc, { plid: 0, username, mode: 1 });
    const first = r[0];
    Plid = first ? Number(first[Object.keys(first)[0]]) : 0; // FirstOrDefault<Int64>
  }
  const data = await tree(treeProc, Plid, username, 2);
  return res.json([{ status: 'true', message: 'success', data }]);
}

// auth
router.post('/api/GenerationSystem', auth, asyncHandler(async (req, res) => {
  await treeWithLookup('usp_createleveltree', 'usp_creategernationtree_level', req, res);
}));

// auth
router.post('/api/GenSystemGettreeview', auth, asyncHandler(async (req, res) => {
  const data = await tree('usp_creategernationtree_level', S(req.p.RegNo), '', 5);
  res.json([{ status: 'true', message: 'success', data }]);
}));

// auth
router.post('/api/GenSystemGetUserdetails', auth, asyncHandler(async (req, res) => {
  const data = await tree('usp_creategernationtree_level', 0, S(req.p.username), 4);
  res.json([{ status: 'true', message: 'success', data }]);
}));

// auth
router.post('/api/AutoGlobalSystem', auth, asyncHandler(async (req, res) => {
  await treeWithLookup('usp_createleveltreematrix_level', 'usp_createleveltreematrix_level', req, res);
}));

// auth
router.post('/api/AGlobalGettreeview', auth, asyncHandler(async (req, res) => {
  const data = await tree('usp_createleveltreematrix_level', S(req.p.RegNo), '', 5);
  res.json([{ status: 'true', message: 'success', data }]);
}));

// auth
router.post('/api/AGlobalGetUserdetails', auth, asyncHandler(async (req, res) => {
  const data = await tree('usp_createleveltreematrix_level', 0, S(req.p.username), 4);
  res.json([{ status: 'true', message: 'success', data }]);
}));

module.exports = router;
