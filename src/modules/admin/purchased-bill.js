'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PurchasedBill.cs (class PurchasedBillController => /admin/PurchasedBill/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, usp_GetPurchase_Bill, USP_EXCEL_DOWNLOAD_HISTORY.
// (class invoice_type / _invoice_type_list() in the same C# file is a model helper, not a controller action - not routed.)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, dec2, col, str,
} = require('./_shared/batch12-common');
const { cfgInt16 } = require('./_shared/batch12-b-common');
const { boolTrue, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'PurchasedBill';

/** class GetPurchaseBill (Purchase_Bill.cs) */
const GET_PURCHASE_BILL_PROPS = ['Sfaid', 'rownumber', 'RefNo', 'challanNo', 'VendorId', 'vendorName', 'subTotal', 'vatTotal', 'stateName', 'challaneDate',
  'transDate', 'DumpName', 'Invoicetype', 'ref_no', 'IsVatInc', 'Total_Cortage', 'Gst_vat'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** public void ExportReport(string fromDate, string toDate, string FRCode, string invoicetype, string State, string challan, string VendorName, int? page) */
async function ExportReport(req, res, ViewBag, fromDate, toDate, FRCode, invoicetype, State, challan, VendorName, page) {
  let MaxRows = await UtilityClass.GridPageSize();
  MaxRows = 1000;
  const userid = req.user.emp_id;
  const Filename = 'Store_Transfer_challan_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const sid = cvtInt(State); // Convert.ToInt32(State)
  // dbo.usp_GetPurchase_Bill @StartRowIndex,@MaxRows,@fromDate,@toDate,@branch,@invoicetype,@State,@vendorName,@TotalCount out,@ChallanNo,@Mode
  const PBillList = mapRows(await db.proc(DB, 'usp_GetPurchase_Bill', omitNull({
    StartRowIndex: page, MaxRows, fromDate, toDate, branch: FRCode, invoicetype, State: sid, vendorName: VendorName, ChallanNo: challan, Mode: 1,
  })), GET_PURCHASE_BILL_PROPS);
  return writeXlsExport({
    req, res, ViewBag, sheet: 'Purchase_Bill.xls', downloadName: 'All_Downline_Member_List.xls', Filename,
    headers: ['S.No.', 'Vendor', 'Enter Date', 'Challan No', 'Purch Date', 'Amount', 'VAT/GST', 'Expense', 'State', 'TaxType', 'Franchaise'],
    rows: PBillList,
    innerProc: 'ExportReport',
    outerProc: 'usp_GetPurchase_Bill',
    cells: (item, w) => {
      w('\n');
      w(tab(cellStr(item, 'rownumber')) + ' \t');
      w(tab(cellStr(item, 'VendorId') + '-' + str(item.vendorName)) + ' \t');
      w(tab(cellStr(item, 'challaneDate')) + ' \t');
      w(tab(cellStr(item, 'challanNo')) + ' \t');
      w(tab(cellStr(item, 'transDate')) + ' \t');
      w(String(dec2(item.subTotal)).replace(/\t/g, '   ') + ' \t'); // (legacy replaced "\t" with 3 spaces here)
      w(tab(dec2(item.vatTotal)) + ' \t');
      w(tab(dec2(item.Total_Cortage)) + ' \t');
      w(tab(cellStr(item, 'stateName')) + ' \t');
      const inc = boolTrue(item.IsVatInc);
      const g = item.Gst_vat === undefined ? null : item.Gst_vat;
      if (inc && g === 'Vat') w(tab('VAT INC.') + ' \t');
      if (!inc && g === 'Vat') w(tab('VAT INC.') + ' \t');
      if (!inc && g === '') w(tab('VAT EXC.') + ' \t');
      if (inc && g === 'IGST') w(tab('IGST INC.') + ' \t');
      if (!inc && g === 'IGST') w(tab('IGST EXC.') + ' \t');
      if (inc && g === 'LGST') w(tab('LGST INC.') + ' \t');
      if (!inc && g === 'LGST') w(tab('LGST EXC.') + ' \t');
      if (inc && g === '') w(tab('VAT INC.') + ' \t');
      if (!inc && g === '0') w(tab('VAT EXC') + ' \t');
      if ((inc && g === '0') || g === null) w(tab('VAT INC.') + ' \t'); // (C# precedence: a && b || c)
      if (inc && g === null) w(tab('VAT INC.') + ' \t');
      if (!inc && g === null) w(tab('VAT EXC.') + ' \t');
      w(tab(cellStr(item, 'DumpName')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, string fromDate, string toDate, string FRCode,
//   string invoicetype, string State, string challan, string VendorName, int? page, int? ddlcustpage, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Purchased-Bill" -> PurchasedBill/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Purchased-Bill'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let orderbydate = nStr(req.p.orderbydate);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let FRCode = nStr(req.p.FRCode);
  let invoicetype = nStr(req.p.invoicetype);
  let State = nStr(req.p.State);
  let challan = nStr(req.p.challan);
  let VendorName = nStr(req.p.VendorName);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  const btnexel = nStr(req.p.btnexel);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (FRCode === null) FRCode = '';
  if (dynamicpagging === null) dynamicpagging = cfgInt16('DynamicPagging'); // Convert.ToInt16(AppSettings["DynamicPagging"])
  if (orderbydate === null) orderbydate = '';
  if (invoicetype === null) invoicetype = '';
  if (State === '') State = '0'; // (MVC binds "" as null, so this rarely fires; a null State => Convert.ToInt32(null) = 0)
  if (VendorName === null) VendorName = '';
  if (challan === null) challan = '';
  if (ddlcustpage === null) ddlcustpage = 1000;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const sid = cvtInt(State);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // dbo.usp_GetPurchase_Bill @StartRowIndex,@MaxRows,@fromDate,@toDate,@branch,@invoicetype,@State,@vendorName,@TotalCount out,@ChallanNo,@Mode,@orderbydate
  const rows = await db.proc(DB, 'usp_GetPurchase_Bill', {
    StartRowIndex: page, MaxRows, fromDate, toDate, branch: FRCode, invoicetype, State: sid, vendorName: VendorName, ChallanNo: challan, Mode: 1,
    orderbydate,
  });
  const PBillList = mapRows(rows, GET_PURCHASE_BILL_PROPS);
  const tc = str(col(rows[0], 'TotalCount'));
  const TotalRecord = parseInt(tc === '' ? '0' : tc, 10); // int.Parse(v == "" ? "0" : v)
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  ViewBag.CurrentPage = page;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.orderbydate = orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.FRCode = FRCode;
  ViewBag.invoicetype = invoicetype;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, fromDate, toDate, FRCode, invoicetype, State, challan, VendorName, page);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/PurchasedBill/Index.cshtml', Model: PBillList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult bind_Challan(string Prefix)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/bind_Challan{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Prefix = nStr(req.p.Prefix);
  // PORT-NOTE: legacy passed @State = "" (nvarchar) to the int parameter; SQL Server converts '' to 0, so 0 is passed here.
  const challan = mapRows(await db.proc(DB, 'usp_GetPurchase_Bill', {
    StartRowIndex: '1', MaxRows: '100', fromDate: '', toDate: '', branch: '', invoicetype: '', State: 0, vendorName: '', ChallanNo: Prefix, Mode: 2,
  }), GET_PURCHASE_BILL_PROPS);
  return res.json(challan);
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string FRCode, string invoicetype,
//   string State, string challan, string VendorName, int? page)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.FRCode), nStr(req.p.invoicetype), nStr(req.p.State),
    nStr(req.p.challan), nStr(req.p.VendorName), nInt(req.p.page));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
