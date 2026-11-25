'use strict';
const DB = 'shopping';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/handover_order.cs (handover_orderController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 * Started from src/modules/franchise/handover_order.js and rewritten to match the MERCHANT C# (source of truth):
 *  - UpdateStatuslist / Uploadexcel / Updatestatus are commented out in the merchant C# => not ported.
 *  - UpdateStatusProduct places the order on ShipRocket (createOrderToShipRocket) and returns its status string.
 *  - BranchId = Session Plid (req.user.plid); USP_NEW_ORDER_LIST @ORDERSTATUS = 3; courier sheet has 14 columns.
 * PORT-NOTE: Excel generation (Microsoft.Office.Interop.Excel) uses the optional npm package "exceljs" (lazy-required, not installed).
 * PORT-NOTE: USP_NEW_ORDER_LIST @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const SendMail = require('../../lib/merchant/SendMail');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const ShipRocketAPI = require('../../lib/merchant/ShipRocketAPI');

const router = express.Router();
const C = 'handover_order';
const BASE = `/merchant/${C}`;

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp(d = new Date()) {
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
/** Int32? model binding: missing / not numeric => null */
const nullableInt = (v) => {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const n = Number(String(v).trim());
  return Number.isInteger(n) ? n : null;
};
/** C# DateTime.AddMonths (day is clamped to the last day of the target month) */
function addMonths(d, months) {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}
/** Json.NET serialisation of a Local DateTime: yyyy-MM-ddTHH:mm:ss.FFFFFFFzzz */
function netLocalIso(d) {
  let frac = pad(d.getMilliseconds(), 3) + '0000';
  frac = frac.replace(/0+$/, '');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + (frac ? '.' + frac : '') + `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() for a DataSet (default name NewDataSet) filled into table `tblName` */
function getXml(rows, tblName) {
  if (!rows.length) return '<NewDataSet />';
  let x = '<NewDataSet>';
  for (const r of rows) {
    x += `\r\n  <${tblName}>`;
    for (const k of Object.keys(r)) {
      if (r[k] === null || r[k] === undefined) continue;
      x += `\r\n    <${k}>${xmlEsc(r[k] instanceof Date ? netLocalIso(r[k]) : r[k])}</${k}>`;
    }
    x += `\r\n  </${tblName}>`;
  }
  return x + '\r\n</NewDataSet>';
}
async function logError(step, remark) {
  await exec(DB, 'INSERT INTO tbl_error (step,remark) VALUES (@step,@remark)', { step, remark });
}

// Merchant NewOrderList (Controllers/CustomerPanel/Active_Order.cs) property names
const NEWORDER_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'EMAILID', 'Name', 'FULLNAME', 'order_DAP',
  'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images',
  'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP',
  'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV',
  'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked',
  'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'PrSKUCode', 'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher',
  'PaidViaOnline', 'CODPAYMENT', 'Distributorname', 'COMPANYNAME'];
// Courierdatalist (bottom of handover_order.cs)
const COURIER_PROPS = ['ROWNUMBER', 'ORDERID', 'ITEM_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_CITY', 'SHIPPING_STATE',
  'SHIPPING_PINCODE', 'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'WEIGHT', 'STATUS', 'INVOICENO', 'PAYMODE', 'TYPE_OF_SERVICE', 'DOCKETNO',
  'CurrentSTATUS', 'OrderNO'];

/** DBO.USP_NEW_ORDER_LIST with the 19 parameters the merchant C# passes */
async function newOrderList(p) {
  return proc(DB, 'usp_new_order_list', {
    startrowindex: p.startrowindex, maxrows: p.maxrows, searchfield: p.searchfield, searchvalue: p.searchvalue, fromdate: p.fromdate,
    todate: p.todate, status: p.status, statustype: p.statustype, branchid: p.branchid, orderid: p.orderid, company: '', poid: p.poid,
    orderno: p.orderno, mode: 1, statusid: '0', loginid: '', sortbydispatchorder: p.sortbydispatchorder, orderstatus: 3,
  });
}

// ---- Mail body template (verbatim from C# SendConfirmationEmail) ----------------------------------------
const MAIL_TEMPLATE = `<div>
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

/** protected void SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) - not an action */
async function SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) {
  let send = 0;
  let CompanyDomain = '', COMPANYINFOEMAILID = '', CompanySupportEmailId = '', CompanyName = '', CompanyDomainLogo = '';
  let FacebookShare = '', TwitterShare = '', GoogleplusShare = '', LinkedinShare = '', PinterestShare = '';
  const companyresellerurl = config.app.CompanyResellerURL || '';
  const companyresellerlogo = config.app.CompanyLogowithurl || '';
  try {
    if (Username === '') Username = ToEmail;
    if (DID > 0 && Type !== '') {
      const _Resellerwisecompanydetails = await query(DB,
        "SELECT coalesce(companyredirect,'') AS companydomain,companyinfoemailid,companysupportemailid,coalesce(companyname,'') AS companyname,'' AS companydomainlogo,"
        + "coalesce(companyfacebooklink,'') AS facebookshare,coalesce(companygoogleplusLink,'') AS googleplusshare,coalesce(companyfacebooklink,'') AS twittershare,"
        + "coalesce(companylinkedinlink,'') AS linkedinshare,coalesce(companypinterestlink,'') AS pinterestshare FROM tbl_companysettings WHERE pmid=1");
      for (const Items of _Resellerwisecompanydetails) {
        CompanyDomain = Items.companydomain;
        COMPANYINFOEMAILID = Items.companyinfoemailid;
        CompanySupportEmailId = Items.companysupportemailid;
        CompanyName = Items.companyname;
        CompanyDomainLogo = Items.companydomainlogo;
        FacebookShare = Items.facebookshare;
        TwitterShare = Items.twittershare;
        GoogleplusShare = Items.googleplusshare;
        LinkedinShare = Items.linkedinshare;
        PinterestShare = Items.pinterestshare;
      }
    }
    void COMPANYINFOEMAILID; void CompanyDomainLogo;
    if (send === 0) {
      // new MailMessage(CompanySettings.CompanySendMailEmailId, ToEmail) - only used to hold the body in legacy
      void (await CompanySettings.CompanySendMailEmailId);
      let mailtxt = MAIL_TEMPLATE;
      const d = new Date();
      const Date_ = pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear(); // DateTime.Now.ToString("dd-MM-yyyy")
      const rep = (k, v) => { mailtxt = mailtxt.split(k).join(s(v)); };
      rep('$$lblname$$', Username);
      rep('$$datetime$$', Date_);
      rep('$$lblmessage$$', Text);
      rep('$$CompanyDomain$$', CompanyDomain);
      rep('$$CompanyURL$$', CompanyDomain);
      rep('$$SupportEmailId$$', CompanySupportEmailId);
      rep('$$CompanyName$$', CompanyName);
      rep('$$CompanyDomainLogo$$', companyresellerlogo);
      rep('$$FacebookShare$$', FacebookShare);
      rep('$$TwitterShare$$', TwitterShare);
      rep('$$GoogleplusShare$$', GoogleplusShare);
      rep('$$LinkedinShare$$', LinkedinShare);
      rep('$$PinterestShare$$', PinterestShare);
      rep('$$CompanyresellerDomain$$', companyresellerurl);
      const process = 'Order Dispatched';
      let result = '';
      // legacy: Send1 runs in a started background thread (not joined) => 'result' is still '' at the check below
      SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type).then((r) => { result = r; }).catch(() => {});
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // legacy: ViewBag.Message = exp.Message
  }
}

/**
 * Merchant UtilityClass.SendMsgOnMobile(string MobileNo, string Message, string type = "", int did = 0) - implemented inline because
 * the shared lib treats a 3rd argument as the SMSAPI overload (different semantics).
 */
async function SendMsgOnMobile(MobileNo, Message, type = '', did = 0) {
  let res = 0;
  try {
    if (type !== '' && did !== 0) {
      const CompanySMSAPI = await scalar(DB, "SELECT coalesce(smsapi,'') FROM tbl_companysettings WHERE pmid=1 LIMIT 1");
      if (CompanySMSAPI === null || CompanySMSAPI === undefined) throw NRE();
      let API = String(CompanySMSAPI).split('1111111111').join(s(MobileNo));
      API = API.split('DummyText').join(s(Message));
      await axios.get(API);
      res = 1;
    } else {
      const baseurl = s(config.app.CompanySMSAPI) + 'username=' + s(config.app.CompanySMSAPIUSERNAME) + '&pass=' + s(config.app.CompanySMSAPIPASSWORD)
        + '&senderid=' + s(config.app.CompanySMSAPISENDERID) + '&dest_mobileno=' + s(MobileNo) + '&message=' + s(Message) + '&response=Y';
      await axios.get(baseurl);
      res = 1;
    }
  } catch (e) {
    res = 0;
  }
  return res;
}

// ---- ExportReport (public void) -------------------------------------------------------------------------
/** returns { sent: true } when the file was streamed, otherwise { ViewBag } */
async function ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder) {
  const ViewBag = {};
  const BranchId = Number(res.req.user.plid);
  const MaxRows = 99999999; // UtilityClass.GridPageSize();  (not used: @MAXROWS is passed 9999999)
  void MaxRows; void btnexel;
  if (page == null) page = 1;
  const rows = await newOrderList({
    startrowindex: page, maxrows: 9999999, searchfield: s(SearchField).trim(), searchvalue: s(SearchValue).trim(), fromdate: s(fromDate).trim(),
    todate: s(toDate).trim(), status: s(status).trim(), statustype: type, branchid: BranchId, orderid, poid: '0', orderno: Orderno, sortbydispatchorder,
  });
  const objAllOrderList = mapRows(rows, NEWORDER_PROPS);
  try {
    if (objAllOrderList.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'Handover_orderlist.xls');
      ViewBag.filepath = filepath;
      // StreamWriter emulation: after an exception inside the loop the writer is closed and every later Write throws
      let out = '';
      let closed = false;
      const wr = (t) => { if (closed) throw new Error('Cannot write to a closed TextWriter.'); out += t; };
      const need = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };
      wr('S.No. \t');
      wr('Product Name \t');
      wr('Order Date \t');
      wr('Order No \t');
      wr('Order Id \t');
      wr('Status \t');
      wr('Quantity \t');
      wr('Actual Value \t');
      wr('Shipping \t');
      wr('GST \t');
      wr('Total \t');
      wr('Customer Name \t');
      wr('City  \t');
      wr('Login ID  \t');
      wr('Payment Type  \t');
      wr('Full Address  \t');
      for (const Items of objAllOrderList) {
        try {
          wr('\n');
          wr(tabClean(need(Items.rownumber)) + ' \t');
          wr(tabClean(need(Items.Product_Name)) + ' \t');
          wr(tabClean(need(Items.OrderDate)) + ' \t');
          wr(tabClean(need(Items.Orderno)) + ' \t');
          wr(tabClean(need(Items.orderID)) + ' \t');
          wr(tabClean(need(Items.status)) + ' \t');
          wr(tabClean(need(Items.order_QTY)) + ' \t');
          wr(tabClean(need(Items.total_DAP)) + ' \t');
          wr(tabClean(need(Items.Total_Ship_Ch)) + ' \t');
          wr(tabClean(need(Items.ProductTotalVat)) + ' \t');
          wr(tabClean(need(Items.total_purchase_cost)) + ' \t');
          wr(tabClean(need(Items.Name)) + ' \t');
          wr(tabClean(need(Items.City)) + ' \t');
          wr(tabClean(need(Items.LoginId)) + ' \t');
          wr(tabClean(need(Items.PayMode)) + ' \t');
          wr(tabClean(s(Items.Address) + ',' + s(Items.City) + ' Pin' + s(Items.PinCode)) + ' \t');
        } catch (ExpObj) {
          closed = true; // wr.Close();
        }
      }
      fs.writeFileSync(filepath, out);
      // legacy: Response.ContentType = "application/force-download"; content-disposition; Response.Redirect(~/AllExcelSheets/Handover_orderlist.xls); Response.End()
      // PORT-NOTE: the generated file is streamed directly instead of redirecting to its static URL.
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Handover_orderlist.xls');
      res.send(out);
      return { sent: true, ViewBag };
    }
    ViewBag.Message = 'There is no record in excel';
  } catch (ExpObj) {
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}

