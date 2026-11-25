'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/intransit_order.cs (intransit_orderController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 * Requires the `xlsx` package for the Excel upload / download (replacement for ACE.OLEDB reader + Excel interop).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const GetIP = require('../../lib/franchise/GetIP');
const SendMail = require('../../lib/franchise/SendMail');

const router = express.Router();
const DB = 'shopping';
const upload = multer({ storage: multer.memoryStorage() });
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

const ORDERLIST_PROPS = ['BrCode', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt',
  'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor',
  'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID',
  'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'SubPrCode',
  'Approved', 'dispatchdate', 'ProcurementSLA', 'Orderno', 'couriername', 'DocketNO', 'DateDiff', 'Morderid', 'Invoiceno', 'INVAmount', 'EURAmount',
  'INVPer', 'EURPer', 'COMPANYNAME', 'merchantname', 'merchantemalid', 'merchantmobile', 'FULLNAME', 'EMAILID'];
const COURIERDATA_PROPS = ['ROWNUMBER', 'ORDERID', 'Item_NAME', 'NO_OF_PIECE', 'CUSTOMER_NAME', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'SHIPPING_CITY',
  'SHIPPING_STATE', 'SHIPPING_PINCODE', 'SHIPPING_MOBILENO', 'INVOICE_VALUE', 'COLLECTABLE_AMOUNT', 'WEIGHT', 'STATUS', 'INVOICENO', 'PAYMODE',
  'TYPE_OF_SERVICE', 'DOCKETNO', 'CurrentSTATUS', 'OrderNO'];

// ---- helpers -------------------------------------------------------------------------------------------
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const s = (v) => (v === null || v === undefined ? '' : String(v)); // ToStringOrEmpty
const P = (o, k) => { if (o === null || o === undefined) throw NRE(); return o[k]; }; // member access on a possibly-null object
const tr = (v) => { if (v === null || v === undefined) throw NRE(); return String(v).trim(); }; // string.Trim()
const optInt = (v) => { const n = parseInt(v, 10); return v === undefined || v === null || v === '' || Number.isNaN(n) ? null : n; };
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const tabClean = (v) => String(v).replace(/\t/g, '    ');
/** a.ToString() on a possibly-null property */
const ts = (v) => { if (v === null || v === undefined) throw NRE(); return String(v); };
/** fire-and-forget (legacy background Thread) */
const bg = (fn) => { Promise.resolve().then(fn).catch(() => { /* background thread, errors ignored */ }); };
/** INSERT INTO TBL_ERROR (STEP,REMARK) */
const dbgErr = (step, remark) => exec(DB, 'INSERT INTO tbl_error (step, remark) VALUES (@step, @remark)', { step, remark });
async function dbNow() {
  try { const v = await scalar(DB, 'SELECT fun_getcurrentdate()'); return v || new Date(); } catch (e) { return new Date(); }
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
function parseCsv(buf) {
  const lines = buf.toString('utf8').split(/\r?\n/);
  const headers = (lines.shift() || '').split(',');
  const rows = [];
  for (const line of lines) {
    if (line === '') continue;
    const r = line.split(',');
    if (r.length > 1) {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] === undefined ? '' : r[i]).trim(); });
      rows.push(o);
    }
  }
  return { columns: headers, rows };
}
/** Utility.ConvertXSLXtoDataTableMerchantorder: SELECT * FROM [Sheet1$] where [F2] IS NOT NULL and [F3] IS NOT NULL (HDR=NO) */
function readSheet(file) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets.Sheet1;
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const table = { columns: Array.from({ length: width }, (_, i) => 'F' + (i + 1)), rows: [] };
  for (const r of aoa) {
    if (r[1] !== null && r[1] !== undefined && r[2] !== null && r[2] !== undefined) {
      const o = {};
      table.columns.forEach((c, i) => { o[c] = r[i] === undefined ? null : r[i]; });
      table.rows.push(o);
    }
  }
  return { table, workbook, XLSX };
}
const getCol = (table, row, name) => {
  if (!table.columns.includes(name)) throw new Error('Column \'' + name + '\' does not belong to table.');
  return row[name];
};

