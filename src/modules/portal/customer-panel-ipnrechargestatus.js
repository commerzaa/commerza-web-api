'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/IPNRECHARGESTATUSController.cs (IPNRECHARGESTATUSController)
// Actions: Index (1) - recharge API IPN callback.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { DB, mvcStr, outOf, csStr } = require('./_shared/batch-04-common');

const router = express.Router();

// public (recharge-provider IPN callback, no session in legacy)
// route-config: IPN-RECHARGE-STATUS -> IPNRECHARGESTATUS/Index
router.all(['/portal/IPNRECHARGESTATUS/Index{/:id}', '/portal/IPNRECHARGESTATUS', '/portal/IPN-RECHARGE-STATUS'], asyncHandler(async (req, res) => {
  const txnid = csStr(mvcStr(req.p.txnid));
  const status = csStr(mvcStr(req.p.status));
  const opref = csStr(mvcStr(req.p.opref));
  const msg = csStr(mvcStr(req.p.msg));
  const usertxn = csStr(mvcStr(req.p.usertxn));
  let Stresult = '';
  // [DBO].[USP_IPN_RECHARGE_STATUS_Mobile] @ORDERNUMBER,@status,@opref,@msg,@usertxn,@STRRESULT out
  // PORT-NOTE: @status/@msg are DECIMAL(18,8) in the procedure; legacy passed the raw strings (SQL Server converted them, a non-numeric value failed).
  const rows = await db.proc(DB, 'usp_ipn_recharge_status_mobile', { ordernumber: txnid, status, opref, msg, usertxn });
  Stresult = csStr(outOf(rows, 'strresult'));
  if (Stresult === 'SUCCESS') {
    // empty block in legacy
  }
  res.json({ view: '~/Views/IPNRECHARGESTATUS/Index.cshtml' });
}));

module.exports = router;
