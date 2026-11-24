'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\SalaryIncome.cs (SalaryIncomeController) */
const express = require('express');
const { query, queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/SalaryIncome';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const P_SALARY = ['ROWNUMBER', 'PAYFROM', 'PAYTO', 'PAYDATE', 'ROI', 'STATUS'];
const P_BOOSTER = ['Booster_Date'];
const P_PACKNAME = ['TSMID', 'SUBSCRIPTIONHEADING'];
const P_PURCHASE = ['ROWNUMBER', 'PackageName', 'INVEST_AMOUNT', 'GROWTHAMOUNT', 'ADMINCH', 'TDS', 'TOTALAMOUNT', 'NETAMOUNT', 'PRINCIPALAMOUNT', 'INTERESTAMOUNT'];
// OUT params of paged procs are exposed as columns of the result rows
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);

async function GetBosterDetailsByRegNo(req) {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_salarymaster_group_bonus', {
    plid: Math.trunc(Plid), startrowindex: '1', maxrows: '100', searchfield: '', searchvalue: '', fromdate: '', todate: '', mode: '3',
  });
  return mapRows(rows, P_BOOSTER);
}

// route-config: referral/rZytBsj_slash_0GBfJ4goFkWIAA==E
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/rZytBsj_slash_0GBfJ4goFkWIAA==E'], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let ddlpackage = intOrNull(req.p.ddlpackage);
  let SearchField = req.p.SearchField; let SearchValue = req.p.SearchValue; let fromdate = req.p.fromdate; let todate = req.p.todate;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (ddlpackage === null) ddlpackage = 0;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (fromdate === undefined || fromdate === null) fromdate = '';
  if (todate === undefined || todate === null) todate = '';
  const Plid = Number(req.user.plid);

  await GetBosterDetailsByRegNo(req); // BoosterHistory (only used for a commented-out ViewBag value)
  const row = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: Plid });
  let loginid = '';
  if (row) loginid = row.loginid; // eslint-disable-line no-unused-vars
  const MaxRows = UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @SumEarndPoind OUT params are read from the proc result columns (totalcount / sumearndpoind).
  const rows = await proc(DB, 'usp_roi_report_salaryincome', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', kid: ddlpackage,
  });
  const Obj = mapRows(rows, P_SALARY);
  const tc = outCol(rows, 'totalcount');
  const TotalRecord = tc === null || String(tc) === '' ? 0 : parseInt(tc, 10);
  const te = outCol(rows, 'sumearndpoind');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate: fromdate, toDate: todate, TotalEarnd: te === null ? '' : String(te), ddlcustpage,
  };
  res.json({ Model: Obj, ViewBag });
}));

// auth
router.all(`${P}/GetBosterDetailsByRegNo{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await GetBosterDetailsByRegNo(req));
}));

// auth
router.all(`${P}/PackageName{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT TSMID,SUBSCRIPTIONHEADING FROM TBL_SUBSCRIPTIONMASTER WHERE ISACTIVE=true AND STATUS=true');
  res.json(mapRows(rows, P_PACKNAME));
}));

// auth
router.all(`${P}/getpurchasepackdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const PayDate = req.p.PayDate;
  // PORT-NOTE: CONVERT(VARCHAR,GROWTHDATE,105) (dd-mm-yyyy) expressed with to_char.
  const rows = await query(DB, `SELECT ROW_NUMBER() OVER(ORDER BY GC.REGNO DESC) AS ROWNUMBER,coalesce(SM.AllPackageName,'''') AS PackageName,coalesce(GM.INVEST_AMOUNT,0) AS INVEST_AMOUNT,
    coalesce(GC.GROWTHAMOUNT,0) AS GROWTHAMOUNT,coalesce(GC.ADMINCH,0) AS ADMINCH,(coalesce(GC.GROWTHAMOUNT,0)+coalesce(GC.TDS,0)) AS NETAMOUNT,coalesce(GC.TDS,0) AS TDS,
    (coalesce(GC.GROWTHAMOUNT,0)+coalesce(GC.ADMINCH,0)+coalesce(GC.TDS,0)) AS TOTALAMOUNT
    FROM TBL_SALARYCHART GC LEFT JOIN TBL_SALARYMASTER GM ON GM.GMID = GC.GIVEID LEFT JOIN Tbl_AllSubscriptionMaster SM ON SM.TASMID = GM.TASMID
    WHERE GC.REGNO = @plid AND to_char(gc.GROWTHDATE,'DD-MM-YYYY') = @paydate`, { plid: Plid, paydate: PayDate });
  const list = mapRows(rows, P_PURCHASE).map((r) => ({ ...r, PRINCIPALAMOUNT: 0, INTERESTAMOUNT: 0 }));
  if (list.length > 0) return res.json(list);
  return res.json('error');
}));

module.exports = router;