// ---- SendConfirmationEmail (protected) ---------------------------------------------------------------------
async function SendConfirmationEmail(ToEmail, Username, Text, Type, subject, DID = 0) {
  let send = 0;
  try {
    let mailtxt = '';
    if (send === 0) {
      // new MailMessage("info@clusteroffer.com", ToEmail) throws for a null / malformed address
      if (ToEmail === null || ToEmail === undefined || !/^[^@\s]+@[^@\s]+$/.test(String(ToEmail).trim())) throw new Error('invalid address');
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
      mailtxt = mailtxt.split('$$lblname$$').join(Username === null || Username === undefined ? '' : Username);
      mailtxt = mailtxt.split('$$lblmessage$$').join(Text === null || Text === undefined ? '' : Text);
      mailtxt = mailtxt.split('$$FacebookShare$$').join('');
      mailtxt = mailtxt.split('$$TwitterShare$$').join('');
      mailtxt = mailtxt.split('$$InstaShare$$').join('');

      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt, DID, Type);
      const process = 'Order Delivered';
      if (Type === 'Customer') await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (Type === 'Merchant') await UtilityClass.TrackMerchantsEmails(ToEmail, mailtxt, process);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message;
  }
}

// ---- Updatestatus (public string action) ---------------------------------------------------------------------
/** state = { datauploadmessage, TOTALINVALIDRECORDS } (legacy controller instance fields) */
async function Updatestatus(state, orderid, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state_, Docketno, weight, pincode, mobile,
  invoicevalue, CollectableAmount, Staus, Typeofservice, Dtdcstatus, Statusdate, ORDERNO) {
  try {
    await dbgErr(4, '');
    let StrMessage = '';
    const EMPID = 0;
    const r = await procOne(DB, 'usp_update_courier_list_complete', {
      orderid, docketno: Docketno, weight, status: Staus, typeofservice: ts(Typeofservice).toLowerCase(), plid: EMPID, productname: ts(Productname).toLowerCase(),
      no_of_piece: No_of_Piece, customer_name: ts(Customer_name).toLowerCase(), shipping_add1: Shipping_add1, shipping_add2: Shipping_add2, city: City,
      state: state_, pincode, mobile, invoicevalue, collectableamount: CollectableAmount, dtdcstatus: Dtdcstatus, statusdate: Statusdate, orderno: ORDERNO,
    });
    const ov = outVal(r, 'strresult');
    if (ov === null || ov === undefined) throw NRE();
    StrMessage = String(ov);
    await dbgErr(5, StrMessage);
    const arr = StrMessage.split('^');
    if (arr[0] !== 'OK') {
      state.TOTALINVALIDRECORDS += 1;
      if (arr[1] === undefined) throw new RangeError('Index was outside the bounds of the array.');
      state.datauploadmessage = (arr[0] + arr[1]).toString();
    } else {
      //----------------------------------------- Start Mail and Message-----------------------------------------------------------------------------
      if (arr[1] === undefined) throw new RangeError('Index was outside the bounds of the array.');
      state.datauploadmessage = String(arr[1]);
      const Orderno = await query(DB, 'SELECT orderno FROM tbl_product_order_master WHERE orderid = @orderid', { orderid });
      const PLIDv = await scalar(DB, 'SELECT plid FROM tbl_product_order_master WHERE orderid = @orderid LIMIT 1', { orderid });
      const PLID = PLIDv === null || PLIDv === undefined ? 0 : PLIDv;
      for (const Items of Orderno) {
        const Obj1 = await queryOne(DB, "Select coalesce(loginid,'') As loginid, coalesce(orderid,'') As orderid, coalesce(product_name,'') As product_name From tbl_product_order_master where orderno = @orderno LIMIT 1", { orderno: Items.orderno });
        await scalar(DB, "select to_char(orderdate + interval '7 day', 'Mon DD, YYYY') as date from tbl_order_master where orderid = @orderid LIMIT 1", { orderid });
        // PORT-NOTE: the legacy SQL aliases TBL_CUSTOMERLOGIN as "lEFT" and then references TCL.DID, so it fails at run time; the SQL is ported literally.
        const Obj = await queryOne(DB, "Select coalesce(phone,'') As phone, emailid, (fname) as username, did, coalesce(dm.companyname,'') As companyname From tbl_customerlogin lEFT JOIN distributor_master dm ON tcl.did=dm.plid where loginid = @loginid LIMIT 1", { loginid: P(Obj1, 'loginid') });
        //----------------------------------------------------------------For Merchant----------------------------------------
        const Obj2 = await queryOne(DB, "Select coalesce(phone,'') As phone, emailid, (fname) as username From portal_login where plid = @plid LIMIT 1", { plid: String(PLID) });
        const O1 = { LoginId: P(Obj1, 'loginid'), OrderId: P(Obj1, 'orderid'), Product_Name: P(Obj1, 'product_name') };

        if (Staus === 'Out for Delivery') {
          const PhoneMessage = 'Dear Customer,\r\nYour ' + O1.Product_Name + '  with Order Id ' + O1.OrderId + ' is Out for delivery.\r\nThank you for shopping with us.\r\n The Clusteroffers Team';
          const PhoneMessage1 = 'Dear Merchant,\r\nYour ' + O1.Product_Name + '  with Order Id ' + O1.OrderId + ' is Out for delivery.\r\nThe' + CompanySettings.CompanyName + ' Team';
          const process = 'Order Out for Delivery';
          const Mailsubject = "Order :- '" + O1.OrderId + "' is Out for Delivery";
          let Type = '';
          const objPhone = P(Obj, 'phone');
          if (objPhone !== null && objPhone !== undefined && objPhone !== '') {
            Type = 'Customer';
            const tp = Type;
            bg(async () => {
              await UtilityClass.SendMsgOnMobile(objPhone, PhoneMessage, tp, 0);
              await UtilityClass.TrackCustomersMessages(objPhone, PhoneMessage, process);
            });
          }
          const obj2Phone = P(Obj2, 'phone');
          if (obj2Phone !== null && obj2Phone !== undefined && obj2Phone !== '') {
            bg(async () => {
              await UtilityClass.SendMsgOnMobile(obj2Phone, PhoneMessage1);
              await UtilityClass.TrackMerchantsMessages(obj2Phone, PhoneMessage1, process);
            });
          }
          let custName = P(Obj, 'username');
          if (custName === '' || custName === null || custName === undefined) custName = "Dear Sir/ Ma'am";
          if (Obj !== null && Obj !== undefined) {
            Type = 'Customer';
            const tp = Type; const em = Obj.emailid;
            bg(() => SendConfirmationEmail(em, custName, 'Your - ' + O1.Product_Name + ' with Order Id ' + O1.OrderId + ' is Out for delivery.', tp, Mailsubject, 0));
          }
          if (Obj2 !== null && Obj2 !== undefined) {
            Type = 'Merchant';
            const tp = Type; const em = Obj2.emailid; const un = Obj2.username;
            bg(() => SendConfirmationEmail(em, un, 'Your - ' + O1.Product_Name + ' with Order Id ' + O1.OrderId + ' is Out for delivery.', tp, Mailsubject));
          }
        } else {
          const PhoneMessage = 'Dear Customer,\r\nYour ' + O1.Product_Name + '  with Order Id ' + O1.OrderId + ' has been Successfully Delivered.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
          const PhoneMessage1 = 'Dear Merchant,\r\nYour ' + O1.Product_Name + '  with Order Id ' + O1.OrderId + ' has been Successfully Delivered.\r\n ' + CompanySettings.CompanyName + ' Team';
          const process = 'Order Delivered';
          const Mailsubject = "Order :- '" + O1.OrderId + "' has been Delivered";
          const objPhone = P(Obj, 'phone');
          if (objPhone !== null && objPhone !== undefined && objPhone !== '') {
            bg(async () => {
              await UtilityClass.SendMsgOnMobile(objPhone, PhoneMessage);
              await UtilityClass.TrackCustomersMessages(objPhone, PhoneMessage, process);
            });
          }
          let custName = P(Obj, 'username');
          if (custName === '' || custName === null || custName === undefined) custName = "Dear Sir/ Ma'am";
          if (Obj !== null && Obj !== undefined) {
            const em = Obj.emailid;
            bg(() => SendConfirmationEmail(em, custName, 'Your - ' + O1.Product_Name + ' with Order Id ' + O1.OrderId + ' has been Successfully Delivered.', 'Customer', Mailsubject));
          }
          if (Obj2 !== null && Obj2 !== undefined) {
            const em = Obj2.emailid; const un = Obj2.username;
            bg(() => SendConfirmationEmail(em, un, 'Your - ' + O1.Product_Name + ' with Order Id ' + O1.OrderId + ' has been Successfully Delivered.', 'Merchant', Mailsubject));
          }
          const o2p = P(Obj2, 'phone');
          if (o2p !== null && o2p !== undefined && o2p !== '') {
            bg(async () => {
              await UtilityClass.SendMsgOnMobile(o2p, PhoneMessage1);
              await UtilityClass.TrackMerchantsMessages(o2p, PhoneMessage1, process);
            });
          }
        }
      }
      //----------------------------------------- End Mail and Message-----------------------------------------------------------------------------
    }
    return StrMessage;
  } catch (Ex) {
    state.TOTALINVALIDRECORDS += 1;
    state.datauploadmessage = 'Some error occured while performing the operations.' + Ex.message;
    return 'Some error occured while performing the operations.' + Ex.message;
  }
}

