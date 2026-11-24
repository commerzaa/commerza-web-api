'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/MyDownline.cs (MyDownlineController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const totalOf = (rows) => { const f = rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === 'totalcount'); const n = k === undefined ? NaN : parseInt(f[k], 10); return Number.isNaN(n) ? 0 : n; };

const DOWNLINE_PROPS = ['rownumber', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'Status', 'paystatus', 'UserName', 'ImageName',
  'SpLoginId', 'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISDcode', 'COUNTRYNAME', 'TITLE', 'KITPRICE', 'JoiningType',
  'SIDE', 'STATENAME', 'CITYNAME', 'PackageAmt'];

// auth
// route-config: "referral/my-downline" -> MyDownline/Index (id optional)
router.all(['/member/MyDownline/Index{/:id}', '/member/referral/my-downline{/:id}'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ddlcustpage = optInt(p.ddlcustpage);
  let Status = optInt(p.Status);
  let SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const fromdate = nn(p.fromdate);
  const todate = nn(p.todate);
  let levelnumber = nn(p.levelnumber);
  const Username = nn(p.Username);
  const Emailid = nn(p.Emailid);
  const SponserID = nn(p.SponserID);
  let ReferralType = optInt(p.ReferralType);
  let LeftRight = p.LeftRight;
  let page = optInt(p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Status === null) Status = 0;
  const ViewBag = {};
  if (SearchField === '0') ViewBag.lable = '0';
  if (SearchField === '1') ViewBag.lable = '1';
  if (ReferralType === null) ReferralType = 0;
  if (LeftRight === undefined || LeftRight === null) LeftRight = '0';

  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  levelnumber = '0';
  // PORT-NOTE: @TotalCount OUT param is returned as a column ("totalcount") of the result row.
  const rows = await db.proc(DB, 'usp_direct_tree_list', {
    loginid: req.user.username !== undefined ? req.user.username : req.user.userName,
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: SearchField.trim(),
    searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(),
    todate: todate.trim(),
    levenumber: levelnumber,
    username: Username.trim(),
    emailid: Emailid.trim(),
    sponserid: SponserID.trim(),
    referraltype: ReferralType,
    status: Status,
    side: LeftRight,
  });
  ViewBag.CurrentPage = page;
  ViewBag.LeftRight = LeftRight;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(rows);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Username = Username;
  ViewBag.EmailID = Emailid;
  ViewBag.ReferralType = ReferralType;
  ViewBag.levelnumber = levelnumber;
  ViewBag.ddlcustpage = ddlcustpage;
  res.json({ view: '~/Views/CustomerPanel/MyDownline/Index.cshtml', Model: mapRows(rows, DOWNLINE_PROPS), ViewBag });
}));

module.exports = router;