// ---- Index ----------------------------------------------------------------------------------------------
// [SessionExpireCheck] => auth
const indexHandler = asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, btnexel, ProductName, sortbydispatchorder } = req.p;
  let page = nullableInt(req.p.page);
  let Orderno = '';
  let orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = '';
  if (ProductName == null) ProductName = '';
  SearchField = String(SearchField); SearchValue = String(SearchValue); ProductName = String(ProductName);
  if (ProductName === '') {
    // nothing
  } else {
    const partnoveri = ProductName;
    // legacy: Substring(0, 2) throws ArgumentOutOfRangeException for a 1-char value
    if (partnoveri.length < 2) throw new RangeError('Index and length must refer to a location within the string.\r\nParameter name: length');
    const sub = partnoveri.substring(0, 2);
    if (sub === 'OD') orderid = ProductName;
    else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  fromDate = String(fromDate); toDate = String(toDate); status = String(status); type = String(type);
  if (type === 'manifest') type = 'ReadyToShip';

  const ViewBag = {};
  ViewBag.Status = status;
  const BranchId = Number(req.user.plid);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await newOrderList({
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId, orderid, poid: '0', orderno: Orderno,
    sortbydispatchorder: s(sortbydispatchorder),
  });
  const TotalRecord = totalOf(rows);
  ViewBag.Productname = ProductName;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.sortbydispatchorder = sortbydispatchorder;
  ViewBag.type = type;
  const Model = mapRows(rows, NEWORDER_PROPS);
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, s(sortbydispatchorder));
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  // View("~/Views/handover_Order/Index.cshtml", objAllOrderList)
  res.json({ Model, ViewBag });
});
// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, indexHandler);
// route-config: handoverOrder  url "merchant/7ZQB7Y7P0XuTRNdZAO7LlQ==" -> handover_order/Index
router.all('/merchant/merchant/7ZQB7Y7P0XuTRNdZAO7LlQ==', auth, indexHandler);

