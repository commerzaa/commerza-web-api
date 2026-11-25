'use strict';
// Ported from Franchise\Controllers\CustomerPanel\SentSmsHistory.cs (database: shopping - DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const COLS = ['RowNumber', 'TSCMID', 'MSGTYPE', 'FROMM', 'TOM', 'SENDMESSAGE', 'SENDSTATUS', 'MSGDATE', 'CampaignName', 'CampaignDateAndTime', 'CreateDate', 'SendingStatus'];

// auth
// route-config: merchant/sentsmshistory -> Index
router.all(['/merchant/SentSmsHistory/Index{/:id}', '/merchant/sentsmshistory'], ...guard, asyncHandler(async (req, res) => {
  let { fromdate, todate, Status, page } = req.p;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (Status == null) Status = '';
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const Plid = Number(req.user.plid);
  const MaxRows = 20;
  const rows = await db.proc(DB, 'send_sms_history', {
    PLID: Plid, TSCMID: '0', FromDate: String(fromdate).trim(), ToDate: String(todate).trim(), Status,
    STARTROWINDEX: page, MAXROWS: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT read from the 'intresult' column of the first row (0 when no rows)
  const TotalRecord = rows.length && rows[0].intresult != null ? Number(rows[0].intresult) : 0;
  res.json({
    Model: mapRows(rows, COLS),
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    Status, fromDate: fromdate, toDate: todate, IsPopUpCheck: 1,
  });
}));

module.exports = router;
