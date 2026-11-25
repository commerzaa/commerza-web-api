'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Active_Deals.cs (Active_DealsController). DB: Db_Shopping => 'shopping' */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const SendMail = require('../../lib/franchise/SendMail');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const f = Object.keys(row)[0];
  return f === undefined ? null : row[f];
}
const NEWORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'INVAmount', 'EURAmount',
  'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemalid', 'merchantmobile', 'FULLNAME', 'EMAILID'];
// PORT-NOTE: NewOrderList class is not declared in this file; mapRows with the OrderList property set (keys missing => null).

function totalOf(rows) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === 'totalcount');
  return k === undefined ? 0 : (parseInt(f[k], 10) || 0);
}

async function ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder) {
  const BranchId = 0;
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: page, maxrows: 999999, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: '0', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '', ddlcancelationtype: '0', categoryrelatedto: '2',
  });
  const list = mapRows(rows, NEWORDERLIST_PROPS);
  try {
    if (list.length > 0) {
      const t = (v) => s(v.toString ? v : '').replace(/\t/g, '    ') + ' \t';
      let out = 'S.No. \tProduct Name \tOrder Date \tOrder No \tOrder Id \tStatus \tQuantity \tActual Value \tShipping \tGST \tTotal \tCustomer Name \tCity  \tLogin ID  \tPayment Type  \tFull Address  \t';
      for (const Item of list) {
        try {
          const need = (v) => { if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.'); return v; };
          let line = '\n';
          line += t(need(Item.rownumber)) + t(need(Item.Product_Name)) + t(need(Item.OrderDate)) + t(need(Item.Orderno)) + t(need(Item.orderID)) + t(need(Item.status)) +
            t(need(Item.order_QTY)) + t(need(Item.total_DAP)) + t(need(Item.Total_Ship_Ch)) + t(need(Item.ProductTotalVat)) + t(need(Item.total_purchase_cost)) +
            t(need(Item.Name)) + t(need(Item.City)) + t(need(Item.LoginId)) + t(need(Item.PayMode)) + t(s(Item.Address) + ',' + s(Item.City) + ' Pin' + s(Item.PinCode));
          out += line;
        } catch (e) { break; /* wr.Close() - stream closed, remaining rows lost */ }
      }
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Active_orderlist.xls');
      res.send(out);
      return true;
    }
  } catch (e) { /* ViewBag.filepath = ExpObj.Message */ }
  return false;
}

// route-config: franchisee/hKVljVjI8d8CVPhknYX_plus_CQ==deals
// auth
router.all(['/franchise/Active_Deals/Index{/:id}', '/franchise/franchisee/hKVljVjI8d8CVPhknYX_plus_CQ==deals'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Orderno = '', orderid = '';
  let type = p.type, SearchField = p.SearchField, SearchValue = p.SearchValue, fromDate = p.fromDate, toDate = p.toDate, status = p.status;
  let ProductName = p.ProductName, sortbydispatchorder = p.sortbydispatchorder;
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  const btnexel = p.btnexel;
  SearchField = SearchField == null ? '' : s(SearchField);
  SearchValue = SearchValue == null ? '' : s(SearchValue);
  if (sortbydispatchorder == null) sortbydispatchorder = 'desc';
  if (ProductName == null) ProductName = '';
  if (ProductName !== '') {
    const sub = ProductName.substring(0, 2); // throws for length<2 (ArgumentOutOfRange) like C#
    if (ProductName.length < 2) throw new Error('Index and length must refer to a location within the string.');
    if (sub === 'OD') orderid = ProductName; else Orderno = ProductName;
  }
  fromDate = fromDate == null ? '' : s(fromDate);
  toDate = toDate == null ? '' : s(toDate);
  status = status == null ? '' : s(status);
  type = type == null ? '' : s(type);
  if (type === 'manifest') type = 'ReadyToShip';
  const ViewBag = { Status: status };
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await proc(DB, 'usp_new_order_list_f', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    status: status.trim(), statustype: type, branchid: BranchId, orderid, company: '', poid: '0', orderno: Orderno, mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder, orderstatus: '0', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '', ddlcancelationtype: '0',
    categoryrelatedto: '2', did: DID,
  });
  const objAllOrderList = mapRows(rows, NEWORDERLIST_PROPS);
  ViewBag.Productname = ProductName;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = totalOf(rows);
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.sortbydispatchorder = sortbydispatchorder;
  ViewBag.type = type;
  if (btnexel === 'Export Excel') {
    const done = await ExportReport(res, type, SearchField, SearchValue, fromDate, toDate, status, page, btnexel, orderid, Orderno, sortbydispatchorder);
    if (done) return undefined;
    ViewBag.Message = 'There is no record in excel';
  }
  return res.json({ Model: objAllOrderList, ViewBag });
}));

