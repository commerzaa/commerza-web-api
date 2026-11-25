'use strict';
const DB = 'shopping';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/pack_order.cs (pack_orderController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');

const router = express.Router();
const C = 'pack_order';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}

const NEWORDER_PROPS = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty',
  'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status',
  'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved',
  'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType',
  'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount', 'INVPer',
  'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemailid', 'FULLNAME', 'EMAILID'];

// Mail body template (verbatim from C#)
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

/** protected void SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) */
async function SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) {
  let send = 0;
  let CompanyDomain = '', COMPANYINFOEMAILID = '', CompanySupportEmailId = '', CompanyName = '', CompanyDomainLogo = '', FacebookShare = '', TwitterShare = '', GoogleplusShare = '', LinkedinShare = '', PinterestShare = '';
  const companyresellerurl = config.app.CompanyResellerURL;
  const companyresellerlogo = config.app.CompanyLogowithurl;
  try {
    if (Username === '') Username = ToEmail;
    if (DID > 0 && Type !== '') {
      const _Resellerwisecompanydetails = await query(DB, "SELECT coalesce(companyredirect,'') AS companydomain,companyinfoemailid,companysupportemailid,coalesce(companyname,'') AS companyname,'' AS companydomainlogo,coalesce(companyfacebooklink,'') AS facebookshare,coalesce(companygoogleplusLink,'') AS googleplusshare,coalesce(companyfacebooklink,'') AS twittershare,coalesce(companylinkedinlink,'') AS linkedinshare,coalesce(companypinterestlink,'') AS pinterestshare FROM tbl_companysettings WHERE pmid=1");
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
    if (send === 0) {
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

// ---- Index ---------------------------------------------------------------------------------------------
// auth
const indexHandler = asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, ProductName, sortbydispatchorder } = req.p;
  let Orderno = '';
  let orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    const sub = ProductName.substring(0, 2); // legacy: throws for 1-char input (ArgumentOutOfRange)
    if (ProductName.length < 2) throw new Error('Index and length must refer to a location within the string.');
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';

  const ViewBag = { Status: status };
  const BranchId = Number(req.user.plid);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: 2,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
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
    const r = await exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ Model, ViewBag });
});
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`], auth, indexHandler);
// route-config
router.all('/merchant/merchant/x94grbKbzigOLdoMlJxHOw==', auth, indexHandler);

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const ViewBag = {};
  const BranchId = Number(res.req.user.plid);
  const MaxRows = 99999999; // UtilityClass.GridPageSize()
  if (page == null || page === '') page = 1;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: parseInt(page, 10), maxrows: MaxRows, searchfield: s(SearchField).trim(), searchvalue: s(SearchValue).trim(), fromdate: s(fromDate).trim(),
    todate: s(toDate).trim(), status: s(status).trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: 2,
  });
  const list = mapRows(rows, NEWORDER_PROPS);
  try {
    if (list.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'Pack_orderlist.xls');
      ViewBag.filepath = filepath;
      let out = '';
      out += 'S.No. \t';
      out += 'Product Name \t';
      out += 'Order Date \t';
      out += 'Order No \t';
      out += 'Order Id \t';
      out += 'Status \t';
      out += 'Quantity \t';
      out += 'Actual Value \t';
      out += 'Shipping \t';
      out += 'GST \t';
      out += 'Total \t';
      out += 'Customer Name \t';
      out += 'City  \t';
      out += 'Login ID  \t';
      out += 'Payment Type  \t';
      out += 'Full Address  \t';
      for (const Item of list) {
        try {
          let line = '\n';
          line += tabClean(Item.rownumber.toString()) + ' \t';
          line += tabClean(Item.Product_Name.toString()) + ' \t';
          line += tabClean(Item.OrderDate.toString()) + ' \t';
          line += tabClean(Item.Orderno.toString()) + ' \t';
          line += tabClean(Item.orderID.toString()) + ' \t';
          line += tabClean(Item.status.toString()) + ' \t';
          line += tabClean(Item.order_QTY.toString()) + ' \t';
          line += tabClean(Item.total_DAP.toString()) + ' \t';
          line += tabClean(Item.Total_Ship_Ch.toString()) + ' \t';
          line += tabClean(Item.ProductTotalVat.toString()) + ' \t';
          line += tabClean(Item.total_purchase_cost.toString()) + ' \t';
          line += tabClean(Item.Name.toString()) + ' \t';
          line += tabClean(Item.City.toString()) + ' \t';
          line += tabClean(Item.LoginId.toString()) + ' \t';
          line += tabClean(Item.PayMode.toString()) + ' \t';
          line += tabClean((s(Item.Address) + ',' + s(Item.City) + ' Pin' + s(Item.PinCode)).toString()) + ' \t';
          out += line;
        } catch (e) { break; /* legacy: wr.Close() then later writes fail */ }
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/Pack_orderlist.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Pack_orderlist.xls');
      res.send(out);
      return { sent: true };
    }
    ViewBag.Message = 'There is no record in excel';
  } catch (ExpObj) {
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}
// auth
router.all(`/merchant/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder } = req.p;
  // legacy: .Trim() on null parameters throws NullReferenceException
  const r = await exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, s(orderid), s(Orderno), sortbydispatchorder);
  if (!r.sent) res.json({ ViewBag: r.ViewBag }); // void action => empty response in MVC; ViewBag returned for parity
}));

