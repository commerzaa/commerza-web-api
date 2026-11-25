'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Customer_Manual_payout.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Customer_Manual_payout';
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'CRDRTYPE', 'WITHDRAWALAMT', 'WithDrawlPoints', 'ADMINCHARGE', 'TDS', 'TDS_PER', 'STATUS', 'DATE',
  'REJECTAMT', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'EMAILID', 'MOBILE', 'PANNO', 'PAID_MODE', 'RESELLERNAME'];
const out = (row, n) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? null : row[k]; };

// auth
// route-config: franchisee/Customer-Manual-Payout
router.all([P + '/Index{/:id}', '/franchise/franchisee/Customer-Manual-Payout'], auth, asyncHandler(async (req, res) => {
  let { page, SearchField, SearchValue, fromDate, toDate, Requestid } = req.p;
  if (SearchField == null) SearchField = '';
  if (Requestid == null) Requestid = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  const rows = await db.proc('shopping', 'usp_resellerwise_customer_withdrawalhistory_report', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(), FROMDATE: fromDate, TODATE: toDate,
    TRANSACTIONTYPE: '', Status: '', orderbydate: '', DID,
  });
  const DOWNLOADBANKEXCEL = mapRows(rows, PROPS);
  const first = rows[0] || null;
  const tcv = out(first, 'TOTALCOUNT');
  const TotalRecord = parseInt(tcv == null || String(tcv) === '' ? '0' : String(tcv), 10);
  const SumofWithdrawal = Number(tcv); // legacy: Convert.ToDecimal(TOTALCOUNT.Value)
  const totalwithdrwal = Number(out(first, 'totalwithdrawal'));
  const ViewBag = {
    totalWithdrawal: SumofWithdrawal, totalw: totalwithdrwal, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, fromDate, toDate, SearchValue,
  };
  res.json({ Model: DOWNLOADBANKEXCEL, ViewBag, ...ViewBag });
}));

module.exports = router;
