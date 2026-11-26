// Ported from ClusterofferShopingPortal/Controllers/UserPanel/Proceed_To_Payment.cs
'use strict';
/**
 * Proceed_To_PaymentController (order payment hand-off to PayPal / PayU / Payza / Perfect Money). DB: Db_Shopping => 'shopping'.
 * C# public members: GetIP, Paypal, Payumoney, Payza, PerfactMoney, ProceedToPayment (void), Generatehash512, Generatetxnid
 * (nested classes Item / RemotePost => batch-21-common RemotePost). [CheckResellerTimeout] is a no-op.
 * Session["PaymentForOrder"] = OrderPayment {Email, mobile, name, OrderId, Payamount, Product, Regno} and Session["Cart"]
 * (string "a^name^b^price^c^qty|...") and TempData["TransIDOut"] are written by Proceed_To_CheckOut.Ordersadd.
 * The gateway pages are browser navigations: ps.callbackSession (session cookie, never rejects).
 * PORT-NOTE: C# System.Decimal arithmetic (scale-preserving, Math.Round = banker's rounding) is emulated with BigInt
 *   (batch-21-common dec*). UtilityClass.ExchangeRateFromAPI returns a JS number; its decimal scale is taken from String(number).
 */
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const PayMode = require('../../lib/portal/PayMode');
const CS = require('../../lib/portal/CompanySettings');
const {
  NRE, s, toInt32, viewJson, bindDecimalStr, Generatehash512, Generatetxnid, RemotePost,
  decParse, decFromNumber, decMul, decAdd, decRound, decToString, decFormat00,
} = require('./_shared/batch-21-common');

const CompanySettings = CS.CompanySettings || CS;
const DB = 'shopping';
const C = '/portal/Proceed_To_Payment';
const router = express.Router();

const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || String(v).toLowerCase() === 'true';
/** array index access that throws like C# (IndexOutOfRangeException) */
function at(arr, i) {
  if (i >= arr.length) throw new RangeError('Index was outside the bounds of the array.');
  return arr[i];
}
/** C# string.Trim(char) */
function trimChar(str, c) {
  let a = 0; let b = str.length;
  while (a < b && str[a] === c) a++;
  while (b > a && str[b - 1] === c) b--;
  return str.slice(a, b);
}
/** Session["Cart"].ToString().Trim('|').Trim().Split('|') */
function cartRecords(req) {
  const cart = ps.sessionGet(req, 'Cart');
  if (cart === null || cart === undefined) throw NRE();
  return trimChar(String(cart), '|').trim().split('|');
}
/** db._Member_Master.Where(a => a.REGNO == op.Regno).FirstOrDefault() */
async function memberByRegno(op) {
  if (op === null || op === undefined) throw NRE(); // op.Regno on a null session object
  return db.queryOne(DB, 'select * from member_master where regno = @regno limit 1', { regno: op.Regno });
}
/** TempData["TransIDOut"] null / "" checks (both legacy branches redirect to Dashboard/Index) */
function transIdOut(req) {
  const v = ps.tempDataGet(req, 'TransIDOut');
  if (v === null || v === undefined) return null;
  if (s(v) === '') return null;
  return String(v);
}
const toDashboard = (res) => res.json({ redirect: '/Dashboard/Index' });

