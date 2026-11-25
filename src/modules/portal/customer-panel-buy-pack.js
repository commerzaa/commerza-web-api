'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/BuyPack.cs (BuyPackController, 2 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, csErr, mvcStr, toDecimal, toInt64 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'BuyPack';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: the friendly URL for this controller is commented out in RouteConfig.cs
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/BuyPack/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult BuyPackOfEmail(string PackAmount, string PackID)
// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all(`/portal/${C}/BuyPackOfEmail{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Result = 'ok'; // eslint-disable-line no-unused-vars, prefer-const
  const PLID = toInt64(req.user.plid);
  const Param = {
    PLID, PackAmount: toDecimal(mvcStr(req, 'PackAmount')), PackID: mvcStr(req, 'PackID'), Mode: 'Purchased Email Pack',
    PaymentMode: '7', PaymentModeName: 'Jewria Wallet', PaymentStatus: '1', BankName: 'N/A', BranchName: 'N/A', ReferenceNo: 'N/A',
    ReferenceDate: '', CommentOrRemark: '',
  };
  // Legacy command text: "[SP_PURCHASESMSOREMAILPACKAGE] @PLID,@PackAmount,@PackID,@Mode,@STRRESULT Out" (positional EXEC).
  // The 5th formal parameter of the proc is @PaymentMode (Int, not OUTPUT), so SQL Server rejected the call with error 8162
  // before the proc body ran; the action always failed (HTTP 500) and nothing was purchased.
  // PORT-NOTE: legacy bug reproduced - the proc is NOT executed and the same SqlException is thrown.
  void Param; void db; void DB;
  throw csErr('SqlException', 'The formal parameter "@PaymentMode" was not declared as an OUTPUT parameter, but the actual parameter passed in requested output.');
  // Unreachable in legacy: Result = Convert.ToString(Param[12].Value); return Json(Result);
}));

module.exports = router;
