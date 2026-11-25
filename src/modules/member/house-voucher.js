'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\House_Voucher.cs (House_VoucherController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/House_Voucher';
const PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/House-Voucher-income-report" -> House_Voucher/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/House-Voucher-income-report'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, RoleMaster, fromDate, toDate } = req.p;
  let page = toInt(req.p.page);
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (RoleMaster == null) RoleMaster = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  let listHouseVoucher = [];
  const ViewBag = {};
  const nn = (v) => { if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.'); return parseFloat(v); };
  try {
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_travelvoucher_report', {
      regno: Plid, vouchertype: 3, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue.trim(),
      fromdate: fromDate, todate: toDate,
    });
    listHouseVoucher = mapRows(rows, PROPS);
    // PORT-NOTE: OUT parameters (@TOTALCOUNT, @TOTALINCOME, @TOTALTDS, @NETINCOME) are read from the columns of the first result row
    const first = rows.length ? rows[0] : {};
    const TotalRecord = parseInt(first.totalcount === null || first.totalcount === undefined || first.totalcount === '' ? '0' : String(first.totalcount), 10);
    const TotalAllIncome = nn(first.totalincome);
    const TotalNetAllIncome = nn(first.netincome);
    const TotalSumTds = nn(first.totaltds);
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, TotalAllIncome, TotalSumTds, TotalNetAllIncome,
      NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, ddlcustpage,
    });
  } catch (ExpObj) {
    // legacy swallowed the error after logging it and still returned the view with whatever list was loaded
    console.error(ExpObj.message);
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'insert_email_newsletter', 0, req.path); } catch (e) { console.error(e.message); }
  }
  res.json({ Model: listHouseVoucher, ViewBag });
}));

module.exports = router;
