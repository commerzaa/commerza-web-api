'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/SentEmailHistory.cs (SentEmailHistoryController)
 * Prefix: /merchant   DB: Merchant DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';

const MAIL_PROPS = ['RowNumber', 'TECMID', 'FROMEMAIL', 'TOEMAIL', 'SUBJECT', 'MESSAGE', 'SENDDATE', 'CampaignName', 'CampaignDateAndTime', 'CreateDate', 'SendingStatus'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all('/merchant/SentEmailHistory/Index{/:id}', auth, asyncHandler(async (req, res) => {
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
    // legacy passed @PLID = "" (implicit conversion to 0 on SQL Server)
    await proc(DB, 'send_mail_history', { plid: 0, tecmid: TECMID });
    // Response.Redirect("/merchant/sentemailhistory")
    return res.json({ redirect: '/merchant/sentemailhistory' });
  }
  //*For Deleting Based on ID Parameter End*//
  const Plid = Number(req.user.plid);
  const MaxRows = 20; // UtilityClass.GridPageSize()
  // PORT-NOTE: @IntResult OUT is read from the first result row (column "intresult"); 0 when no rows.
  const rows = await proc(DB, 'send_mail_history', {
    plid: Plid, tecmid: '0', fromdate: fromdate.trim(), todate: todate.trim(), status: Status, startrowindex: page, maxrows: MaxRows,
  });
  const MAIL_HISTORY = mapRows(rows, MAIL_PROPS);
  const TotalRecord = totalOf(rows, 'intresult');
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    Status, fromDate: fromdate, toDate: todate, IsPopUpCheck: 1,
  };
  return res.json({ view: '~/Views/SentEmailHistory/Index.cshtml', Model: MAIL_HISTORY, ViewBag });
}));

// ---- RemoveCampaign ------------------------------------------------------------------------------------
// auth
router.all('/merchant/SentEmailHistory/RemoveCampaign{/:id}', auth, asyncHandler(async (req, res) => {
  const id = parseInt(req.p.id, 10);
  if (Number.isNaN(id)) throw new Error('The parameters dictionary contains a null entry for parameter \'id\' of non-nullable type \'System.Int32\'.');
  // PORT-NOTE: legacy called UtilityClass.Decryptword(int id) which is `throw new NotImplementedException()`; behaviour kept (request fails with 500).
  throw new Error('The method or operation is not implemented.');
}));

module.exports = router;