// auth - public void ExportReport(type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder)
router.all(`${BASE}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  // legacy: null string args => .Trim() NullReferenceException
  for (const k of ['SearchField', 'SearchValue', 'fromDate', 'toDate', 'status']) if (p[k] === undefined || p[k] === null) throw NRE();
  const r = await ExportReport(res, s(p.type), s(p.SearchField), s(p.SearchValue), s(p.fromDate), s(p.toDate), s(p.status), nullableInt(p.page), p.btnexel,
    s(p.orderid), s(p.Orderno), s(p.sortbydispatchorder));
  if (r.sent) return;
  // void action => empty result in legacy; ViewBag values returned for the client
  res.json({ ViewBag: r.ViewBag });
}));

// ---- ParticularProductDetails ---------------------------------------------------------------------------
// auth (reads Session["Plid"])
router.all(`${BASE}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid === undefined || req.p.poid === null || String(req.p.poid).trim() === '' ? null : req.p.poid;
  const BranchId = Number(req.user.plid);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await newOrderList({
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    branchid: BranchId, orderid: '', poid, orderno: '', sortbydispatchorder: '',
  });
  res.json(mapRows(rows, NEWORDER_PROPS));
}));

// ---- createOrderToShipRocket (public string) ------------------------------------------------------------
async function createOrderToShipRocket(req, Orderid, remark, poid, pickuplocation, length, breadth, height, weight) {
  const BranchId = Number(req.user.plid); // ViewBag.BranchId = BranchId (not returned)
  void BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await newOrderList({
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    // PORT-NOTE: legacy passed @BRANCHID = "" (SQL Server converts '' to bigint 0); 0 is passed explicitly. Same for an empty @POID.
    branchid: 0, orderid: s(Orderid), poid: s(poid) === '' ? 0 : poid, orderno: '', sortbydispatchorder: '',
  });
  const TotalRecord = totalOf(rows);
  void TotalRecord;
  const Noofpage = await UtilityClass.GridNumbersPerPage();
  void Noofpage;
  const objAllOrderList = mapRows(rows, NEWORDER_PROPS);
  const first = () => { if (!objAllOrderList.length) throw NRE(); return objAllOrderList[0]; }; // FirstOrDefault().X

  const itemsDetail = [];
  itemsDetail.push({
    name: first().Product_Name,
    sku: first().PrSKUCode,
    units: first().Product_qty,
    selling_price: first().CODPAYMENT,
    discount: 0,
    tax: first().total_Vat,
    hsn: '',
  });
  const _srm = [];
  _srm.push({
    order_id: first().orderID,
    order_date: netLocalIso(addMonths(new Date(), -2)), // DateTime.Now.AddMonths(-2) (objAllOrderList.FirstOrDefault().OrderDate was commented out)
    pickup_location: pickuplocation === undefined ? null : pickuplocation,
    channel_id: '',
    comment: remark === undefined ? null : remark,
    reseller_name: first().Distributorname,
    company_name: first().COMPANYNAME,
    billing_customer_name: first().FULLNAME,
    billing_last_name: '',
    billing_address: first().Address,
    billing_address_2: '',
    billing_city: first().City,
    billing_pincode: first().PinCode,
    billing_state: 'Delhi',
    billing_country: 'India',
    billing_email: first().EMAILID,
    billing_phone: first().MobileNo,
    billing_alternate_phone: '',
    shipping_is_billing: true,
    shipping_customer_name: '',
    shipping_last_name: '',
    shipping_address: '',
    shipping_address_2: '',
    billing_isd_code: '',
    shipping_city: '',
    shipping_pincode: '',
    shipping_country: '',
    shipping_state: '',
    shipping_email: '',
    shipping_phone: '',
    longitude: '',
    latitude: '',

    order_items: itemsDetail,

    payment_method: first().PayMode,
    shipping_charges: first().Total_Ship_Ch,
    giftwrap_charges: '',
    transaction_charges: '',
    total_discount: '',
    sub_total: first().total_purchase_cost,

    length: length === undefined ? null : length,
    breadth: breadth === undefined ? null : breadth,
    height: height === undefined ? null : height,
    weight: weight === undefined ? null : weight,
    ewaybill_no: '',
    customer_gstin: '',
    invoice_number: first().Invoiceno,
    order_type: '',
    checkout_shipping_method: '',
  });
  const objShiprocket = new ShipRocketAPI();
  const status = await objShiprocket.CreateOrder(_srm);
  return status;
}