// ---- GetIP (public string => Content) ----------------------------------------------------------------------
// public (legacy: no session check)
router.all(`${C}/GetIP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  // request.UserHostAddress
  res.type('text/plain').send(String(req.ip || '').replace(/^::ffff:/, ''));
}));

// ---- Paypal ---------------------------------------------------------------------------------------------------
// public (browser hand-off after checkout; session cookie)
router.all(`${C}/Paypal{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  const apiRate = decFromNumber(Number(await UtilityClass.ExchangeRateFromAPI()));
  const TransIDOut = transIdOut(req);
  if (TransIDOut === null) return toDashboard(res);
  const obj2 = await new PayMode().paymodeby_pmcode('paypal');
  const op = ps.sessionGet(req, 'PaymentForOrder');
  if (obj2 !== null && obj2 !== undefined) {
    const MM = await memberByRegno(op);
    if (!MM) throw NRE(); // MM.FNAME
    const TotalAmount = decParse(op.Payamount); // Convert.ToDecimal (unused, may throw FormatException)
    void TotalAmount;
    const PaymentCurrency = CompanySettings.CompanyCurrency; // unused in legacy
    void PaymentCurrency;
    let HostUrl = '';
    let redirecturl = '';
    if (isTrue(obj2.IsTesting)) {
      HostUrl = s(config.app.HostUrl_Test || '');
      redirecturl += 'https://www.sandbox.paypal.com/cgi-bin/webscr?business=' + s(obj2.UserID);
    } else {
      HostUrl = s(config.app.HostUrl || '');
      redirecturl += 'https://www.paypal.com/cgi-bin/webscr?business=' + s(obj2.UserID);
    }
    redirecturl += '&cmd=_cart';
    redirecturl += '&upload=' + 'https://www.paypal.com/cgi-bin/webscr';
    redirecturl += '&first_name=' + s(MM.fname);
    redirecturl += '&middle_name= ' + s(MM.mname);
    redirecturl += '&last_name=' + s(MM.lname);
    redirecturl += '&address1=' + s(MM.address);
    redirecturl += '&city=' + s(MM.cityname);
    redirecturl += '&state=' + '';
    redirecturl += '&zip=' + s(MM.pincode);
    redirecturl += '&H_PhoneNumber=' + s(MM.mobile);
    redirecturl += '&email-address=' + s(MM.emailid);

    const splitrecords = cartRecords(req);
    ps.sessionSet(req, 'Cart', null);
    let i = 1;
    for (const rcrd of splitrecords) {
      const splitvales = rcrd.split('^');
      redirecturl += '&item_name_' + String(i) + '=' + at(splitvales, 1);
      redirecturl += '&amount_' + String(i) + '=' + decToString(decRound(decMul(apiRate, decParse(at(splitvales, 3))), 2));
      redirecturl += '&custom=' + '123456';
      redirecturl += '&quantity_' + i + '=' + toInt32(at(splitvales, 5));
      i++;
    }

    redirecturl += '&night_phone_a=' + s(MM.mobile);
    redirecturl += '&shipping=0';
    redirecturl += '&handling=0';
    redirecturl += '&tax=0';
    redirecturl += '&currency=' + 'USD';
    redirecturl += '&type=mastercard';
    redirecturl += '&txn_id=' + TransIDOut;
    redirecturl += '&return=' + HostUrl + 'paypalResponse_Success/' + TransIDOut;
    redirecturl += '&cancel_return=' + HostUrl + 'paypalResponse_Cancel/' + TransIDOut;
    redirecturl += '&notify_url=' + HostUrl + 'paymentResponse_paypal';
    // Response.Redirect(redirecturl)
    return res.json({ redirect: redirecturl });
  }
  return viewJson(res, '~/Views/Proceed_To_Payment/Paypal.cshtml');
}));