// ---- ExportReport ----------------------------------------------------------------------------------------
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
  const BranchId = 0;
  const MaxRows = await UtilityClass.GridPageSize();
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
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      let out = '';
      for (const h of ['S.No.', 'Product Name', 'Order Date', 'Order No', 'Order Id', 'Status', 'Quantity', 'Actual Value', 'Shipping', 'GST', 'Total',
        'After Date', 'By Date', 'Customer Name', 'City ', 'Login ID ', 'Payment Type ', 'Full Address ']) out += h + ' \t';
      let closed = false; // after the first failing row the legacy StreamWriter is closed and later writes throw (swallowed)
      for (const Item of objAllOrderList) {
        if (closed) continue;
        try {
          out += '\n';
          out += tabClean(ts(Item.rownumber)) + ' \t';
          out += tabClean(ts(Item.Product_Name)) + ' \t';
          out += tabClean(ts(Item.OrderDate)) + ' \t';
          out += tabClean(ts(Item.Orderno)) + ' \t';
          out += tabClean(ts(Item.orderID)) + ' \t';
          out += tabClean(ts(Item.status)) + ' \t';
          out += tabClean(ts(Item.order_QTY)) + ' \t';
          out += tabClean(ts(Item.total_DAP)) + ' \t';
          out += tabClean(ts(Item.Total_Ship_Ch)) + ' \t';
          out += tabClean(ts(Item.ProductTotalVat)) + ' \t';
          out += tabClean(ts(Item.total_purchase_cost)) + ' \t';
          if (Item.Approved === 'Jan  1 1900 12:00AM') out += 'N.A.'; else out += tabClean(ts(Item.Approved)) + ' \t';
          if (Item.dispatchdate === 'Jan  1 1900 12:00AM') out += 'N.A.'; else out += tabClean(ts(Item.dispatchdate)) + ' \t';
          out += tabClean(ts(Item.Name)) + ' \t';
          out += tabClean(ts(Item.City)) + ' \t';
          out += tabClean(ts(Item.LoginId)) + ' \t';
          out += tabClean(ts(Item.PayMode)) + ' \t';
          out += tabClean(nn(Item.Address) + ',' + nn(Item.City) + ' Pin' + nn(Item.PinCode)) + ' \t';
        } catch (ExpObj) {
          closed = true;
        }
      }
      fs.writeFileSync(filepath, out);
      // legacy: force-download headers + Response.Redirect("~/AllExcelSheets/intransit_order.xls")
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
// route-config: franchisee/GOjhT8qZ8GbRQj3kECcLlA==
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/intransit_order/Index{/:id}', '/franchise/franchisee/GOjhT8qZ8GbRQj3kECcLlA=='], auth, asyncHandler(async (req, res) => {
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
  const BranchId = 0;
  const DID = parseInt(req.user.did, 10);
  ViewBag.BranchId = BranchId;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT is read from the first result row (column "totalcount"); 0 when no rows.
  const rows = await proc(DB, 'usp_order_list_complete_new', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    status: statusid.trim(), statustype: type, branchid: BranchId, fromreadyfordispatch: fromReadyforDispatch, toreadyfordispatch: toReadyforDispatch,
    orderid, orderno: Orderno, merchantname: '', productname: '', loginid: '', categoryrelatedto: '1', did: DID,
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
}));

