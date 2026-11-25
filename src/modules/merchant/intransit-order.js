'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/intransit_order.cs (intransit_orderController)
 * Prefix: /merchant   DB: Merchant DataBaseContext => Db_Shopping => 'shopping'
 * Started from src/modules/franchise/intransit_order.js and changed line by line to the MERCHANT C# (merchant wins on every difference).
 * Requires the `xlsx` package (lazy-required) for the Excel upload write-back / courier download (replacement for Excel interop / ACE.OLEDB).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const GetIP = require('../../lib/merchant/GetIP');
const SendMail = require('../../lib/merchant/SendMail');
const Utility = require('../../lib/merchant/ConvertUtility');

const router = express.Router();
const DB = 'shopping';
const upload = multer({ storage: multer.memoryStorage() });
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// C# class OrderList (Merchant Controllers/CustomerPanel/Order_List.cs)
const ORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'PrSKUCode', 'PaidViaCashWallet',
  'PaidViaCahbackWallet', 'PaidViaKreazVoucher', 'PaidViaOnline', 'EMAILID', 'FULLNAME', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit',
  'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'CODPAYMENT'];
// C# class Courierdatalist (Merchant Controllers/CustomerPanel/handover_order.cs)
const COURIERDATA_PROPS = ['ROWNUMBER', 'ORDERID', 'ITEM_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_CITY',
  'SHIPPING_STATE', 'SHIPPING_PINCODE', 'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'WEIGHT', 'STATUS', 'INVOICENO', 'PAYMODE',
  'TYPE_OF_SERVICE', 'DOCKETNO', 'CurrentSTATUS', 'OrderNO'];
// C# classes GetOrderDetailsMessage / GetLoginIdEmail (SubscribeUs.cs) / Resellerwisecompanydetails (Active_Order.cs)
const ORDERMSG_PROPS = ['LoginId', 'OrderId', 'Product_Name', 'DocketNO'];
const LOGINEMAIL_PROPS = ['Phone', 'EmailID', 'UserName', 'Password', 'DID', 'COMPANYNAME'];
const RESELLER_PROPS = ['CompanyDomain', 'COMPANYINFOEMAILID', 'CompanySupportEmailId', 'CompanyName', 'CompanyDomainLogo', 'FacebookShare', 'TwitterShare',
  'GoogleplusShare', 'LinkedinShare', 'PinterestShare'];

// ---- helpers -------------------------------------------------------------------------------------------
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const s = (v) => (v === null || v === undefined ? '' : String(v)); // ToStringOrEmpty
const tr = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).trim(); }; // string.Trim()
const lc = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).toLowerCase(); }; // string.ToLower()
const optInt = (v) => { const n = parseInt(v, 10); return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n; };
/** String.Replace(old, newValue) — a null newValue removes the token */
const rep = (str, oldV, newV) => str.split(oldV).join(newV === null || newV === undefined ? '' : String(newV));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
/** OUTPUT parameter value; DBNull.ToString() => "" */
function outStr(row, name) {
  if (!row) return '';
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  const v = k !== undefined ? row[k] : row[Object.keys(row)[0]];
  return v === null || v === undefined ? '' : String(v);
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
/** DateTime.Now.ToString("dd-MM-yyyy") */
function todayDMY() { const d = new Date(); return pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); }
const tabClean = (v) => String(v).replace(/\t/g, '    ');
/** a.ToString() on a possibly-null property */
const ts = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };
/** fire-and-forget (legacy System.Threading.Thread) */
const bg = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread, errors ignored */ }); };
/** insert into TBL_ERROR (STEP,REMARK) values (...) */
const dbgErr = (step, remark) => exec(DB, 'INSERT INTO tbl_error (step, remark) VALUES (@step, @remark)', { step, remark });
/** SELECT DBO.FUN_GETCURRENTDATE() */
async function dbNow() {
  try { const v = await scalar(DB, 'SELECT fun_getcurrentdate()'); return v || new Date(); } catch (e) { return new Date(); }
}
/** new MailMessage(from, to) argument validation (ArgumentNull / Argument / FormatException) */
function mailCheck(addr, param) {
  if (addr === null || addr === undefined) throw new Error("Value cannot be null.\r\nParameter name: " + param);
  if (String(addr) === '') throw new Error("The parameter '" + param + "' cannot be an empty string.\r\nParameter name: " + param);
  for (const a of String(addr).split(',')) {
    if (!/^[^@\s]+@[^@\s]+$/.test(a.trim())) throw new Error('The specified string is not in the form required for an e-mail address.');
  }
}
// Convert.* on DataTable cells (DBNull is null here)
const cvStr = (v) => (v === null || v === undefined ? '' : String(v));
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f; if (d > 0.5) return f + 1; return f % 2 === 0 ? f : f + 1;
}
function cvInt(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') return bankers(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const str = String(v).trim();
  if (!/^[+-]?\d+$/.test(str)) throw new Error('Input string was not in a correct format.');
  return parseInt(str, 10);
}
function cvDec(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') return v;
  const str = String(v).trim();
  if (str === '' || Number.isNaN(Number(str))) throw new Error('Input string was not in a correct format.');
  return Number(str);
}
/** wrap Utility.ConvertCSVtoDataTable / ConvertXSLXtoDataTableMerchantorder rows (array of objects) as a DataTable-like {columns, rows} */
function toTable(rows, csvHeaders) {
  let columns;
  if (csvHeaders) columns = csvHeaders;
  else {
    const width = rows.reduce((m, r) => Math.max(m, Object.keys(r).length), 0);
    columns = Array.from({ length: width }, (_, i) => 'F' + (i + 1));
  }
  return { columns, rows };
}
const getCol = (table, row, name) => {
  if (!table.columns.includes(name)) throw new Error('Column \'' + name + '\' does not belong to table.');
  const v = row[name];
  return v === undefined ? null : v;
};