// ---- ParticularProductDetails ----------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid == null || req.p.poid === '' ? null : req.p.poid;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: Number(req.user.plid), orderid: '',
    company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: 2, statusdate: '',
  });
  res.json(mapRows(rows, NEWORDER_PROPS));
}));

// ---- DataSearchnew -----------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], 'usp_SearchOrderNo', 'dsData');
  res.json(getXml(ds));
}));

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  const tokens = s(isSelected).split(',');
  const status = parseInt(req.p.activinactiv, 10);
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== '') {
      await exec(DB, "UPDATE tbl_product_order_master SET intstatus=3,status='Ready For Dispatch' WHERE orderno=@orderno", { orderno: tokens[i] });
      await exec(DB, 'UPDATE tbl_order_confirmedstaus SET handover=fun_getcurrentdate() WHERE orderno=@orderno', { orderno: tokens[i] });
      await exec(DB, 'UPDATE tbl_customer_notifications SET notificationdate=fun_getcurrentdate(),isread=0,active=1,isreaddate=NULL WHERE referenceid=@orderno', { orderno: tokens[i] });
    }
    const Obj1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid,coalesce(orderid,'') AS orderid,coalesce(product_name,'') AS product_name,coalesce(docketno,'N/A') AS docketno FROM tbl_product_order_master WHERE orderno = @orderno LIMIT 1", { orderno: tokens[i] });
    if (!Obj1) throw new TypeError('Object reference not set to an instance of an object.'); // legacy: Obj1.OrderId on null
    await scalar(DB, "SELECT to_char(orderdate + interval '7 days','Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid=@orderid LIMIT 1", { orderid: Obj1.orderid }); // deliverydate (unused in legacy)
    const Obj = await queryOne(DB, "SELECT coalesce(phone,'') AS phone,emailid,(fname) AS username,coalesce(did,0) did ,coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid= @loginid LIMIT 1", { loginid: Obj1.loginid });
    const CompanyName = await scalar(DB, 'SELECT companyname FROM tbl_companysettings WHERE pmid=1 LIMIT 1');
    const PhoneMessage = 'Dear Customer,\r\nYour ' + Obj1.product_name + '  with Order Id ' + Obj1.orderid + ' and Docket No ' + Obj1.docketno + ' has been Dispatched. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + s(CompanyName) + ' Team';
    const Mailsubject = "Order :- '" + Obj1.orderid + "' has been Dispatched";
    const process = 'Order Dispatched';
    if (Obj != null && (Obj.emailid !== '' || Obj.emailid !== null)) {
      if (Obj.username === '' || Obj.username === null) Obj.username = "Dear Sir/ Ma'am";
      await SendConfirmationEmail(Obj.emailid, Obj.username, 'Your  - ' + Obj1.product_name + ' with Order Id ' + Obj1.orderid + ' and Docket No ' + Obj1.docketno + ' has been Dispatched. We will notify you for further updates.', Mailsubject, 'Customer', Number(Obj.did));
    }
    if (!Obj) throw new TypeError('Object reference not set to an instance of an object.'); // legacy: Obj.Phone on null
    if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
      // legacy: started background thread (not joined)
      (async () => {
        try {
          await UtilityClass.SendMsgOnMobile(Obj.phone, PhoneMessage, 'Customer', Number(Obj.did));
          await UtilityClass.TrackCustomersMessages(Obj.phone, PhoneMessage, process);
        } catch (e) { console.error(e.message); }
      })();
    }
  }
  res.json(status);
}));