// ---- Payumoney ------------------------------------------------------------------------------------------------
// public (browser hand-off after checkout; session cookie)
router.all(`${C}/Payumoney{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  const op = ps.sessionGet(req, 'PaymentForOrder');
  if (op !== null && op !== undefined) {
    // RemotePost.Post() => Response.End(): the auto-submit form is the response
    return ProceedToPayment(res, op.OrderId, decToString(decParse(op.Payamount)), op.Product, op.name, op.mobile, op.Email);
  }
  return viewJson(res, '~/Views/Proceed_To_Payment/Payumoney.cshtml');
}));

// ---- Payza ------------------------------------------------------------------------------------------------------
// public (browser hand-off after checkout; session cookie)
// PORT-NOTE: legacy Response.Write the auto-submit form and then rendered ~/Views/proceed_to_payment/payza.cshtml after it;
//   the view is not ported, the written HTML is the response.
router.all(`${C}/Payza{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  const apiRate = decFromNumber(Number(await UtilityClass.ExchangeRateFromAPI()));
  const TransIDOut = transIdOut(req);
  if (TransIDOut === null) return toDashboard(res);
  const op = ps.sessionGet(req, 'PaymentForOrder');
  const obj2 = await new PayMode().paymodeby_pmcode('payza');
  if (obj2 !== null && obj2 !== undefined) {
    const MM = await memberByRegno(op);
    void MM;
    let TotalAmount = decParse('0');
    const PaymentCurrency = config.app.PaymentCurrency; // unused in legacy
    void PaymentCurrency;
    const HostUrl = s(config.app.HostUrl || '');
    let h = '';
    if (isTrue(obj2.IsTesting)) {
      h += "<form name='newForm' method=post action='https://secure.payza.com/checkout'>";
    } else {
      h += "<form name='newForm' method=post action='https://secure.payza.com/checkout'>";
    }

    let Qty = 0;
    const splitrecords = cartRecords(req);
    let i = 1;
    for (const rcrd of splitrecords) {
      const splitvales = rcrd.split('^');
      TotalAmount = decAdd(TotalAmount, decParse(at(splitvales, 3)));
      Qty = Qty + toInt32(at(splitvales, 5));
      i++;
    }
    void i;

    ps.sessionSet(req, 'Cart', null);
    h += `<input type=hidden name="ap_merchant" value="${s(obj2.UserID)}">`;
    h += `<input type=hidden name="ap_purchasetype" value="${'item'}">`;
    h += `<input type=hidden name="ap_itemname" value="${s(op.Product)}">`;
    h += `<input type=hidden name="ap_itemname1" value="${s(op.Product)}">`;
    h += `<input type=hidden name="ap_quantity" value="${String(Qty)}">`;
    h += `<input type=hidden name="ap_description" value="${TransIDOut}">`;
    h += `<input type=hidden name="ap_amount" value="${decToString(decRound(decMul(apiRate, TotalAmount), 2))}">`;
    h += `<input type=hidden name="ap_currency" value="${'USD'}">`;
    h += `<input type=hidden name="ap_cancelurl" value="${HostUrl + 'payzaResponse_Cancel/' + TransIDOut}">`;
    h += `<input type=hidden name="ap_returnurl" value="${HostUrl + 'packages?reqid=' + TransIDOut}">`;
    h += `<input type=hidden name="ap_alerturl" value="${HostUrl + 'paymentResponse_forepin_payza'}">`;
    h += '</form>';
    h += '</body>';
    h += "<SCRIPT LANGUAGE='JavaScript'>document.forms[0].submit();</SCRIPT>";
    return res.status(200).type('html').send(h);
  }
  return viewJson(res, '~/Views/proceed_to_payment/payza.cshtml');
}));

// ---- PerfactMoney -----------------------------------------------------------------------------------------------
// public (browser hand-off after checkout; session cookie)
// PORT-NOTE: same as Payza - the written auto-submit form is the response, the trailing payza.cshtml view is not ported.
router.all(`${C}/PerfactMoney{/:id}`, ps.callbackSession, asyncHandler(async (req, res) => {
  const TransIDOut = transIdOut(req);
  if (TransIDOut === null) return toDashboard(res);
  const obj2 = await new PayMode().paymodeby_pmcode('perfectmoney');
  const op = ps.sessionGet(req, 'PaymentForOrder');
  if (obj2 !== null && obj2 !== undefined) {
    const MM = await memberByRegno(op);
    void MM;
    let TotalAmount = decParse('0');
    const PaymentCurrency = s(config.app.PaymentCurrency || '');
    const HostUrl = s(config.app.HostUrl || '');
    let h = '';
    if (isTrue(obj2.IsTesting)) {
      h += "<form name='newForm' method=post action='https://perfectmoney.is/api/step1.asp'>";
    } else {
      h += "<form name='newForm' method=post action='https://perfectmoney.is/api/step1.asp'>";
    }

    let Qty = 0;
    const splitrecords = cartRecords(req);
    let i = 1;
    for (const rcrd of splitrecords) {
      const splitvales = rcrd.split('^');
      TotalAmount = decAdd(TotalAmount, decParse(at(splitvales, 3)));
      Qty = Qty + toInt32(at(splitvales, 5));
      i++;
    }
    void i; void Qty;
    ps.sessionSet(req, 'Cart', null);

    h += `<input type=hidden name="PAYEE_ACCOUNT" value="${s(obj2.UserID)}">`;
    h += `<input type=hidden name="PAYEE_NAME" value="${'Mr Mahesh'}">`;
    h += `<input type=hidden name="PAYMENT_ID" value="${'123'}">`;
    h += `<input type=hidden name="PAYMENT_AMOUNT" value="${decFormat00(TotalAmount)}">`;
    h += `<input type=hidden name="PAYMENT_UNITS" value="${PaymentCurrency}">`;
    h += `<input type=hidden name="STATUS_URL" value="${HostUrl + 'payzaResponse_Cancel/' + TransIDOut}">`;
    h += `<input type=hidden name="PAYMENT_URL" value="${HostUrl + 'Payment-Successful/' + TransIDOut}">`;
    h += `<input type=hidden name="PAYMENT_URL_METHOD" value="${'LINK'}">`;
    h += `<input type=hidden name="NOPAYMENT_URL" value="${HostUrl + 'paymentResponse_PerfectMoney'}">`;
    h += `<input type=hidden name="NOPAYMENT_URL_METHOD" value="${'LINK'}">`;
    h += `<input type=hidden name="SUGGESTED_MEMO" value="${'ok'}">`;
    h += `<input type=hidden name="BAGGAGE_FIELDS" value="${''}">`;
    h += '</form>';
    h += '</body>';
    h += "<SCRIPT LANGUAGE='JavaScript'>document.forms[0].submit();</SCRIPT>";
    return res.status(200).type('html').send(h);
  }
  return toDashboard(res);
}));

