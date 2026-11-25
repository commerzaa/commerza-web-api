'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Dispatched_Order.cs (class Dispatched_OrderController, no namespace => /Dispatched_Order/...)
// Database: affiliate (Db_Affiliate). Procs UPS_OrderDeatils, UPS_OrderDeatilsEXport.
// No RouteConfig friendly url targets this controller.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/adminSession');
const {
  nInt, nStr, col, nowStamp, writeXlsExport, cellStr, tab, dec2, netFormat, dynPaging, trimNull,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Dispatched_Order';

/** New_Order.cs class OrderManagement */
const ORDER_MANAGEMENT_PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL',
  'ALLPRODUCTID', 'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID',
  'PRODUCTNAME', 'MRP', 'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY',
  'STATE', 'CITY', 'PINCODE', 'Amount', 'STATUST', 'WalletTypeName', 'USERNAME', 'IMAGENAME', 'GSTPER', 'FNAME', 'FADDRESS', 'QUANTITY',
  'OrderStatusT', 'OrderStatus', 'TRACKINGNO', 'INVOICEDATE', 'SHIPBY', 'PRODUCTCODE', 'Type', 'ReferenceDate', 'ReferenceNumber', 'TotalPayable',
  'ShippingCharge', 'DDAmount', 'DDNO', 'Customermobile', 'DocketNo'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (written by Index only).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

/** public static String GetTimestamp(DateTime value) - static => not an MVC action; kept as an internal helper. */
function GetTimestamp(value) { // eslint-disable-line no-unused-vars
  return netFormat(value, 'yyyyMMdd');
}

/** dbo.UPS_OrderDeatilsEXport @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate,@SearchField,@SearchValue,@ProductType */
async function orderDetailsExport(fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  return mapRows(await db.proc(DB, 'UPS_OrderDeatilsEXport', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: SearchField, UserName: '', Type: Type1, orderbydate: '', SearchField,
    SearchValue: trimNull(SearchValue), ProductType: PRtype,
  }), ORDER_MANAGEMENT_PROPS);
}

/** public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype) */
async function ExportReportOLd(req, res, fromDate, toDate, SearchField, SearchValue, Type1, PRtype, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Order_Dispatched_Details_' + userid + '_' + nowStamp();
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  const obj1 = await orderDetailsExport(fromDate, toDate, SearchField, SearchValue, Type1, PRtype);
  if (obj1.length > 0) {
    const noSpace = (item, k) => cellStr(item, k).split(' ').join('');
    return writeXlsExport({
      req, res, sheet: 'Order_Details.xls', Filename, ViewBag, rows: obj1,
      headers: ['S.No.', 'OrderNo', 'OrderDate', 'Username', 'Customername', 'State', 'TotalAmount', 'Paymode', 'DocketNo', 'shipby', 'Status'],
      innerProc: 'UPS_OrderDeatilsEXport', outerProc: 'UPS_OrderDeatilsEXport',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'ORDERID')) + ' \t');
        w(tab(netFormat(item.ORDERDATE, 'dd-MM-yyyy')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(noSpace(item, 'CUSTOMERNAME')) + ' \t');
        w(tab(noSpace(item, 'STATE')) + ' \t');
        w(tab(dec2(item.TOTALAMOUNT)) + ' \t');
        w(tab(cellStr(item, 'PAYMODE')) + ' \t');
        w(tab(noSpace(item, 'DocketNo')) + ' \t');
        w(tab(noSpace(item, 'SHIPBY')) + ' \t');
        w(tab('Dispatched') + ' \t');
      },
    });
  }
  return { sent: false };
}

/** public void ExportReport(...) - Microsoft.Office.Interop.Excel workbook saved to ~/AllExcelSheets/OrderDetails.xls (not sent to the client).
 *  PORT-NOTE: Excel Interop replaced by exceljs (lazy require); AutoFit approximated by column widths; written in xlsx format under the
 *  legacy name OrderDetails.xls. */