// auth - public string createOrderToShipRocket(Orderid, remark, poid, pickuplocation, length, breadth, height, weight)
router.all(`${BASE}/createOrderToShipRocket{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const r = await createOrderToShipRocket(req, p.Orderid, p.remark, p.poid, p.pickuplocation, p.length, p.breadth, p.height, p.weight);
  res.type('text/plain').send(s(r));
}));

// ---- UpdateStatusProduct (public string) ----------------------------------------------------------------
async function UpdateStatusProduct(req, st, statusid, poid, loginid, orderno, orderid, statusdate, Remark, docketno, ddlcourier, pickuplocation, length, breadth, height, weight) {
  void statusid; void loginid; void ddlcourier;
  try {
    const status = 'Shipped';
    let StrMessage = '';
    const EMPID = Number(req.user.plid);
    const placedShipstatus = await createOrderToShipRocket(req, orderid, Remark, s(poid), pickuplocation, length, breadth, height, weight);
    // eslint-disable-next-line no-constant-condition
    if (placedShipstatus === 'true' && false) { // legacy: branch disabled with "&& false" - kept as dead code
      const out = await procOne(DB, 'usp_update_courier_list', {
        orderid, docketno, weight: '', status: '4', typeofservice: '', plid: EMPID,
        productname: '', no_of_piece: '0', customer_name: '', shipping_add1: '', shipping_add2: '', city: '', state: '', pincode: '', mobile: '',
        invoicevalue: '0.00', collectableamount: '0.00', dtdcstatus: '', statusdate, ordernoexcel: orderno,
      });
      StrMessage = s(out && out.strresult); // PORT-NOTE: @STRRESULT OUT read from the "strresult" column
      const arr = StrMessage.split('^');
      if (arr[0] !== 'ok') {
        st.TOTALINVALIDRECORDS += 1;
        if (arr.length < 2) throw new RangeError('Index was outside the bounds of the array.');
        st.datauploadmessage = (arr[0] + arr[1]).toString();
        if (status != null && status !== '') {
          const Obj_Ordremsg = mapRow(await queryOne(DB,
            "SELECT coalesce(loginid,'') AS loginid,coalesce(orderid,'') AS orderid,coalesce(product_name,'') AS product_name,coalesce(docketno,'N/A') AS docketno "
            + 'FROM tbl_product_order_master WHERE orderid=@orderid LIMIT 1', { orderid: s(orderid) }), ['LoginId', 'OrderId', 'Product_Name', 'DocketNO']);
          if (!Obj_Ordremsg) throw NRE();
          const Obj_LoginEmail = mapRow(await queryOne(DB,
            "SELECT coalesce(phone,'') AS phone,emailid,(fname) AS username,coalesce(did,0) AS did,coalesce(dm.companyname,'') AS companyname "
            + 'FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid=@loginid LIMIT 1', { loginid: Obj_Ordremsg.LoginId }),
          ['Phone', 'EmailID', 'UserName', 'DID', 'COMPANYNAME']);
          const CompanyName = await scalar(DB, 'SELECT companyname FROM tbl_companysettings WHERE pmid=1 LIMIT 1');
          const PhoneMessage = 'Dear Customer,\r\nYour ' + s(Obj_Ordremsg.Product_Name) + '  with Order Id ' + s(Obj_Ordremsg.OrderId) + ' and Docket No '
            + s(Obj_Ordremsg.DocketNO) + ' has been ' + status + '. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + s(CompanyName) + ' Team';
          const Mailsubject = "Order :- '" + s(Obj_Ordremsg.OrderId) + "' has been " + status;
          const process = '';
          if (Obj_LoginEmail != null) { // (EmailID != "" || EmailID != null) is always true
            if (Obj_LoginEmail.UserName === '' || Obj_LoginEmail.UserName == null) Obj_LoginEmail.UserName = "Dear Sir/ Ma'am";
            await SendConfirmationEmail(Obj_LoginEmail.EmailID, Obj_LoginEmail.UserName, 'Your  - ' + s(Obj_Ordremsg.Product_Name) + ' with Order Id '
              + s(Obj_Ordremsg.OrderId) + ' and Docket No ' + s(Obj_Ordremsg.DocketNO) + ' has been ' + status + '. We will notify you for further updates.',
            Mailsubject, 'Customer', Number(Obj_LoginEmail.DID));
          }
          if (!Obj_LoginEmail) throw NRE();
          if (Obj_LoginEmail.Phone != null && Obj_LoginEmail.Phone !== '') {
            // legacy: background thread
            const ph = Obj_LoginEmail.Phone; const did = Number(Obj_LoginEmail.DID);
            Promise.resolve().then(async () => {
              await SendMsgOnMobile(ph, PhoneMessage, 'Customer', did);
              await UtilityClass.TrackCustomersMessages(ph, PhoneMessage, process);
            }).catch((e) => console.error(e));
          }
        }
      } else {
        if (arr.length < 2) throw new RangeError('Index was outside the bounds of the array.');
        st.datauploadmessage = arr[1].toString();
      }
    } else {
      StrMessage = placedShipstatus;
    }
    return StrMessage;
  } catch (Ex) {
    st.TOTALINVALIDRECORDS += 1;
    st.datauploadmessage = 'Some error occured while performing the operations.' + Ex.message;
    return 'Some error occured while performing the operations.' + Ex.message;
  }
}

// auth - public string UpdateStatusProduct(statusid, poid, loginid, orderno, orderid, statusdate, Remark, docketno, ddlcourier, pickuplocation, length, breadth, height, weight)
router.all(`${BASE}/UpdateStatusProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const st = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 }; // controller instance fields
  const poid = p.poid === undefined || p.poid === null || String(p.poid).trim() === '' ? null : p.poid; // Int64? => Convert.ToString(null) = ""
  const r = await UpdateStatusProduct(req, st, nullableInt(p.statusid), poid, p.loginid, p.orderno, p.orderid, p.statusdate, p.Remark, p.docketno, p.ddlcourier,
    p.pickuplocation, p.length, p.breadth, p.height, p.weight);
  res.type('text/plain').send(s(r));
}));

