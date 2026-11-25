'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Cancel_Order.cs (class Cancel_OrderController => /admin/Cancel_Order/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert, issueAdminToken } = require('./_shared/admin-session');
const {
  s, ni, col, netStr, nowStamp, tab, DYNAMIC_PAGING, sendTsv,
} = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Cancel_Order';

/** class OrderManagement (Controllers/AdminPanel/New_Order.cs) */
const ORDER_PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL', 'ALLPRODUCTID',
  'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID', 'PRODUCTNAME', 'MRP',
  'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY', 'STATE', 'CITY', 'PINCODE',
  'Amount', 'STATUST', 'WalletTypeName', 'USERNAME', 'IMAGENAME', 'GSTPER', 'FNAME', 'FADDRESS', 'QUANTITY', 'OrderStatusT', 'OrderStatus', 'TRACKINGNO',
  'INVOICEDATE', 'SHIPBY', 'PRODUCTCODE', 'Type', 'ReferenceDate', 'ReferenceNumber', 'TotalPayable', 'ShippingCharge', 'DDAmount', 'DDNO',
  'Customermobile', 'DocketNo'];

// private static string url, url1 (process-wide)
let url = '';
let url1 = '';

const p2 = (n) => String(n).padStart(2, '0');
/** DateTime.ToString("dd-MM-yyyy") (non-nullable DateTime from DBNull => cast error) */
function dmy(d) {
  if (d === null || d === undefined) throw new Error('Specified cast is not valid.');
  const x = d instanceof Date ? d : new Date(d);
  return `${p2(x.getDate())}-${p2(x.getMonth() + 1)}-${x.getFullYear()}`;
}
/** decimal.ToString("0.00") */
function dec2(v) {
  if (v === null || v === undefined) throw new Error('Specified cast is not valid.');
  const n = Number(v);
  return (Math.sign(n) * Math.round(Math.abs(n) * 100 + 1e-9) / 100).toFixed(2);
}

/** public static String GetTimestamp(DateTime value) => value.ToString("yyyyMMdd")  (static => not an MVC action) */
// eslint-disable-next-line no-unused-vars
function GetTimestamp(value) {
  const x = value instanceof Date ? value : new Date(value);
  return `${x.getFullYear()}${p2(x.getMonth() + 1)}${p2(x.getDate())}`;
}

/** dbo.UPS_OrderDeatilsEXport @fromDate,@toDate,@STARTROWINDEX,@MAXROWS,@STATUS,@UserName,@TOTALCOUNT out,@Type,@orderbydate,@SearchField,@SearchValue,@ProductType */
async function exportRows(fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  await UtilityClass.GridPageSize(); // int MaxRows = UtilityClass.GridPageSize(); (unused)
  if (SearchValue === null) throw new Error('Object reference not set to an instance of an object.'); // SearchValue.Trim()
  return mapRows(await db.proc(DB, 'UPS_OrderDeatilsEXport', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: SearchField, UserName: '', Type: Type1, orderbydate: '', SearchField,
    SearchValue: SearchValue.trim(), ProductType: PRtype,
  }), ORDER_PROPS);
}

// ---------------------------------------------------------------- public void ExportReportOLd(fromDate, toDate, SearchField, SearchValue, Type1, int? PRtype)
async function ExportReportOLd(req, res, ViewBag, fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  const userid = req.user.emp_id;
  const Filename = `Order_Complete_Details_${userid}_${nowStamp()}`;
  const obj1 = await exportRows(fromDate, toDate, SearchField, SearchValue, Type1, PRtype);
  if (obj1.length > 0) {
    return sendTsv({
      req, res, ViewBag, sheet: 'Order_Details.xls', Filename, rows: obj1, rowErrProc: 'UPS_OrderDeatilsEXport', outerErrProc: 'UPS_OrderDeatilsEXport',
      headers: ['S.No.', 'OrderNo', 'OrderDate', 'Username', 'Customername', 'State', 'TotalAmount', 'Paymode', 'Status'],
      cells: (item, w) => {
        w(tab(netStr(item.ROWNUMBER)) + ' \t');
        w(tab(netStr(item.ORDERID)) + ' \t');
        w(tab(dmy(item.ORDERDATE)) + ' \t');
        w(tab(netStr(item.USERNAME)) + ' \t');
        const na1 = netStr(item.CUSTOMERNAME).replace(/ /g, '');
        w(tab(na1) + ' \t');
        const STATE1 = netStr(item.STATE).replace(/ /g, '');
        w(tab(STATE1) + ' \t');
        w(tab(dec2(item.TOTALAMOUNT)) + ' \t');
        w(tab(netStr(item.PAYMODE)) + ' \t');
        w(tab('Cancelled') + ' \t');
      },
    });
  }
  // PORT-NOTE: legacy never wrote USP_EXCEL_DOWNLOAD_HISTORY here (SpOutPut declared but unused).
  return { sent: false };
}