async function ExportReport(req, ViewBag, fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  const objAllOrderList = await orderDetailsExport(fromDate, toDate, SearchField, SearchValue, Type1, PRtype);
  if (objAllOrderList.length > 0) {
    try {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      const heads = ['S.No', 'OrderNo', 'OrderDate', 'Name', 'Amount', 'Paymode', 'DDNo', 'DD-Date', 'DocketNo', 'shipby', 'Status'];
      heads.forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
      let row = 2;
      for (const item of objAllOrderList) {
        worksheet.getCell(row, 1).value = cellStr(item, 'ROWNUMBER').trim();
        worksheet.getCell(row, 2).value = cellStr(item, 'ORDERID').trim();
        worksheet.getCell(row, 3).value = netFormat(item.ORDERDATE, 'dd-MM-yyyy').trim();
        worksheet.getCell(row, 4).value = cellStr(item, 'CUSTOMERNAME').trim();
        worksheet.getCell(row, 5).value = cellStr(item, 'TOTALAMOUNT').trim();
        worksheet.getCell(row, 6).value = cellStr(item, 'PAYMODE').trim();
        worksheet.getCell(row, 7).value = cellStr(item, 'DDNO').trim();
        // PORT-NOTE: legacy compared the "dd-MM-yyyy" text with "1900-01-01" (never equal) - kept.
        if (netFormat(item.ReferenceDate, 'dd-MM-yyyy') === '1900-01-01') {
          worksheet.getCell(row, 8).value = '';
        } else {
          worksheet.getCell(row, 8).value = netFormat(item.ReferenceDate, 'dd-MM-yyyy').trim();
        }
        let list2 = [];
        if (Type1 === '1') list2.push('Packed');
        if (Type1 === '3') list2.push('Dispatched');
        if (Type1 === '4') list2.push('Delivered');
        const FlatList2 = list2.join(',');
        const Cell = worksheet.getCell(row, 11);
        Cell.protection = { locked: true };
        Cell.dataValidation = { type: 'list', allowBlank: true, errorStyle: 'information', formulae: [`"${FlatList2}"`] };
        list2 = null;
        row++;
      }
      for (let c = 1; c <= heads.length; c++) {
        let max = 8;
        worksheet.getColumn(c).eachCell({ includeEmpty: false }, (cell) => { max = Math.max(max, String(cell.value === null ? '' : cell.value).length + 2); });
        worksheet.getColumn(c).width = max;
      }
      for (let c = 1; c <= 26; c++) { // range A1:Z1
        const cell = worksheet.getCell(1, c);
        cell.font = { bold: true, name: 'Arial Narrow', size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
      }
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'OrderDetails.xls');
      if (fs.existsSync(p)) fs.unlinkSync(p);
      await workbook.xlsx.writeFile(p);
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'LiUserWiseIWalletStatementsController_Report');
      ViewBag.filepath = ExpObj.message;
    }
  }
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue,
//   string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember,
//   int? Side, int? Type, int? hdnordertype, int? ProductType)
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let ByStatus = nStr(req.p.ByStatus);
  let page = nInt(req.p.page);
  let OrderBy = nStr(req.p.OrderBy);
  const btnexel = nStr(req.p.btnexel);
  let Userdownlinemember = nStr(req.p.Userdownlinemember);
  let Side = nInt(req.p.Side); // eslint-disable-line no-unused-vars
  let Type = nInt(req.p.Type);
  let ProductType = nInt(req.p.ProductType);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ProductType === null) ProductType = 0;
  if (Type === null) Type = 4;
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  if (orderbydate === null) orderbydate = '';
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  let objAllOrderList = [];
  const MaxRows = Number(dynamicpagging);
  const ViewBag = {};
  try {
    let TotalRecord = 0;
    const Empid = req.user.emp_id;
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid)
    const token = emp ? issueAdminToken(emp) : undefined;
    // dbo.UPS_OrderDeatils @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate,@SearchField,@SearchValue,@ProductType
    const rows = await db.proc(DB, 'UPS_OrderDeatils', {
      fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: 4, UserName: '', Type: 4, orderbydate, SearchField,
      SearchValue: SearchValue.trim(), ProductType,
    });
    objAllOrderList = mapRows(rows, ORDER_MANAGEMENT_PROPS);
    const tc = col(rows[0], 'TotalCount');
    if (tc === null || tc === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(DBNull)
    TotalRecord = Math.round(Number(tc));
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.Userdownlinemember = Userdownlinemember;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = ByStatus;
    ViewBag.OrderBy = OrderBy;
    ViewBag.ProductType = String(ProductType);
    if (btnexel === 'Export Excel') {
      const x = await ExportReportOLd(req, res, fromDate, toDate, SearchField, SearchValue, String(Type), ProductType, ViewBag);
      if (x.sent) return undefined;
    }
    ViewBag.APIerror = 1;
    const out = { view: '~/Views/AdminPanel/Dispatched_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag };
    if (token) out.token = token;
    return res.json(out);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Dispatched_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportOLd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReportOLd(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.SearchField), nStr(req.p.SearchValue),
    nStr(req.p.Type1), nInt(req.p.PRtype), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
// auth (PORT-NOTE: legacy had no session check; admin data export => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, {}, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.SearchField), nStr(req.p.SearchValue),
    nStr(req.p.Type1), nInt(req.p.PRtype));
  res.send(''); // void action => empty response (the workbook is only saved on the server)
}));

module.exports = router;
