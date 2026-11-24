'use strict';
// Ported from Member\Controllers\CustomerPanel\Referral_Bonus_Flush.cs (Referral_Bonus_flushController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Referral_Bonus_flush';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// PORT-NOTE: OUT parameter @TotalCount is read from the "totalcount" column of the first result row (0 when absent / NULL)
const numOut = (rows, name) => { const v = outv(rows, name); return v === undefined || v === null || v === '' ? 0 : Number(v); };
const PROPS = ['ROWNUMBER', 'FROMUSERNAME', 'KIT_PRICE', 'AMOUNT', 'TDS_AMT', 'ADMIN_AMT', 'PARTICULAR', 'ISSKIP', 'INCOME'];

// route-config: referral/bbkQAaAq4MK8zyWzbIAVNLxYTWq0xQ0V
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/bbkQAaAq4MK8zyWzbIAVNLxYTWq0xQ0V'], ...guard, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  let ddlcustpage = req.p.ddlcustpage === undefined || req.p.ddlcustpage === null || req.p.ddlcustpage === '' ? null : parseInt(req.p.ddlcustpage, 10);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  const Plid = Number(req.user.plid);
  // legacy also read Member_Master.LOGINID into an unused local - dropped
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_member_earning_history_flush', {
    PLID: Math.trunc(Plid), STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromdate.trim(), TODATE: todate.trim(), MODE: '1', INCOMETYPE: '1',
  });
  const TotalRecord = numOut(rows, 'totalcount');
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  };
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
}));

module.exports = router;
