'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\TransferHistory_Growthwallet.cs (TransferHistory_GrowthwalletController) */
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
const P = '/member/TransferHistory_Growthwallet';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_SHOP = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];

// route-config: referral/gEUxSIO_slash_5155cdvnvnuyu88TransGW  (defaults Type = 1)
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/gEUxSIO_slash_5155cdvnvnuyu88TransGW'], auth, asyncHandler(async (req, res) => {
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { fromDate, toDate, CrDrType, TrType, Username } = req.p;
  let Type = req.p.Type;
  if (req.path.indexOf('/referral/') !== -1 && (Type === undefined || Type === null)) Type = '1'; // route default Type = 1
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Username === undefined || Username === null) Username = '';
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  if (CrDrType === undefined || CrDrType === null) CrDrType = '';
  if (TrType === undefined || TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const ViewBag = { abc: '' };
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_fund_history_transfer_growth', { plid: Plid, fromdate: fromDate, todate: toDate, username: Username, startrowindex: page, maxrows: MaxRows });
    Obj = mapRows(rows, P_SHOP);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const tc = outCol(rows, 'totalcount');
    if (tc === null) throw new Error('Input string was not in a correct format.'); // Convert.ToInt32(TotalCount.Value.ToString())
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = parseInt(tc, 10);
    ViewBag.cramount = 0;
    ViewBag.dramount = 0;
    ViewBag.avalibalefund = 0;
    ViewBag.NoPerPage = UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    // legacy: Response.Redirect("/page-not-found") (ends the response before ErrorInsert runs)
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ Model: Obj, ViewBag, Type });
}));

module.exports = router;
