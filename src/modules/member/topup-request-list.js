'use strict';
// Ported from Member/Controllers/CustomerPanel/Topup_Request_List.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const DB = 'affiliate';
const Topup_Requests_List = ['RowNumber', 'TFHID', 'RegNo', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId', 'FullName', 'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName', 'BranchName', 'ReferenceNumber', 'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin', 'TransactionId'];

// auth ([SessionExpireCheck]). route-config: url "referral/new-deposit-history"
router.all(['/member/Topup_Request_List/Index{/:id}', '/member/Topup_Request_List', '/member/referral/new-deposit-history'], auth, asyncHandler(async (req, res) => {
  const MaxRows = await UtilityClass.GridPageSize();
  let { page, fromDate, toDate } = req.p;
  if (page == null || page === '') page = 1; else page = Number(page);
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  // (legacy auto-approval thread for BTC is commented out in the C#)
  const Plid = Number(req.user.plid);
  const RegNo = Number(await scalar(DB, 'select regno from member_master where regno = @Plid limit 1', { Plid })) || 0;
  const rows = await proc(DB, 'usp_fund_request', {
    mode: '2', regno: RegNo, type: 'Cr', amount: '0', remark: '', paymentmode: '0', paymentmodename: '',
    challanimage: '', bankname: '', branchname: '', referencenumber: '', referencedate: '',
    fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
  });
  // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  res.json({
    View: '~/Views/CustomerPanel/Topup_Request_List/Index.cshtml',
    Model: mapRows(rows, Topup_Requests_List),
    ViewBag: {
      fromDate, toDate, CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
}));

module.exports = router;