// ---------------------------------------------------------------- public void ExportReport(fromDate, toDate, SearchField, SearchValue, Type1, int? PRtype)
// Excel COM interop => exceljs (lazy). Saves ~/AllExcelSheets/OrderDetails.xls on the server only (no response body).
async function ExportReport(req, ViewBag, fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  const objAllOrderList = await exportRows(fromDate, toDate, SearchField, SearchValue, Type1, PRtype);
  if (objAllOrderList.length > 0) {
    try {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Sheet1');
      ['S.No', 'OrderNo', 'OrderDate', 'Name', 'Amount', 'Paymode', 'DDNo', 'DD-Date', 'DocketNo', 'shipby', 'Status']
        .forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
      let row = 2;
      for (const item of objAllOrderList) {
        worksheet.getCell(row, 1).value = netStr(item.ROWNUMBER).trim();
        worksheet.getCell(row, 2).value = netStr(item.ORDERID).trim();
        worksheet.getCell(row, 3).value = dmy(item.ORDERDATE).trim();
        worksheet.getCell(row, 4).value = netStr(item.CUSTOMERNAME).trim();
        worksheet.getCell(row, 5).value = netStr(item.TOTALAMOUNT).trim();
        worksheet.getCell(row, 6).value = netStr(item.PAYMODE).trim();
        worksheet.getCell(row, 7).value = netStr(item.DDNO).trim();
        // PORT-NOTE: legacy compared "dd-MM-yyyy" output with "1900-01-01" (never equal) => the date is always written.
        if (dmy(item.ReferenceDate) === '1900-01-01') worksheet.getCell(row, 8).value = '';
        else worksheet.getCell(row, 8).value = dmy(item.ReferenceDate).trim();
        const list2 = [];
        if (Type1 === '1') list2.push('Packed');
        if (Type1 === '3') list2.push('Dispatched');
        if (Type1 === '4') list2.push('Delivered');
        const FlatList2 = list2.join(',');
        const Cell = worksheet.getCell(row, 11);
        Cell.protection = { locked: true };
        // Validation.Add(xlValidateList, xlValidAlertInformation, xlBetween, FlatList2)
        Cell.dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, errorStyle: 'information', formulae: [`"${FlatList2}"`] };
        row++;
      }
      for (let c = 1; c <= 11; c++) worksheet.getColumn(c).width = 15; // EntireColumn.AutoFit() approximation
      for (let c = 1; c <= 26; c++) { // A1:Z1 heading style
        const h = worksheet.getCell(1, c);
        h.font = { bold: true, name: 'Arial Narrow', size: 12 };
        h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } }; // Color.Gray
      }
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const p = path.join(dir, 'OrderDetails.xls');
      if (fs.existsSync(p)) fs.unlinkSync(p);
      // PORT-NOTE: written in xlsx format (exceljs) under the legacy .xls name.
      await workbook.xlsx.writeFile(p);
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'LiUserWiseIWalletStatementsController_Report');
      ViewBag.filepath = ExpObj.message;
    }
  }
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, int? Type, int? hdnordertype, int? ProductType)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/Cancel-Order" -> Cancel_Order/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Cancel-Order'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ni(req.p.dynamicpagging); let orderbydate = s(req.p.orderbydate); let SearchField = s(req.p.SearchField);
  let SearchValue = s(req.p.SearchValue); let fromDate = s(req.p.fromDate); let toDate = s(req.p.toDate); let ByStatus = s(req.p.ByStatus);
  let page = ni(req.p.page); let OrderBy = s(req.p.OrderBy); const btnexel = s(req.p.btnexel); let Userdownlinemember = s(req.p.Userdownlinemember);
  let Side = ni(req.p.Side); let Type = ni(req.p.Type); let ProductType = ni(req.p.ProductType);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ProductType === null) ProductType = 0;
  if (Type === null) Type = 6;
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  if (orderbydate === null) orderbydate = '';
  if (dynamicpagging === null) dynamicpagging = DYNAMIC_PAGING();
  let objAllOrderList = [];
  const MaxRows = Number(dynamicpagging);
  const ViewBag = {};
  const out = {};
  try {
    let TotalRecord = 0;
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw new Error('Object reference not set to an instance of an object.');
    out.token = issueAdminToken(emp);
    const raw = await db.proc(DB, 'UPS_OrderDeatils', {
      fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: 6, UserName: '', Type: 6, orderbydate, SearchField,
      SearchValue: SearchValue.trim(), ProductType,
    });
    objAllOrderList = mapRows(raw, ORDER_PROPS);
    const tc = col(raw[0], 'totalcount');
    if (tc === null || tc === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToInt32(object)
    TotalRecord = Number(tc);
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.Userdownlinemember = Userdownlinemember;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = ByStatus;
    ViewBag.OrderBy = OrderBy;
    ViewBag.ProductType = String(ProductType);
    if (btnexel === 'Export Excel') {
      const r = await ExportReportOLd(req, res, ViewBag, fromDate, toDate, SearchField, SearchValue, String(Type), ProductType);
      if (r.sent) return undefined;
    }
    ViewBag.APIerror = 1;
    return res.json({ view: '~/Views/AdminPanel/Cancel_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Cancel_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReportOLd(...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportOLd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReportOLd(req, res, {}, s(req.p.fromDate), s(req.p.toDate), s(req.p.SearchField), s(req.p.SearchValue), s(req.p.Type1),
    ni(req.p.PRtype));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (legacy had no session check; writes an order export file on the server => protected)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, {}, s(req.p.fromDate), s(req.p.toDate), s(req.p.SearchField), s(req.p.SearchValue), s(req.p.Type1), ni(req.p.PRtype));
  res.send('');
}));

module.exports = router;
