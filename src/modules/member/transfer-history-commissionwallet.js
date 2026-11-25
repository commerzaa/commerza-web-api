'use strict';
/** Port of Member/Controllers/CustomerPanel/TransferHistory_Commissionwallet.cs (TransferHistory_CommissionwalletController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

// Shoping_Statement (Controllers/CustomerPanel/FranchiseApply.cs)
const PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };

// route-config: referral/gEUxSIO_slash_5155cdvnvnuyu88TransCM -> Index (Type = 1)
// auth ([SessionExpireCheck])
router.all(['/member/TransferHistory_Commissionwallet/Index{/:id}', '/member/referral/gEUxSIO_slash_5155cdvnvnuyu88TransCM'], auth, asyncHandler(async (req, res) => {
  let page = optInt(req.p.page);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const CrDrType = nn(req.p.CrDrType);
  let TrType = req.p.TrType;
  let ddlcustpage = optInt(req.p.ddlcustpage);
  const Username = nn(req.p.Username);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (TrType === undefined || TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const ViewBag = { abc: '' };
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @StrResult / @TotalCount OUT params are returned as columns of the result row.
    const rows = await proc(DB, 'usp_fund_history_transfer_commission', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: Username, startrowindex: page, maxrows: MaxRows,
    });
    Obj = mapRows(rows, PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const tc = parseInt(outCol(rows, 'totalcount'), 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = Number.isNaN(tc) ? 0 : tc;
    ViewBag.cramount = 0;
    ViewBag.dramount = 0;
    ViewBag.avalibalefund = 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    // legacy: Response.Redirect("/page-not-found") ran first and ended the request, so its ErrorInsert (USP_FUND_HISTORY_Transfer) never executed
    void Exp;
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/CustomerPanel/TransferHistory_Commissionwallet/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
