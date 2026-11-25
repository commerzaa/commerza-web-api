'use strict';
// Port of Member\Common\Controllers\CustomerPanel\GetHelp_History.cs (GetHelp_HistoryController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DB = 'affiliate';
const HelpHistoryHistory = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date', 'Expire_Date', 'BTC_Address', 'InvestID', 'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status', 'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip', 'Remark', 'TLoginID', 'FLoginID', 'str_Create_Date', 'LinkID', 'PHStatus', 'qrcode'];

// route-config: referral/Wi3n3r0P5aUrCPvp3Z0ohGkkkkkH== -> GetHelp_History/Index
// auth
router.all(['/member/GetHelp_History/Index{/:id}', '/member/referral/Wi3n3r0P5aUrCPvp3Z0ohGkkkkkH=='], auth, asyncHandler(async (req, res) => {
  const regno = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_dashboard_help_requests', { plid: regno });
  res.json(mapRows(rows, HelpHistoryHistory));
}));

module.exports = router;
