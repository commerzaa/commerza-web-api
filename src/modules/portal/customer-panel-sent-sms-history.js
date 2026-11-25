'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SentSmsHistory.cs (SentSmsHistoryController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { outCol } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const COLS = ['RowNumber', 'TSCMID', 'MSGTYPE', 'FROMM', 'TOM', 'SENDMESSAGE', 'SENDSTATUS', 'MSGDATE', 'CampaignName', 'CampaignDateAndTime', 'CreateDate', 'SendingStatus'];

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/sentsmshistory -> SentSmsHistory/Index
router.all(['/portal/SentSmsHistory/Index{/:id}', '/portal/SentSmsHistory', '/portal/merchant/sentsmshistory'], ps.customerAuth, asyncHandler(async (req, res) => {
  let { fromdate, todate, Status, page } = req.p;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (Status == null) Status = '';
  page = (page === undefined || page === null || page === '') ? 1 : parseInt(page, 10);
  const Plid = Number(req.user.plid);
  const MaxRows = 20; // UtilityClass.GridPageSize()
  const rows = await db.proc(DB, 'send_sms_history', {
    plid: Plid, tscmid: '0', fromdate: String(fromdate).trim(), todate: String(todate).trim(), status: Status,
    startrowindex: page, maxrows: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT read from the 'intresult' column of the first row (0 when no rows)
  const t = outCol(rows[0], 'intresult');
  const TotalRecord = t === null ? 0 : parseInt(t, 10) || 0;
  res.json({
    view: '~/Views/CustomerPanel/SentSmsHistory/Index.cshtml',
    Model: mapRows(rows, COLS),
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    Status, fromDate: fromdate, toDate: todate, IsPopUpCheck: 1,
  });
}));

module.exports = router;
