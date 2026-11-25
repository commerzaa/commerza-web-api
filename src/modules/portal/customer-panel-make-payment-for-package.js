'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/MakePaymentForPackageController.cs
/**
 * PayU package payment. DB: Db_Shopping => 'shopping'
 * C# methods: Index, Success, SendConfirmationEmail (protected), Failure, ProceedToPayment, RemotePost{Add,Post} (nested class),
 *             Generatehash512, Generatetxnid, ThumbnailCallback (private static).
 * Started from src/modules/merchant/make-payment-for-package.js and aligned with the PORTAL C#: mail From = CompanySettings.NoReplyMail,
 * portal mail template (anav-exchange-logo, social links, $CompanySupportEmailId$, $CompanyDomain$ replaced),
 * surl/furl = CompanySettings.CompanyMerchantURL + "/payment-successful" | "/transection-failure".
 */
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const CS = require('../../lib/portal/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const DB = 'shopping';
const P = '/portal/MakePaymentForPackage';
const rep = (s, k, v) => String(s).split(k).join(v === null || v === undefined ? '' : String(v)); // C# string.Replace
const pad2 = (n) => String(n).padStart(2, '0');
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
const num2 = (v) => { if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.'); return Number(v).toFixed(2); };
const str = (s) => (s === null || s === undefined ? '' : String(s));
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const nn = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };

// Verbatim C# @"..." mail/invoice templates (INVOICE_* identical in both apps; MAIL_PART1/2 extracted byte-for-byte from the PORTAL C#, CRLF line breaks kept)
const INVOICE_HEAD = "\r\n\r\n  <style>\r\n        .invoice-box {\r\n            max-width: 800px;\r\n            margin: auto;\r\n            padding: 20px;\r\n            border: 1px solid #eee;\r\n            box-shadow: 0 0 10px rgba(0, 0, 0, .15);\r\n            font-size: 14px;\r\n            line-height: 24px;\r\n        }\r\n\r\n        .divTable {\r\n            font-family: Roboto;\r\n        }\r\n    </style>\r\n<table border='0' cellspacing='0'  cellpadding='0'  style='font-family:Arial, Helvetica, sans-serif; font-size:12px; border-top:1px solid #ddd; margin-top:30px;'>\r\n  <tr>\r\n    <td style=' border-bottom:1px solid #ddd; font-weight:bold; border-right:1px solid #ddd;  border-left:1px solid #ddd; padding:8px; width:50px;'>S No. </td>\r\n    <td style=' border-bottom:1px solid #ddd; font-weight:bold; border-right:1px solid #ddd; padding:8px; width:200px; text-align:left;'>Description of Work </td>\r\n    <td style=' border-bottom:1px solid #ddd; font-weight:bold;  border-right:1px solid #ddd; padding:8px; width:80px; '>Amount (£) </td>\r\n  </tr>";
const INVOICE_SUBTOTAL = " <tr>\r\n    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd;border-left:1px solid #ddd; padding:8px;'>&nbsp;</td>\r\n    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px; text-align:left;'>Thank you for giving us the opportunity to provide you the \r\n\r\nservices</td>\r\n    <td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>&nbsp;</td>\r\n  </tr>\r\n  <tr>\r\n    <td >&nbsp;</td>\r\n    <td>Subtotal</td>\r\n    <td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>";
const INVOICE_TAX = "<tr>\r\n    <td >&nbsp;</td>\r\n    <td>Service tax  ";
const MAIL_PART1 = "<div class='invoice-box' style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; text-align:center; padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n   \r\n\r\n\r\n    <table cellpadding='0' cellspacing='0' style='width: 100%'>\r\n      <tbody>\r\n        <tr>\r\n          <td><table style='width:100%;'>\r\n              <tbody>\r\n                <tr>\r\n                  <td colspan='2'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='https://$$CompanyURL$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></a></td>\r\n                </tr>\r\n              </tbody>\r\n            </table></td>\r\n        </tr>\r\n        <tr>\r\n          <td><div>\r\n              <div class='clear'></div>\r\n              <table style='padding-bottom: 10px;   width: 100%; '>\r\n                <tbody>\r\n                  <tr>\r\n                    <td><h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #000'></h1>\r\n                      <strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'>Subscription Acknowledgment Order ID $$lblOrderid$$</strong>\r\n                      <p style='text-align:left; margin-bottom:0px;'>Dear $$lblname$$,</p> \r\n                      <p style='font-size: 14px; font-weight: normal; text-align:left; line-height:20px; margin:10px 0px 20px 0px; color: #000'> Thank you for choosing $$AllPackageName$$ as your subscription pack. Your order has been submitted to the accounts department. Once it will be approved/ rejected, it will be notified to you within 24hrs.</p>\r\n                     \r\n                      <div style='clear: both'></div>\r\n                      <div style='clear: both'></div>\r\n                     \r\n                      <div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top:0px'>";
const MAIL_PART2 = "<center>\r\n                          <img src='http://webmail.jewria.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'>\r\n                        </center>\r\n                      </div>\r\n                      <div style='clear: both'></div>\r\n   \r\n\r\n<div style='margin-right: 7px; text-align:left; border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                                                    <h5 style = 'margin:0; font-size:18px; font-weight:normal; padding-bottom:5px;'> Need Support ?</h5>\r\n     \r\n                                                         <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, \r\n\r\nHelvetica, sans-serif; color: #000'>\r\n                                                        If you have any issues,\r\n                                                        we will be happy to help you.You can contact us on <a href = 'mailto:$$CompanySupportEmailId$$' target = '_blank'\r\n\r\nstyle = 'color:#00a0a8;'> $$CompanySupportEmailId$$ </a>\r\n    \r\n                                                        </p>\r\n    \r\n                                                    </div>\r\n    \r\n\r\n\r\n                                                                  <div style = 'clear: both'></div>\r\n               \r\n                                                           </td>\r\n               \r\n                                                       </tr>\r\n               \r\n                                                       <tr>\r\n               \r\n                                                           <td>\r\n               \r\n\r\n                                                               <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\r\n                \r\n                                                                    <tbody>\r\n                \r\n                                                                        <tr>\r\n                \r\n                                                                            <td>\r\n                \r\n\r\n                                                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\r\n                 \r\n                                                                                 <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\r\n                      \r\n\r\n                                                                                  </td>\r\n                      \r\n                                                                                  <td>\r\n                      \r\n                                                                                      <div style = 'margin-right: 7px; text-align:right'>\r\n                       \r\n                                                                                           <a href = 'https://www.facebook.com/ATCShoppingServices/' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'https://$$CompanyURL$$/images/mailer-facebook.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n                                  \r\n                                                                                                      <a href = 'https://twitter.com/ATCShoppingServices' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'https://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n                                             \r\n                                                                                                                 <a href = 'https://plus.google.com/+ATCShoppingIn' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'https://$$CompanyURL$$/images/mailer-gplus.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n                                                        \r\n                                                                                                                            <a href = 'https://www.linkedin.com/company/ATCShopping' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'https://$$CompanyURL$$/images/mailer-linkeden.jpg' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n                                                                   \r\n                                                                                                                                       <a href = 'https://pinterest.com/ATCShoppingServices/' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'https://\r\n$$CompanyURL$$/images/mailer-pintrest.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n                                                                              \r\n\r\n                                                                                                                                              </div>\r\n                                                                              \r\n                                                                                                                                          </td>\r\n                                                                              \r\n                                                                                                                                      </tr>\r\n                                                                              \r\n                                                                                                                                  </tbody>\r\n                                                                              \r\n                                                                                                                              </table>\r\n                                                                              \r\n                                                                                                                          </td>\r\n                                                                              \r\n                                                                                                                      </tr>\r\n                                                                              \r\n\r\n                                                                                                                  </tbody>\r\n                                                                              \r\n                                                                                                              </table>\r\n                                                                              \r\n                                                                                                              <div class='clear'></div>\r\n                            </div>\r\n                        </td>\r\n                    </tr>\r\n                </tbody>\r\n            </table>\r\n        </div>\r\n        <p style = 'font-family:arial; font-size:14px; padding-top:10px;'>© 2016-2017 All Rights Reserved | $$CompanyURL$$</p>\r\n    </div>\r\n";

// ---- Hash generation Algorithm (public string Generatehash512(string text)) ------------------------------
function Generatehash512(text) {
  // SHA512 over the UTF-8 bytes, lower-case hex ({0:x2}) - identical to the legacy implementation
  return crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');
}

// .NET DateTime.Now.ToString() (en-US default culture: M/d/yyyy h:mm:ss tt)
function netNow() {
  const d = new Date();
  let h = d.getHours();
  const tt = h >= 12 ? 'PM' : 'AM';
  h %= 12; if (h === 0) h = 12;
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${tt}`;
}

// public string Generatetxnid()
function Generatetxnid() {
  // legacy: rnd.ToString() is the type name "System.Random" (not a random number) + DateTime.Now
  // PORT-NOTE: DateTime.Now formatting depends on the server culture; en-US format used.
  const strHash = Generatehash512('System.Random' + netNow());
  const txnid1 = strHash.substring(0, 20);
  return txnid1;
}

// private static bool ThumbnailCallback() - GetThumbnailImageAbort delegate, never invoked by GDI+
function ThumbnailCallback() {
  throw new Error('The method or operation is not implemented.');
}
void ThumbnailCallback;

// public class RemotePost { Url, Method = "post", FormName = "form1", Add(name, value), Post() }
class RemotePost {
  constructor() {
    this.Inputs = []; // NameValueCollection (Add with an existing key appends ",value")
    this.Url = '';
    this.Method = 'post';
    this.FormName = 'form1';
  }

  Add(name, value) {
    const e = this.Inputs.find((x) => x[0].toLowerCase() === String(name).toLowerCase());
    if (e) { if (value !== null && value !== undefined) e[1] = e[1] === null ? String(value) : e[1] + ',' + value; } else this.Inputs.push([String(name), value === null || value === undefined ? null : String(value)]);
  }

  // legacy Response.Clear(); Response.Write(...); Response.End() => full HTML auto-submit page
  Post(res) {
    let h = '';
    h += '<html><head>';
    h += `</head><body onload="document.${this.FormName}.submit()">`;
    h += `<form name="${this.FormName}" method="${this.Method}" action="${this.Url}" >`;
    for (const [k, v] of this.Inputs) h += `<input name="${k}" type="hidden" value="${v === null ? '' : v}">`;
    h += '</form>';
    h += '</body></html>';
    return res.status(200).type('html').send(h);
  }
}

// decimal.ToString() / Amount.ToStringOrEmpty() equivalent
const decStr = (n) => { const x = Number(n); return Number.isFinite(x) ? String(Math.round(x * 1e10) / 1e10) : ''; };

// public void ProceedToPayment(string OrderId, decimal Amount, string ProductInfo, string UserName, string PhoneNo, string EmailId)
function ProceedToPayment(res, OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId) {
  const MyRemotePost = new RemotePost();
  // keys/salt never hard-coded: AppSettings MERCHANT_KEY / SALT / PAYU_URL
  const Key = String(config.app.MERCHANT_KEY || '');
  const Salt = String(config.app.SALT || '');
  MyRemotePost.Url = String(config.app.PAYU_URL || '');
  MyRemotePost.Add('key', Key);
  MyRemotePost.Add('txnid', OrderId);
  MyRemotePost.Add('amount', decStr(Amount));
  MyRemotePost.Add('productinfo', ProductInfo);
  MyRemotePost.Add('firstname', UserName);
  MyRemotePost.Add('phone', PhoneNo);
  MyRemotePost.Add('email', EmailId);
  // For Online
  MyRemotePost.Add('surl', '' + CompanySettings.CompanyMerchantURL + '/payment-successful');
  MyRemotePost.Add('furl', '' + CompanySettings.CompanyMerchantURL + '/transection-failure');
  MyRemotePost.Add('service_provider', 'payu_paisa');
  const hashString = Key + '|' + str(OrderId) + '|' + decStr(Amount) + '|' + str(ProductInfo) + '|' + str(UserName) + '|' + str(EmailId) + '|||||||||||' + Salt;
  const hash = Generatehash512(hashString);
  MyRemotePost.Add('hash', hash);
  return MyRemotePost.Post(res);
}

// protected void SendConfirmationEmail(string ToEmail, string Username, string Text, string Orderid, string AllPackageNames)
async function SendConfirmationEmail(req, ViewBag, ToEmail, Username, Text, Orderid, AllPackageNames) {
  let send = 0;
  let TASMID = 0;
  try {
    const Regno = Number(req.user.plid);
    let InvoiceStructure = '';
    const row = await db.queryOne(DB, 'select tasmid from tbl_allsubscriptionmaster where transaction_id = @oid limit 1', { oid: Orderid });
    if (row) TASMID = row.tasmid;
    const InvoicePrintLi = await db.proc(DB, 'usp_userinvoice', { plid: Regno, sfdid: TASMID });
    InvoiceStructure = INVOICE_HEAD;
    for (const Item of InvoicePrintLi) {
      const PackageType = nn(Item.allpackagetype).split('~');
      const PackageName = nn(Item.allpackagename).split(',');
      const PackageAmount = nn(Item.allpackageamount).split('~');
      const PackageId = nn(Item.allpackageid).split('~');
      for (let i = 0; i < PackageType.length; i++) {
        InvoiceStructure = InvoiceStructure + "<tr><td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; border-left:1px solid #ddd; padding:8px;vertical-align:top;'> " + (i + 1) + '</td>';
        let Query = '';
        if (PackageType[i] === '1') {
          if (PackageId[i] === undefined) throw new RangeError('Index was outside the bounds of the array.');
          // legacy: "Select SubscriptionDetails From Tbl_SubscriptionMaster Where TSMID=" + PackageId[i] (concatenated; bound here)
          Query = await db.scalar(DB, 'select subscriptiondetails from tbl_subscriptionmaster where tsmid::varchar = @id limit 1', { id: String(PackageId[i]).trim() });
        }
        if (PackageName[i] === undefined || PackageAmount[i] === undefined) throw new RangeError('Index was outside the bounds of the array.');
        InvoiceStructure = InvoiceStructure + "<td style=' border-bottom:1px solid #ddd;line-height:20px;vertical-align:top;  border-right:1px solid #ddd; padding:8px; text-align:left;'>" + PackageName[i] + ' <br/>';
        InvoiceStructure = InvoiceStructure + '' + str(Query) + '</td>';
        InvoiceStructure = InvoiceStructure + "<td style=' border-bottom:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>" + PackageAmount[i] + ' </td></tr>';
      }
      InvoiceStructure = InvoiceStructure + INVOICE_SUBTOTAL + num2(Item.with_out_tax_amount) + '</td></tr>';
      InvoiceStructure = InvoiceStructure + INVOICE_TAX + num2(Item.service_tax_per) + "% </td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>" + num2(Item.service_tax) + '</td></tr>';
      InvoiceStructure = InvoiceStructure + "<tr><td>&nbsp;</td><td><strong>Total Amount </strong></td><td style=' border-bottom:1px solid #ddd;  border-left:1px solid #ddd;  border-right:1px solid #ddd; padding:8px;'>" + num2(Item.totalpayableamount) + '</td> </tr><tr>   <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td> <td>&nbsp;</td><td>&nbsp;</td></tr> <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>';
    }

    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      // new MailMessage("" + CompanySettings.NoReplyMail + "", ToEmail) - throws on an empty sender / null or empty recipient
      if (String(CompanySettings.NoReplyMail || '') === '') throw new Error("The parameter 'from' cannot be an empty string.\r\nParameter name: from");
      if (ToEmail === null || ToEmail === undefined) throw new Error("Value cannot be null.\r\nParameter name: to");
      if (String(ToEmail) === '') throw new Error("The parameter 'to' cannot be an empty string.\r\nParameter name: to");
      mailtxt = MAIL_PART1 + InvoiceStructure + MAIL_PART2;
      mailtxt = rep(mailtxt, '$$AllPackageName$$', AllPackageNames);
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$lblOrderid$$', Orderid);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    ViewBag.Message = exp.message;
  }
}

// Saves the challan image like the legacy System.Drawing code: > 10 KB => half-size JPEG thumbnail, else original bytes.
async function saveChallan(b, strValidFullName) {
  let sharp = null;
  try { sharp = require('sharp'); } catch (_) { sharp = null; }
  const filesize = b.length / 1024;
  let meta = null;
  if (sharp) meta = await sharp(b).metadata(); // Image.FromStream: throws on invalid image data
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  const scaleFactor = 0.5;
  if (filesize > 10) {
    if (sharp) {
      const newWidth = Math.trunc(meta.width * scaleFactor);
      const newHeight = Math.trunc(meta.height * scaleFactor);
      const out = await sharp(b).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
      fs.writeFileSync(strValidFullName, out);
    } else {
      // PORT-NOTE: sharp not installed - image saved without the 50% thumbnail reduction.
      fs.writeFileSync(strValidFullName, b);
    }
  } else {
    // img.Save(path): original format re-encoded; bytes written unchanged here
    fs.writeFileSync(strValidFullName, b);
  }
}

// ---- Index ------------------------------------------------------------------------------------------------
// public (legacy had no session check: without Session["PaymentForOrder"] it just returns the view;
// with it, (Login)Session["Plid"] is cast unguarded => NullReferenceException when not logged in)
// route-config: merchant/MakePaymentForPackage -> MakePaymentForPackage/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/MakePaymentForPackage'], ps.portalSession, asyncHandler(async (req, res) => {
  const ObjOnlinePaymentForPackage = ps.sessionGet(req, 'PaymentForOrder');
  if (ObjOnlinePaymentForPackage !== null && ObjOnlinePaymentForPackage !== undefined) {
    if (!ps.isCustomer(req)) throw NRE();
    const RegNo = Math.trunc(Number(req.user.plid));
    const OrderId = Generatetxnid();
    const ObjUserMaster = await db.queryOne(DB, 'select fname, phone, emailid from portal_login where plid = @plid limit 1', { plid: RegNo });
    if (!ObjUserMaster) throw NRE();
    const ProductInfo = ObjOnlinePaymentForPackage.AllPackageName;
    const UserName = ObjUserMaster.fname;
    const PhoneNo = ObjUserMaster.phone;
    const EmailId = ObjUserMaster.emailid;
    let Amount = Number(ObjOnlinePaymentForPackage.TotalPayableAmount);
    if (Number.isNaN(Amount)) throw new Error('Input string was not in a correct format.');
    Amount = Amount + ((Amount * 15) / 100); // Service Charge
    Amount = Amount + ((Amount * 1) / 100); // Processing Fee
    // PORT-NOTE: C# decimal arithmetic -> JS number rounded to 10 decimals; the same string is used for the "amount" field and the hash.
    return ProceedToPayment(res, OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId);
  }
  return res.json({ view: '~/Views/CustomerPanel/MakePaymentForPackage/Index.cshtml' });
}));

// ---- Success (PayU surl) --------------------------------------------------------------------------------------
// public (payment-gateway return URL): identity from the portal session snapshot (ps.callbackSession)
// route-config: merchant/payment-successful -> MakePaymentForPackage/Success
router.all([`${P}/Success{/:id}`, '/portal/merchant/payment-successful'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const ObjOnlinePaymentForPackage = ps.sessionGet(req, 'PaymentForOrder');
  if (ObjOnlinePaymentForPackage !== null && ObjOnlinePaymentForPackage !== undefined) {
    let ReturnOutput = 'success';
    let strValidFullName = '';
    if (!ps.isCustomer(req)) throw NRE(); // (Login)Session["Plid"] cast outside the try
    const RegNo = Math.trunc(Number(req.user.plid));
    const o = ObjOnlinePaymentForPackage;
    const TotalPayableAmount = o.TotalPayableAmount; const PaymentMode = o.PaymentMode; const ModeName = o.ModeName;
    const CommentORRemark = o.CommentORRemark; const ChallanImage = o.ChallanImage; const BankName = o.BankName;
    const BranchName = o.BranchName; const ReferenceDate = o.ReferenceDate; const ReferenceNumber = o.ReferenceNumber;
    const TransactionPassword = o.TransactionPassword; const GoogleAuthenticationCode = o.GoogleAuthenticationCode;
    const WalletId = o.WalletId; const AllPackageId = o.AllPackageId; const AllPackageType = o.AllPackageType;
    const AllPackageAmount = o.AllPackageAmount; const AllPackageName = o.AllPackageName;
    try {
      const loginid = str(req.user.loginid);
      // #region Challen
      let Imgchallen = '';
      if (nn(ChallanImage).trim() !== '') {
        let SavePaths = '';
        let base64String = '';
        let ImageExt = '';
        SavePaths = String(config.app.ChallenImagePath || '');
        if (ChallanImage !== '') {
          base64String = ChallanImage;
          let ChallenImage = loginid + '&' + RegNo + '&' + str(ReferenceNumber);
          ChallenImage = ChallenImage.trim();
          ChallenImage = rep(ChallenImage, '&amp;', 'And');
          ChallenImage = rep(ChallenImage, '&', ' And ');
          ChallenImage = ChallenImage.replace(/[^\w\d]/g, '');
          ChallenImage = rep(ChallenImage, ' ', '-');
          Imgchallen = ChallenImage + '-' + RegNo + str(ReferenceNumber) + '.jpg';
        } else {
          Imgchallen = ' ';
        }
        // Server.MapPath(SavePaths) => folder under config.uploadDir
        const dir = path.join(config.uploadDir, SavePaths.replace(/^[~/\\]+/, ''));
        fs.mkdirSync(dir, { recursive: true });
        strValidFullName = path.join(dir, Imgchallen);
        if (base64String.includes('base64,')) {
          const IndexNo = base64String.indexOf('/') + 1;
          const lastIndexNo = base64String.indexOf(';');
          ImageExt = base64String.substring(IndexNo, lastIndexNo);
          const IndexNo1 = base64String.indexOf(',') + 1;
          base64String = base64String.substring(IndexNo1);
        }
        void ImageExt;
        const b = Buffer.from(base64String, 'base64');
        await saveChallan(b, strValidFullName);
      }
      // #endregion Challen

      const Plid = Number(req.user.plid);
      // [DBO].[Usp_AllSubscriptionMaster] ... @IntResult Out, @TranIds out (returned as columns of the result row)
      const r = await db.procOne(DB, 'usp_allsubscriptionmaster', {
        totalpayableamount: TotalPayableAmount, paymentmode: PaymentMode, modename: ModeName, commentorremark: CommentORRemark,
        regno: RegNo, imagename: Imgchallen, bankname: BankName, branchname: BranchName, referencedate: ReferenceDate,
        referencenumber: ReferenceNumber, walletid: WalletId, transactionpassword: TransactionPassword,
        googleauthenticationcode: GoogleAuthenticationCode, allpackageid: AllPackageId, allpackagetype: AllPackageType,
        allpackageamount: AllPackageAmount, plid: Plid, allpackagename: AllPackageName, processingfee: '0.00',
      });
      if (!r) throw NRE();
      ReturnOutput = str(r.intresult); // DBNull.ToString() => "" => Convert.ToInt32 throws FormatException below
      const Orderid = str(r.tranids);
      const rv = String(ReturnOutput).trim();
      if (!/^[+-]?\d+$/.test(rv)) throw new Error('Input string was not in a correct format.');
      if (parseInt(rv, 10) > 0) {
        try {
          const AllPackageNames = rep(nn(AllPackageName), '~', ',');
          // legacy: "... where plid = '" + Plid + "'" (concatenated; bound here)
          const Obj = await db.queryOne(DB, "select coalesce(phone,'') as phone, emailid, username from portal_login where plid = @plid limit 1", { plid: Plid });
          if (Obj && (Obj.emailid !== '' || Obj.emailid !== null)) {
            const MobileNo = '9718355334';
            const Msg = 'New Payment received from\r\nUser name: ' + str(Obj.username) + ',\r\nPackage name: ' + AllPackageNames + ',\r\nAmount: ' + str(AllPackageAmount) + ',\r\nRef No.: ' + str(ReferenceNumber) + '';
            const Message = 'Dear ' + str(Obj.username) + ',\r\nThanks for Purchasing ' + AllPackageNames + ' subscription.\r\nYour Order will be confirmed once your payment gets approved from our account department.\r\nPlease note your subscription order id is ' + Orderid + '';
            if (Obj.phone !== null && Obj.phone !== '') {
              await UtilityClass.SendMsgOnMobile(Obj.phone, Message);
              const host = req.hostname; // Request.Url.Host
              if (!String(host).includes('demo.jewria.com') && host !== 'localhost') {
                await UtilityClass.SendMsgOnMobile(MobileNo, Msg);
              }
            }
            await SendConfirmationEmail(req, ViewBag, Obj.emailid, Obj.username, 'Thank you for purchasing subscription. Your request is sent to Admin for verification.', Orderid, AllPackageNames);
          }
        } catch (Ex) {
          ViewBag.Message = Ex.message;
        }
      }
    } catch (Exp) {
      ViewBag.Message = Exp.message;
      ReturnOutput = 'Some Exception Occur : ' + Exp.message;
    }
    ViewBag.Message = ReturnOutput;
  } else {
    ViewBag.Message = 'Your Payment Rejected';
  }
  res.json({ view: '~/Views/CustomerPanel/MakePaymentForPackage/Success.cshtml', ViewBag, ...ViewBag });
}));

// ---- Failure (PayU furl) --------------------------------------------------------------------------------------
// public (payment-gateway return URL)
// route-config: merchant/transection-failure -> MakePaymentForPackage/Failure
router.all([`${P}/Failure{/:id}`, '/portal/merchant/transection-failure'], ps.callbackSession, asyncHandler(async (req, res) => {
  ps.sessionSet(req, 'PaymentForOrder', null);
  res.json({ view: '~/Views/CustomerPanel/MakePaymentForPackage/Failure.cshtml' });
}));

// ---- ProceedToPayment (public void action) ---------------------------------------------------------------------
// auth (legacy: public void action without session check; PORT-NOTE: protected because it signs arbitrary PayU requests with the merchant SALT)
router.all(`${P}/ProceedToPayment{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const { OrderId, ProductInfo, UserName, PhoneNo, EmailId } = req.p;
  const Amount = Number(req.p.Amount);
  if (req.p.Amount === undefined || req.p.Amount === null || req.p.Amount === '' || Number.isNaN(Amount)) {
    throw new Error("The parameters dictionary contains a null entry for parameter 'Amount' of non-nullable type 'System.Decimal'");
  }
  return ProceedToPayment(res, OrderId, Amount, ProductInfo, UserName, PhoneNo, EmailId);
}));

// ---- Generatehash512 / Generatetxnid (public string actions) ----------------------------------------------------
// public (legacy: no session check; plain SHA-512 of the given text)
router.all(`${P}/Generatehash512{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatehash512(nn(req.p.text)));
}));

// public (legacy: no session check)
router.all(`${P}/Generatetxnid{/:id}`, asyncHandler(async (req, res) => {
  res.type('text/plain').send(Generatetxnid());
}));

module.exports = router;