// ---- UpdateStatuslist ----------------------------------------------------------------------------------
// auth
router.all('/franchise/intransit_order/UpdateStatuslist{/:id}', auth, asyncHandler(async (req, res) => {
  const isSelected = req.p.isSelected;
  if (isSelected === undefined || isSelected === null) throw NRE();
  const activinactiv = parseInt(req.p.activinactiv, 10);
  if (Number.isNaN(activinactiv)) throw new Error('The parameters dictionary contains a null entry for parameter \'activinactiv\' of non-nullable type \'System.Int32\'.');
  const tokens = String(isSelected).split(',');
  let ReturnMessage = 'ok';
  const BranchId = 0;
  for (let i = 0; i < tokens.length - 1; i++) {
    if (tokens[i] !== '') {
      const r = await procOne(DB, 'usp_update_courier_list_mannual', { plid: BranchId, ordernop: tokens[i], status: 'Delivered', docketno: '' });
      const rv = outVal(r, 'strresult');
      if (rv === null || rv === undefined) throw NRE();
      ReturnMessage = String(rv);

      const Obj1 = await queryOne(DB, "SELECT coalesce(loginid,'') AS loginid, coalesce(orderid,'') AS orderid, coalesce(product_name,'') AS product_name FROM tbl_product_order_master WHERE orderno = @orderno LIMIT 1", { orderno: tokens[i] });
      await scalar(DB, "SELECT to_char(orderdate + interval '7 day', 'Mon DD, YYYY') AS date FROM tbl_order_master WHERE orderid = @orderid LIMIT 1", { orderid: P(Obj1, 'orderid') });
      const Obj = await queryOne(DB, "SELECT coalesce(phone,'') AS phone, emailid, (fname) AS username, coalesce(did,0) did, coalesce(dm.companyname,'') AS companyname FROM tbl_customerlogin tcl LEFT JOIN distributor_master dm ON tcl.did=dm.plid WHERE loginid = @loginid LIMIT 1", { loginid: P(Obj1, 'loginid') });
      const Product_Name = Obj1.product_name; const OrderId = Obj1.orderid;
      const PhoneMessage = 'Dear Customer,\r\nYour Product Order for ' + Product_Name + '  with Order Id ' + OrderId + ' has been successfully Delivered. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe Clusteroffers Team';
      const Mailsubject = 'Your Product Order for ' + OrderId + ' has been Delivered';
      const process = 'Order Delivered';
      if (Obj !== null && Obj !== undefined) {
        let UserName = Obj.username;
        if (UserName === '' || UserName === null || UserName === undefined) UserName = "Dear Sir/ Ma'am";
        const em = Obj.emailid;
        bg(() => SendConfirmationEmail(em, UserName, 'Your Product Order for ' + Product_Name + ' with Order Id ' + OrderId + ' has been successfully Delivered. We will notify you for further updates.', 'Customer', Mailsubject, 0));
      }
      const ph = P(Obj, 'phone');
      if (ph !== null && ph !== undefined && ph !== '') {
        await UtilityClass.SendMsgOnMobile(ph, PhoneMessage, 'Customer', 0);
        await UtilityClass.TrackCustomersMessages(ph, PhoneMessage, process);
      }
    }
  }
  return res.json(ReturnMessage);
}));

