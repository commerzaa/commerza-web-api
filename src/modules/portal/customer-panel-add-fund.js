'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AddFund.cs (class AddFundController => /portal/AddFund/...)
// Database: shopping (Db_Shopping). (RouteConfig entry for AddFund is commented out.)
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, outv, s, toInt64, ImageUploadMasterMethod } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AddFund';

/** class FUNDDETAILS */
const FUNDDETAILS = ['rowNumber', 'CREDITDATE', 'DEPOSITDATE', 'DEPOSITAMOUNT', 'PAYMENTTYPE', 'STATUS', 'COMMENT'];
/** class PaymentForAddFund (Controllers/CustomerPanel/MakePayment.cs) */
const PAYMENT_FOR_ADD_FUND = ['PLID', 'Name', 'Payamount', 'Product', 'Email', 'Mobile', 'PaymentMode', 'CommentORRemark', 'OrderId'];

/** public string PayByPayYouMoney(string PLID, string Amount, string CommentORRemark) (also an MVC action, see below) */
async function PayByPayYouMoney(req, PLID, Amount, CommentORRemark) {
  let ReturnOutput = 'PayYouMoney';
  try {
    const row = await db.procOne(DB, 'Usp_PayByPayuMoney', { PLID, Amount, CommentOrRemark: CommentORRemark });
    const Obj = mapRow(row, PAYMENT_FOR_ADD_FUND); // FirstOrDefault() => null when no row
    ps.sessionSet(req, 'PaymentForOrder', Obj);
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    ReturnOutput = 'Some Exception Occur : ' + Exp.message;
  }
  return ReturnOutput;
}

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${C}/Index{/:id}`, C], ps.customerAuth, asyncHandler(async (req, res) => {
  ps.sessionSet(req, 'PaymentForOrder', null);
  const rows = await db.proc(DB, 'USP_ADD_FUND', {});
  const Fund_LIST = mapRows(rows, FUNDDETAILS);
  return view(res, '~/Views/CustomerPanel/AddFund/Index.cshtml', Fund_LIST);
}));

// ---------------------------------------------------------------- AddFundInWallet(string Amount, string CommentORRemark)
// auth (legacy: unguarded (Login)Session["Plid"] => NullReferenceException without a session)
router.all(`${C}/AddFundInWallet{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let ReturnOutput = 'success';
  const PLID = toInt64(req.user.plid);
  ReturnOutput = await PayByPayYouMoney(req, String(PLID), req.p.Amount, req.p.CommentORRemark);
  return res.json(ReturnOutput);
}));

// ---------------------------------------------------------------- PayByPayYouMoney(string PLID, string Amount, string CommentORRemark)
// auth (PORT-NOTE: public helper method => reachable MVC action in legacy WITHOUT a session check; it stores a payment object for any
// PLID in the session, so it is protected here. The PLID parameter is still taken from the request, as in legacy.)
router.all(`${C}/PayByPayYouMoney{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const out = await PayByPayYouMoney(req, req.p.PLID, req.p.Amount, req.p.CommentORRemark);
  return res.type('text/html').send(out); // string action => ContentResult
}));

// ---------------------------------------------------------------- AddFundInWalletByOffline(PaymentMode, Amount, BankName, BranchName, ReferenceNumber, Date, Receipt, CommentORRemark)
// auth (legacy: unguarded (Login)Session["Plid"] => NullReferenceException without a session)
router.all(`${C}/AddFundInWalletByOffline{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let ReturnOutput = 'success';
  const PLID = toInt64(req.user.plid);
  // AddTicketController Obj = new AddTicketController(); Obj.ImageUploadMasterMethod(...)
  const ImageName = await ImageUploadMasterMethod(p.Receipt, s(config.app.PaymentReciptImage), String(PLID));
  const rows = await db.proc(DB, 'USP_ADDFUNDNEW', {
    PLID, PAYMENTTYPE: p.PaymentMode, DEPOSITAMOUNT: p.Amount, CHECKNO: p.ReferenceNumber, DEPOSITDATE: p.Date, BANKNAME: p.BankName,
    BRANCHNAME: p.BranchName, ACCOUNTNUMBER: '', COUPONNO: '', FROMLOGINID: '', PASSWORD: '', REQFROM: '', REMARK: p.CommentORRemark,
    FNAME: '', LNAME: '', EMAILID: '', CONTACTNO: '', IPADDRESS: ImageName,
    AMOUNTINPOUND: 0, // legacy passed "" to a MONEY parameter (SQL Server converted it to 0)
  });
  // Param[13].Value.ToString() (@STRRESULT OUT)
  ReturnOutput = s(outv(rows, 'STRRESULT'));
  ps.sessionSet(req, 'PaymentForOrder', null);
  return res.json(ReturnOutput);
}));

module.exports = router;
