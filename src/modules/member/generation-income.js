'use strict';
/** Ported from MemberCommonControllers${cs} (GenerationIncomeController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/GenerationIncome';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_LEVEL = ["ROWNUMBER","FROMUSERNAME","PACKAGEAMT","COMMISSIONPERCENTAGE","COMMISSIONAMOUNT","ADMINCH","TDS","NETCOMMISSION","PARTICULAR","ishold","LEVEL","DATE","FROMNAME","TOUserName","TONAME","CITYNAME"];

// route-config: referral/generation-income
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/generation-income'], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let SearchField = req.p.SearchField; let SearchValue = req.p.SearchValue; let fromdate = req.p.fromdate; let todate = req.p.todate;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  const Plid = Number(req.user.plid);
  const row = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: Plid });
  let loginid = '';
  if (row) loginid = row.loginid;
  const MaxRows = UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await proc(DB, 'usp_level_incomehistory', { loginid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', levelincometype: 1 });
  const AllFreeEpinList = mapRows(rows, P_LEVEL);
  const TotalRecord = totalOf(rows);
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, ddlcustpage,
  };
  res.json({ Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