// ---- GetStatusData -------------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/GetStatusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT osid,statusname FROM orderstatusmaster WHERE status=1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- DownloadData / Downloadexceldata --------------------------------------------------------------
async function Downloadexceldata(plid) {
  let file_name = '', Path = '';
  try {
    const BranchId = Number(plid);
    const COURIER_PROPS = ['ROWNUMBER', 'ORDERID', 'ITEM_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_PINCODE',
      'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'DOCKETNO', 'WEIGHT', 'PAYMODE', 'TYPE_OF_SERVICE', 'CurrentSTATUS', 'OrderNO'];
    const objCourierList = mapRows(await proc(DB, 'usp_getcourierdatalist_merchand', { mode: 1, status: 3, branchid: BranchId }), COURIER_PROPS);
    let City = '', State = '';
    // PORT-NOTE: Microsoft.Office.Interop.Excel replaced by the "exceljs" package (not installed yet)
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const heads = { 1: 'S.No', 2: 'Order_id', 3: 'Item_Name', 4: 'No_of_Piece', 5: 'Customer_Name', 6: 'SHIPPING_ADD1', 7: 'SHIPPING_ADD2', 8: 'City', 9: 'State',
      10: 'Pincode', 11: 'Mobile_No', 12: 'Invoice_value', 13: 'Collectable_Amount', 14: 'DOCKETNO', 15: 'WEIGHT', 16: 'STATUS', 17: 'TYPE_OF_SERVICE',
      18: 'DTDC_STATUS', 19: 'Status Date', 20: 'Current Status', 21: 'Order No', 23: 'Error Reson' };
    for (const c of Object.keys(heads)) worksheet.getCell(1, Number(c)).value = heads[c];
    let row = 2;
    for (const Item of objCourierList) {
      const set = (c, v) => { worksheet.getCell(row, c).value = v; };
      set(1, s(Item.ROWNUMBER).trim());
      set(2, s(Item.ORDERID).trim());
      set(3, s(Item.ITEM_NAME).trim());
      set(4, s(Item.NO_OF_PIECE).trim());
      set(5, s(Item.CUSTOMER_NAME).trim());
      set(6, s(Item.SHIPPING_ADD1).trim());
      set(7, s(Item.SHIPPING_ADD2).trim());
      const pincode = Item.SHIPPING_PINCODE;
      const objList = await query(DB, 'SELECT city,state FROM tbl_courierpincodes WHERE pincode=@pincode', { pincode });
      const objcourierStatuslist = await query(DB, 'SELECT csid,statusname FROM tbl_courierexcelstatuslist WHERE status=1');
      for (const a of objList) { City = a.city; State = a.state; }
      set(8, s(City).trim());
      set(9, s(State).trim());
      set(10, s(Item.SHIPPING_PINCODE).trim());
      set(11, s(Item.SHIPPING_MOBILENO).trim());
      set(12, s(Item.INVOICE_VALUE).trim());
      if (Item.PAYMODE === 'COD') set(13, s(Item.COLLECTABLE_AMOUNT).trim()); else set(13, '0');
      set(14, s(Item.DOCKETNO).trim());
      set(15, s(Item.WEIGHT).trim());
      set(17, s(Item.TYPE_OF_SERVICE).trim());
      set(20, s(Item.CurrentSTATUS).trim());
      set(21, s(Item.OrderNO).trim());
      const FlatList2 = objcourierStatuslist.map((x) => x.statusname).join(',');
      // PORT-NOTE: legacy also set EntireColumn/EntireRow.Locked (no effect without worksheet protection); list validation kept
      worksheet.getCell(row, 16).dataValidation = { type: 'list', allowBlank: true, formulae: ['"' + FlatList2 + '"'], errorStyle: 'information', showErrorMessage: true };
      row++;
    }
    worksheet.columns.forEach((col) => { col.width = 18; });
    const hr = worksheet.getRow(1);
    for (let c = 1; c <= 26; c++) {
      const cell = hr.getCell(c);
      cell.font = { bold: true, name: 'Arial Narrow', size: 15 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }
    file_name = 'Courier_data_' + nowStamp();
    Path = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), file_name + '.xlsx');
    await workbook.xlsx.writeFile(Path);
  } catch (ex) {
    await exec(DB, 'INSERT INTO tbl_error (step,remark) VALUES (2,@remark)', { remark: ex.message });
    return { Item1: Path, Item2: file_name };
  }
  return { Item1: Path, Item2: file_name };
}
// auth
router.all(`/merchant/${C}/DownloadData{/:id}`, auth, asyncHandler(async (req, res) => {
  let fileName = '';
  try {
    const DownloadFile = await Downloadexceldata(req.user.plid);
    const fileBytes = fs.readFileSync(DownloadFile.Item1);
    fileName = DownloadFile.Item2 + '.xlsx';
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBytes);
  } catch (ex) {
    await exec(DB, 'INSERT INTO tbl_error (step,remark) VALUES (2,@remark)', { remark: ex.message });
    return res.json('');
  }
}));
// auth
router.all(`/merchant/${C}/Downloadexceldata{/:id}`, auth, asyncHandler(async (req, res) => {
  // legacy: public Tuple-returning method (MVC would render Tuple.ToString()); returned as JSON
  const t = await Downloadexceldata(req.user.plid);
  res.json(t);
}));

module.exports = router;
