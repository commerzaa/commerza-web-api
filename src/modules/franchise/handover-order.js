'use strict';
// Ported from Franchise/Controllers/CustomerPanel/handover_order.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
// PORT-NOTE: Excel generation / write-back (Microsoft.Office.Interop.Excel) uses the optional npm package "exceljs" (lazy-required, not installed).
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const config = require('../../config');
const { query, queryOne, exec, proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const SendMail = require('../../lib/franchise/SendMail');
const GetIP = require('../../lib/franchise/GetIP');
const ConvertUtility = require('../../lib/franchise/ConvertUtility');
const Utility = ConvertUtility.Utility || ConvertUtility;

const BASE = '/franchise/handover_order';
const upload = multer({ storage: multer.memoryStorage() }).any();
const str = (v) => (v === null || v === undefined ? '' : String(v));
const tab = (s) => String(s).replace(/\t/g, '    ');

const NEW_ORDER = ['ALLIMAGES', 'BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode', 'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'Producttitle', 'CreatedDate', 'Packed', 'Handover', 'Intransit', 'Picked', 'Delivered', 'CancelledType', 'Canceldate', 'Morderid', 'Invoiceno', 'Remarks', 'ReturnDate', 'ExchangeDate', 'RefundedRemark', 'RefundedDate', 'INVAmount', 'EURAmount', 'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemailid', 'FULLNAME', 'EMAILID'];
const COURIER = ['ROWNUMBER', 'ORDERID', 'Item_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_CITY', 'SHIPPING_STATE', 'SHIPPING_PINCODE', 'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'WEIGHT', 'STATUS', 'INVOICENO', 'PAYMODE', 'TYPE_OF_SERVICE', 'DOCKETNO', 'CurrentSTATUS', 'OrderNO'];

const pad2 = (n) => String(n).padStart(2, '0');
const stamp12 = (d = new Date()) => `${pad2(d.getDate())}${pad2(d.getMonth() + 1)}${d.getFullYear()}${pad2(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12)}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`; // ddMMyyyyhhmmss

// ---- USP_NEW_ORDER_LIST call used by Index / ExportReport / ParticularProductDetails
async function newOrderList(p) {
  return proc('shopping', 'usp_new_order_list', p);
}
const sqlTotal = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0); // PORT-NOTE: @TotalCount OUT from "totalcount" column

// ---- ExportReport (tab separated .xls). returns { content, filename } or { message }
async function ExportReport(type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder) {
  if (page == null || page === '') page = 1;
  const rows = await newOrderList({
    startrowindex: Number(page), maxrows: 9999999, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(), todate: toDate.trim(), status: status.trim(), statustype: type, branchid: 0,
    orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: 3,
  });
  const list = mapRows(rows, NEW_ORDER);
  try {
    if (list.length > 0) {
      const need = (v) => { if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.'); return String(v); };
      let s = '';
      s += 'S.No. \t'; s += 'Product Name \t'; s += 'Order Date \t'; s += 'Order No \t'; s += 'Order Id \t'; s += 'Status \t';
      s += 'Quantity \t'; s += 'Actual Value \t'; s += 'Shipping \t'; s += 'GST \t'; s += 'Total \t'; s += 'Customer Name \t';
      s += 'City  \t'; s += 'Login ID  \t'; s += 'Payment Type  \t'; s += 'Full Address  \t';
      for (const Item of list) {
        let line = '\n';
        try {
          line += tab(need(Item.rownumber)) + ' \t';
          line += tab(need(Item.Product_Name)) + ' \t';
          line += tab(need(Item.OrderDate)) + ' \t';
          line += tab(need(Item.Orderno)) + ' \t';
          line += tab(need(Item.orderID)) + ' \t';
          line += tab(need(Item.status)) + ' \t';
          line += tab(need(Item.order_QTY)) + ' \t';
          line += tab(need(Item.total_DAP)) + ' \t';
          line += tab(need(Item.Total_Ship_Ch)) + ' \t';
          line += tab(need(Item.ProductTotalVat)) + ' \t';
          line += tab(need(Item.total_purchase_cost)) + ' \t';
          line += tab(need(Item.Name)) + ' \t';
          line += tab(need(Item.City)) + ' \t';
          line += tab(need(Item.LoginId)) + ' \t';
          line += tab(need(Item.PayMode)) + ' \t';
          line += tab(String(str(Item.Address) + ',' + str(Item.City) + ' Pin' + str(Item.PinCode))) + ' \t';
        } catch (e) { /* legacy: wr.Close() and continue */ }
        s += line;
      }
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'Handover_orderlist.xls');
      fs.writeFileSync(filepath, s);
      return { content: s, filename: 'Handover_orderlist.xls', filepath };
    }
    return { message: 'There is no record in excel' };
  } catch (ExpObj) {
    return { filepath: ExpObj.message };
  }
}

// auth ([SessionExpireCheck])  route-config: franchisee/7ZQB7Y7P0XuTRNdZAO7LlQ==
const index = asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, btnexel, ProductName, sortbydispatchorder } = req.p;
  let page = req.p.page;
  let Orderno = '', orderid = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (sortbydispatchorder == null) sortbydispatchorder = '';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    const partnoveri = ProductName;
    if (partnoveri.length < 2) throw new RangeError('Index and length must refer to a location within the string.');
    const sub = partnoveri.substring(0, 2);
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (status == null) status = '';
  if (type == null) type = '';
  if (type === 'manifest') type = 'ReadyToShip';
  const ViewBag = { Status: status };
  const BranchId = 0;
  const DID = Math.trunc(Number(req.user.did));
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null || page === '') page = 1;
  const rows = await newOrderList({
    startrowindex: Number(page), maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(), todate: toDate.trim(), status: status.trim(), statustype: type, branchid: BranchId,
    orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: 3, statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
    ddlcancelationtype: '0', categoryrelatedto: '1', did: DID,
  });
  const TotalRecord = sqlTotal(rows);
  Object.assign(ViewBag, {
    Productname: ProductName, CurrentPage: page, GridPageSize: MaxRows, TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate, sortbydispatchorder, type,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder);
    if (r.content !== undefined) {
      // legacy: Response.ContentType force-download + Redirect to the generated file, Response.End()
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Handover_orderlist.xls');
      return res.send(r.content);
    }
    if (r.message) ViewBag.Message = r.message;
    if (r.filepath) ViewBag.filepath = r.filepath;
  }
  res.json({ Model: mapRows(rows, NEW_ORDER), ViewBag });
});
router.all([`${BASE}/Index{/:id}`, BASE], auth, index);
// route-config
router.all('/franchise/franchisee/7ZQB7Y7P0XuTRNdZAO7LlQ==', auth, index);

