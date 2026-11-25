'use strict';
// Ported from Member\Controllers\CustomerPanel\MakeOnlinePayment.cs (MakeOnlinePaymentController) - database: affiliate (Db_Affiliate)
const express = require('express');
const crypto = require('crypto');
const db = require('../../db');
const config = require('../../config');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/MakeOnlinePayment';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const nz = (v) => (v === undefined || v === null ? '' : v);
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const KEY = () => config.app.MERCHANT_KEY || ''; // AppSettings["MERCHANT_KEY"]
const SALT = () => config.app.SALT || '';        // AppSettings["SALT"]
const PAYU_URL = () => config.app.PAYU_URL || ''; // AppSettings["PAYU_URL"]

// Generatehash512: SHA512 of the UTF8 bytes, lower-case hex
function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

// yyyyMMddHHmmssffff (kept for parity with the legacy static GetTimestamp)
function GetTimestamp(value) {
  const p2 = (n) => String(n).padStart(2, '0');
  return value.getFullYear() + p2(value.getMonth() + 1) + p2(value.getDate()) + p2(value.getHours()) + p2(value.getMinutes()) + p2(value.getSeconds()) + String(value.getMilliseconds()).padStart(3, '0') + '0';
}

// PORT-NOTE: SQL Server ENCRYPTBYPASSPHRASE / DECRYPTBYPASSPHRASE (proprietary, non-deterministic, not available in PostgreSQL) are replaced by
// AES-256-CBC with a key derived (SHA-256) from the same passphrase text; the token keeps the "0x<hex>" form. Tokens are produced and consumed only
// by this controller (ProceedToPayment -> PaymentSuccess), so the pair stays consistent.
function passphraseKey(passphrase) { return crypto.createHash('sha256').update(String(passphrase), 'utf8').digest(); }
function encryptByPassphrase(passphrase, text) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', passphraseKey(passphrase), iv);
  const enc = Buffer.concat([c.update(Buffer.from(String(text), 'utf8')), c.final()]);
  return '0x' + Buffer.concat([iv, enc]).toString('hex');
}
function decryptByPassphrase(passphrase, token) {
  try {
    let h = String(token);
    if (h.startsWith('0x') || h.startsWith('0X')) h = h.slice(2);
    const buf = Buffer.from(h, 'hex');
    if (buf.length < 32) return null;
    const d = crypto.createDecipheriv('aes-256-cbc', passphraseKey(passphrase), buf.subarray(0, 16));
    return Buffer.concat([d.update(buf.subarray(16)), d.final()]).toString('utf8');
  } catch (e) { return null; } // DECRYPTBYPASSPHRASE returns NULL on failure
}

// SaveData (public string action in legacy): USP_PAYUMONEYGATEWAYMANAGEMENT
async function SaveData(Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, RegNo, UserName) {
  try {
    const rows = await db.proc(DB, 'usp_payumoneygatewaymanagement', {
      NAME: Name, ADDRESS: Address, CONTACTNO: ContactNo, CITYNAME: CityName, EMAILID: EmailId, STATE: State, AMOUNT: Amount, COUNTRY: Country,
      REMARK: Remark, PINCODE: Pincode, ORDERID: OrderId, PAYMENTSTATUS: PaymentStatus, REGNO: RegNo, USERNAME: UserName,
    });
    const v = outv(rows, 'strresult');
    return v === undefined || v === null ? '' : String(v);
  } catch (e) {
    return 'Error';
  }
}

async function loadMember(regno) {
  // Select FNAME As Name,Address,MOBILE As ContactNo,CityName,EmailId,('')As State,('India')As Country,Pincode,Cast(REGNO As Int)As RegNo,USERNAME From MEMBER_MASTER WHERE REGNO=...
  const r = await db.queryOne(DB, `Select fname As name, address, mobile As contactno, cityname, emailid, ('') As state, ('India') As country, pincode, Cast(regno As Int) As regno, username
    From member_master WHERE regno = @r limit 1`, { r: regno });
  if (!r) return null;
  return {
    Name: r.name, Address: r.address, ContactNo: r.contactno, CityName: r.cityname, EmailId: r.emailid, State: r.state, Country: r.country,
    Pincode: r.pincode, RegNo: r.regno, UserName: r.username,
  };
}

// RemotePost.Post(): auto-submitting form
function remotePostHtml(Url, inputs) {
  const FormName = 'form1';
  const Method = 'post';
  let h = '<html><head>';
  h += `</head><body onload="document.${FormName}.submit()">`;
  h += `<form name="${FormName}" method="${Method}" action="${Url}" >`;
  for (const [k, v] of inputs) h += `<input name="${k}" type="hidden" value="${v}">`;
  h += '</form>';
  h += '</body></html>';
  return h;
}

// ProceedToPayment: returns the html of the auto-post form
async function ProceedToPaymentHtml(RegNo, UserName, Amount, ProductInfo, Email, Phone, OrderId) {
  const Key = KEY();
  const Salt = SALT();
  const inputs = [];
  const Url = PAYU_URL();
  inputs.push(['key', Key]);
  const TxnId = OrderId;
  inputs.push(['txnid', TxnId]);
  inputs.push(['amount', Amount]);
  inputs.push(['productinfo', ProductInfo]);
  inputs.push(['firstname', UserName]);
  inputs.push(['phone', Phone]);
  inputs.push(['email', Email]);
  const Token = encryptByPassphrase(nz(Phone) + nz(Email) + nz(OrderId) + Key + Salt, OrderId);
  inputs.push(['surl', 'https://login.kreazlife.com/referral/payment-successful' + '?refrenceid=' + await UtilityClass.Encryptword(OrderId) + '&OrderId=' + await UtilityClass.Encryptword(String(RegNo)) + '&Token=' + Token]);
  inputs.push(['furl', 'https://login.kreazlife.com/referral/payment-failure' + '?refrenceid=' + await UtilityClass.Encryptword(OrderId) + '&OrderId=' + await UtilityClass.Encryptword(String(RegNo))]);
  inputs.push(['service_provider', 'payu_paisa']);
  const hashString = Key + '|' + TxnId + '|' + Amount + '|' + ProductInfo + '|' + UserName + '|' + Email + '|||||||||||' + Salt;
  inputs.push(['hash', Generatehash512(hashString)]);
  return remotePostHtml(Url, inputs);
}

