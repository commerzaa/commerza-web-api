'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Coupon_Request_History.cs (Coupon_Request_HistoryController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const ATCAPI = require('../../lib/member/ATCAPI');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Coupon_Request_History';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const need = (v) => { if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.'); return Number(v); };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const COUPON_PROPS = ['ROWNUMBER', 'CRID', 'Name', 'USERNAME', 'Mobile', 'COUPONNO', 'UsedFrom', 'USEDDATE', 'ACTIVE', 'CREATEDATE', 'LEVEL', 'ISHOLD', 'TYPE', 'REMARK', 'regdate'];

// route-config: referral/9P1ssmoPPRyjgEK9tT3AzE_plus__slash_xZ9qgVco
// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameter @TOTALCOUNT of USP_COUPON_REQUESTHISTORY is read from the "totalcount" column of the first result row.
router.all([`${P}/Index{/:id}`, '/member/referral/9P1ssmoPPRyjgEK9tT3AzE_plus__slash_xZ9qgVco'], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { fromDate, toDate, CrDrType, TrType, SearchField, SearchValue, Status } = req.p;
  let DateP = req.p.Date;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (Status == null) Status = '';
  if (DateP == null) DateP = '';

  // Auto Approval Of BTC For E-Wallet Topup (background thread in legacy)
  const RegNo = Math.trunc(Number(req.user.plid));
  bg(() => ATCAPI.BTCPaymentClearification(RegNo));

  let Obj = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const Plid = Number(req.user.plid);
    ViewBag.PLID = Plid;
    const rows = await proc(DB, 'usp_coupon_requesthistory', {
      startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate,
      plid: Plid, orderbydate: 'DESC', status: Status, date: DateP,
    });
    Obj = mapRows(rows, COUPON_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = need(outv(rows, 'totalcount'));
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_Fund_History', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
