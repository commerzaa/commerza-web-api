// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OnlinePayment.cs
'use strict';
const DB = 'shopping';
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanySettings, CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const { outVal } = require('./_shared/batch-11-common');

const router = express.Router();
const P = '/portal/OnlinePayment';

const str = (v) => (v === undefined || v === null ? '' : String(v)); // Convert.ToString
const nullRef = () => { throw new Error('Object reference not set to an instance of an object.'); };
const toStr = (v) => (v === undefined || v === null ? nullRef() : String(v)); // .ToString() on a possibly null value

/** Generatehash512(text): SHA-512 of the UTF-8 bytes, lower-case hex */
function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

/** DateTime.Now.ToString() (PORT-NOTE: en-US "M/d/yyyy h:mm:ss tt" assumed; legacy depended on the server culture) */
function netNow() {
  const d = new Date();
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** SaveData(...): Usp_PaymentManagement_Payment_Gateway, "<StrResult>^/<Successurl>^/<Failureurl>^/<Inprocessurl>^/<Canceledurl>" */
async function SaveData(Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, ReferenceId) {
  try {
    const row = await db.procOne(DB, 'usp_paymentmanagement_payment_gateway', {
      Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, ReferenceId,
    });
    if (!row) nullRef(); // Param[n].Value.ToString() on DBNull is "", but no row means the proc did not run as expected
    return '' + outVal(row, 'StrResult') + '^/' + outVal(row, 'Successurl') + '^/' + outVal(row, 'Failureurl') + '^/' + outVal(row, 'Inprocessurl') + '^/' + outVal(row, 'Canceledurl') + '';
  } catch (e) {
    return 'error^/page-not-found^/page-not-found^/page-not-found^/page-not-found';
  }
}

/** RemotePost.Post(): auto-submitting HTML form (values written unencoded, as the legacy did) */
function remotePostHtml(Url, inputs, FormName = 'form1', Method = 'post') {
  let h = '<html><head>';
  h += `</head><body onload="document.${FormName}.submit()">`;
  h += `<form name="${FormName}" method="${Method}" action="${Url}" >`;
  for (const [k, v] of inputs) h += `<input name="${k}" type="hidden" value="${v === null || v === undefined ? '' : v}">`;
  h += '</form>';
  h += '</body></html>';
  return h;
}

/** ProceedToPayment(...): PayU form post. Secrets come from config (MERCHANT_KEY, SALT, PAYU_URL). */
function ProceedToPayment(UserName, Amount, ProductInfo, Email, Phone, OrderId, RefrenceId) {
  const Key = config.app.MERCHANT_KEY || '';
  const Salt = config.app.SALT || '';
  const Url = config.app.PAYU_URL || '';
  const inputs = [];
  inputs.push(['key', Key]);
  const TxnId = OrderId;
  inputs.push(['txnid', TxnId]);
  inputs.push(['amount', Amount]);
  inputs.push(['productinfo', ProductInfo]);
  inputs.push(['firstname', UserName]);
  inputs.push(['phone', Phone]);
  inputs.push(['email', Email]);
  inputs.push(['surl', '' + CompanySettings.CompanyDomain + '/payment-successful?OrderId=' + OrderId + '&RefrenceId=' + RefrenceId]);
  inputs.push(['furl', '' + CompanySettings.CompanyDomain + '/payment-failure?OrderId=' + OrderId + '&RefrenceId=' + RefrenceId]);
  inputs.push(['service_provider', 'payu_paisa']);
  const hashString = Key + '|' + TxnId + '|' + Amount + '|' + ProductInfo + '|' + UserName + '|' + Email + '|||||||||||' + Salt;
  inputs.push(['hash', Generatehash512(hashString)]);
  return remotePostHtml(Url, inputs);
}

// public (payment page entry; [CheckResellerTimeout] is a no-op)
// route-config: secure-jewria-payment-gateway
router.all([P + '/Index{/:id}', '/portal/secure-jewria-payment-gateway'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  UtilityClass.Encryptword('Checkout'); // string Checkout (unused)
  ViewBag.RefrenceId = await UtilityClass.Decryptword(req.p.refrenceid);
  ps.sessionSet(req, 'RefrenceId', await UtilityClass.Decryptword(req.p.refrenceid));
  ViewBag.SuccessUrl = await UtilityClass.Decryptword(req.p.successurl);
  ViewBag.FailureUrl = await UtilityClass.Decryptword(req.p.failureurl);
  ViewBag.InprocessUrl = await UtilityClass.Decryptword(req.p.inprocessurl);
  ViewBag.CanceledUrl = await UtilityClass.Decryptword(req.p.canceledurl);
  ViewBag.Source = await UtilityClass.Decryptword(req.p.source);
  ps.sessionSet(req, 'Source', await UtilityClass.Decryptword(req.p.source));
  res.json({ ViewBag, ...ViewBag });
}));