// ---- SendMsgOnMobile (Merchant Models/UtilityClass.cs, 4-arg overload) -----------------------------------
// Inline: src/lib/merchant/UtilityClass re-exports the API UtilityClass whose 3-arg overload treats the 3rd argument as an SMS API URL,
// and the franchise copy reads TBL_DISTRIBUTOR; the Merchant C# version below differs from both.
async function SendMsgOnMobile(MobileNo, Message, type = '', did = 0) {
  let res = 0;
  let CompanySMSAPI = ''; let baseurl = '';
  try {
    if (type !== '' && did !== 0) {
      let API = '';
      CompanySMSAPI = await scalar(DB, "SELECT coalesce(smsapi,'') FROM tbl_companysettings WHERE pmid=1 LIMIT 1");
      if (CompanySMSAPI === null || CompanySMSAPI === undefined) throw NRE();
      API = rep(String(CompanySMSAPI), '1111111111', MobileNo);
      API = rep(API, 'DummyText', Message);
      await axios.get(API, { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
      res = 1;
    } else {
      // ConfigurationManager.AppSettings[...].ToString() throws when the key is missing
      const need = (k) => { const v = config.app[k]; if (v === undefined || v === null) throw NRE(); return String(v); };
      CompanySMSAPI = need('CompanySMSAPI');
      const CompanySMSAPIUSERNAME = need('CompanySMSAPIUSERNAME');
      const CompanySMSAPIPASSWORD = need('CompanySMSAPIPASSWORD');
      const CompanySMSAPISENDERID = need('CompanySMSAPISENDERID');
      baseurl = CompanySMSAPI + 'username=' + CompanySMSAPIUSERNAME + '&pass=' + CompanySMSAPIPASSWORD + '&senderid=' + CompanySMSAPISENDERID + '&dest_mobileno=' + MobileNo + '&message=' + Message + '&response=Y';
      await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d], timeout: 100000 });
      res = 1;
    }
  } catch (e) {
    res = 0;
  }
  return res;
}

// ---- TrackMerchantsEmails (Merchant Models/UtilityClass.cs) — not exported by the shared UtilityClass the merchant lib re-exports ----
async function TrackMerchantsEmails(emailId, mailBody, process) {
  try {
    await procOne(DB, 'usp_merchants_registration_email', { emailid: emailId, mailbody: mailBody, process });
  } catch (ex) { /* swallowed like legacy */ }
}

// ---- SendConfirmationEmailNew (protected) -------------------------------------------------------------------
async function SendConfirmationEmailNew(ToEmail, Username, Text, subject, Type, DID = 0) {
  let send = 0;
  let CompanyDomain = '', COMPANYINFOEMAILID = '', CompanySupportEmailId = '', CompanyName = '', CompanyDomainLogo = '', FacebookShare = '', TwitterShare = '',
    GoogleplusShare = '', LinkedinShare = '', PinterestShare = '';
  const companyresellerurl = config.app.CompanyResellerURL;
  const companyresellerlogo = config.app.CompanyLogowithurl;
  try {
    if (Username === '') Username = ToEmail;
    if (DID > 0 && Type !== '') {
      const _Resellerwisecompanydetails = mapRows(await query(DB, `SELECT coalesce(companyredirect,'') AS companydomain, companyinfoemailid, companysupportemailid,
        coalesce(companyname,'') AS companyname, '' AS companydomainlogo, coalesce(companyfacebooklink,'') AS facebookshare, coalesce(companygooglepluslink,'') AS googleplusshare,
        coalesce(companyfacebooklink,'') AS twittershare, coalesce(companylinkedinlink,'') AS linkedinshare, coalesce(companypinterestlink,'') AS pinterestshare
        FROM tbl_companysettings WHERE pmid=1`), RESELLER_PROPS);
      for (const Items of _Resellerwisecompanydetails) {
        CompanyDomain = Items.CompanyDomain;
        COMPANYINFOEMAILID = Items.COMPANYINFOEMAILID;
        CompanySupportEmailId = Items.CompanySupportEmailId;
        CompanyName = Items.CompanyName;
        CompanyDomainLogo = Items.CompanyDomainLogo;
        FacebookShare = Items.FacebookShare;
        TwitterShare = Items.TwitterShare;
        GoogleplusShare = Items.GoogleplusShare;
        LinkedinShare = Items.LinkedinShare;
        PinterestShare = Items.PinterestShare;
      }
    }
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      mailCheck('' + CompanySettings.CompanySendMailEmailId + '', 'from'); // new MailMessage(from, to)
      mailCheck(ToEmail, 'to');
      mailtxt = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;padding: 5px;background: #0e1017;'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Hello $$lblname$$,</h1>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>
    <tr>
        <td colspan='3' style='height:10px; line-height:10px;'></td>
    </tr>
    <tr>
    <td colspan='3' style='height:10px; line-height:30px;'>$$lblmessage$$</td>
    </tr>

    <tr>
        <td colspan='3' style='height:15px; line-height:15px;'></td>
    </tr>

</table>
</p>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>

</p>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding this mail, you can write us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Best Regards,
<br>
The $$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<span>Follow us on</span>
<br>
<div style = 'margin-right: 7px; text-align:right'>
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyresellerDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyresellerDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyresellerDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyresellerDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyresellerDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanyDomain);
      mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', companyresellerlogo);
      mailtxt = rep(mailtxt, '$$FacebookShare$$', FacebookShare);
      mailtxt = rep(mailtxt, '$$TwitterShare$$', TwitterShare);
      mailtxt = rep(mailtxt, '$$GoogleplusShare$$', GoogleplusShare);
      mailtxt = rep(mailtxt, '$$LinkedinShare$$', LinkedinShare);
      mailtxt = rep(mailtxt, '$$PinterestShare$$', PinterestShare);
      mailtxt = rep(mailtxt, '$$CompanyresellerDomain$$', companyresellerurl);
      const process = 'Order Dispatched';
      const result = '';
      const body = mailtxt;
      // legacy: the send runs on a new Thread and `result` is checked immediately (race) => practically always "" => return
      bg(() => SendMail.Send1('', ToEmail, '', '', subject, body, DID, Type));
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message;
  }
}