// auth - public void ExportReport(...)
router.all(`${BASE}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  let { type, SearchField, SearchValue, fromDate, toDate, status, btnexel, orderid, Orderno, sortbydispatchorder } = req.p;
  const r = await ExportReport(str(type), str(SearchField), str(SearchValue), str(fromDate), str(toDate), str(status), req.p.page, btnexel, str(orderid), str(Orderno), str(sortbydispatchorder));
  if (r.content !== undefined) {
    res.set('Content-Type', 'application/force-download');
    res.set('Content-Disposition', 'attachment; filename=Handover_orderlist.xls');
    return res.send(r.content);
  }
  res.json({ ViewBag: { Message: r.message, filepath: r.filepath } });
}));

// ---- confirmation e-mail (protected SendConfirmationEmail, not an action)
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

async function SendConfirmationEmail(ToEmail, Username, Text, Type, subject, DID = 0) {
  let send = 0;
  try {
    if (send === 0) {
      let mailtxt = MAIL_TEMPLATE;
      mailtxt = mailtxt.split('$$lblname$$').join(Username);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text);
      mailtxt = mailtxt.split('$$FacebookShare$$').join('');
      mailtxt = mailtxt.split('$$TwitterShare$$').join('');
      mailtxt = mailtxt.split('$$InstaShare$$').join('');
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type);
      const process = 'In Transit';
      if (Type === 'Customer') await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (Type === 'Merchant') await UtilityClass.TrackMerchantsEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// auth
router.all(`${BASE}/UpdateStatuslist{/:id}`, auth, asyncHandler(async (req, res) => {
  const allcourier = str(req.p.allcourierforupdate).split(',');
  const allorder = str(req.p.allorders).split(',');
  const alldocketno = str(req.p.alldocketforupdate).split(',');
  void allcourier;
  let ReturnMessage = 'ok';
  const BranchId = 0;
  for (let i = 0; i < allorder.length - 1; i++) {
    if (allorder[i] !== '') {
      const out = await procOne('shopping', 'usp_update_courier_list_mannual', {
        plid: BranchId, ordernop: allorder[i], status: 'Intransit', docketno: alldocketno[i],
      });
      // PORT-NOTE: @STRRESULT OUT read from "strresult" column
      ReturnMessage = str(out && out.strresult);

      const Obj1 = mapRow(await queryOne('shopping',
        "select coalesce(loginid,'') as loginid, coalesce(orderid,'') as orderid, coalesce(product_name,'') as product_name from tbl_product_order_master where orderno = @orderno limit 1",
        { orderno: allorder[i] }), ['LoginId', 'OrderId', 'Product_Name']);
      if (!Obj1) throw new TypeError('Object reference not set to an instance of an object.');
      await queryOne('shopping', "select to_char(orderdate + interval '7 days', 'Mon DD, YYYY') as date from tbl_order_master where orderid = @orderid limit 1", { orderid: Obj1.OrderId });
      const Obj = mapRow(await queryOne('shopping',
        "select coalesce(phone,'') as phone, emailid, fname as username, coalesce(did,0) as did, coalesce(dm.companyname,'') as companyname from tbl_customerlogin tcl left join distributor_master dm on tcl.did = dm.plid where loginid = @loginid limit 1",
        { loginid: Obj1.LoginId }), ['Phone', 'EmailID', 'UserName', 'DID', 'COMPANYNAME']);
      const PhoneMessage = 'Dear Customer,\r\nYour Product Order for ' + Obj1.Product_Name + '  with Order Id ' + Obj1.OrderId + ' has been successfully In Transit. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
      const Mailsubject = 'Your Product Order for ' + Obj1.OrderId + ' has been successfully In Transit';
      const processName = 'Order In Transit';
      if (Obj !== null) { // (Obj.EmailID != "" || Obj.EmailID != null) is always true
        if (Obj.UserName === '' || Obj.UserName === null) Obj.UserName = "Dear Sir/ Ma'am";
        const ob = Obj; const ob1 = Obj1;
        Promise.resolve().then(() => SendConfirmationEmail(ob.EmailID, ob.UserName, 'Your Product Order for ' + ob1.Product_Name + ' with Order Id ' + ob1.OrderId + ' has been successfully In Transit. We will notify you for further updates.', 'Customer', Mailsubject, 0)).catch(() => {});
      }
      if (!Obj) throw new TypeError('Object reference not set to an instance of an object.');
      if (Obj.Phone !== null && Obj.Phone !== undefined && Obj.Phone !== '') {
        await UtilityClass.SendMsgOnMobile(Obj.Phone, PhoneMessage, 'Customer', 0);
        await UtilityClass.TrackCustomersMessages(Obj.Phone, PhoneMessage, processName);
      }
    }
  }
  res.json(ReturnMessage);
}));

// auth
router.all(`${BASE}/ParticularProductDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid === undefined || req.p.poid === '' ? null : req.p.poid;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await newOrderList({
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    branchid: 0, orderid: '', company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder: '', orderstatus: 3,
  });
  res.json(mapRows(rows, NEW_ORDER));
}));

