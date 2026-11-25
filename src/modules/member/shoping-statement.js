'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/Shoping_Statement.cs  (Shoping_StatementController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const BASE = '/member/Shoping_Statement';
const PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const outv = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// Convert.ToDouble(x.Value.ToString()); output parameters missing (no result row) are treated as 0
const dbl = (v) => { if (v === null || v === undefined || v === '') return 0; const n = Number(v); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };

// Index(int? page, string fromDate, string toDate, string CrDrType, string TrType, int? ddlcustpage, string Type, string ISHOLD)  [SessionExpireCheck]
// route-config: referral/shopping-statement ; referral/gEUxSIO_slash_5155cd8CtBtuA67aFNhG6yqL
// auth
router.all([`${BASE}/Index{/:id}`, BASE, '/member/referral/shopping-statement', '/member/referral/gEUxSIO_slash_5155cd8CtBtuA67aFNhG6yqL'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = toInt(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  let fromDate = req.p.fromDate === undefined || req.p.fromDate === null ? '' : String(req.p.fromDate);
  let toDate = req.p.toDate === undefined || req.p.toDate === null ? '' : String(req.p.toDate);
  let CrDrType = req.p.CrDrType === undefined || req.p.CrDrType === null ? '' : String(req.p.CrDrType);
  let TrType = req.p.TrType === undefined || req.p.TrType === null ? '0' : String(req.p.TrType);
  if (TrType === '') TrType = '0';
  const ISHOLD = req.p.ISHOLD === undefined || req.p.ISHOLD === null ? '0' : String(req.p.ISHOLD);
  let Obj = [];
  let IncomeType = req.p.Type === undefined ? null : req.p.Type; // string Type (null when absent)
  const ViewBag = { abc: '' };
  if (IncomeType === '1') {
    ViewBag.abc = 'Shopping Statement';
    IncomeType = '0';
  } else {
    ViewBag.abc = 'Coupon Statement';
  }
  try {
    const MaxRows = ddlcustpage;
    let page = toInt(req.p.page);
    if (page === null) page = 1;
    const Plid = Number(req.user.plid);
    const trtype = Number(TrType);
    if (TrType.trim() === '' || !Number.isInteger(trtype)) throw new Error('Input string was not in a correct format.'); // Convert.ToInt32(TrType)
    // PORT-NOTE: all OUT parameters (@StrResult, @TotalCount, @cramount, @dramount, @avalibalefund, @GrossCoinWallet, @UsedCoinWallet,
    //   @GrossCommissionWallet, @UsedCommissionWallet, @AvailableCommissionWallet) are read from the first result row (0 when no rows).
    const rows = await proc(DB, 'usp_shopingstatementhistory', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: '', startrowindex: page, maxrows: MaxRows,
      crdrtype: CrDrType, trtype, incometype: IncomeType, ishold: ISHOLD,
    });
    Obj = mapRows(rows, PROPS);
    const first = rows[0];
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = Math.trunc(dbl(outv(first, 'totalcount')));
    const cramountt = dbl(outv(first, 'cramount'));
    const dramountt = dbl(outv(first, 'dramount'));
    const avalibalefundd = dbl(outv(first, 'avalibalefund'));
    dbl(outv(first, 'grosscoinwallet'));
    dbl(outv(first, 'usedcoinwallet'));
    const GCommissionWallet = dbl(outv(first, 'grosscommissionwallet'));
    const UCommissionWallet = dbl(outv(first, 'usedcommissionwallet'));
    const ACommissionWallet = dbl(outv(first, 'availablecommissionwallet'));
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
    // C# calls Response.Redirect("/page-not-found") first (ends the request), so the ErrorInsert below it never ran
    return res.json({ redirect: '/page-not-found' });
  }
  res.json({ view: '~/Views/CustomerPanel/Shoping_Statement/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
