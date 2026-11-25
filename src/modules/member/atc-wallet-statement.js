'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Atc_Wallet_Statement.cs (Atc_Wallet_StatementController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row.
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : null);
const num = (v) => {
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  const n = Number(String(v));
  if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));
const Atc_Wallet_Statement = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance'];

// route-config: referral/kes0wFOkRKI9Be2Enx7qTm5CyY7VeigT -> Atc_Wallet_Statement/Index
// auth (SessionExpireCheck)
router.all(['/member/Atc_Wallet_Statement/Index{/:id}', '/member/referral/kes0wFOkRKI9Be2Enx7qTm5CyY7VeigT'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === '' ? 100 : parseInt(p.ddlcustpage, 10);
  const fromDate = orEmpty(p.fromDate);
  const toDate = orEmpty(p.toDate);
  const CrDrType = orEmpty(p.CrDrType);
  let TrType = p.TrType === undefined || p.TrType === null ? '0' : String(p.TrType);
  if (TrType === '') TrType = '0';
  let Obj = [];
  const ViewBag = {};
  try {
    const MaxRows = ddlcustpage;
    const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
    const Plid = Number(req.user.plid);
    const rows = await db.proc(DB, 'usp_transactionhistory_commission', {
      plid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, crdrtype: CrDrType,
      trtype: parseInt(TrType, 10),
    });
    Obj = mapRows(rows, Atc_Wallet_Statement);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const TotalRecord = parseInt(String(outv(rows, 'totalcount')), 10);
    const cramountt = num(outv(rows, 'cramount'));
    const dramountt = num(outv(rows, 'dramount'));
    const avalibalefundd = num(outv(rows, 'avalibalefund'));
    num(outv(rows, 'grosscoinwallet'));
    num(outv(rows, 'usedcoinwallet'));
    const GCommissionWallet = num(outv(rows, 'grosscommissionwallet'));
    const UCommissionWallet = num(outv(rows, 'usedcommissionwallet'));
    const ACommissionWallet = num(outv(rows, 'availablecommissionwallet'));
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
    // Response.Redirect("/page-not-found") (the ErrorInsert after it is unreachable in legacy)
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ Model: Obj, ...ViewBag });
}));

module.exports = router;
