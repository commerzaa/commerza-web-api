'use strict';
// Ported from Member/Controllers/CustomerPanel/ProvideHelp_History.cs  (DB: affiliate)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const HelpHistoryHistory = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date', 'Expire_Date', 'BTC_Address', 'InvestID', 'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status', 'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip', 'Remark', 'TLoginID', 'FLoginID', 'str_Create_Date', 'LinkID', 'PHStatus', 'qrcode'];

// auth (legacy: Session["Plid"] == null -> redirect Home/Index). route-config: url "referral/Wi3n3r0P5aUrCPvp3Z0ohPgfdgfH=="
router.all(['/member/ProvideHelp_History/Index{/:id}', '/member/ProvideHelp_History', '/member/referral/Wi3n3r0P5aUrCPvp3Z0ohPgfdgfH=='], auth, asyncHandler(async (req, res) => {
  const regno = Number(req.user.plid);
  const rows = await proc(DB, 'usp_dashboard_help_requests', { plid: regno });
  res.json({ View: '~/Views/CustomerPanel/ProvideHelp_History/Index.cshtml', Model: mapRows(rows, HelpHistoryHistory) });
}));

module.exports = router;