// public (payment page POST; the order is taken from Session["RefrenceId"]/["Source"])
router.post(P + '/MakeOnlinePayment{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'usp_paymentgatewaymaster', {
    Mode: '2', OrderNumber: str(ps.sessionGet(req, 'RefrenceId')), Source: str(ps.sessionGet(req, 'Source')),
    Successurl: '', Failureurl: '', Inprocessurl: '', Canceledurl: '',
  });
  if (row == null) {
    // Response.Redirect("/invalid-attempt") ends the request
    return res.json({ redirect: '/invalid-attempt' });
  }
  const u = {
    USERNAME: row.username, NAME: row.name, PHONE: row.phone, EMAILID: row.emailid, AMOUNT: row.amount, JPPOINTS: row.jppoints,
    SUCCESSURL: row.successurl, FAILUREURL: row.failureurl, INPROCESSURL: row.inprocessurl, CANCELLEDURL: row.cancelledurl,
  };
  // PORT-NOTE: new Random().ToString() is the type name "System.Random".
  const StrHash = Generatehash512('System.Random' + netNow());
  const OrderId = StrHash.substring(0, 20);
  ps.sessionSet(req, 'OrderId', OrderId);
  const RefrenceId = toStr(ps.sessionGet(req, 'RefrenceId'));
  await SaveData(toStr(u.NAME), '', toStr(u.PHONE), '', toStr(u.EMAILID), '', toStr(u.AMOUNT), 'India', 'Remark', '', OrderId, '0', RefrenceId);
  // PORT-NOTE: CompanySettings.CompanyDomain is a static loaded at application start in the legacy; loaded here before use.
  if (!CompanySettings.CompanyDomain) CompanyMasterSettings.GetResellerData();
  const html = ProceedToPayment(toStr(u.NAME), toStr(u.AMOUNT), 'OnlinePayment', toStr(u.EMAILID), toStr(u.PHONE), OrderId, RefrenceId);
  res.type('html').send(html); // MyRemotePost.Post() -> Response.End()
}));

function gatewayReturn(status, index) {
  return asyncHandler(async (req, res) => {
    const OrderId = req.p.OrderId === undefined ? null : req.p.OrderId;
    const RefrenceId = req.p.RefrenceId === undefined ? null : req.p.RefrenceId;
    if (OrderId != null) {
      const SaveLogResponse = await SaveData('', '', '', '', '', '', '', '', '', '', str(OrderId), status, str(RefrenceId));
      const list = SaveLogResponse.split('^');
      return res.json({ redirect: list[index] + '?refrenceid=' + UtilityClass.Encryptword(str(RefrenceId)) });
    }
    res.json({});
  });
}

// public (PayU surl)
// route-config: payment-successful
router.all([P + '/PaymentSuccess{/:id}', '/portal/payment-successful'], ps.callbackSession, gatewayReturn('1', 1));
// public (gateway return)
// route-config: payment-canceled
router.all([P + '/PaymentCancel{/:id}', '/portal/payment-canceled'], ps.callbackSession, gatewayReturn('3', 4));
// public (PayU furl)
// route-config: payment-failure
router.all([P + '/PaymentFailure{/:id}', '/portal/payment-failure'], ps.callbackSession, gatewayReturn('2', 2));
// public (gateway return)
// route-config: payment-inprocess
router.all([P + '/PaymentInprocess{/:id}', '/portal/payment-inprocess'], ps.callbackSession, gatewayReturn('4', 3));

module.exports = router;