// auth
router.all(`${BASE}/UpdateStatusProduct{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const emptyNull = (v) => (v === undefined || v === '' ? null : v);
  const rows = await newOrderList({
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '',
    branchid: 0, orderid: p.orderid, company: '', poid: emptyNull(p.poid), orderno: '', mode: 4,
    statusid: emptyNull(p.statusid), loginid: p.loginid, sortbydispatchorder: '', orderstatus: 3,
    statusdate: p.statusdate, docketno: p.docketno, ddlcourier: p.ddlcourier,
  });
  // PORT-NOTE: ExecuteSqlCommand's affected-row count has no direct equivalent; the number of result rows is returned
  res.json(rows.length);
}));

const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// auth - DataSet.GetXml() of usp_SearchOrderNo
router.all(`${BASE}/DataSearchnew{/:id}`, auth, asyncHandler(async (req, res) => {
  const SearchText = str(req.p.SearchText).split('+apostopis').join("'");
  const rows = await proc('shopping', 'usp_searchorderno', { serchitem: SearchText });
  let xml = '<dsData>';
  for (const r of rows) {
    xml += '<Table>';
    for (const k of Object.keys(r)) { if (r[k] !== null && r[k] !== undefined) xml += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`; }
    xml += '</Table>';
  }
  xml += '</dsData>';
  res.json(xml);
}));

