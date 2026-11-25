'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\GetHelp.cs (class Get_HelpController => /admin/Get_Help/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; FetchReceiverDetail -> route ; FetchGiveHelpInfo -> route ; CreateManualLinksGetHelp -> route ;
//           model class TBL_WITHDRAWALS.TaxList() -> internal function TaxList() (never called by the controller).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Get_Help';

/** class GetHelpList */
const GHL_PROPS = ['rowNumber', 'GetID', 'RequestID', 'Request_Date', 'LoginId', 'Name', 'Emailid', 'Mobile', 'UserName', 'SpLoginId', 'SpName',
  'SpEmailid', 'SpMobile', 'SpUserName', 'Request_Amount', 'Confirm_Amount', 'Remain_Amount', 'Process_Amount', 'CountDown'];
/** class GiveHelpInfo */
const GHI_PROPS = ['rowNumber', 'InvestID', 'Name', 'Emailid', 'Remain_Amount'];

/** [Table("dbo.TBL_WITHDRAWALS")] class TBL_WITHDRAWALS { TaxList() => db._TBL_WITHDRAWALS.ToList() } */
async function TaxList() {
  return mapRows(await db.query(DB, 'select trans_id, remainamount from tbl_withdrawals', {}), ['Trans_Id', 'REMAINAMOUNT']);
}
void TaxList;

// ---------------------------------------------------------------- ActionResult Index(string SearchField, string SearchValue, string fromDate, string toDate, string orderBy, int? page)
// auth (reads Session["Admin_User"].Emp_ID; legacy NullReference => catch => redirect "/page-not-found")
// route-config: "AdminPanel/Get-Help" -> Get_Help/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Get-Help'], adminAuth, asyncHandler(async (req, res) => {
  let Obj = [];
  const ViewBag = {};
  try {
    let SearchField = B.nStr(req.p.SearchField);
    let SearchValue = B.nStr(req.p.SearchValue);
    let fromDate = B.nStr(req.p.fromDate);
    let toDate = B.nStr(req.p.toDate);
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    if (fromDate === null) fromDate = '';
    if (toDate === null) toDate = '';
    const empId = req.user.emp_id;
    ViewBag.EmpId = empId;
    Obj = mapRows(await db.proc(DB, 'Usp_GetHelpList', { SearchField, SearchValue, fromDate, ToDate: toDate }), GHL_PROPS);
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") FIRST in the catch; its ThreadAbortException ended the request,
    // so the ErrorInsert block after it never ran. Reproduced: redirect only, no ErrorInsert.
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/AdminPanel/GetHelp/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult FetchReceiverDetail(string RequestID)
// auth (withdrawal data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/FetchReceiverDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RequestID = B.nStr(req.p.RequestID);
  let ReqID = '';
  let RemainAmt = '0';
  // db._TBL_WITHDRAWALS.Where(a => a.Trans_Id == RequestID).FirstOrDefault()
  const objGHD = await db.queryOne(DB, 'select trans_id, remainamount from tbl_withdrawals where trans_id = @RequestID limit 1', { RequestID });
  if (objGHD !== null && objGHD !== undefined) {
    ReqID = B.str(objGHD.trans_id);
    // Convert.ToDecimal(objGHD.REMAINAMOUNT) then decimal.ToString() (keeps the stored scale)
    const v = objGHD.remainamount;
    if (v === null || v === undefined) throw new Error('The cast to value type \'System.Decimal\' failed because the materialized value is null.');
    RemainAmt = String(v);
  }
  return res.json('ok^' + ReqID + '^' + RemainAmt);
}));

// ---------------------------------------------------------------- JsonResult FetchGiveHelpInfo(string LinkAmount)
// auth (member data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/FetchGiveHelpInfo{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const LinkAmount = B.nStr(req.p.LinkAmount);
  const objGiveHelpInfo = mapRows(await db.proc(DB, 'usp_GiveHelpInfo', { LinkAmount }), GHI_PROPS);
  return res.json(objGiveHelpInfo);
}));

// ---------------------------------------------------------------- JsonResult CreateManualLinksGetHelp(string RequestID, string investID, string LinkAmount)
// auth (creates help links; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/CreateManualLinksGetHelp{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RequestID = B.nStr(req.p.RequestID);
  const investID = B.nStr(req.p.investID);
  const LinkAmount = B.nStr(req.p.LinkAmount);
  // decimal BTCRate = CommonController.dollarToBitcoinConvertor(1) (commented) => Convert.ToDecimal(1)
  const BTCRate = 1;
  // dbo.usp_getRequest @requestID,@investID,@linkAmount,@btcLinkAmount,@message out  (result rows = Create_Manual_Links_Response_GetHelp, unused)
  const rows = await db.proc(DB, 'usp_getRequest', { requestID: RequestID, investID, linkAmount: LinkAmount, btcLinkAmount: BTCRate });
  const message = B.outStr(rows[0], 'message');
  return res.json(message);
}));

module.exports = router;
