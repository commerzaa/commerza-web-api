'use strict';
// Ported from Member\Controllers\CustomerPanel\ETH_Withdrawal_History.cs (ETH_Withdrawal_HistoryController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/ETH_Withdrawal_History';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameter @TOTALCOUNT is read from the "totalcount" column of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
const PROPS = ['ROWNUMBER', 'WDID', 'WITHDRAWAMOUNT', 'DATE', 'PAID_STATUS', 'REMARKS', 'Wallet_Address', 'Withdrawal_BTC', 'TXID'];

// route-config: referral/f0XZklY5Flxi_plus_BubT6fQFk_plus__slash_xZ9qgVco
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/f0XZklY5Flxi_plus_BubT6fQFk_plus__slash_xZ9qgVco'], ...guard, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  const Plid = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_walleteth_history', {
    PLID: Plid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate.trim(), TODATE: todate.trim(),
  });
  const TotalRecord = numOut(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    fromDate: fromdate,
    toDate: todate,
    SearchField,
    SearchValue,
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