// route-config: referral/do-not-refresh-payment
// auth (legacy dereferences Session["Plid"])
router.all([`${P}/Index{/:id}`, '/member/referral/do-not-refresh-payment'], ...guard, asyncHandler(async (req, res) => {
  let { CommentORRemark, Amount, OrderId } = req.p;
  if (CommentORRemark === undefined || CommentORRemark === null) CommentORRemark = '';
  if (Amount === undefined || Amount === null) Amount = '0.00';
  if (OrderId === undefined || OrderId === null) OrderId = '';
  const RegNo = Number(req.user.plid);
  const obj = await loadMember(RegNo);
  if (!obj) throw NRE();
  const SaveLogResponse = await SaveData(obj.Name, obj.Address, obj.ContactNo, obj.CityName, obj.EmailId, obj.State, Amount, obj.Country, CommentORRemark, obj.Pincode, OrderId, '0', obj.RegNo, obj.UserName);
  if (SaveLogResponse === 'inserted') {
    // ProceedToPayment writes the PayU auto-post form and ends the response
    const html = await ProceedToPaymentHtml(RegNo, obj.Name, Amount, 'OnlinePayment', obj.EmailId, obj.ContactNo, OrderId);
    return res.type('html').send(html);
  }
  return res.json({ status: 'false', view: 'PaymentCancel' }); // View("~/Views/CustomerPanel/MakeOnlinePayment/PaymentCancel.cshtml")
}));

// route-config: referral/payment-successful
// public (PayU return URL)
router.all([`${P}/PaymentSuccess{/:id}`, '/member/referral/payment-successful'], asyncHandler(async (req, res) => {
  let { RefrenceId, OrderId, Token } = req.p;
  // PayU returns refrenceid in lower case
  if (RefrenceId === undefined || RefrenceId === null) RefrenceId = '';
  if (OrderId === undefined || OrderId === null) OrderId = '';
  if (Token === undefined || Token === null) Token = '';
  const obj = await loadMember(await UtilityClass.Decryptword(OrderId));
  if (!obj) throw NRE();
  const Key = KEY();
  const Salt = SALT();
  const failure = () => res.json({ status: 'false', view: 'PaymentFailure' });
  const refDecrypted = await UtilityClass.Decryptword(RefrenceId);
  const DecryptedToken = decryptByPassphrase(nz(obj.ContactNo) + nz(obj.EmailId) + refDecrypted + Key + Salt, Token);
  if (nz(DecryptedToken) !== refDecrypted) return failure();
  const SaveLogResponse = await SaveData('', '', '', '', '', '', '', '', '', '', refDecrypted, '1', Number(await UtilityClass.Decryptword(OrderId)), '');
  if (SaveLogResponse === 'updated') return res.json({ status: 'true', view: 'PaymentSuccess' });
  return failure();
}));

// public (PayU return URL)
router.all(`${P}/PaymentCancel{/:id}`, asyncHandler(async (req, res) => {
  let { RefrenceId, OrderId } = req.p;
  if (RefrenceId === undefined || RefrenceId === null) RefrenceId = '';
  if (OrderId === undefined || OrderId === null) OrderId = '';
  await SaveData('', '', '', '', '', '', '', '', '', '', await UtilityClass.Decryptword(RefrenceId), '3', Number(await UtilityClass.Decryptword(OrderId)), '');
  res.json({ status: 'false', view: 'PaymentCancel' });
}));

// route-config: referral/payment-failure
// public (PayU return URL)
router.all([`${P}/PaymentFailure{/:id}`, '/member/referral/payment-failure'], asyncHandler(async (req, res) => {
  let { RefrenceId, OrderId } = req.p;
  if (RefrenceId === undefined || RefrenceId === null) RefrenceId = '';
  if (OrderId === undefined || OrderId === null) OrderId = '';
  await SaveData('', '', '', '', '', '', '', '', '', '', await UtilityClass.Decryptword(RefrenceId), '2', Number(await UtilityClass.Decryptword(OrderId)), '');
  res.json({ status: 'false', view: 'PaymentFailure' });
}));

// auth (public void action in legacy; reads Session["Plid"])
router.all(`${P}/ProceedToPayment{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  const html = await ProceedToPaymentHtml(Number(req.user.plid), p.UserName, p.Amount, p.ProductInfo, p.Email, p.Phone, p.OrderId);
  res.type('html').send(html);
}));

// public (public string action in legacy)
router.all(`${P}/Generatehash512{/:id}`, asyncHandler(async (req, res) => {
  res.send(Generatehash512(nz(req.p.text)));
}));

// auth (public string action in legacy; writes a payment log row, so it requires a logged-in member here)
router.all(`${P}/SaveData{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  res.send(await SaveData(p.Name, p.Address, p.ContactNo, p.CityName, p.EmailId, p.State, p.Amount, p.Country, p.Remark, p.Pincode, p.OrderId, p.PaymentStatus, Number(p.RegNo), p.UserName));
}));

module.exports = router;
module.exports.GetTimestamp = GetTimestamp;