// auth
router.all(`${BASE}/GetStatusData{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query('shopping', 'select osid, statusname from orderstatusmaster where status = 1');
  res.json(mapRows(rows, ['OSID', 'Statusname']));
}));

// ---- Excel download of courier data
async function logError(step, remark) {
  await exec('shopping', 'insert into tbl_error (step, remark) values (@step, @remark)', { step, remark });
}

async function Downloadexceldata() {
  let file_name = '', Path = '';
  try {
    const BranchId = 0;
    const objCourierList = mapRows(await proc('shopping', 'usp_getcourierdatalist_merchand', { mode: 1, status: 3, branchid: BranchId }), COURIER);
    let City = '', State = '';
    await logError(0, '1');
    const ExcelJS = require('exceljs'); // PORT-NOTE: dependency to be installed (npm i exceljs)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const heads = ['S.No', 'Order_id', 'Item_Name', 'No_of_Piece', 'Customer_Name', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'City', 'State', 'Pincode', 'Mobile_No', 'Invoice_value', 'Collectable_Amount', 'Courier Tracking No', 'WEIGHT', 'STATUS', 'TYPE_OF_SERVICE', 'DTDCSTATUS', 'Status Date', 'Error Reson', 'Orderno'];
    heads.forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
    let row = 2;
    const T = (v) => str(v).trim();
    for (const Item of objCourierList) {
      worksheet.getCell(row, 1).value = T(Item.ROWNUMBER);
      worksheet.getCell(row, 2).value = T(Item.ORDERID);
      worksheet.getCell(row, 3).value = T(Item.Item_NAME);
      worksheet.getCell(row, 4).value = T(Item.NO_OF_PIECE);
      worksheet.getCell(row, 5).value = T(Item.CUSTOMER_NAME);
      worksheet.getCell(row, 6).value = T(Item.SHIPPING_ADD1);
      worksheet.getCell(row, 7).value = T(Item.SHIPPING_ADD2);
      const pincode = Item.SHIPPING_PINCODE;
      const objList = await query('shopping', 'select city, state from tbl_courierpincodes where pincode = @pincode', { pincode: str(pincode) });
      const objcourierStatuslist = await query('shopping', 'select csid, statusname from tbl_courierexcelstatuslist where status = 1');
      for (const a of objList) { City = a.city; State = a.state; }
      worksheet.getCell(row, 8).value = str(City).trim();
      worksheet.getCell(row, 9).value = str(State).trim();
      worksheet.getCell(row, 10).value = T(Item.SHIPPING_PINCODE);
      worksheet.getCell(row, 11).value = T(Item.SHIPPING_MOBILENO);
      worksheet.getCell(row, 12).value = T(Item.INVOICE_VALUE);
      worksheet.getCell(row, 13).value = Item.PAYMODE === 'COD' ? T(Item.COLLECTABLE_AMOUNT) : '0';
      worksheet.getCell(row, 14).value = T(Item.DOCKETNO);
      worksheet.getCell(row, 15).value = T(Item.WEIGHT);
      worksheet.getCell(row, 17).value = T(Item.TYPE_OF_SERVICE);
      worksheet.getCell(row, 21).value = T(Item.OrderNO);
      const FlatList2 = objcourierStatuslist.map((x) => x.statusname).join(',');
      worksheet.getCell(row, 16).dataValidation = { type: 'list', allowBlank: true, showErrorMessage: false, formulae: ['"' + FlatList2 + '"'] };
      row++;
    }
    for (let c = 1; c <= 26; c++) {
      const cell = worksheet.getCell(1, c);
      cell.font = { bold: true, name: 'Arial Narrow', size: 15 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }
    const d = new Date();
    file_name = 'Courier_data_' + stamp12(d);
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    Path = path.join(dir, file_name + '.xlsx');
    await logError(0, Path);
    await workbook.xlsx.writeFile(Path);
  } catch (ex) {
    try { await logError(2, ex.message); } catch (e) { /* ignore */ }
    return { Item1: Path, Item2: file_name };
  }
  return { Item1: Path, Item2: file_name };
}

// auth
router.all(`${BASE}/DownloadData{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const DownloadFile = await Downloadexceldata();
    const fileBytes = fs.readFileSync(DownloadFile.Item1);
    const fileName = DownloadFile.Item2 + '.xlsx';
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.send(fileBytes);
  } catch (ex) {
    try { await logError(2, ex.message); } catch (e) { /* ignore */ }
    res.json('');
  }
}));

