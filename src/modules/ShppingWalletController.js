'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { proc } = require('../db');
const { mapRows, netDate } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');

const router = express.Router();

function toInt64(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

// Shoping_Statement (declared in TopupWalletController.cs)
const SHOPING_PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance', 'Date', 'Amount'];

// auth
router.post('/api/Shipping_WalletStatement', auth, asyncHandler(async (req, res) => {
  let { plid, page, fromDate, toDate, CrDrType, TrType, ddlcustpage, Type, ISHOLD } = req.p;
  page = (page === undefined || page === null || page === '') ? null : Number(page);
  ddlcustpage = (ddlcustpage === undefined || ddlcustpage === null || ddlcustpage === '') ? null : Number(ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  if (ISHOLD == null) ISHOLD = '0';
  let IncomeType = Type == null ? null : Type;
  if (IncomeType === '1') IncomeType = '0';
  const responseData = [];
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const Plid = toInt64(plid);
    if (!/^[+-]?\d+$/.test(String(TrType).trim())) throw new Error('Input string was not in a correct format.');
    const rows = await proc('affiliate', 'USP_SHOPINGSTATEMENTHISTORY', {
      plid: Plid,
      fromdate: fromDate,
      todate: toDate,
      username: '',
      startrowindex: page,
      maxrows: MaxRows,
      crdrtype: CrDrType,
      trtype: Number(TrType),
      incometype: IncomeType,
      ishold: ISHOLD,
    });
    // PORT-NOTE: the unused OUT values (@StrResult,@TotalCount,@cramount,...) were only converted for the (commented-out) ViewBag; not re-parsed here.
    const Obj = mapRows(rows, SHOPING_PROPS).map((r) => ({ ...r, Date: netDate(r.Date) }));
    await UtilityClass.GridNumbersPerPage();
    responseData.push({ status: 'true', message: 'success', data: Obj });
  } catch (Exp) {
    console.error(Exp);
    // PORT-NOTE: C# called HttpContext.Current.Response.Redirect("/page-not-found") first in the catch block,
    // which aborts the request (302) before ErrorInsert / the error JSON are reached. Reproduced as a redirect.
    return res.redirect(302, '/page-not-found');
  }
  res.json(responseData);
}));

module.exports = router;
