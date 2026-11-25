'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Vehicle_Voucher.cs (Vehicle_VoucherController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: VehicleVoucher -> referral/Vehicle-Voucher-income-report
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const C = 'Vehicle_Voucher';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const colOf = (rows, n) => { const r = rows && rows[0]; if (!r) return null; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? null : r[k]; };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const P_VEHICLE = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/Vehicle-Voucher-income-report'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  SearchField = nz(SearchField); SearchValue = nz(SearchValue); fromDate = nz(fromDate); toDate = nz(toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let listVehicleVoucher = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @TOTALCOUNT / @NETINCOME / @TOTALTDS / @TOTALINCOME OUT params are same-named columns of the first result row (0 when empty)
    const raw = await proc(DB, 'usp_travelvoucher_report', {
      regno: Plid, vouchertype: '2', startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: String(SearchValue).trim(), fromdate: fromDate, todate: toDate,
    });
    listVehicleVoucher = mapRows(raw, P_VEHICLE);
    const num = (n) => Number(colOf(raw, n) || 0);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = num('totalcount');
    ViewBag.TotalAllIncome = num('totalincome');
    ViewBag.TotalSumTds = num('totaltds');
    ViewBag.TotalNetAllIncome = num('netincome');
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'insert_email_newsletter');
  }
  res.json({ Model: listVehicleVoucher, ViewBag });
}));

module.exports = router;