// auth - public Tuple<string,string> Downloadexceldata() (exposed as action; serialises as Item1/Item2)
router.all(`${BASE}/Downloadexceldata{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await Downloadexceldata());
}));

// ---- Updatestatus (USP_UPDATE_COURIER_LIST), state kept in `st` like the controller's instance fields
async function Updatestatus(st, orderid, Docketno, weight, status, Typeofservice, orderno, Dtdcstatus, Statusdate, CollectableAmount, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state, pincode, mobile, invoicevalue) {
  try {
    const EMPID = 0;
    const out = await procOne('shopping', 'usp_update_courier_list', {
      orderid, docketno: Docketno, weight, status, typeofservice: Typeofservice, plid: EMPID,
      productname: Productname.toLowerCase(), no_of_piece: No_of_Piece, customer_name: Customer_name.toLowerCase(),
      shipping_add1: Shipping_add1, shipping_add2: Shipping_add2, city: City, state, pincode, mobile,
      invoicevalue, collectableamount: CollectableAmount, dtdcstatus: Dtdcstatus, statusdate: Statusdate, ordernoexcel: orderno,
    });
    const StrMessage = str(out && out.strresult); // PORT-NOTE: @STRRESULT OUT from "strresult" column
    const arr = StrMessage.split('^');
    if (arr[0] !== 'ok') {
      st.TOTALINVALIDRECORDS += 1;
      if (arr.length < 2) throw new RangeError('Index was outside the bounds of the array.');
      st.datauploadmessage = (arr[0] + arr[1]).toString();
    } else {
      if (arr.length < 2) throw new RangeError('Index was outside the bounds of the array.');
      st.datauploadmessage = arr[1].toString();
    }
    return StrMessage;
  } catch (Ex) {
    st.TOTALINVALIDRECORDS += 1;
    st.datauploadmessage = 'Some error occured while performing the operations.' + Ex.message;
    return 'Some error occured while performing the operations.' + Ex.message;
  }
}

// auth - public string Updatestatus(...)
router.all(`${BASE}/Updatestatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const st = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  const r = await Updatestatus(st, str(p.orderid), str(p.Docketno), str(p.weight), str(p.status), str(p.Typeofservice), str(p.orderno), str(p.Dtdcstatus), str(p.Statusdate), Number(p.CollectableAmount), str(p.Productname), parseInt(p.No_of_Piece, 10), str(p.Customer_name), str(p.Shipping_add1), str(p.Shipping_add2), str(p.City), str(p.state), str(p.pincode), str(p.mobile), Number(p.invoicevalue));
  res.json(r);
}));

const toInt = (v) => { const n = Number(String(v).trim()); if (String(v).trim() === '' || !Number.isInteger(n)) throw new Error('Input string was not in a correct format.'); return n; };
const toDec = (v) => { const n = Number(String(v).trim()); if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };

