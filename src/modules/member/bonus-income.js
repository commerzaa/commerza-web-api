'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\BonusIncome.cs (BonusIncomeController) - 1 action: Index */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/BonusIncome';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const BONUS_PROPS = ['ROWNUMBER', 'DATE', 'PACKAGEAMT', 'COMMISSIONAMOUNT', 'ADMINCH', 'TDS', 'NETCOMMISSION', 'ToUserName'];

// route-config: referral/6JU5kMoBslyqM467i3dxeQA==
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// PORT-NOTE: OUT parameter @TotalCount of USP_BonusIncomeHistory is read from the "totalcount" column of the first result row (no try/catch in legacy: failures => 500).
router.all([`${P}/Index{/:id}`, '/member/referral/6JU5kMoBslyqM467i3dxeQA=='], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let page = intOrNull(req.p.page);
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select loginid from member_master where regno = @plid limit 1', { plid: Plid });
  if (row != null) loginid = row.loginid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_bonusincomehistory', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const AllFreeEpinList = mapRows(rows, BONUS_PROPS);
  const tc = outv(rows, 'totalcount');
  const TotalRecord = parseInt(String(tc === undefined || tc === null ? 0 : tc), 10);
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  res.json({
    Model: AllFreeEpinList,
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  });
}));

module.exports = router;
