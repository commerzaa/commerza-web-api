'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\FranchiseApply.cs (FranchiseApplyController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/FranchiseApply';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
const need = (v) => { if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.'); return Number(v); };
const SHOP_PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];

// auth ([SessionExpireCheck])  (no RouteConfig friendly url maps to FranchiseApply)
// PORT-NOTE: OUT parameters of USP_SHOPINGSTATEMENTHISTORY are read from columns of the first result row (db layer convention).
// PORT-NOTE: in the legacy catch the Response.Redirect("/page-not-found") ran BEFORE the ErrorInsert block, so ErrorInsert never executed; not ported.
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { fromDate, toDate, CrDrType, TrType } = req.p;
  const Type = req.p.Type;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const IncomeType = Type;
  const ViewBag = {};
  ViewBag.abc = '';
  if (IncomeType === '1') {
    ViewBag.abc = 'Shoping Statement';
  } else {
    ViewBag.abc = 'Coupen Statement';
  }
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_shopingstatementhistory', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: '', startrowindex: page, maxrows: MaxRows,
      crdrtype: CrDrType, trtype: need(TrType), incometype: IncomeType,
    });
    Obj = mapRows(rows, SHOP_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = need(outv(rows, 'totalcount'));
    const cramountt = need(outv(rows, 'cramount'));
    const dramountt = need(outv(rows, 'dramount'));
    const avalibalefundd = need(outv(rows, 'avalibalefund'));
    need(outv(rows, 'grosscoinwallet'));
    need(outv(rows, 'usedcoinwallet'));
    const GCommissionWallet = need(outv(rows, 'grosscommissionwallet'));
    const UCommissionWallet = need(outv(rows, 'usedcommissionwallet'));
    const ACommissionWallet = need(outv(rows, 'availablecommissionwallet'));
    ViewBag.GCommissionWallet = GCommissionWallet;
    ViewBag.UCommissionWallet = UCommissionWallet;
    ViewBag.ACommissionWallet = ACommissionWallet;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.cramount = cramountt;
    ViewBag.dramount = dramountt;
    ViewBag.avalibalefund = avalibalefundd;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