// auth ([HttpPost]) multipart: FileUpload + Typename
router.post(`${BASE}/Uploadexcel{/:id}`, auth, upload, asyncHandler(async (req, res) => {
  let ret = '';
  const st = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  let z = 0;
  let ExcelFileName = '';
  let workbook = null;
  let PathForFile = '';
  try {
    const files = req.files || [];
    const file = files[0];
    const FileUpload = files.find((f) => f.fieldname === 'FileUpload');
    if (file && file.size > 0) {
      const FileExtension = path.extname(FileUpload.originalname).toLowerCase();
      const Typename = str(req.body && req.body.Typename);
      void Typename;
      void GetIP;
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      let Filename = path.basename(FileUpload.originalname);
      Filename = stamp12() + Filename;
      const dir = path.join(config.uploadDir, 'AllUploadsExcelFile');
      PathForFile = path.join(dir, Filename);
      fs.mkdirSync(dir, { recursive: true });
      let DtExcel = null;
      if (validFileTypes.includes(FileExtension)) {
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, FileUpload.buffer);
        if (FileExtension === '.csv') {
          DtExcel = await Utility.ConvertCSVtoDataTable(PathForFile);
        } else {
          const ConnString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=NO;IMEX=1"';
          DtExcel = await Utility.ConvertXSLXtoDataTableMerchantorder(PathForFile, ConnString);
        }
        ExcelFileName = Filename;
      }
      if (!DtExcel) throw new TypeError('Object reference not set to an instance of an object.'); // legacy NRE on invalid type
      // PORT-NOTE: DtExcel is expected as an array of row objects keyed F1..Fn (first row = header), as the lib returns for HDR=NO
      if (DtExcel.length > 0) {
        z = DtExcel.length - 1;
        const cell = (r, k) => { const v = r[k]; return v === null || v === undefined ? '' : String(v); };
        for (let i = 1; i < DtExcel.length; i++) {
          let alllength = 0;
          const hdr = DtExcel[0];
          for (const k of Object.keys(hdr)) { if (cell(hdr, k) !== '') alllength++; }
          const r = DtExcel[i];
          const orderid = cell(r, 'F2');
          const Productname = cell(r, 'F3');
          const No_of_Piece = toInt(r.F4 === null || r.F4 === undefined ? 0 : r.F4);
          const Customer_name = cell(r, 'F5');
          const Shipping_add1 = cell(r, 'F6');
          const Shipping_add2 = cell(r, 'F7');
          const City = cell(r, 'F8');
          const state = cell(r, 'F9');
          const pincode = cell(r, 'F10');
          const mobile = cell(r, 'F11');
          const invoicevalue = toDec(r.F12 === null || r.F12 === undefined ? 0 : r.F12);
          let CollectableAmount = toDec(r.F13 === null || r.F13 === undefined ? 0 : r.F13);
          const Docketno = cell(r, 'F14');
          const weight = cell(r, 'F15');
          const status = cell(r, 'F16');
          const Typeofservice = cell(r, 'F17');
          const orderno = cell(r, 'F21');
          CollectableAmount = toDec(r.F13 === null || r.F13 === undefined ? 0 : r.F13);
          const Dtdcstatus = cell(r, 'F18');
          const Statusdate = cell(r, 'F19');
          await Updatestatus(st, orderid, Docketno, weight, status, Typeofservice, orderno, Dtdcstatus, Statusdate, CollectableAmount, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state, pincode, mobile, invoicevalue);
          const Response = st.datauploadmessage;
          // write the result back into the uploaded workbook (Excel interop in legacy)
          if (FileExtension === '.csv') throw new Error('Sheet1 not found'); // legacy: csv workbook has no "Sheet1" => exception
          if (!workbook) {
            const ExcelJS = require('exceljs'); // PORT-NOTE: dependency to be installed (npm i exceljs)
            workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(PathForFile);
          }
          const sheet = workbook.getWorksheet('Sheet1');
          if (!sheet) throw new Error('Sheet1 not found');
          const c = sheet.getCell(i + 1, alllength);
          c.value = Response;
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9A9A9' } };
          c.font = { color: { argb: Response !== 'Update Status' ? 'FFFF0000' : 'FF008000' } };
          await workbook.xlsx.writeFile(PathForFile);
        }
      }
      const Totalrecord = z - st.TOTALINVALIDRECORDS;
      const act = await queryOne('shopping', 'select fun_getcurrentdate() as d');
      await exec('shopping',
        'insert into tbl_uploaded_courier_excellog (plid, activitybyuserid, activitydate, excelfile, requestid, totaluploadedrecords, totalerrorrecords, status) values (@plid, @uid, @dt, @file, @req, @tot, @err, @status)',
        { plid: 0, uid: 0, dt: act ? act.d : new Date(), file: ExcelFileName, req: '', tot: Totalrecord, err: st.TOTALINVALIDRECORDS, status: 1 });
      ret = '1';
    }
  } catch (Ex) {
    // TempData["Message"] = "Some error occured while performing the operation(s)." + Ex.Message
    return res.json(ret);
  }
  res.json(ret);
}));

module.exports = router;
