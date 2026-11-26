// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/MakePayment.cs
'use strict';
/**
 * MakePaymentController (PayU add-fund payment). DB: Db_Shopping => 'shopping'.
 * C# members: Index, Success, Failure, ProceedToPayment (public void), Generatehash512, Generatetxnid (public string),
 *             nested class RemotePost (=> batch-21-common RemotePost). [CheckResellerTimeout] is a no-op (ps.portalSession).
 * Session["PaymentForOrder"] holds a PaymentForAddFund {PLID, Name, Payamount, Product, Email, Mobile, PaymentMode, CommentORRemark, OrderId}
 * written by CustomerPanel/AddFund.
 * PORT-NOTE: legacy cast (PaymentForAddFund)Session["PaymentForOrder"] threw InvalidCastException when another payment object
 *   (OrderPayment / OnlinePaymentForPackage) was stored; session objects are plain JSON now, so that cast cannot fail
 *   (missing properties read as null).
 */
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { NRE, s, outVal, viewJson, Generatehash512, Generatetxnid, RemotePost } = require('./_shared/batch-21-common');

const DB = 'shopping';
const P = '/portal/MakePayment';
const router = express.Router();

// public void ProceedToPayment(string UserName, string Amount, string ProductInfo, string Email, string Phone, string OrderId)
function ProceedToPayment(res, UserName, Amount, ProductInfo, Email, Phone, OrderId) {
  const myremotepost = new RemotePost();
  // ConfigurationManager.AppSettings["MERCHANT_KEY"/"SALT"/"PAYU_URL"].ToString() - secrets read from config, never hard-coded
  const key = s(config.app.MERCHANT_KEY || '');
  const salt = s(config.app.SALT || '');
  myremotepost.Url = s(config.app.PAYU_URL || '');
  myremotepost.Add('key', key);
  const txnid = OrderId;
  myremotepost.Add('txnid', txnid);
  myremotepost.Add('amount', Amount);
  myremotepost.Add('productinfo', ProductInfo);
  myremotepost.Add('firstname', UserName);
  myremotepost.Add('phone', Phone);
  myremotepost.Add('email', Email);
  // PORT-NOTE: legacy hard-coded the local-host return URLs below (server URLs were commented out); kept verbatim.
  myremotepost.Add('surl', 'http://localhost:41075/merchant/payment-successful'); // For Local Host
  myremotepost.Add('furl', 'http://localhost:41075/merchant/transection-failure');
  myremotepost.Add('service_provider', 'payu_paisa');
  const hashString = key + '|' + s(txnid) + '|' + s(Amount) + '|' + s(ProductInfo) + '|' + s(UserName) + '|' + s(Email) + '|||||||||||' + salt;
  const hash = Generatehash512(hashString);
  myremotepost.Add('hash', hash);
  return myremotepost.Post(res);
}

// ---- Index ------------------------------------------------------------------------------------------------
// public (legacy: no session check; reads Session["PaymentForOrder"])
router.all([`${P}/Index{/:id}`, P], ps.portalSession, asyncHandler(async (req, res) => {
  const op = ps.sessionGet(req, 'PaymentForOrder');
  if (op !== null && op !== undefined) {
    // ProceedToPayment => RemotePost.Post() => Response.End(): the auto-submit form is the response (the view is never rendered)
    return ProceedToPayment(res, op.Name, op.Payamount, op.Product, op.Email, op.Mobile, op.OrderId);
  }
  return viewJson(res, '~/Views/CustomerPanel/AddFund/Index.cshtml');
}));

// ---- Success (PayU surl) -------------------------------------------------------------------------------------
// public (payment-gateway return URL): identity from the portal session snapshot (ps.callbackSession)
router.all(`${P}/Success{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  const op = ps.sessionGet(req, 'PaymentForOrder');
  if (op !== null && op !== undefined) {
    let ReturnOutput = '';
    if (!ps.isCustomer(req)) throw NRE(); // Convert.ToInt64(((Login)Session["Plid"]).Plid)
    const PLID = Math.trunc(Number(req.user.plid));
    const ObjPayment = op;
    const row = await db.procOne(DB, 'usp_addfundnew', {
      plid: PLID, paymenttype: 'Online Banking', depositamount: ObjPayment.Payamount, checkno: '', depositdate: '', bankname: '',
      branchname: '', accountnumber: '', couponno: '', fromloginid: '', password: '', reqfrom: '', remark: ObjPayment.CommentORRemark,
      fname: '', lname: '', emailid: '', contactno: '', ipaddress: '', amountinpound: '',
    });
    ReturnOutput = s(outVal(row, 'strresult')); // Param[13].Value.ToString(): DBNull => ''
    void ReturnOutput; // legacy computed it but did not pass it to the view
    ps.sessionSet(req, 'PaymentForOrder', null);
  }
  return viewJson(res, '~/Views/CustomerPanel/MakePayment/Success.cshtml');
}));

// ---- Failure (PayU furl) -------------------------------------------------------------------------------------
// public (payment-gateway return URL)
router.all(`${P}/Failure{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  ps.sessionSet(req, 'PaymentForOrder', null);
  return viewJson(res, '~/Views/CustomerPanel/MakePayment/Failure.cshtml');
}));

// ---- ProceedToPayment (public void action) ---------------------------------------------------------------------
// auth (legacy: public void action without session check; PORT-NOTE: protected because it signs arbitrary PayU requests with the merchant SALT)
router.all(`${P}/ProceedToPayment{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const { UserName, Amount, ProductInfo, Email, Phone, OrderId } = req.p;
  return ProceedToPayment(res, UserName, Amount, ProductInfo, Email, Phone, OrderId);
}));

// ---- Generatehash512 / Generatetxnid (public string actions => Content) ----------------------------------------
// public (legacy: no session check)
router.all(`${P}/Generatehash512{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatehash512(req.p.text));
}));

// public (legacy: no session check)
router.all(`${P}/Generatetxnid{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatetxnid());
}));

module.exports = router;
