'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Active_Order.cs (Active_OrderController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const SendMail = require('../../lib/franchise/SendMail');

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
const MAIL_TEMPLATE = `
    <div style='text-align: center; background-color: #eae9e9;width: 650px;margin: 0 auto;    padding-bottom: 90px; font-family: sans-serif;'>
        <table style='border-collapse: collapse; text-align: center;margin: 0 auto;background-color: #fff; width: 100%;'>
            <tr style='border-collapse: collapse; font-family: sans-serif;'>
                <td style='padding: -1px;'>
                    <div>
                        <a href='#'><img style='width:645px' src='https://clusteroffer.com/images/Emailtop.png'></a>
                    </div>
                </td>
            </tr>
            <tr style='border-collapse: collapse;'>
                <td style='padding: 0px 15px; text-align: left; font-family: sans-serif;'>
                    <div>
                        <h3 style='margin-bottom: 5px; color: #1c3a6c;margin-top: 30px;'>Dear $$lblname$$</h3>
                        <h2 style='margin-bottom: 30px;margin-top: 0;'>
                        </h2>
                    </div>
                    <div>
                        <p style='margin: 6px 0;color: #154054;'>$$lblmessage$$</p>
                        <p style='margin: 6px 0;color: #154054;'>You can track the status of your order any time in your Dealsinvicta user profile</p>
                        <p style='margin: 6px 0;color: #154054;'>In case any support please contact us</p>


                    </div>
                    <br>


                    <div>
                        <p style='margin: 0;color: #8a8383;'><a href='https://clusteroffer.com/contact-us' style='text-decoration: none; color: #000'>Need Help?  <img src='https://clusteroffer.com/images/tech-support1.png' style='width: 18px; vertical-align: middle;    float: right;'></a></p>
                    </div>

                    <br>

                </td>
            </tr>
        </table>

        <table style='border-collapse: collapse; text-align: center;margin: 0 auto;background-color: #fff;width: 100%;'>
            <tr style='border-collapse: collapse; font-family: sans-serif;background-color: #fbf7f7;'>
                <td style='padding: 10px 15px;' colspan='2'>
                    <div>
                        <ul style='list-style: none; padding: 0; margin: 0;'>
                            <li style='display: inline-block;padding: 5px 10px;font-family: sans-serif;'> <img src='http://icons.iconarchive.com/icons/iconsmind/outline/512/Mail-icon.png' style='width: 17px; vertical-align: middle;'> <a href='mailto:support@clusteroffer.com'>support@clusteroffer.com</a></li>
                        </ul>
                        <br>

                        <ul style='list-style: none; padding: 0; margin: 0;'>
                            <li style='display: inline-block;'><a href='$$FacebookShare$$'><img src='https://clusteroffer.com/images/fb.png' style='width: 30px; height: 31px'> </a></li>
                            <li style='display: inline-block;'><a href='$$TwitterShare$$'><img src='https://clusteroffer.com/images/tw.png' style='width: 30px; height: 31px'></a></li>
                            <li style='display: inline-block;'><a href='$$InstaShare$$'><img src='https://clusteroffer.com/images/ins.png' style='width: 30px; height: 31px'>  </a></li>
                        </ul>

                    </div>
                </td>
            </tr>
        </table>
    </div>`;

