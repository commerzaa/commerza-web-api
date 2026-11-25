'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Active_Order.cs (Active_OrderController)
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
const DB = 'shopping';
const C = 'Active_Order';

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

const NEWORDER_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'EMAILID', 'Name', 'FULLNAME', 'order_DAP',
  'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images',
  'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP',
  'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV',
  'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked',
  'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'PrSKUCode', 'PaidViaCashWallet', 'PaidViaCahbackWallet', 'PaidViaKreazVoucher',
  'PaidViaOnline', 'CODPAYMENT', 'Distributorname', 'COMPANYNAME'];

// Mail body template (verbatim from C#)
const MAIL_TEMPLATE = `
<div>
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
  const companyresellerurl = config.app.CompanyResellerURL || '';
  const companyresellerlogo = config.app.CompanyLogowithurl || '';
  try {
    if (Username === '') Username = ToEmail;
    if (DID > 0 && Type !== '') {
      const rows = await query(DB, "SELECT coalesce(companyredirect,'') AS companydomain,companyinfoemailid,companysupportemailid,coalesce(companyname,'') AS companyname,'' AS companydomainlogo,coalesce(companyfacebooklink,'') AS facebookshare,coalesce(companygoogleplusLink,'') AS googleplusshare,coalesce(companyfacebooklink,'') AS twittershare,coalesce(companylinkedinlink,'') AS linkedinshare,coalesce(companypinterestlink,'') AS pinterestshare FROM tbl_companysettings WHERE pmid=1");
      for (const Items of rows) {
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
    let mailtxt = '';
    const d = new Date();
    const Date_ = pad(d.getDate()) + '-' + pad(d.getMonth() + 1) + '-' + d.getFullYear();
    if (send === 0) {
      mailtxt = MAIL_TEMPLATE;
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
      // legacy: mail is sent on a background thread; `result` is read before the thread finishes
      SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type).then((r) => { result = r; }).catch(() => {});
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // legacy: ViewBag.Message = exp.Message
  }
}

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, ProductName, sortbydispatchorder } = req.p;
  let Orderno = '';
  let orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    if (ProductName.length < 2) throw new Error('Index and length must refer to a location within the string.');
    const sub = ProductName.substring(0, 2);
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';

  const ViewBag = { Status: status };
  const BranchId = req.user.plid;
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: '0',
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
    const r = await exportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ Model, ViewBag });
});
// auth
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`], auth, indexHandler);
// route-config: merchant/hKVljVjI8d8CVPhknYX_plus_CQ==
router.all('/merchant/merchant/hKVljVjI8d8CVPhknYX_plus_CQ==', auth, indexHandler);

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth (no session check in legacy; acts on orders of a logged-in merchant)
router.all(`/merchant/${C}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  let status = s(parseInt(req.p.activinactiv, 10));
  let ret = '';
  const so = await procOne(DB, 'usp_getorderinvoice', { orderno: isSelected });
  ret = s(outVal(so, 'strresult'));
  if (ret !== '') status = ret;
  try {
    const tokens = s(isSelected).split(',');
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] !== '') {
        const Obj1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid,coalesce(orderid,'') AS orderid,coalesce(product_name,'') AS product_name FROM tbl_product_order_master WHERE orderno = @orderno", { orderno: tokens[i] });
        await scalar(DB, "SELECT to_char(orderdate + interval '7 days','Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid=@orderid LIMIT 1", { orderid: Obj1.orderid });
        const Obj = await queryOne(DB, "SELECT coalesce(phone,'') AS phone,emailid,(fname) AS username,coalesce(did,0) did ,coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid = @loginid", { loginid: Obj1.loginid });
        const CompanyName = await scalar(DB, 'SELECT companyname FROM tbl_companysettings WHERE pmid=1 LIMIT 1');
        if (Obj != null && (Obj.emailid !== '' || Obj.emailid !== null)) {
          const Mailsubject = 'Order:' + Obj1.orderid + ' has been Packed';
          if (Obj.username === '' || Obj.username === null) Obj.username = "Dear Sir/ Ma'am";
          await SendConfirmationEmail(Obj.emailid, Obj.username, 'Your  - ' + Obj1.product_name + ' with Order Id ' + Obj1.orderid + ' has been Packed .We will notify you for further updates.', Mailsubject, 'Customer', Number(Obj.did));
        }
        if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
          const PhoneMessage = 'Dear Customer,\r\nYour ' + Obj1.product_name + '  with Order Id ' + Obj1.orderid + ' has been Packed. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + s(CompanyName) + ' Team';
          const process = 'Order Packed';
          // legacy: background thread
          (async () => {
            await UtilityClass.SendMsgOnMobile(Obj.phone, PhoneMessage, 'Customer', Number(Obj.did));
            await UtilityClass.TrackCustomersMessages(Obj.phone, PhoneMessage, process);
          })().catch(() => {});
        }
      }
    }
  } catch (Exp) {
    // legacy: ViewBag.Message = Exp.Message
  }
  res.json(status);
}));

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const ViewBag = {};
  const BranchId = req.user.plid;
  if (page == null || page === '') page = 1;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: parseInt(page, 10), maxrows: 999999, searchfield: s(SearchField).trim(), searchvalue: s(SearchValue).trim(), fromdate: s(fromDate).trim(),
    todate: s(toDate).trim(), status: s(status).trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: '0',
  });
  const list = mapRows(rows, NEWORDER_PROPS);
  try {
    if (list.length > 0) {
      const filepath = path.join(ensureDir(path.join(config.uploadDir, 'AllExcelSheets')), 'Active_orderlist.xls');
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
      out += 'Paid Via Cash Wallet \t';
      out += 'Paid Via Kreaz Voucher \t';
      out += 'Paid Via Online \t';
      out += 'Cashback Redeemed \t';
      out += 'Customer Name \t';
      out += 'City  \t';
      out += 'Login ID  \t';
      out += 'Payment Type  \t';
      out += 'Full Address  \t';
      for (const Items of list) {
        try {
          let line = '\n';
          line += tabClean(Items.rownumber.toString()) + ' \t';
          line += tabClean(Items.Product_Name.toString()) + ' \t';
          line += tabClean(Items.OrderDate.toString()) + ' \t';
          line += tabClean(Items.Orderno.toString()) + ' \t';
          line += tabClean(Items.orderID.toString()) + ' \t';
          line += tabClean(Items.status.toString()) + ' \t';
          line += tabClean(Items.order_QTY.toString()) + ' \t';
          line += tabClean(Items.total_DAP.toString()) + ' \t';
          line += tabClean(Items.Total_Ship_Ch.toString()) + ' \t';
          line += tabClean(Items.ProductTotalVat.toString()) + ' \t';
          line += tabClean(Items.total_purchase_cost.toString()) + ' \t';
          line += tabClean(Number(Items.PaidViaCashWallet).toFixed(2)) + ' \t';
          line += tabClean(Number(Items.PaidViaKreazVoucher).toFixed(2)) + ' \t';
          line += tabClean(Number(Items.PaidViaOnline).toFixed(2)) + ' \t';
          line += tabClean(Number(Items.PaidViaCahbackWallet).toFixed(2)) + ' \t';
          line += tabClean(Items.Name.toString()) + ' \t';
          line += tabClean(Items.City.toString()) + ' \t';
          line += tabClean(Items.LoginId.toString()) + ' \t';
          line += tabClean(Items.PayMode.toString()) + ' \t';
          line += tabClean((s(Items.Address) + ',' + s(Items.City) + ' Pin' + s(Items.PinCode)).toString()) + ' \t';
          out += line;
        } catch (e) { break; }
      }
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: legacy redirected to ~/AllExcelSheets/Active_orderlist.xls; the file content is sent directly as the download
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Active_orderlist.xls');
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
  const { type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder } = req.p;
  const r = await exportReport(req, res, type, SearchField, SearchValue, fromDate, toDate, status, page, s(orderid), s(Orderno), sortbydispatchorder);
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

// ---- ParticularProductDetails ----------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid;
  const BranchId = req.user.plid;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: await UtilityClass.GridPageSize(), searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    branchid: BranchId, orderid: '', company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: '0',
  });
  res.json(mapRows(rows, NEWORDER_PROPS));
}));

// ---- UpdateStatusProduct -------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/UpdateStatusProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const result = 0;
  res.json(result);
}));

// ---- DataSearchnew -----------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@SERCHITEM', Value: SearchText }], 'USP_SEARCHORDERNO', 'dsData');
  res.json(getXml(ds));
}));

// ---- GetStatusData -------------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/GetStatusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT osid,statusname FROM orderstatusmaster WHERE status=1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- cancelorder ---------------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/cancelorder{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Reasaon, cancelremark, cancelorderno, cancelpoid } = req.p;
  let Response = '0';
  const OrderID = await scalar(DB, 'SELECT orderid FROM tbl_product_order_master WHERE orderno=@orderno LIMIT 1', { orderno: cancelorderno });
  try {
    const o = await procOne(DB, 'usp_updateorderstatus_new', { orderid: OrderID, poid: cancelpoid, status: 'Cancel', remark: cancelremark, reason: Reasaon, iscancelbymember: '0' });
    Response = s(outVal(o, 'strresult'));
    // Refund On Return
    if (Response === 'ok^ok') {
      const r = await procOne(DB, 'usp_refundwallet', { transactionid: OrderID });
      if (s(outVal(r, 'stroutput')) === 'success') Response = '1'; else Response = '0';
    }
  } catch (e) {
    Response = '0';
  }
  res.json(Response);
}));

module.exports = router;
