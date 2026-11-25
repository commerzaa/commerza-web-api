'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/MakePayment.cs  (MakePaymentController, 6 public methods)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
// Session["Plid"] -> req.user.plid ; Session["PaymentForOrder"] (PaymentForAddFund) -> utils/sessionStore key 'PaymentForOrder'
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../../config');
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const DB = 'affiliate';
const BASE = '/member/MakePayment';
const s = (v) => (v === undefined || v === null ? '' : String(v));
const esc = (v) => s(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// public string Generatehash512(string text): SHA512 hex (lower case)
function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}
// public string Generatetxnid()
function Generatetxnid() {
  // C#: Generatehash512(rnd.ToString() + DateTime.Now) - type name of Random + current date/time text, first 20 hex chars
  return Generatehash512('System.Random' + new Date().toString()).substring(0, 20);
}

// RemotePost.Post(): an auto-submitting HTML form
class RemotePost {
  constructor() { this.Inputs = []; this.Url = ''; this.Method = 'post'; this.FormName = 'form1'; }
  Add(name, value) { this.Inputs.push([name, value]); }
  Post() {
    let html = '<html><head>';
    html += `</head><body onload="document.${this.FormName}.submit()">`;
    html += `<form name="${this.FormName}" method="${this.Method}" action="${esc(this.Url)}" >`;
    for (const [k, v] of this.Inputs) html += `<input name="${esc(k)}" type="hidden" value="${esc(v)}">`;
    html += '</form>';
    html += '</body></html>';
    return html;
  }
}

// public void ProceedToPayment(string UserName, string Amount, string ProductInfo, string Email, string Phone, string OrderId)
function ProceedToPayment(UserName, Amount, ProductInfo, Email, Phone, OrderId) {
  const myremotepost = new RemotePost();
  const key = s(config.app.MERCHANT_KEY);
  const salt = s(config.app.SALT);
  myremotepost.Url = s(config.app.PAYU_URL);
  myremotepost.Add('key', key);
  const txnid = OrderId;
  myremotepost.Add('txnid', txnid);
  myremotepost.Add('amount', Amount);
  myremotepost.Add('productinfo', ProductInfo);
  myremotepost.Add('firstname', UserName);
  myremotepost.Add('phone', Phone);
  myremotepost.Add('email', Email);
  // PORT-NOTE: the C# hard-codes the localhost return URLs (server URLs were commented out); kept as is.
  myremotepost.Add('surl', 'https://localhost:41075/merchant/payment-successful');
  myremotepost.Add('furl', 'https://localhost:41075/merchant/transection-failure');
  myremotepost.Add('service_provider', 'payu_paisa');
  const hashString = s(key) + '|' + s(txnid) + '|' + s(Amount) + '|' + s(ProductInfo) + '|' + s(UserName) + '|' + s(Email) + '|||||||||||' + s(salt);
  myremotepost.Add('hash', Generatehash512(hashString));
  return myremotepost.Post();
}

// Index(): session check absent in C#, but PaymentForOrder lives in the per-user store => auth
// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  const op = sessionStore.get(req, 'PaymentForOrder');
  if (op !== undefined && op !== null) {
    // ProceedToPayment ends the response with the auto-submit form (the view after it is never rendered)
    return res.type('html').send(ProceedToPayment(op.Name, op.Payamount, op.Product, op.Email, op.Mobile, op.OrderId));
  }
  return res.json({ view: '~/Views/CustomerPanel/AddFund/Index.cshtml' });
}));

// Success()
// auth
router.all(`${BASE}/Success{/:id}`, auth, asyncHandler(async (req, res) => {
  let ReturnOutput = '';
  const ObjPayment = sessionStore.get(req, 'PaymentForOrder');
  if (ObjPayment !== undefined && ObjPayment !== null) {
    const PLID = Number(req.user.plid);
    // PORT-NOTE: @STRRESULT OUT is read from the "strresult" column of the single result row
    const rows = await proc(DB, 'usp_addfundnew', {
      plid: PLID, paymenttype: 'Online Banking', depositamount: ObjPayment.Payamount, checkno: '', depositdate: '', bankname: '', branchname: '', accountnumber: '',
      couponno: '', fromloginid: '', password: '', reqfrom: '', remark: ObjPayment.CommentORRemark, fname: '', lname: '', emailid: '', contactno: '', ipaddress: '', amountinpound: '',
    });
    const r = rows[0];
    const k = r ? Object.keys(r).find((x) => x.toLowerCase() === 'strresult') : undefined;
    ReturnOutput = k === undefined || r[k] === null ? '' : String(r[k]);
    sessionStore.set(req, 'PaymentForOrder', null);
  }
  res.json({ view: '~/Views/CustomerPanel/MakePayment/Success.cshtml', ReturnOutput });
}));

// Failure()
// auth
router.all(`${BASE}/Failure{/:id}`, auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'PaymentForOrder', null);
  res.json({ view: '~/Views/CustomerPanel/MakePayment/Failure.cshtml' });
}));

// ProceedToPayment(...) is a public void method => routable MVC action: writes the auto-submit PayU form
// auth
router.all(`${BASE}/ProceedToPayment{/:id}`, auth, asyncHandler(async (req, res) => {
  const { UserName, Amount, ProductInfo, Email, Phone, OrderId } = req.p;
  res.type('html').send(ProceedToPayment(UserName, Amount, ProductInfo, Email, Phone, OrderId));
}));

// Generatehash512(string text) - public string method => routable MVC action (pure function)
// public
router.all(`${BASE}/Generatehash512{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatehash512(s(req.p.text)));
}));

// Generatetxnid() - public string method => routable MVC action (pure function)
// public
router.all(`${BASE}/Generatetxnid{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatetxnid());
}));

module.exports = router;
