'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { proc } = require('../db');
const { mapRows } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');
const DataUtility = require('../lib/DataUtility');

const router = express.Router();

// Convert.ToInt64(string): null => 0, invalid => FormatException
function toInt64(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
const toInt32 = toInt64;

const WALLET_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance'];

// auth
router.post('/api/Income_WalletStatement', auth, asyncHandler(async (req, res) => {
  let { plid, page, fromDate, toDate, CrDrType, TrType, ddlcustpage } = req.p;
  page = (page === undefined || page === null || page === '') ? null : Number(page);
  ddlcustpage = (ddlcustpage === undefined || ddlcustpage === null || ddlcustpage === '') ? null : Number(ddlcustpage);
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (CrDrType == null) CrDrType = '';
  if (TrType == null) TrType = '0';
  if (TrType === '') TrType = '0';
  const responseData = [];
  try {
    const MaxRows = ddlcustpage;
    if (page == null) page = 1;
    const Plid = toInt64(plid);
    const rows = await proc('affiliate', 'USP_TRANSACTIONHISTORY_Commission', {
      plid: Plid,
      fromdate: fromDate,
      todate: toDate,
      startrowindex: page,
      maxrows: MaxRows,
      crdrtype: CrDrType,
      trtype: toInt32(TrType),
    });
    // PORT-NOTE: the unused OUT values (@StrResult,@TotalCount,@cramount,...) were only converted for the (commented-out) ViewBag; not re-parsed here.
    const Obj = mapRows(rows, WALLET_PROPS);
    await UtilityClass.GridNumbersPerPage();
    responseData.push({ status: 'true', message: 'success', data: Obj });
  } catch (Exp) {
    console.error(Exp);
    try {
      const ut = new DataUtility();
      // PORT-NOTE: C# stack-trace line number / Win32 error code have no equivalent => 0
      await ut.ErrorInsert(0, Exp.message, 'Usp_TransactionHistory', 0, req.path);
    } catch (e2) { console.error(e2); }
    responseData.push({ status: 'false', message: 'error', _error: Exp.message });
  }
  res.json(responseData);
}));

module.exports = router;