// ---- DataSearchnew --------------------------------------------------------------------------------------
// auth (no session check in legacy, but searches order data)
router.all(`${BASE}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  if (req.p.SearchText === undefined || req.p.SearchText === null) throw NRE();
  const SearchText = String(req.p.SearchText).split('+apostopis').join("'");
  // UtilityClass.GetDataSetSPNamed(@serchItem, "usp_SearchOrderNo", "dsData") - merchant UtilityClass uses the Db_Shopping connection
  const rows = await proc(DB, 'usp_searchorderno', { serchitem: SearchText });
  res.json(getXml(rows, 'dsData'));
}));

// ---- GetStatusData --------------------------------------------------------------------------------------
// public (master data, no session check in legacy)
router.all(`${BASE}/GetStatusData{/:id}`, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT osid,statusname FROM orderstatusmaster WHERE status=1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- Downloadexceldata (public Tuple<string,string>) ----------------------------------------------------
async function Downloadexceldata(req) {
  let file_name = '', Path = '';
  try {
    const BranchId = Number(req.user.plid);
    const objCourierList = mapRows(await proc(DB, 'usp_getcourierdatalist_merchand', { mode: 1, status: 3, branchid: BranchId }), COURIER_PROPS);
    let pincode = '', City = '', State = '';
    await logError(0, '1');
    const ExcelJS = require('exceljs'); // PORT-NOTE: replaces Microsoft.Office.Interop.Excel (npm i exceljs)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const T = (v) => s(v).trim(); // ToStringOrEmpty().Trim()
    const heads = ['S.No', 'Order_id', 'Item_Name', 'No_of_Piece', 'Customer_Name', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'City', 'State', 'Pincode', 'Mobile_No',
      'Invoice_value', 'DOCKETNO', 'Orderno'];
    heads.forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
    let row = 2;
    for (const Items of objCourierList) {
      worksheet.getCell(row, 1).value = T(Items.ROWNUMBER);
      worksheet.getCell(row, 2).value = T(Items.ORDERID);
      worksheet.getCell(row, 3).value = T(Items.ITEM_NAME);
      worksheet.getCell(row, 4).value = T(Items.NO_OF_PIECE);
      worksheet.getCell(row, 5).value = T(Items.CUSTOMER_NAME);
      worksheet.getCell(row, 6).value = T(Items.SHIPPING_ADD1);
      worksheet.getCell(row, 7).value = T(Items.SHIPPING_ADD2);
      pincode = Items.SHIPPING_PINCODE;
      const objList = await query(DB, 'SELECT city,state FROM tbl_courierpincodes WHERE pincode=@pincode', { pincode: s(pincode) });
      const objcourierStatuslist = mapRows(await query(DB, 'SELECT csid,statusname FROM tbl_courierexcelstatuslist WHERE status=1'), ['CSID', 'Statusname']);
      for (const a of objList) { City = a.city; State = a.state; } // City/State keep the previous row's values when no pincode match (legacy)
      if (City === null || State === null) throw NRE(); // City.Trim() on a null column
      worksheet.getCell(row, 8).value = String(City).trim();
      worksheet.getCell(row, 9).value = String(State).trim();
      worksheet.getCell(row, 10).value = T(Items.SHIPPING_PINCODE);
      worksheet.getCell(row, 11).value = T(Items.SHIPPING_MOBILENO);
      worksheet.getCell(row, 12).value = T(Items.INVOICE_VALUE);
      worksheet.getCell(row, 13).value = T(Items.DOCKETNO);
      worksheet.getCell(row, 14).value = T(Items.OrderNO);
      const FlatList2 = objcourierStatuslist.map((x) => x.Statusname).join(',');
      void FlatList2; // legacy: list validation on column 16 is commented out
      row++;
    }
    // worksheet.get_Range("A1","ZZ1").EntireColumn.AutoFit()
    worksheet.columns.forEach((col) => {
      let max = 8;
      col.eachCell({ includeEmpty: false }, (c) => { max = Math.max(max, s(c.value).length + 2); });
      col.width = max;
    });
    // range A1:Z1 => bold, Arial Narrow, size 15, yellow background
    for (let c = 1; c <= 26; c++) {
      const cell = worksheet.getCell(1, c);
      cell.font = { bold: true, name: 'Arial Narrow', size: 15 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }
    file_name = 'Courier_data_' + nowStamp();
    Path = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), file_name + '.xlsx');
    await logError(0, Path);
    await workbook.xlsx.writeFile(Path);
  } catch (ex) {
    try { await logError(2, ex.message); } catch (e) { console.error(e); }
    return { Item1: Path, Item2: file_name };
  }
  return { Item1: Path, Item2: file_name };
}

// optionalAuth - legacy checks Session itself and answers Json("Session Expired. Please login again")
router.all(`${BASE}/DownloadData{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let fileName = '';
  try {
    if (!req.user) return res.json('Session Expired. Please login again');
    const DownloadFile = await Downloadexceldata(req);
    if (!DownloadFile.Item1) throw new Error('Empty path name is not legal.');
    const fileBytes = fs.readFileSync(DownloadFile.Item1);
    fileName = DownloadFile.Item2 + '.xlsx';
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBytes);
  } catch (ex) {
    try { await logError(2, ex.message); } catch (e) { console.error(e); }
    return res.json('');
  }
}));

// auth - public Tuple<string,string> Downloadexceldata() is a public action in MVC (serialises as Item1/Item2)
router.all(`${BASE}/Downloadexceldata{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await Downloadexceldata(req));
}));

module.exports = router;