// ---- SendConfirmationEmail (protected; only referenced from commented-out code in the Merchant C#) ------------------
// `plid` = ((Login)Session["Plid"]).Plid (passed in because there is no Session in this module scope)
async function SendConfirmationEmail(plid, ToEmail, Username, Text, Type, subject, DID = 0) {
  let send = 0;
  try {
    let mailtxt = '';
    const Date_ = todayDMY();
    if (send === 0) {
      mailCheck(CompanySettings.CompanySupportEmailId, 'from'); // new MailMessage(CompanySupportEmailId, ToEmail)
      mailCheck(ToEmail, 'to');
      mailtxt = `<div>
 <link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Dear $$lblname$$,</h1>

<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>
    <tr>
        <td colspan='3' style='height:10px; line-height:10px;'></td>
    </tr>
    <tr>
    <td colspan='3'>$$lblmessage$$</td>
    </tr>

    <tr>
        <td colspan='3' style='height:15px; line-height:15px;'></td>
    </tr>

</table>
</p>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>

</p>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding this mail, you can write us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
</center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Thank & Regards,
<br>
$$CompanyName$$  Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<span>Follow us on</span>
<br>
<div style = 'margin-right: 7px; text-align:right'>
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySettings.CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', CompanySettings.CompanyDomainLogo);
      mailtxt = rep(mailtxt, '$$FacebookShare$$', CompanySettings.FacebookShare);
      mailtxt = rep(mailtxt, '$$TwitterShare$$', CompanySettings.TwitterShare);
      mailtxt = rep(mailtxt, '$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      mailtxt = rep(mailtxt, '$$LinkedinShare$$', CompanySettings.LinkedinShare);
      mailtxt = rep(mailtxt, '$$PinterestShare$$', CompanySettings.PinterestShare);
      // legacy positional call kept: SendMail.Send(Plid, ToEmail, "", "", subject, mailtxt, DID.ToString(), Type)
      const result = await SendMail.Send(plid, ToEmail, '', '', subject, mailtxt, String(DID), Type);
      const process = 'Order Delivered';
      if (Type === 'Customer') await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (Type === 'Merchant') await TrackMerchantsEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message;
  }
}
void SendConfirmationEmail; // kept for parity (no live caller in the Merchant C#)

// ---- Updatestatus (public string action + helper used by Uploadexcel) ----------------------------------------
/** state = { datauploadmessage, TOTALINVALIDRECORDS } (legacy controller instance fields); plid = Session Plid */
async function Updatestatus(state, plid, orderid, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state_, Docketno, weight, pincode,
  mobile, invoicevalue, CollectableAmount, Staus, Typeofservice, Dtdcstatus, Statusdate, ORDERNO) {
  try {
    await dbgErr(4, '');
    let StrMessage = '';
    const EMPID = plid;
    const r = await procOne(DB, 'usp_update_courier_list_complete', {
      orderid, docketno: Docketno, weight, status: Staus, typeofservice: lc(Typeofservice), plid: EMPID, productname: lc(Productname),
      no_of_piece: No_of_Piece, customer_name: lc(Customer_name), shipping_add1: Shipping_add1, shipping_add2: Shipping_add2, city: City,
      state: state_, pincode, mobile, invoicevalue, collectableamount: CollectableAmount, dtdcstatus: Dtdcstatus, statusdate: Statusdate, orderno: ORDERNO,
    });
    StrMessage = outStr(r, 'strresult');
    await dbgErr(5, StrMessage);
    const arr = StrMessage.split('^');
    if (arr[0] !== 'OK') {
      state.TOTALINVALIDRECORDS += 1;
      if (arr[1] === undefined) throw new RangeError('Index was outside the bounds of the array.');
      state.datauploadmessage = (arr[0] + arr[1]).toString();
    } else {
      //--------------Created ON 15-10-2020 By Pawan Verma---------START Content-------------
      if (Staus !== '' && Staus !== null && Staus !== undefined) {
        // PORT-NOTE: the legacy SQL is malformed ("... As DocketNO As Product_Name"); it fails at run time on SQL Server and is ported literally,
        // so this block normally throws and the outer catch counts the row as invalid (same as legacy; the DB error text differs).
        const Obj_Ordremsg = mapRows(await query(DB, "SELECT coalesce(loginid,'') AS loginid, coalesce(orderid,'') AS orderid, coalesce(product_name,''), coalesce(docketno,'N/A') AS docketno AS product_name FROM tbl_product_order_master WHERE orderid = @orderid LIMIT 1", { orderid }), ORDERMSG_PROPS)[0] || null;
        if (Obj_Ordremsg === null) throw NRE();
        const Obj_LoginEmail = mapRows(await query(DB, "SELECT coalesce(phone,'') AS phone, emailid, (fname) AS username, coalesce(did,0) AS did, coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid = @loginid LIMIT 1", { loginid: Obj_Ordremsg.LoginId }), LOGINEMAIL_PROPS)[0] || null;
        const CompanyName = await scalar(DB, 'SELECT companyname FROM tbl_companysettings WHERE pmid=1 LIMIT 1');
        const PhoneMessage = 'Dear Customer,\r\nYour ' + nn(Obj_Ordremsg.Product_Name) + '  with Order Id ' + nn(Obj_Ordremsg.OrderId) + ' and Docket No ' + nn(Obj_Ordremsg.DocketNO) + ' has been ' + nn(Staus) + '. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + nn(CompanyName) + ' Team';
        const Mailsubject = "Order :- '" + nn(Obj_Ordremsg.OrderId) + "' has been " + nn(Staus);
        const process = '';
        const DIDv = Obj_LoginEmail ? (Number(Obj_LoginEmail.DID) || 0) : 0;
        if (Obj_LoginEmail !== null && (Obj_LoginEmail.EmailID !== '' || Obj_LoginEmail.EmailID !== null)) {
          if (Obj_LoginEmail.UserName === '' || Obj_LoginEmail.UserName === null || Obj_LoginEmail.UserName === undefined) Obj_LoginEmail.UserName = "Dear Sir/ Ma'am";
          await SendConfirmationEmailNew(Obj_LoginEmail.EmailID, Obj_LoginEmail.UserName, 'Your  - ' + nn(Obj_Ordremsg.Product_Name) + ' with Order Id ' + nn(Obj_Ordremsg.OrderId) + ' and Docket No ' + nn(Obj_Ordremsg.DocketNO) + ' has been ' + nn(Staus) + '. We will notify you for further updates.', Mailsubject, 'Customer', DIDv);
        }
        if (Obj_LoginEmail === null) throw NRE();
        const ph = Obj_LoginEmail.Phone;
        if (ph !== null && ph !== undefined && ph !== '') {
          bg(async () => {
            await SendMsgOnMobile(ph, PhoneMessage, 'Customer', DIDv);
            await UtilityClass.TrackCustomersMessages(ph, PhoneMessage, process);
          });
        }
      }
      //--------------Created ON 15-10-2020 By Pawan Verma--------------END Content--------
      // (Start/End Mail and Message block is commented out in the Merchant C#; datauploadmessage is NOT updated on success)
    }
    return StrMessage;
  } catch (Ex) {
    state.TOTALINVALIDRECORDS += 1;
    state.datauploadmessage = 'Some error occured while performing the operations.' + Ex.message;
    return 'Some error occured while performing the operations.' + Ex.message;
  }
}

// ---- ExportReport (public void action + helper used by Index) ----------------------------------------------
/** returns true when the download response has been sent */
async function ExportReport(req, res, type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order) {
  let Orderno = '';
  let orderid = '';
  if (Order === null || Order === undefined) Order = '';
  if (Order !== '') {
    if (Order.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    if (Order.substring(0, 2) === 'OD') orderid = Order; else Orderno = Order;
  }
  if (type === null || type === undefined) type = '1';
  const BranchId = req.user.plid;
  const MaxRows = 99999999; // UtilityClass.GridPageSize();
  if (page === null || page === undefined) page = 1;
  const rows = await proc(DB, 'usp_order_list_complete_new', {
    startrowindex: page, maxrows: MaxRows, searchfield: tr(SearchField), searchvalue: tr(SearchValue), fromdate: tr(fromDate), todate: tr(toDate),
    status: tr(statusid), statustype: type, branchid: BranchId, fromreadyfordispatch: fromReadyforDispatch, toreadyfordispatch: toReadyforDispatch,
    orderid, orderno: Orderno,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);
  try {
    if (objAllOrderList.length > 0) {
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'intransit_order.xls');
      // ViewBag.filepath = filepath;
      if (fs.existsSync(filepath)) { fs.unlinkSync(filepath); fs.closeSync(fs.openSync(filepath, 'a')); }
      let out = '';
      for (const h of ['S.No. ', 'Product Name ', 'Order Date ', 'Order No ', 'Order Id ', 'Status ', 'Quantity ', 'Actual Value ', 'Shipping ', 'GST ', 'Total ',
        'After Date ', 'By Date ', 'Customer Name ', 'City  ', 'Login ID  ', 'Payment Type  ', 'Full Address  ']) out += h + '\t';
      let closed = false; // after the first failing row the legacy StreamWriter is closed and later writes throw (swallowed)
      for (const item of objAllOrderList) {
        if (closed) continue;
        try {
          out += '\n';
          out += tabClean(ts(item.rownumber)) + ' \t';
          out += tabClean(ts(item.Product_Name)) + ' \t';
          out += tabClean(ts(item.OrderDate)) + ' \t';
          out += tabClean(ts(item.Orderno)) + ' \t';
          out += tabClean(ts(item.orderID)) + ' \t';
          out += tabClean(ts(item.status)) + ' \t';
          out += tabClean(ts(item.order_QTY)) + ' \t';
          out += tabClean(ts(item.total_DAP)) + ' \t';
          out += tabClean(ts(item.Total_Ship_Ch)) + ' \t';
          out += tabClean(ts(item.ProductTotalVat)) + ' \t';
          out += tabClean(ts(item.total_purchase_cost)) + ' \t';
          if (item.Approved === 'Jan  1 1900 12:00AM') out += 'N.A.'; else out += tabClean(ts(item.Approved)) + ' \t';
          if (item.dispatchdate === 'Jan  1 1900 12:00AM') out += 'N.A.'; else out += tabClean(ts(item.dispatchdate)) + ' \t';
          out += tabClean(ts(item.Name)) + ' \t';
          out += tabClean(ts(item.City)) + ' \t';
          out += tabClean(ts(item.LoginId)) + ' \t';
          out += tabClean(ts(item.PayMode)) + ' \t';
          out += tabClean(nn(item.Address) + ',' + nn(item.City) + ' Pin' + nn(item.PinCode)) + ' \t';
        } catch (ExpObj) {
          closed = true; // wr.Close();
        }
      }
      fs.writeFileSync(filepath, out);
      // legacy: force-download headers + Response.Redirect("~/AllExcelSheets/intransit_order.xls") + Response.End()
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=intransit_order.xls');
      res.send(out);
      return true;
    }
    // ViewBag.Message = "There is no record in excel";
  } catch (ExpObj) {
    // ViewBag.filepath = ExpObj.Message;
  }
  return false;
}

// ---- Index ---------------------------------------------------------------------------------------------
async function Index(req, res) {
  const p = req.p;
  let Orderno = '';
  let orderid = '';
  const Order = nn(p.Order);
  if (Order !== '') {
    if (Order.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    if (Order.substring(0, 2) === 'OD') orderid = Order; else Orderno = Order;
  }
  const SearchField = nn(p.SearchField);
  const SearchValue = nn(p.SearchValue);
  const fromDate = nn(p.fromDate);
  const fromReadyforDispatch = nn(p.fromReadyforDispatch);
  const toReadyforDispatch = nn(p.toReadyforDispatch);
  const statusid = nn(p.statusid);
  const toDate = nn(p.toDate);
  const status = nn(p.status);
  const type = p.type === undefined || p.type === null ? '1' : String(p.type);
  let page = optInt(p.page);
  const btnexel = p.btnexel;

  const ViewBag = { Status: status };
  const BranchId = req.user.plid; // ((Login)Session["Plid"]).Plid
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_order_list_complete_new', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    status: statusid.trim(), statustype: type, branchid: BranchId, fromreadyfordispatch: fromReadyforDispatch, toreadyfordispatch: toReadyforDispatch,
    orderid, orderno: Orderno,
  });
  const objAllOrderList = mapRows(rows, ORDERLIST_PROPS);
  const TotalRecord = totalOf(rows, 'totalcount');
  ViewBag.Orderno = orderid === '' ? Orderno : orderid;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.fromReadyforDispatch = fromReadyforDispatch;
  ViewBag.toReadyforDispatch = toReadyforDispatch;
  ViewBag.statusid = statusid;
  ViewBag.toDate = toDate;
  ViewBag.status = status;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const done = await ExportReport(req, res, type, toReadyforDispatch, fromReadyforDispatch, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, statusid, Order);
    if (done) return undefined;
  }
  return res.json({ view: '~/Views/intransit_order/Index.cshtml', Model: objAllOrderList, ViewBag });
}
// auth (legacy cast Session["Plid"] without a null check)
router.all('/merchant/intransit_order/Index{/:id}', auth, asyncHandler(Index));
// route-config: IntransitOrder  url "merchant/GOjhT8qZ8GbRQj3kECcLlA==" -> intransit_order/Index
// auth
router.all('/merchant/merchant/GOjhT8qZ8GbRQj3kECcLlA==', auth, asyncHandler(Index));

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth
router.all('/merchant/intransit_order/UpdateStatuslist{/:id}', auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  if (isSelected === undefined || isSelected === null) throw NRE();
  const activinactiv = parseInt(req.p.activinactiv, 10);
  if (Number.isNaN(activinactiv)) throw new Error('The parameters dictionary contains a null entry for parameter \'activinactiv\' of non-nullable type \'System.Int32\'.');
  const tokens = String(isSelected).split(',');
  const status = activinactiv;
  let ret = 'ok';
  const BranchId = req.user.plid;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== '') {
      const r = await procOne(DB, 'usp_updateorderstatusmerchant_complete', {
        orderno: tokens[i], branchid: BranchId, empid: 1, intstatus: 6, remark: '', statusdate: '',
      });
      ret = outStr(r, 'strresult');
    }
  }
  void ret;
  return res.json(status);
}));

// ---- UpdateStatusProduct -------------------------------------------------------------------------------
// auth
router.all('/merchant/intransit_order/UpdateStatusProduct{/:id}', auth, asyncHandler(async (req, res) => {
  const { Orderno, statusdate } = req.p;
  const BranchId = req.user.plid;
  const r = await procOne(DB, 'usp_updateorderstatusmerchant_complete', {
    orderno: Orderno, branchid: BranchId, empid: 1, intstatus: 6, remark: '', statusdate,
  });
  return res.json(outStr(r, 'strresult'));
}));

// ---- Uploadexcel ---------------------------------------------------------------------------------------
// auth
router.post('/merchant/intransit_order/Uploadexcel{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  let ret = '', Filename = '', Typename = '';
  const ip = await GetIP.GetLocalIP(req);
  void ip;
  let z = 0;
  let Totalrecord = 0;
  await dbgErr(1, '');
  try {
    const files = req.files || [];
    const file = files[0]; // Request.Files[0]
    if (!file) throw new RangeError('Specified argument was out of the range of valid values.');
    if (file.size > 0) {
      await dbgErr(2, '');
      const fu = files.find((f) => f.fieldname === 'FileUpload'); // Request.Files["FileUpload"]
      if (!fu) throw NRE();
      await dbgErr(101, path.extname(fu.originalname).toLowerCase());
      const FileExtension = path.extname(fu.originalname).toLowerCase();
      Typename = nn(req.body && req.body.Typename);
      await dbgErr(102, '');
      let ConnString = '';
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      await dbgErr(103, '');
      let PathForFile = fu.originalname;
      Filename = path.basename(PathForFile);
      Filename = nowStamp() + Filename;
      await dbgErr(104, '');
      const dir = path.join(config.uploadDir, 'AllUploadsExcelFile');
      PathForFile = path.join(dir, Filename);
      await dbgErr(105, '');
      if (!fs.existsSync(PathForFile)) fs.mkdirSync(dir, { recursive: true });
      await dbgErr(106, PathForFile);
      await dbgErr(101, FileExtension);
      // TempData["ExcelFileName"] / TempData["UploadedExcel"] (read back within the same request)
      let TD_ExcelFileName;
      let TD_UploadedExcel;
      if (validFileTypes.includes(FileExtension)) {
        await dbgErr(10, '');
        let DtObjForFileUpload = { columns: [], rows: [] };
        await dbgErr(1111, PathForFile);
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        await dbgErr(2233, 'System.Web.HttpPostedFileWrapper');
        fs.writeFileSync(PathForFile, fu.buffer);
        await dbgErr(2222, PathForFile);
        if (FileExtension === '.csv') {
          const rowsCsv = await Utility.ConvertCSVtoDataTable(PathForFile);
          const firstLine = fs.readFileSync(PathForFile, 'utf8').replace(/^﻿/, '').split(/\r\n|\n|\r/)[0] || '';
          DtObjForFileUpload = toTable(rowsCsv, firstLine.split(','));
          // ViewBag.Data = DtObjForFileUpload;
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          await dbgErr(11, '');
          ConnString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=NO;IMEX=1"';
          DtObjForFileUpload = toTable(await Utility.ConvertXSLXtoDataTableMerchantorder(PathForFile, ConnString));
          // ViewBag.Data = DtObjForFileUpload;
          await dbgErr(12, ConnString);
        }
        TD_ExcelFileName = Filename;
        TD_UploadedExcel = DtObjForFileUpload;
      }
      await dbgErr(3, '');
      const DtExcel = TD_UploadedExcel;
      if (DtExcel === undefined || DtExcel === null) throw NRE();
      if (DtExcel.rows.length > 0) {
        z = DtExcel.rows.length - 1;
        for (let i = 1; i < DtExcel.rows.length; i++) {
          const row = DtExcel.rows[i];
          const col = (name) => getCol(DtExcel, row, name);
          let alllength = 0;
          const Dtdcstatus = '';
          for (let k = 0; k < DtExcel.columns.length; k++) {
            const v0 = DtExcel.rows[0][DtExcel.columns[k]];
            if (cvStr(v0 === undefined ? null : v0) !== '') alllength++;
          }
          // `x == null ? 0 : x` never matches (DBNull), Convert.ToString(DBNull) => ""
          const orderid = cvStr(col('F2'));
          const Productname = cvStr(col('F3'));
          const No_of_Piece = cvInt(col('F4'));
          const Customer_name = cvStr(col('F5'));
          const Shipping_add1 = cvStr(col('F6'));
          const Shipping_add2 = cvStr(col('F7'));
          const City = cvStr(col('F8'));
          const state_ = cvStr(col('F9'));
          const pincode = cvStr(col('F10'));
          const mobile = cvStr(col('F11'));
          const invoicevalue = cvDec(col('F12'));
          // legacy: `if (row["F13"] != "" && row["F13"] != null)` compares object references => always true; Convert.ToDecimal(DBNull) throws
          const CollectableAmount = cvDec(col('F13'));
          const Docketno = cvStr(col('F14'));
          const weight = cvStr(col('F15'));
          const Typeofservice = cvStr(col('F17'));
          const Staus = cvStr(col('F16'));
          const Statusdate = cvStr(col('F19'));
          const ORDERNO = cvStr(col('F21'));
          if (Staus !== '') {
            await Updatestatus(state, req.user.plid, orderid, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state_, Docketno, weight,
              pincode, mobile, invoicevalue, CollectableAmount, Staus, Typeofservice, Dtdcstatus, Statusdate, ORDERNO);
          }
          const Response = state.datauploadmessage;

          // Excel interop: open the saved upload, write the status into Sheet1!(row i+1, col alllength), SaveAs, close (once per row)
          // PORT-NOTE: interop cell colouring (DarkGray fill, Red / Green font) is not supported by `xlsx`; only the text is written.
          if (!fs.existsSync(PathForFile)) throw NRE(); // mWorkBook == null => mWorkBook.Worksheets
          if (FileExtension === '.csv') {
            // PORT-NOTE: Excel names a CSV's only sheet after the file, so get_Item("Sheet1") fails for every CSV upload (legacy behaviour kept).
            throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
          }
          const XLSX = require('xlsx');
          const mWorkBook = XLSX.readFile(PathForFile);
          const mWSheet1 = mWorkBook.Sheets.Sheet1;
          if (!mWSheet1) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
          if (alllength < 1) throw new Error('Exception from HRESULT: 0x800A03EC');
          const J = i + 1;
          const addr = XLSX.utils.encode_cell({ r: J - 1, c: alllength - 1 });
          mWSheet1[addr] = { t: 's', v: Response !== 'Update Status' ? Response : state.datauploadmessage };
          const ref = mWSheet1['!ref'] ? XLSX.utils.decode_range(mWSheet1['!ref']) : { s: { r: 0, c: 0 }, e: { r: 0, c: 0 } };
          if (J - 1 > ref.e.r) ref.e.r = J - 1;
          if (alllength - 1 > ref.e.c) ref.e.c = alllength - 1;
          mWSheet1['!ref'] = XLSX.utils.encode_range(ref);
          XLSX.writeFile(mWorkBook, PathForFile);
        }
      }

      TD_UploadedExcel = null;
      Totalrecord = z - state.TOTALINVALIDRECORDS;
      const EMPID = req.user.plid;
      await exec(DB, `INSERT INTO tbl_uploaded_courier_excellog (excelfile, plid, status, activitybyuserid, totaluploadedrecords, totalerrorrecords, requestid, activitydate)
        VALUES (@excelfile, @plid, @status, @activitybyuserid, @totaluploadedrecords, @totalerrorrecords, @requestid, @activitydate)`, {
        excelfile: nn(TD_ExcelFileName), plid: Math.trunc(Number(EMPID)), status: 1, activitybyuserid: 0, totaluploadedrecords: Totalrecord,
        totalerrorrecords: state.TOTALINVALIDRECORDS, requestid: '', activitydate: await dbNow(),
      });
      ret = '1';
    }
  } catch (Ex) {
    sessionStore.set(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message); // TempData["Message"]
    await dbgErr(0, Ex.message.toString());
    await dbgErr(0, ret.toString());
    return res.json(Ex.message);
  }
  return res.json(ret);
}));

// ---- Updatestatus (public string action) -----------------------------------------------------------------------
// auth
router.all('/merchant/intransit_order/Updatestatus{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  const no = (v) => { const x = parseInt(v, 10); if (Number.isNaN(x)) throw new Error('The parameters dictionary contains a null entry for parameter \'No_of_Piece\' of non-nullable type \'System.Int32\'.'); return x; };
  const dec = (v, n) => { const x = Number(v); if (v === undefined || v === null || v === '' || Number.isNaN(x)) throw new Error('The parameters dictionary contains a null entry for parameter \'' + n + '\' of non-nullable type \'System.Decimal\'.'); return x; };
  const out = await Updatestatus(state, req.user.plid, p.orderid, p.Productname, no(p.No_of_Piece), p.Customer_name, p.Shipping_add1, p.Shipping_add2, p.City, p.state,
    p.Docketno, p.weight, p.pincode, p.mobile, dec(p.invoicevalue, 'invoicevalue'), dec(p.CollectableAmount, 'CollectableAmount'), p.Staus, p.Typeofservice,
    p.Dtdcstatus, p.Statusdate, p.ORDERNO);
  return res.type('text/plain').send(out);
}));

// ---- Downloadexceldata (public Tuple action + helper used by DownloadData) ------------------------------------
async function Downloadexceldata(plid) {
  let file_name = '', Path = '';
  try {
    const BranchId = plid;
    const objCourierList = mapRows(await proc(DB, 'usp_getcourierdatalist_merchand', { mode: 1, status: 4, branchid: BranchId }), COURIERDATA_PROPS);
    let pincode = '', City = '', State = '';
    const XLSX = require('xlsx');
    const aoa = [['S.No', 'Order_id', 'Item_Name', 'No_of_Piece', 'Customer_Name', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'City', 'State', 'Pincode', 'Mobile_No',
      'Invoice_value', 'Collectable_Amount', 'DOCKETNO', 'WEIGHT', 'STATUS', 'TYPE_OF_SERVICE', 'Status Date', 'Error Reson']];
    for (const item of objCourierList) {
      const rowv = new Array(19).fill(undefined);
      rowv[0] = s(item.ROWNUMBER).trim();
      rowv[1] = s(item.ORDERID).trim();
      rowv[2] = s(item.ITEM_NAME).trim();
      rowv[3] = s(item.NO_OF_PIECE).trim();
      rowv[4] = s(item.CUSTOMER_NAME).trim();
      rowv[5] = s(item.SHIPPING_ADD1).trim();
      rowv[6] = s(item.SHIPPING_ADD2).trim();
      pincode = item.SHIPPING_PINCODE;
      const objList = await query(DB, 'SELECT city, state FROM tbl_courierpincodes WHERE pincode = @pincode', { pincode });
      const objcourierStatuslist = await query(DB, 'SELECT csid, statusname FROM tbl_courierexcelstatuslist WHERE status = 1');
      for (const a of objList) { City = a.city; State = a.state; }
      rowv[7] = tr(City);
      rowv[8] = tr(State);
      rowv[9] = s(item.SHIPPING_PINCODE).trim();
      rowv[10] = s(item.SHIPPING_MOBILENO).trim();
      rowv[11] = s(item.INVOICE_VALUE).trim();
      rowv[12] = item.PAYMODE === 'COD' ? s(item.COLLECTABLE_AMOUNT).trim() : '0';
      rowv[13] = s(item.DOCKETNO).trim();
      rowv[14] = s(item.WEIGHT).trim();
      rowv[16] = s(item.TYPE_OF_SERVICE).trim();
      // PORT-NOTE: STATUS column (16) drop-down validation built from tbl_courierexcelstatuslist, cell/row locking, header styling
      // (bold, Arial Narrow 15, yellow fill) and AutoFit are Excel-interop features not supported by the `xlsx` package.
      const FlatList2 = objcourierStatuslist.map((x) => x.statusname).join(',');
      void FlatList2;
      aoa.push(rowv);
    }
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    file_name = 'Courier_data_' + nowStamp();
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    Path = path.join(dir, file_name + '.xlsx');
    XLSX.writeFile(wb, Path);
  } catch (ex) {
    await dbgErr(2, ex.message);
    return [Path, file_name];
  }
  return [Path, file_name];
}

// auth
router.all('/merchant/intransit_order/Downloadexceldata{/:id}', auth, asyncHandler(async (req, res) => {
  const [Path, file_name] = await Downloadexceldata(req.user.plid);
  // Tuple<string,string>.ToString()
  return res.type('text/plain').send('(' + Path + ', ' + file_name + ')');
}));

// ---- DownloadData --------------------------------------------------------------------------------------
// auth (legacy: Session["Plid"] == null => Json("Session Expired. Please login again"))
router.all('/merchant/intransit_order/DownloadData{/:id}', auth, asyncHandler(async (req, res) => {
  let fileName = '';
  try {
    const DownloadFile = await Downloadexceldata(req.user.plid);
    const fileBytes = fs.readFileSync('' + DownloadFile[0] + '');
    fileName = DownloadFile[1] + '.xlsx';
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="' + fileName + '"');
    return res.send(fileBytes);
  } catch (ex) {
    return res.json('');
  }
}));

// ---- ExportReport (public void action) -------------------------------------------------------------------
// auth
router.all('/merchant/intransit_order/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const page = optInt(p.page);
  const done = await ExportReport(req, res, p.type, p.toReadyforDispatch, p.fromReadyforDispatch, p.SearchField, p.SearchValue, p.fromDate, p.toDate, p.status, page, p.btnexel, p.statusid, p.Order);
  if (done) return undefined;
  return res.status(200).end();
}));

module.exports = router;
