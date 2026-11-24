'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\PayItForwardList.cs (PayItForwardListController) */
const express = require('express');
const { query, queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/PayItForwardList';
const LIST_PROPS = ['TFLID', 'rownumber', 'PURCHASEDATE', 'USERNAME', 'ALLPACKAGENAME', 'TOTALPAIDINCURRENCY', 'MODENAME', 'REFNUM', 'STATUS', 'REMARK',
  'TotalPayableAmount', 'TASMID', 'IsOrderCanCancel', 'CoinRate', 'PAIDFROM', 'Quitdate', 'quittsmid', 'COURIERSTATUS', 'DIRECTMEMBER'];
const PRODUCT_PROPS = ['PRODUCTNAME', 'COURIERTYPE', 'REMARK', 'COURIERSTATUS', 'STATUS'];
const MEMBER_PROPS = ['REGNO', 'LOGINID', 'RANKID', 'TITLE', 'FNAME', 'MNAME', 'LNAME', 'USERNAME', 'FATH_HUS_NAME', 'DOB', 'GENDER', 'MARITAL_STATUS',
  'ADDRESS', 'CID', 'CTID', 'STATENAME', 'CITYNAME', 'PINCODE', 'MOBILE', 'EMAILID', 'KID', 'EPIN_NO', 'REGDATE', 'DOC', 'INTROREGNO', 'PARENTREGNO',
  'IPADD', 'IMAGENAME', 'ACTIVE', 'STATUS', 'NOMNAME', 'NOMREL', 'NOMDOB', 'PANNO', 'SPONSERID', 'ROOTID', 'LEFTID', 'RIGHTID', 'KYCSTATUS',
  'KYCCOMMENT', 'KITPRICE', 'IsMobileSelfVerified', 'IsEmailSelfVerified', 'IsProfileSelfVerified', 'IsReferralAccepted', 'DefaultSponserSide', 'side'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/package-history" -> PayItForwardList/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/package-history'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, Username, PaymentMode } = req.p;
  let page = toInt(req.p.page);
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (Username == null) Username = '';
  if (PaymentMode == null) PaymentMode = '0';
  // Request.QueryString.ToString()
  const qIdx = req.originalUrl.indexOf('?');
  let regno = qIdx >= 0 ? req.originalUrl.slice(qIdx + 1) : '';
  if (regno != null && regno !== '') {
    regno = await UtilityClass.Decryptword(regno);
    if (regno != null && regno !== '' && regno === String(req.user.plid)) {
      Username = req.user.username; // ((Login)Session["Plid"]).UserName
    }
  }
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_paid_forwordlist', {
    plid: Plid, startrowindex: page, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: fromdate.trim(), todate: todate.trim(),
    username: Username, paymentmode: PaymentMode,
  });
  // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 when there are no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    Model: mapRows(rows, LIST_PROPS),
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      fromDate: fromdate, toDate: todate, Username, PaymentMode, ddlcustpage,
    },
  });
}));

// auth (legacy had no session check; the action writes the member's bank details for a package subscription)
router.all(`${P}/QuitMemberPackege{/:id}`, auth, asyncHandler(async (req, res) => {
  const { acholdername, ifsccode, branchname, bankname, accountno } = req.p;
  const hdntasmid = toInt(req.p.hdntasmid);
  const rows = await proc(DB, 'usp_quit_package_subscription', {
    mode: 1, acholdername, ifsccode, branchname, bankname, accountno, tasmid: hdntasmid,
  });
  // @StrResult is an OUTPUT parameter: read from the first result row
  const first = rows.length ? rows[0] : null;
  if (!first || first.strresult === null || first.strresult === undefined) throw new Error('Object reference not set to an instance of an object.');
  res.json(String(first.strresult));
}));

// auth (legacy had no session check; returns a member's bank details)
router.all(`${P}/GetMemberBankDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const TASMID = toInt(req.p.TASMID);
  const regno = await queryOne(DB, 'select regno from tbl_allsubscriptionmaster where tasmid = @t limit 1', { t: TASMID });
  if (!regno) throw new Error('Object reference not set to an instance of an object.');
  const r = Number(regno.regno);
  const _ParticularMemberBankDetails = await query(DB, 'select * from member_master where regno = @r', { r });
  res.json(mapRows(_ParticularMemberBankDetails, MEMBER_PROPS));
}));

// auth (legacy had no session check; returns the product/courier status of a member's package purchase)
router.all(`${P}/GetPublicDetailProductStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getproductdetailsof_purchasepackage', { tasmid: toInt(req.p.tasmid) });
  res.json(mapRows(rows, PRODUCT_PROPS));
}));

module.exports = router;