/** protected void SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) */
async function SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) {
  let send = 0;
  try {
    if (Username === '') Username = ToEmail;
    if (DID > 0 && Type !== '') {
      // result only fed company fields that the mail template no longer uses (kept for parity)
      await query(DB, `SELECT coalesce(companyredirect,'') AS companydomain,companyinfoemailid,companysupportemailid,companyname,coalesce(companyimage,'') AS companydomainlogo,coalesce(companyfacebooklink,'') facebookshare,coalesce(companygoogleplusLink,'') AS googleplusshare,coalesce(companyfacebooklink,'') AS twittershare,coalesce(companylinkedinlink,'') AS linkedinshare,coalesce(companypinterestlink,'') AS pinterestshare FROM tbl_companysettings tcs LEFT JOIN distributor_master dm ON tcs.pmid=dm.pmid WHERE tcs.pmid IN (SELECT pmid FROM tbl_distributor WHERE did=@did)`, { did: DID });
    }
    if (send === 0) {
      let mailtxt = MAIL_TEMPLATE;
      mailtxt = mailtxt.split('$$lblname$$').join(Username);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text);
      mailtxt = mailtxt.split('$$FacebookShare$$').join('');
      mailtxt = mailtxt.split('$$TwitterShare$$').join('');
      mailtxt = mailtxt.split('$$InstaShare$$').join('');
      const process = 'Order Packed';
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type);
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // legacy: ViewBag.Message = exp.Message (no effect on response from the background thread)
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
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_new_order_list_f', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: '0', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
    ddlcancelationtype: '0', categoryrelatedto: '1', did: DID,
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
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/hKVljVjI8d8CVPhknYX_plus_CQ==', auth, indexHandler);

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  let status = s(parseInt(req.p.activinactiv, 10));
  let ret = '';
  const so = await procOne(DB, 'usp_getorderinvoice', { orderno: isSelected });
  ret = s(outVal(so, 'strresult'));

  let ReturnMessage = 'ok';
  const BranchId = 0;
  try {
    const tokens = s(isSelected).split(',');
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] !== '') {
        const o = await procOne(DB, 'usp_update_courier_list_mannual', { plid: BranchId, ordernop: tokens[i], status: 'PACKED', docketno: '' });
        ReturnMessage = s(outVal(o, 'strresult'));
        if (ReturnMessage === 'success') status = '1'; else status = ReturnMessage;

        const Obj1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid,coalesce(orderid,'') AS orderid,coalesce(product_name,'') AS product_name FROM tbl_product_order_master WHERE orderno = @orderno", { orderno: tokens[i] });
        await scalar(DB, "SELECT to_char(orderdate + interval '7 days','Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid=@orderid LIMIT 1", { orderid: Obj1.orderid });
        const Obj = await queryOne(DB, "SELECT coalesce(phone,'') AS phone,emailid,(fname) AS username,coalesce(did,0) did ,coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid = @loginid", { loginid: Obj1.loginid });
        if (Obj != null && (Obj.emailid !== '' || Obj.emailid !== null)) {
          const Mailsubject = 'Your Product Order for ' + Obj1.orderid + ' has been Packed';
          if (Obj.username === '' || Obj.username === null) Obj.username = "Dear Sir/ Ma'am";
          const em = Obj.emailid, un = Obj.username;
          // legacy quirk preserved: arguments (Type, subject) are passed swapped => subject="Customer", Type=Mailsubject
          SendConfirmationEmail(em, un, 'Your Product Order for ' + Obj1.product_name + ' with Order Id ' + Obj1.orderid + ' has been successfully Packed .We will notify you for further updates.', 'Customer', Mailsubject, 0).catch(() => {});
        }
        if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
          const PhoneMessage = 'Dear Customer,\r\n Your Product Order for ' + Obj1.product_name + '  with Order Id ' + Obj1.orderid + ' has been successfully Packed .We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
          const process = 'Order Packed';
          await UtilityClass.SendMsgOnMobile(Obj.phone, PhoneMessage, 'Customer', 0);
          await UtilityClass.TrackCustomersMessages(Obj.phone, PhoneMessage, process);
        }
      }
    }
  } catch (Exp) {
    // legacy: ViewBag.Message = Exp.Message
  }
  res.json(status);
}));

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const ViewBag = {};
  const BranchId = 0;
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
router.all(`/franchise/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const { type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder } = req.p;
  const r = await exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, s(orderid), s(Orderno), sortbydispatchorder);
  if (!r.sent) res.json({ ViewBag: r.ViewBag });
}));

// ---- ParticularProductDetails ----------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: await UtilityClass.GridPageSize(), searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    branchid: 0, orderid: '', company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: '0',
  });
  res.json(mapRows(rows, NEWORDER_PROPS));
}));

// ---- UpdateStatusProduct -------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/UpdateStatusProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const result = 0;
  res.json(result);
}));

// ---- DataSearchnew -----------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], 'usp_SearchOrderNo', 'dsData');
  res.json(getXml(ds));
}));

// ---- GetStatusData -------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/GetStatusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT osid,statusname FROM orderstatusmaster WHERE status=1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- cancelorder ---------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/cancelorder{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Reasaon, cancelremark, cancelorderno } = req.p;
  let ret = '';
  try {
    const o = await procOne(DB, 'usp_updateorderstatus_new', { orderid: cancelorderno, poid: '0', status: 'Cancel', remark: cancelremark, reason: Reasaon, iscancelbymember: '0' });
    ret = s(outVal(o, 'strresult'));
  } catch (ex) {
    ret = 'error^' + ex.message;
  }
  res.json(ret);
}));

module.exports = router;
