'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Distibute_Genratration_Income.cs (Distibute_Genratration_IncomeController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: Distibute Generation-Income -> referral/distibute-generation-income
 */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'Distibute_Genratration_Income';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_LEVELHIST = ['ROWNUMBER', 'FROMUSERNAME', 'PACKAGEAMT', 'COMMISSIONPERCENTAGE', 'COMMISSIONAMOUNT', 'ADMINCH', 'TDS', 'NETCOMMISSION', 'PARTICULAR', 'ishold', 'LEVEL', 'DATE', 'FROMNAME',
  'TOUserName', 'TONAME', 'CITYNAME'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/distibute-generation-income'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromdate, todate } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  let mode = optInt(req.p.mode);
  if (ddlcustpage === null) ddlcustpage = 100;
  SearchField = nz(SearchField); SearchValue = nz(SearchValue); fromdate = nz(fromdate); todate = nz(todate);
  const Plid = Number(req.user.plid);
  let loginid = '';
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid: Plid });
  if (row) loginid = row.loginid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (mode === null) mode = 1;
  // PORT-NOTE: @TotalCount OUT is the "totalcount" column of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_distibute_level_incomehistory', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(), fromdate: String(fromdate).trim(),
    todate: String(todate).trim(), mode, levelincometype: 1,
  });
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(raw);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.ddlcustpage = ddlcustpage;
  res.json({ Model: mapRows(raw, P_LEVELHIST), ViewBag });
}));

module.exports = router;
