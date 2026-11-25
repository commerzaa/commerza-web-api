'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Complete_Order.cs (class Complete_OrderController => /admin/Complete_Order/...)
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
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Complete_Order';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class OrderManagement (Controllers/AdminPanel/New_Order.cs) */
const ORDER_PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL',
  'ALLPRODUCTID', 'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID',
  'TKPMID', 'PRODUCTNAME', 'MRP', 'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE',
  'ADDRESS', 'COUNTRY', 'STATE', 'CITY', 'PINCODE', 'Amount', 'STATUST', 'WalletTypeName', 'USERNAME', 'IMAGENAME', 'GSTPER', 'FNAME',
  'FADDRESS', 'QUANTITY', 'OrderStatusT', 'OrderStatus', 'TRACKINGNO', 'INVOICEDATE', 'SHIPBY', 'PRODUCTCODE', 'Type', 'ReferenceDate',
  'ReferenceNumber', 'TotalPayable', 'ShippingCharge', 'DDAmount', 'DDNO', 'Customermobile', 'DocketNo'];

/** public static String GetTimestamp(DateTime value) => value.ToString("yyyyMMdd")  (static => not an MVC action) */
function GetTimestamp(value) {
  return B.netFormat(value, 'yyyyMMdd');
}

/** dbo.UPS_OrderDeatilsEXport (shared by ExportReportOLd / ExportReport) */
async function orderDetailsExport(fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  if (SearchValue === null || SearchValue === undefined) throw B.nullRef(); // SearchValue.Trim()
  // PORT-NOTE: db.Database.CommandTimeout = 1000 (seconds) - the pg pool timeout applies.
  return mapRows(await db.proc(DB, 'UPS_OrderDeatilsEXport', {
    fromDate, toDate, STARTROWINDEX: 1, MAXROWS: 1000000, STATUS: SearchField, UserName: '', Type: Type1, orderbydate: '',
    SearchField, SearchValue: SearchValue.trim(), ProductType: PRtype,
  }), ORDER_PROPS);
}

/** public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype) */
async function ExportReportOLd(req, res, ViewBag, fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  const userid = req.user.emp_id;
  const Filename = 'Order_Complete_Details_' + userid + '_' + B.nowStamp();
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows; // unused (legacy)
  const obj1 = await orderDetailsExport(fromDate, toDate, SearchField, SearchValue, Type1, PRtype);
  if (obj1.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Order_Details.xls', Filename,
      headers: ['S.No.', 'OrderNo', 'OrderDate', 'Username', 'Customername', 'State', 'TotalAmount', 'Paymode', 'Status'],
      rows: obj1, innerProc: 'UPS_OrderDeatilsEXport', outerProc: 'UPS_OrderDeatilsEXport',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'ORDERID')) + ' \t');
        w(B.tab(B.netFormat(item.ORDERDATE, 'dd-MM-yyyy')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'CUSTOMERNAME').replace(/ /g, '')) + ' \t');
        w(B.tab(B.cellStr(item, 'STATE').replace(/ /g, '')) + ' \t');
        w(B.tab(B.dec2(item.TOTALAMOUNT)) + ' \t');
        w(B.tab(B.cellStr(item, 'PAYMODE')) + ' \t');
        w(B.tab('Delivered') + ' \t');
      },
    });
  }
  return { sent: false };
}

/** public void ExportReport(...) - Microsoft.Office.Interop.Excel workbook saved to ~/AllExcelSheets/OrderDetails.xls (not sent).
 *  PORT-NOTE: Excel Interop replaced by exceljs (lazy); AutoFit is approximated by column widths; the file is written in xlsx format
 *  under the legacy name OrderDetails.xls (Interop SaveAs used the default workbook format too). */
