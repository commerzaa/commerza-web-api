'use strict';
// Ported from Member/Controllers/CustomerPanel/TransferHistory_Shoppingwallet.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
// class Shoping_Statement (FranchiseApply.cs)
const Shoping_Statement = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];

async function Index(req, res, routeDefaults) {
  const p = { ...req.p.all(), ...(routeDefaults || {}) };
  const g = (k) => p[k.toLowerCase()];
  let page = g('page'); let fromDate = g('fromDate'); let toDate = g('toDate'); let CrDrType = g('CrDrType'); let TrType = g('TrType');
  let ddlcustpage = g('ddlcustpage'); const Type = g('Type'); let Username = g('Username');
  if (ddlcustpage == null || ddlcustpage === '') ddlcustpage = 100; else ddlcustpage = Number(ddlcustpage);
  if (Username == null) Username = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const IncomeType = Type; // unused in legacy
  const ViewBag = { abc: '' };
  try {
    const MaxRows = Number(ddlcustpage);
    if (page == null || page === '') page = 1; else page = Number(page);
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_fund_history_transfer_shopping', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: Username, startrowindex: page, maxrows: MaxRows,
    });
    Obj = mapRows(rows, Shoping_Statement);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 if none)
    const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.cramount = 0;
    ViewBag.dramount = 0;
    ViewBag.avalibalefund = 0;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (Exp) {
    // legacy: Response.Redirect("/page-not-found") (ThreadAbortException, the ErrorInsert block after it is unreachable)
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ View: '~/Views/CustomerPanel/TransferHistory_Shoppingwallet/Index.cshtml', Model: Obj, ViewBag });
}

// auth ([SessionExpireCheck])
router.all(['/member/TransferHistory_Shoppingwallet/Index{/:id}', '/member/TransferHistory_Shoppingwallet'], auth, asyncHandler((req, res) => Index(req, res)));
// route-config: url "referral/gEUxSIO_slash_5155cdvnvnuyu88TransSW" -> Index with route default Type = 1 (route defaults win over query values)
router.all('/member/referral/gEUxSIO_slash_5155cdvnvnuyu88TransSW', auth, asyncHandler((req, res) => Index(req, res, { type: 1 })));

module.exports = router;