// auth
router.all('/franchise/Active_Deals/ParticularProductDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const poid = req.p.poid;
  const BranchId = 0;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_new_order_list', {
    startrowindex: 1, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '', status: '', statustype: '', branchid: BranchId,
    orderid: '', company: '', poid, orderno: '', mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', orderstatus: '0', statusdate: '',
    docketno: '', ddlcourier: '', merchantname: '', productname: '', ddlcancelationtype: '0', categoryrelatedto: '2',
  });
  res.json(mapRows(rows, NEWORDERLIST_PROPS));
}));

async function SendConfirmationEmail(ToEmail, Username, Text, subject, Type, DID = 0) {
  let send = 0;
  try {
    if (Username === '') Username = ToEmail;
    // DID > 0 branch only loads Resellerwisecompanydetails whose values are unused afterwards (all replacements commented out)
    if (DID > 0 && Type !== '') {
      await query(DB, 'SELECT coalesce(companyredirect,\'\') AS companydomain, companyinfoemailid, companysupportemailid, companyname, coalesce(companyimage,\'\') AS companydomainlogo FROM tbl_companysettings tcs LEFT JOIN distributor_master dm ON tcs.pmid=dm.pmid WHERE tcs.pmid IN (SELECT pmid FROM tbl_distributor WHERE did=@did)', { did: DID });
    }
    let mailtxt = '';
    if (send === 0) {
      mailtxt = `
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
      mailtxt = mailtxt.split('$$lblname$$').join(Username);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text);
      mailtxt = mailtxt.split('$$FacebookShare$$').join('');
      mailtxt = mailtxt.split('$$TwitterShare$$').join('');
      mailtxt = mailtxt.split('$$InstaShare$$').join('');
      const process = 'Order Redeemed';
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type);
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) { /* ViewBag.Message = exp.Message */ }
}

// auth
router.all('/franchise/Active_Deals/UpdateStatuslist{/:id}', auth, asyncHandler(async (req, res) => {
  const isSelected = s(req.p.isSelected);
  const activinactiv = parseInt(req.p.activinactiv, 10);
  let status = String(activinactiv);
  let ret = '';
  const r0 = await procOne(DB, 'usp_getorderinvoice', { orderno: isSelected });
  ret = s(outVal(r0, 'strresult'));
  let ReturnMessage = 'ok';
  const BranchId = 0;
  try {
    const tokens = isSelected.split(',');
    for (let i = 0; i < tokens.length - 1; i++) {
      if (tokens[i] !== '') {
        const r = await procOne(DB, 'usp_update_courier_list_mannual', { plid: BranchId, ordernop: tokens[i], status: 'Delivered', docketno: '' });
        ReturnMessage = s(outVal(r, 'strresult'));
        if (ReturnMessage === 'success') status = '1'; else status = ReturnMessage;

        const o1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid, coalesce(orderid,'') AS orderid, coalesce(product_name,'') AS product_name FROM tbl_product_order_master WHERE orderno = @orderno LIMIT 1", { orderno: tokens[i] });
        const Obj1 = { LoginId: o1.loginid, OrderId: o1.orderid, Product_Name: o1.product_name };
        const deliverydate = await scalar(DB, "SELECT to_char(orderdate + interval '7 day', 'Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid = @orderid LIMIT 1", { orderid: Obj1.OrderId });
        const c = await queryOne(DB, "SELECT coalesce(phone,'') AS phone, emailid, fname AS username, coalesce(did,0) AS did, coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid = @loginid LIMIT 1", { loginid: Obj1.LoginId });
        const Obj = c ? { Phone: c.phone, EmailID: c.emailid, UserName: c.username, DID: c.did, COMPANYNAME: c.companyname } : null;
        if (Obj !== null && (Obj.EmailID !== '' || Obj.EmailID !== null)) {
          const Mailsubject = 'Your NDN Order for ' + Obj1.OrderId + ' has been Redeemed';
          if (Obj.UserName === '' || Obj.UserName === null) Obj.UserName = "Dear Sir/ Ma'am";
          // background thread in C#: fire and forget
          SendConfirmationEmail(Obj.EmailID, Obj.UserName, 'Your NDN Order for ' + Obj1.Product_Name + ' with Order Id ' + Obj1.OrderId + ' has been successfully Redeemed .We will notify you for further updates.', 'Customer', Mailsubject, 0).catch(() => {});
        }
        if (Obj.Phone !== null && Obj.Phone !== '') {
          const PhoneMessage = 'Dear Customer,\r\n Your NDN Order for ' + Obj1.Product_Name + '  with Order Id ' + Obj1.OrderId + ' has been successfully Redeemed .We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
          const process = 'Order Packed';
          await UtilityClass.SendMsgOnMobile(Obj.Phone, PhoneMessage, 'Customer', 0);
          await UtilityClass.TrackCustomersMessages(Obj.Phone, PhoneMessage, process);
        }
      }
    }
  } catch (Exp) { /* ViewBag.Message = Exp.Message */ }
  res.json(status);
}));

module.exports = router;
