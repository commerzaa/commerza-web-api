'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/SentEmailHistory.cs (SentEmailHistoryController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { nn, outCol } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const MAIL_PROPS = ['RowNumber', 'TECMID', 'FROMEMAIL', 'TOEMAIL', 'SUBJECT', 'MESSAGE', 'SENDDATE', 'CampaignName', 'CampaignDateAndTime', 'CreateDate', 'SendingStatus'];

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/sentemailhistory -> SentEmailHistory/Index
router.all(['/portal/SentEmailHistory/Index{/:id}', '/portal/SentEmailHistory', '/portal/merchant/sentemailhistory{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = req.p.id;
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Status = nn(req.p.Status);
  let page = parseInt(req.p.page, 10);
  if (Number.isNaN(page)) page = 1;
  //*For Deleting Based on ID Parameter Start*//
  if (id !== undefined && id !== null && id !== '') {
    const dec = await UtilityClass.Decryptword(id);
    const TECMID = parseInt(dec, 10);
    if (Number.isNaN(TECMID)) throw new Error('Input string was not in a correct format.');
    // legacy passed @PLID = "" (converted to 0 by SQL Server)
    await db.proc(DB, 'send_mail_history', { plid: 0, tecmid: TECMID });
    // Response.Redirect ends the request
    return res.json({ redirect: '/merchant/sentemailhistory' });
  }
  //*For Deleting Based on ID Parameter End*//
  const Plid = Number(req.user.plid);
  const MaxRows = 20; // UtilityClass.GridPageSize()
  const rows = await db.proc(DB, 'send_mail_history', {
    plid: Plid, tecmid: '0', fromdate: fromdate.trim(), todate: todate.trim(), status: Status, startrowindex: page, maxrows: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT is read from the first result row (column "intresult"); 0 when no rows.
  const t = outCol(rows[0], 'intresult');
  const TotalRecord = t === null ? 0 : parseInt(t, 10) || 0;
  return res.json({
    view: '~/Views/CustomerPanel/SentEmailHistory/Index.cshtml',
    Model: mapRows(rows, MAIL_PROPS),
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    Status, fromDate: fromdate, toDate: todate, IsPopUpCheck: 1,
  });
}));

// auth (deletes a campaign; legacy had no session check)
router.all('/portal/SentEmailHistory/RemoveCampaign{/:id}', ps.customerAuth, asyncHandler(async (req, res) => { // eslint-disable-line no-unused-vars
  const id = parseInt(req.p.id, 10);
  if (Number.isNaN(id)) throw new Error("The parameters dictionary contains a null entry for parameter 'id' of non-nullable type 'System.Int32'.");
  // PORT-NOTE: legacy called UtilityClass.Decryptword(int id), whose body is `throw new NotImplementedException()`;
  // the SEND_MAIL_HISTORY delete never ran. Behaviour kept (500).
  throw new Error('The method or operation is not implemented.');
}));

module.exports = router;