// public void ProceedToPayment(string OrderId, decimal Amount, string ProductInfo, string UserName, string PhoneNo, string EmailId)
// Amount is passed as the .NET decimal string (scale kept).
async function ProceedToPayment(res, OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId) {
  if (OrderId === null || OrderId === undefined) throw NRE();
  OrderId = String(OrderId);
  if (OrderId.length < 1) throw new RangeError('Length cannot be less than zero.\r\nParameter name: length');
  OrderId = OrderId.substring(1, OrderId.length); // Substring(1, Length - 1)
  const MyRemotePost = new RemotePost();
  // AppSettings MERCHANT_KEY / SALT / PAYU_URL - never hard-coded
  const Key = s(config.app.MERCHANT_KEY || '');
  const Salt = s(config.app.SALT || '');
  MyRemotePost.Url = s(config.app.PAYU_URL || '');
  MyRemotePost.Add('key', Key);
  MyRemotePost.Add('txnid', OrderId);
  MyRemotePost.Add('amount', s(Amount));
  MyRemotePost.Add('productinfo', ProductInfo);
  MyRemotePost.Add('firstname', UserName);
  MyRemotePost.Add('phone', PhoneNo);
  MyRemotePost.Add('email', EmailId);
  // For Online
  MyRemotePost.Add('surl', '' + s(CompanySettings.CompanyDomain) + '/OrderComplete/' + (await UtilityClass.Encryptword(OrderId)));
  MyRemotePost.Add('furl', '' + s(CompanySettings.CompanyDomain) + '/cart-list');
  MyRemotePost.Add('service_provider', 'payu_paisa');
  const hashString = Key + '|' + OrderId + '|' + s(Amount) + '|' + s(ProductInfo) + '|' + s(UserName) + '|' + s(EmailId) + '|||||||||||' + Salt;
  const hash = Generatehash512(hashString);
  MyRemotePost.Add('hash', hash);
  return MyRemotePost.Post(res);
}

// ---- ProceedToPayment (public void action) ---------------------------------------------------------------------
// auth (legacy: public void action without session check; PORT-NOTE: protected because it signs arbitrary PayU requests with the merchant SALT)
router.all(`${C}/ProceedToPayment{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Amount = bindDecimalStr(req, 'Amount', 'Void ProceedToPayment(System.String, System.Decimal, System.String, System.String, System.String, System.String)');
  const { OrderId, ProductInfo, UserName, PhoneNo, EmailId } = req.p;
  return ProceedToPayment(res, OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId);
}));

// ---- Generatehash512 / Generatetxnid (public string actions => Content) ----------------------------------------
// public (legacy: no session check)
router.all(`${C}/Generatehash512{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatehash512(req.p.text));
}));

// public (legacy: no session check)
router.all(`${C}/Generatetxnid{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatetxnid());
}));

module.exports = router;
