'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/CustomerPanel/CP_Request_List.cs (CP_Request_ListController) - database: Db_Shopping
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const P = '/merchant/CP_Request_List';
const PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId', 'FullName', 'ByUserFullName',
  'ByUsername', 'GeneratedBy', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber', 'ReferenceDate',
  'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin', 'TransactionId'];

// auth ([SessionExpireCheck]) - route-config: merchant/cp-request-list
router.all([`${P}/Index{/:id}`, '/merchant/merchant/cp-request-list{/:id}'], auth, asyncHandler(async (req, res) => {
  let { fromDate, toDate, page } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const BranchId = Number(req.user.plid);
  const ViewBag = { BranchId };
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  // PORT-NOTE: @StrResult OUT / @TotalCount OUT are returned as columns of the result rows; TotalCount read from the first row (0 when none)
  const rows = await db.proc(DB, 'usp_merchant_fund_request', {
    mode: 2, regno: BranchId, type: 'Cr', amount: '0', remark: '', paymentmode: '0', paymentmodename: '', challanimage: '', bankname: '',
    branchname: '', referencenumber: '', referencedate: '', fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
    ifsccode: '', transactionid: '', bankid: 0, cppoint: '0',
  });
  const objORDERTRANSACTIONS = mapRows(rows, PROPS);
  const f = rows && rows[0];
  const tcKey = f && Object.keys(f).find((x) => x.toLowerCase() === 'totalcount');
  const TotalRecord = tcKey ? (parseInt(f[tcKey], 10) || 0) : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.BranchId = BranchId;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  res.json({ view: '~/Views/CP_Request_List/Index.cshtml', Model: objORDERTRANSACTIONS, ViewBag });
}));

module.exports = router;