// ---- UpdateStatusProduct -------------------------------------------------------------------------------
// auth
router.all('/franchise/intransit_order/UpdateStatusProduct{/:id}', auth, asyncHandler(async (req, res) => {
  const { Orderno, statusdate } = req.p;
  const BranchId = 0;
  const r = await procOne(DB, 'usp_updateorderstatusmerchant_complete', {
    orderno: Orderno, branchid: BranchId, empid: 1, intstatus: 6, remark: '', statusdate,
  });
  const rv = outVal(r, 'strresult');
  if (rv === null || rv === undefined) throw NRE();
  return res.json(String(rv));
}));

// ---- Uploadexcel ---------------------------------------------------------------------------------------
// auth
router.post('/franchise/intransit_order/Uploadexcel{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  let ret = '', Filename = '', Typename = '';
  const ip = await GetIP.GetLocalIP(req);
  let z = 0;
  let Totalrecord = 0;
  await dbgErr(1, '');
  try {
    const files = req.files || [];
    const file = files.find((f) => f.fieldname === 'FileUpload') || files[0];
    if (!file) throw new RangeError('Specified argument was out of the range of valid values.');
    if (file.size > 0) {
      await dbgErr(2, '');
      const FileExtension = path.extname(file.originalname).toLowerCase();
      await dbgErr(101, FileExtension);
      Typename = nn(req.body && req.body.Typename);
      await dbgErr(102, '');
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      await dbgErr(103, '');
      let PathForFile = file.originalname;
      Filename = path.basename(PathForFile);
      Filename = nowStamp() + Filename;
      await dbgErr(104, '');
      const dir = path.join(config.uploadDir, 'AllUploadsExcelFile');
      PathForFile = path.join(dir, Filename);
      await dbgErr(105, '');
      fs.mkdirSync(dir, { recursive: true });
      await dbgErr(106, PathForFile);
      await dbgErr(101, FileExtension);
      let workbook = null, XLSX = null;
      if (validFileTypes.includes(FileExtension)) {
        await dbgErr(10, '');
        let DtObjForFileUpload = { columns: [], rows: [] };
        await dbgErr(1111, PathForFile);
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        await dbgErr(2233, 'System.Web.HttpPostedFileWrapper');
        fs.writeFileSync(PathForFile, file.buffer);
        await dbgErr(2222, PathForFile);
        if (FileExtension === '.csv') {
          DtObjForFileUpload = parseCsv(file.buffer);
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          await dbgErr(11, '');
          const rs = readSheet(PathForFile);
          DtObjForFileUpload = rs.table; workbook = rs.workbook; XLSX = rs.XLSX;
          await dbgErr(12, 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=NO;IMEX=1"');
        }
        sessionStore.set(req, 'ExcelFileName', Filename);
        sessionStore.set(req, 'UploadedExcel', DtObjForFileUpload);
      }
      await dbgErr(3, '');
      const DtExcel = sessionStore.get(req, 'UploadedExcel');
      if (DtExcel === undefined || DtExcel === null) throw NRE();
      let touched = false;
      try {
        if (DtExcel.rows.length > 0) {
          z = DtExcel.rows.length - 1;
          for (let i = 1; i < DtExcel.rows.length; i++) {
            const row = DtExcel.rows[i];
            const col = (name) => getCol(DtExcel, row, name);
            let alllength = 0;
            const Dtdcstatus = '';
            for (let k = 0; k < DtExcel.columns.length; k++) {
              if (cvStr(DtExcel.rows[0][DtExcel.columns[k]]) !== '') alllength++;
            }
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
              await Updatestatus(state, orderid, Productname, No_of_Piece, Customer_name, Shipping_add1, Shipping_add2, City, state_, Docketno, weight, pincode, mobile, invoicevalue, CollectableAmount, Staus, Typeofservice, Dtdcstatus, Statusdate, ORDERNO);
            }
            const Response = state.datauploadmessage;
            if (workbook) {
              // PORT-NOTE: Excel interop cell colouring (DarkGray fill, red/green font) is not available in `xlsx`; only the status text is written.
              const sheet = workbook.Sheets.Sheet1;
              const J = i + 1;
              const addr = XLSX.utils.encode_cell({ r: J - 1, c: alllength - 1 });
              sheet[addr] = { t: 's', v: Response !== 'Update Status' ? Response : state.datauploadmessage };
              const ref = XLSX.utils.decode_range(sheet['!ref']);
              if (J - 1 > ref.e.r) ref.e.r = J - 1;
              if (alllength - 1 > ref.e.c) ref.e.c = alllength - 1;
              sheet['!ref'] = XLSX.utils.encode_range(ref);
              touched = true;
            }
          }
        }
      } finally {
        if (workbook && touched) XLSX.writeFile(workbook, PathForFile);
      }

      sessionStore.set(req, 'UploadedExcel', null);
      Totalrecord = z - state.TOTALINVALIDRECORDS;
      const EMPID = 0;
      const efn = sessionStore.get(req, 'ExcelFileName');
      await exec(DB, `INSERT INTO tbl_uploaded_courier_excellog (excelfile, plid, status, activitybyuserid, totaluploadedrecords, totalerrorrecords, requestid, activitydate)
        VALUES (@excelfile, @plid, @status, @activitybyuserid, @totaluploadedrecords, @totalerrorrecords, @requestid, @activitydate)`, {
        excelfile: nn(efn), plid: EMPID, status: 1, activitybyuserid: 0, totaluploadedrecords: Totalrecord, totalerrorrecords: state.TOTALINVALIDRECORDS,
        requestid: '', activitydate: await dbNow(),
      });
      ret = '1';
    }
  } catch (Ex) {
    sessionStore.set(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message);
    await dbgErr(0, Ex.message.toString());
    await dbgErr(0, ret.toString());
    return res.json(Ex.message);
  }
  return res.json(ret);
}));

