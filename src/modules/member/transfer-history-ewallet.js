'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/TransferHistory_Ewallet.cs (TransferHistory_EwalletController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const totalOf = (rows) => { const f = rows[0]; if (!f) return null; const k = Object.keys(f).find((x) => x.toLowerCase() === 'totalcount'); return k === undefined ? null : f[k]; };

const STATEMENT_PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];

async function indexHandler(req, res) {
  // [SessionExpireCheck] => auth middleware. A friendly-URL route default ("Type = 1") overrides query-string values.
  const p = req.p;
  let ddlcustpage = optInt(p.ddlcustpage);
  let Username = p.Username;
  let fromDate = p.fromDate;
  let toDate = p.toDate;
  let CrDrType = p.CrDrType;
  let TrType = p.TrType;
  let page = optInt(p.page);
  const Type = req.routeDefaults && req.routeDefaults.Type !== undefined ? req.routeDefaults.Type : p.Type;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (Username === undefined || Username === null) Username = '';
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  if (CrDrType === undefined || CrDrType === null) CrDrType = '';
  if (TrType === undefined || TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const IncomeType = Type; // eslint-disable-line no-unused-vars
  const ViewBag = { abc: '' };
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const Plid = Number(req.user.plid);
    // PORT-NOTE: OUT params (@StrResult,@TotalCount) are read from columns of the first result row.
    const rows = await db.proc(DB, 'usp_fund_history_transfer', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: Username, startrowindex: page, maxrows: MaxRows,
    });
    Obj = mapRows(rows, STATEMENT_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const tc = totalOf(rows);
    // Convert.ToInt32(TotalCount.Value.ToString()) throws (=> redirect) when the value is missing
    const TotalRecord = tc === null || tc === undefined ? 0 : parseInt(tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.cramount = 0;
    ViewBag.dramount = 0;
    ViewBag.avalibalefund = 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    // legacy: Response.Redirect("/page-not-found") (the ErrorInsert code after it is unreachable)
    console.error('TransferHistory_Ewallet/Index', Exp);
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/CustomerPanel/TransferHistory_Ewallet/Index.cshtml', Model: Obj, ViewBag });
}

// auth
router.all('/member/TransferHistory_Ewallet/Index{/:id}', auth, asyncHandler(indexHandler));
// route-config: "referral/gEUxSIO_slash_5155cdvnvnuyu88Trans" -> TransferHistory_Ewallet/Index with route default Type = 1
router.all('/member/referral/gEUxSIO_slash_5155cdvnvnuyu88Trans', (req, res, next) => { req.routeDefaults = { Type: '1' }; next(); }, auth, asyncHandler(indexHandler));

module.exports = router;
