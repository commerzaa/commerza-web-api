'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Coin_Statement.cs (Coin_StatementController) - 1 action: Index */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Coin_Statement';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const intOrNull = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };
// Convert.ToInt32/ToDecimal(x.Value.ToString()): missing out value => legacy exception (caught by the action's catch)
const need = (v) => { if (v === undefined || v === null || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.'); return Number(v); };
const COIN_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'PARTICULARS'];

// route-config: referral/u_slash_z63m_plus_zPFrcOg6YzDMSLw==
// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameters of Usp_coinTransactionHistory are read from columns of the first result row (db layer convention).
router.all([`${P}/Index{/:id}`, '/member/referral/u_slash_z63m_plus_zPFrcOg6YzDMSLw=='], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { fromDate, toDate, CrDrType, TrType } = req.p;
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_cointransactionhistory', {
      plid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
      crdrtype: CrDrType, trtype: need(TrType),
    });
    Obj = mapRows(rows, COIN_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = need(outv(rows, 'totalcount'));
    const cramountt = need(outv(rows, 'cramount'));
    const dramountt = need(outv(rows, 'dramount'));
    const avalibalefundd = need(outv(rows, 'avalibalefund'));
    const GCoinWallet = need(outv(rows, 'grosscoinwallet'));
    const UCoinWallet = need(outv(rows, 'usedcoinwallet'));
    ViewBag.GCoinWallet = GCoinWallet;
    ViewBag.UCoinWallet = UCoinWallet;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.cramount = cramountt;
    ViewBag.dramount = dramountt;
    ViewBag.AvailableCoinWallet = avalibalefundd;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    try { await new DataUtility().ErrorInsert(0, Exp.message, 'Usp_coinTransactionHistory', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