// ---- Updatestatus (public string action) -----------------------------------------------------------------------
// auth
router.all('/franchise/intransit_order/Updatestatus{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  const no = (v) => { const x = parseInt(v, 10); if (Number.isNaN(x)) throw new Error('The parameters dictionary contains a null entry for a non-nullable Int32 parameter.'); return x; };
  const dec = (v) => { const x = Number(v); if (v === undefined || v === null || v === '' || Number.isNaN(x)) throw new Error('The parameters dictionary contains a null entry for a non-nullable decimal parameter.'); return x; };
  const out = await Updatestatus(state, p.orderid, p.Productname, no(p.No_of_Piece), p.Customer_name, p.Shipping_add1, p.Shipping_add2, p.City, p.state,
    p.Docketno, p.weight, p.pincode, p.mobile, dec(p.invoicevalue), dec(p.CollectableAmount), p.Staus, p.Typeofservice, p.Dtdcstatus, p.Statusdate, p.ORDERNO);
  return res.type('text/plain').send(out);
}));

// ---- Downloadexceldata (public Tuple action) ---------------------------------------------------------------
async function Downloadexceldata() {
  let file_name = '', Path = '';
  try {
    const BranchId = 0;
    const objCourierList = mapRows(await proc(DB, 'usp_getcourierdatalist_merchand', { mode: 1, status: 4, branchid: BranchId }), COURIERDATA_PROPS);
    let City = '', State = '';
    const XLSX = require('xlsx');
    const aoa = [['S.No', 'Order_id', 'Item_Name', 'No_of_Piece', 'Customer_Name', 'SHIPPING_ADD1', 'SHIPPING_ADD2', 'City', 'State', 'Pincode', 'Mobile_No',
      'Invoice_value', 'Collectable_Amount', 'Courier Tracking No', 'WEIGHT', 'STATUS', 'TYPE_OF_SERVICE', 'Status Date', 'Error Reson']];
    for (const Item of objCourierList) {
      const rowv = new Array(19).fill(undefined);
      rowv[0] = s(Item.ROWNUMBER).trim();
      rowv[1] = s(Item.ORDERID).trim();
      rowv[2] = s(Item.Item_NAME).trim();
      rowv[3] = s(Item.NO_OF_PIECE).trim();
      rowv[4] = s(Item.CUSTOMER_NAME).trim();
      rowv[5] = s(Item.SHIPPING_ADD1).trim();
      rowv[6] = s(Item.SHIPPING_ADD2).trim();
      const pincode = Item.SHIPPING_PINCODE;
      const objList = await query(DB, 'Select city, state from tbl_courierpincodes where pincode = @pincode', { pincode });
      // PORT-NOTE: Excel drop-down validation list of statuses (tbl_courierexcelstatuslist) on the STATUS column is not supported by `xlsx`.
      await query(DB, 'Select csid, statusname from tbl_courierexcelstatuslist where status = 1');
      for (const a of objList) { City = a.city; State = a.state; }
      rowv[7] = tr(City);
      rowv[8] = tr(State);
      rowv[9] = s(Item.SHIPPING_PINCODE).trim();
      rowv[10] = s(Item.SHIPPING_MOBILENO).trim();
      rowv[11] = s(Item.INVOICE_VALUE).trim();
      rowv[12] = Item.PAYMODE === 'COD' ? s(Item.COLLECTABLE_AMOUNT).trim() : '0';
      rowv[13] = s(Item.DOCKETNO).trim();
      rowv[14] = s(Item.WEIGHT).trim();
      rowv[16] = s(Item.TYPE_OF_SERVICE).trim();
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
router.all('/franchise/intransit_order/Downloadexceldata{/:id}', auth, asyncHandler(async (req, res) => {
  const [Path, file_name] = await Downloadexceldata();
  // Tuple<string,string>.ToString()
  return res.type('text/plain').send('(' + Path + ', ' + file_name + ')');
}));

// ---- DownloadData --------------------------------------------------------------------------------------
// auth (legacy: Session["Plid"] == null => "Session Expired. Please login again")
router.all('/franchise/intransit_order/DownloadData{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const DownloadFile = await Downloadexceldata();
    const fileBytes = fs.readFileSync(DownloadFile[0]);
    const fileName = DownloadFile[1] + '.xlsx';
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="' + fileName + '"');
    return res.send(fileBytes);
  } catch (ex) {
    return res.json('');
  }
}));

// ---- ExportReport (public void action) -------------------------------------------------------------------
// auth
router.all('/franchise/intransit_order/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const page = optInt(p.page);
  const done = await ExportReport(req, res, p.type, p.toReadyforDispatch, p.fromReadyforDispatch, p.SearchField, p.SearchValue, p.fromDate, p.toDate, p.status, page, p.btnexel, p.statusid, p.Order);
  if (done) return undefined;
  return res.status(200).end();
}));

module.exports = router;
