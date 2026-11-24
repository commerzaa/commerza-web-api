'use strict';
/** Port of Member/Controllers/CustomerPanel/GrowthBonus.cs (GrowthBonusController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { query, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const LIST_PROPS = ['ROWNUMBER', 'PAYFROM', 'PAYTO', 'PAYDATE', 'ROI', 'STATUS'];
const PACKAGE_PROPS = ['TSMID', 'SUBSCRIPTIONHEADING'];
const PURCHASE_PROPS = ['ROWNUMBER', 'PackageName', 'INVEST_AMOUNT', 'GROWTHAMOUNT', 'ADMINCH', 'TDS', 'TOTALAMOUNT', 'NETAMOUNT', 'PRINCIPALAMOUNT', 'INTERESTAMOUNT'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
const totalOf = (rows, name) => { const n = parseInt(outCol(rows, name), 10); return Number.isNaN(n) ? 0 : n; };

/** Legacy public helper GetBosterDetailsByRegNo() (not an MVC view action; used inline by Index). Returns [{Booster_Date}] */
async function GetBosterDetailsByRegNo(req) {
  const Plid = Number(req.user.plid);
  // PORT-NOTE: @TotalCount / @SumEarndPoind OUT params come back as columns; rows without booster_date are the output-only row.
  const rows = await proc(DB, 'usp_member_group_bonus', {
    plid: Math.trunc(Plid), startrowindex: '1', maxrows: '100', searchfield: '', searchvalue: '', fromdate: '', todate: '', mode: '3',
  });
  return rows.filter((r) => r.booster_date !== undefined && r.booster_date !== null).map((r) => ({ Booster_Date: r.booster_date }));
}

// route-config: referral/rZytBsj_slash_0GBfJ4goFkWIAA== -> Index
// auth
router.all(['/member/GrowthBonus/Index{/:id}', '/member/referral/rZytBsj_slash_0GBfJ4goFkWIAA=='], auth, asyncHandler(async (req, res) => {
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  let ddlpackage = optInt(req.p.ddlpackage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (ddlpackage === null) ddlpackage = 0;

  const ViewBag = {};
  const Plid = Number(req.user.plid);
  const BoosterHistory = await GetBosterDetailsByRegNo(req);
  if (BoosterHistory.length > 0) ViewBag.BoosterDate = BoosterHistory[0].Booster_Date;

  // (legacy looked up Member_Master.LOGINID into an unused local; not needed)
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @SumEarndPoind OUT params are returned as columns of the result row.
  const rows = await proc(DB, 'usp_roi_report', {
    plid: Math.trunc(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromdate.trim(), todate: todate.trim(), mode: '1', kid: ddlpackage,
  });
  const Obj = mapRows(rows, LIST_PROPS);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(rows, 'totalcount');
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.TotalEarnd = outCol(rows, 'sumearndpoind');
  ViewBag.ddlcustpage = ddlcustpage;
  res.json({ view: '~/Views/CustomerPanel/GrowthBonus/Index.cshtml', Model: Obj, ViewBag });
}));

// auth
router.all('/member/GrowthBonus/PackageName{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT tsmid,subscriptionheading FROM tbl_subscriptionmaster WHERE isactive=1 AND status=1');
  res.json(mapRows(rows, PACKAGE_PROPS));
}));

// auth
router.all('/member/GrowthBonus/getpurchasepackdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const PayDate = req.p.PayDate;
  const Plid = Number(req.user.plid);
  // CONVERT(VARCHAR(100),'<PayDate>',105) on a string literal is the literal itself => compared with dd-mm-yyyy of GROWTHDATE
  const rows = await query(DB, `SELECT ROW_NUMBER() OVER(ORDER BY gc.regno DESC) AS ROWNUMBER,COALESCE(sm.allpackagename,'''') AS PackageName,COALESCE(gm.invest_amount,0) AS INVEST_AMOUNT,
COALESCE(gc.growthamount,0) AS GROWTHAMOUNT,COALESCE(gc.adminch,0) AS ADMINCH,(COALESCE(gc.growthamount,0)+COALESCE(gc.tds,0)) AS NETAMOUNT,COALESCE(gc.tds,0) AS TDS,
(COALESCE(gc.growthamount,0)+COALESCE(gc.adminch,0)+COALESCE(gc.tds,0)) AS TOTALAMOUNT,COALESCE(gc.principalamount,0) AS PRINCIPALAMOUNT,COALESCE(gc.interestamount,0) AS INTERESTAMOUNT
FROM tbl_growthchart gc LEFT JOIN tbl_growthmaster gm ON gm.gmid=gc.giveid LEFT JOIN tbl_allsubscriptionmaster sm ON sm.tasmid=gm.tasmid
WHERE gc.regno=@plid AND to_char(gc.growthdate,'DD-MM-YYYY')=@paydate`, { plid: Plid, paydate: PayDate });
  const purchasepackdetails = mapRows(rows, PURCHASE_PROPS);
  if (purchasepackdetails.length > 0) return res.json(purchasepackdetails);
  return res.json('error');
}));

module.exports = router;