async function ExportReport(req, ViewBag, fromDate, toDate, SearchField, SearchValue, Type1, PRtype) {
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
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
        worksheet.getCell(row, 1).value = B.cellStr(item, 'ROWNUMBER').trim();
        worksheet.getCell(row, 2).value = B.cellStr(item, 'ORDERID').trim();
        worksheet.getCell(row, 3).value = B.netFormat(item.ORDERDATE, 'dd-MM-yyyy').trim();
        worksheet.getCell(row, 4).value = B.cellStr(item, 'CUSTOMERNAME').trim();
        worksheet.getCell(row, 5).value = B.cellStr(item, 'TOTALAMOUNT').trim();
        worksheet.getCell(row, 6).value = B.cellStr(item, 'PAYMODE').trim();
        worksheet.getCell(row, 7).value = B.cellStr(item, 'DDNO').trim();
        // PORT-NOTE: legacy compared the "dd-MM-yyyy" text with "1900-01-01" (never equal) - kept.
        if (B.netFormat(item.ReferenceDate, 'dd-MM-yyyy') === '1900-01-01') {
          worksheet.getCell(row, 8).value = '';
        } else {
          worksheet.getCell(row, 8).value = B.netFormat(item.ReferenceDate, 'dd-MM-yyyy').trim();
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

// ---------------------------------------------------------------- ActionResult Index(...)
// auth (reads Session["Admin_User"]; legacy had no explicit null check - the NullReference was caught and the view returned)
// route-config: "AdminPanel/Complete-Order" -> Complete_Order/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Complete-Order'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let ByStatus = B.nStr(req.p.ByStatus);
  let page = B.nInt(req.p.page);
  let OrderBy = B.nStr(req.p.OrderBy);
  const releasepayout = B.nStr(req.p.releasepayout); void releasepayout;
  const btnexel = B.nStr(req.p.btnexel);
  let Userdownlinemember = B.nStr(req.p.Userdownlinemember);
  let Side = B.nInt(req.p.Side);
  let Type = B.nInt(req.p.Type);
  const hdnordertype = B.nInt(req.p.hdnordertype); void hdnordertype;
  let ProductType = B.nInt(req.p.ProductType);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (ProductType === null) ProductType = 0;
  if (Type === null) Type = 2;
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  if (orderbydate === null) orderbydate = '';
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging;
    dynamicpagging = value === undefined || value === null || value === '' ? 0 : parseInt(value, 10); // Convert.ToInt16
  }
  let objAllOrderList = [];
  const MaxRows = Number(dynamicpagging);
  const ViewBag = {};
  const out = {};
  try {
    let TotalRecord = 0;
    const Empid = req.user.emp_id;
    // Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
    const emp = await new UtilityClass().UpdateAdminUserSession(Empid);
    if (!emp) throw B.nullRef(); // EM.Emp_ID on a null session object
    out.token = issueAdminToken(emp);
    const rows = await db.proc(DB, 'UPS_OrderDeatils', {
      fromDate, toDate, STARTROWINDEX: page, MAXROWS: MaxRows, STATUS: 2, UserName: '', Type: 2, orderbydate, SearchField,
      SearchValue: SearchValue.trim(), ProductType,
    });
    objAllOrderList = mapRows(rows, ORDER_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT read from the result row column "totalcount" (Convert.ToInt32(DBNull) would throw; no row => 0).
    const tc = rows.length ? B.col(rows[0], 'totalcount') : 0;
    TotalRecord = tc === null || tc === undefined ? 0 : Number(tc);
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
    return res.json({ view: '~/Views/AdminPanel/Complete_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Complete_Order/Index.cshtml', Model: objAllOrderList, ...ViewBag, ...out });
  }
}));

// ---------------------------------------------------------------- public void ExportReportOLd(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReportOLd{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReportOLd(req, res, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.SearchField),
    B.nStr(req.p.SearchValue), B.nStr(req.p.Type1), B.nInt(req.p.PRtype));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue, string Type1, int? PRtype)
// auth (public method => routable in legacy; admin data export - legacy had no session check)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await ExportReport(req, {}, B.nStr(req.p.fromDate), B.nStr(req.p.toDate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue),
    B.nStr(req.p.Type1), B.nInt(req.p.PRtype));
  res.send(''); // void action => empty response
}));

module.exports = router;
void GetTimestamp; // internal helper (public static in C#, not routable)
