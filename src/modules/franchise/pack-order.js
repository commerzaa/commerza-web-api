'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/pack_order.cs (pack_orderController)
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
const GETDETAILS_PROPS = ['SNO', 'DID', 'DATE', 'ORDERAMOUNT', 'ORDERNO', 'DELIVERYCHARGE', 'RECEIVEDAMOUNT', 'PAYMENTTYPE', 'DELIVERYDATE',
  'PAIDAMOUNTMARCHENT', 'PAIDMARCHENTTYPE', 'MARCHENTDATE'];

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
      const process = 'Order Handover';
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type);
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // legacy: ViewBag.Message = exp.Message (no effect on response from the background thread)
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
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(),
    todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1,
    statusid: '0', loginid: '', sortbydispatchorder, orderstatus: 2, statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
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
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/x94grbKbzigOLdoMlJxHOw==', auth, indexHandler);

// ---- ExportReport (public void) ---------------------------------------------------------------------
async function exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, orderid, Orderno, sortbydispatchorder) {
  const ViewBag = {};
  const BranchId = 0;
  const MaxRows = await UtilityClass.GridPageSize();
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
router.all(`/franchise/${C}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder } = req.p;
  // legacy: .Trim() on null parameters throws NullReferenceException
  const r = await exportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, s(orderid), s(Orderno), sortbydispatchorder);
  if (!r.sent) res.json({ ViewBag: r.ViewBag }); // void action => empty response in MVC; ViewBag returned for parity
}));

// ---- ParticularProductDetails ----------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid == null || req.p.poid === '' ? null : req.p.poid;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: 0, orderid: '',
    company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: 2, statusdate: '',
  });
  res.json(mapRows(rows, NEWORDER_PROPS));
}));

// ---- DataSearchnew -----------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = s(req.p.SearchText).split('+apostopis').join("'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@SERCHItem', Value: SearchText }], 'USP_SEARCHORDERNO', 'DSDATA');
  res.json(getXml(ds));
}));

// ---- InsertData --------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/InsertData{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const DID = parseInt(req.user.did, 10);
  const row = await procOne(DB, 'usp_insertdata', {
    did: DID, date: p.Date, orderamount: Number(p.OrderAmount), orderid: p.OrderId, deliverycharge: Number(p.Deliverycharge),
    receivedamount: Number(p.ReceivedAmount), paymenttype: p.PaymentType, deliverydate: p.DeliveryDate, paidamountmarchent: Number(p.PaidAmountMarchent),
    paidmarchenttype: p.PaidMarchentType, marchentdate: p.MarchentDate, orderno: p.ORDERNO,
  });
  const ResValue = s(outVal(row, 'intresult'));
  res.json(ResValue);
}));

// ---- GetDetails ----------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/GetDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const DID = parseInt(req.user.did, 10);
  const rows = await query(DB, 'SELECT ROW_NUMBER() OVER(ORDER BY date DESC) AS sno,did,date,orderamount,orderno,deliverycharge,receivedamount,paymenttype,deliverydate,paidamountmarchent,paidmarchenttype,marchentdate FROM tbl_insert_data WHERE did=@did', { did: String(DID) });
  res.json(mapRows(rows, GETDETAILS_PROPS));
}));

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  const tokens = s(isSelected).split(',');
  let ReturnMessage = 'ok';
  const BranchId = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== '') {
      const so = await procOne(DB, 'usp_update_courier_list_mannual', { plid: BranchId, ordernop: tokens[i], status: 'Handover', docketno: '' });
      ReturnMessage = s(outVal(so, 'strresult'));

      const Obj1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid,coalesce(orderid,'') AS orderid,coalesce(product_name,'') AS product_name FROM tbl_product_order_master WHERE orderno = @orderno", { orderno: tokens[i] });
      await scalar(DB, "SELECT to_char(orderdate + interval '7 days','Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid=@orderid LIMIT 1", { orderid: Obj1.orderid }); // legacy: Obj1 null => NullReferenceException
      const Obj = await queryOne(DB, "SELECT coalesce(phone,'') AS phone,emailid,(fname) AS username,coalesce(did,0) did ,coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid= @loginid", { loginid: Obj1.loginid });
      const PhoneMessage = 'Dear Customer,\r\nYour Product Order for ' + Obj1.product_name + '  with Order Id ' + Obj1.orderid + ' has been successfully Handover. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
      const Mailsubject = 'Your Product Order for ' + Obj1.orderid + ' has been Handover';
      const process = 'Order Handover';
      if (Obj != null && (Obj.emailid !== '' || Obj.emailid !== null)) {
        if (Obj.username === '' || Obj.username === null) Obj.username = "Dear Sir/ Ma'am";
        const em = Obj.emailid, un = Obj.username;
        // legacy: background Thread
        SendConfirmationEmail(em, un, 'Your Product Order for ' + Obj1.product_name + ' with Order Id ' + Obj1.orderid + ' has been successfully Handover. We will notify you for further updates.', Mailsubject, 'Customer', 0).catch(() => {});
      }
      if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') { // legacy: Obj null => NullReferenceException
        await UtilityClass.SendMsgOnMobile(Obj.phone, PhoneMessage, 'Customer', 0);
        await UtilityClass.TrackCustomersMessages(Obj.phone, PhoneMessage, process);
      }
    }
  }
  res.json(ReturnMessage);
}));

// ---- GetStatusData -------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/GetStatusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT osid,statusname FROM orderstatusmaster WHERE status=1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- DownloadData / Downloadexceldata --------------------------------------------------------------
async function Downloadexceldata() {
  let file_name = '', Path = '';
  try {
    const BranchId = 0;
    const COURIER_PROPS = ['ROWNUMBER', 'ORDERID', 'Item_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_PINCODE',
      'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'DOCKETNO', 'WEIGHT', 'PAYMODE', 'TYPE_OF_SERVICE', 'CurrentSTATUS', 'OrderNO'];
    const objCourierList = mapRows(await proc(DB, 'usp_getcourierdatalist_merchand', { mode: 1, status: 2, branchid: BranchId }), COURIER_PROPS);
    let City = '', State = '';
    // PORT-NOTE: Microsoft.Office.Interop.Excel replaced by the "exceljs" package (not installed yet)
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const heads = { 1: 'S.No', 2: 'Order_id', 3: 'Item_Name', 4: 'No_of_Piece', 5: 'Customer_Name', 6: 'SHIPPING_ADD1', 7: 'SHIPPING_ADD2', 8: 'City', 9: 'State',
      10: 'Pincode', 11: 'Mobile_No', 12: 'Invoice_value', 13: 'Collectable_Amount', 14: 'Courier Tracking No', 15: 'WEIGHT', 16: 'STATUS', 17: 'TYPE_OF_SERVICE',
      18: 'DTDC_STATUS', 19: 'Status Date', 20: 'Current Status', 21: 'Order No', 23: 'Error Reson' };
    for (const c of Object.keys(heads)) worksheet.getCell(1, Number(c)).value = heads[c];
    let row = 2;
    for (const Item of objCourierList) {
      const set = (c, v) => { worksheet.getCell(row, c).value = v; };
      set(1, s(Item.ROWNUMBER).trim());
      set(2, s(Item.ORDERID).trim());
      set(3, s(Item.Item_NAME).trim());
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
router.all(`/franchise/${C}/DownloadData{/:id}`, auth, asyncHandler(async (req, res) => {
  let fileName = '';
  try {
    const DownloadFile = await Downloadexceldata();
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
router.all(`/franchise/${C}/Downloadexceldata{/:id}`, auth, asyncHandler(async (req, res) => {
  // legacy: public Tuple-returning method (MVC would render Tuple.ToString()); returned as JSON
  const t = await Downloadexceldata();
  res.json(t);
}));

module.exports = router;
