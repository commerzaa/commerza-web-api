'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Vender_List.cs (class Vender_ListController => /admin/Vender_List/...)
// Database: affiliate (Db_Affiliate). Tables: tbl_vendor_master (vendor_master), tbl_vendor_heads (Vendor_Heads_Master).
//
// Coverage: Index (session check) -> route ; ExportReport (public void => routable) -> route + internal function (used by Index) ;
//           CreditOnVendor, Deactivate_Vendor, UpdateHead, GetVendorDetail, UpdateVendor (JsonResult) -> routes.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson, sendVoid } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Vender_List';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class VendorList */
const VENDORLIST_PROPS = ['rownumber', 'vmID', 'vendorId', 'vendorType', 'vendorName', 'vendorEmail', 'vendorMobile', 'vendorPanno', 'balance',
  'monthlyPurchase', 'totalPurchase', 'createDate', 'vendor_address', 'stateName', 'Totalvendor', 'GST_No', 'Vendor_ctid', 'vendor_tinno',
  'Pincode'];
/** class CategoryMasterDetails (Controllers/AdminPanel/CategoryMaster.cs) */
const CATEGORY_PROPS = ['ROWNUMBER', 'PCMID', 'Status1', 'Status', 'Name', 'Category', 'Remark', 'Date', 'Added_by'];
/** entity vendor_master (Models/vendor_master.cs, table tbl_vendor_master) */
const VENDOR_MASTER_PROPS = ['vmid', 'vendor_id', 'vendor_type', 'vendor_name', 'vendor_email', 'vendor_mobile', 'vendor_panno', 'vendor_tinno',
  'vendor_address', 'Pincode', 'vendor_sid', 'Vendor_ctid', 'vendor_password', 'vendor_createdate', 'credit_days', 'balance', 'funds_locked',
  'monthly_purch', 'total_purch', 'ServiceTaxNo', 'active', 'isDelete', 'GST_No'];

/** dbo.usp_GetVendor_List @StartRowIndex,@MaxRows,@Vendortype,@SearchField,@SearchValue,@TotalCount out,@GST_No */
function vendorList(page, MaxRows, Vendortype, SearchField, SearchValue, GST_No) {
  return db.proc(DB, 'usp_GetVendor_List', { StartRowIndex: page, MaxRows, Vendortype, SearchField, SearchValue, GST_No });
}

/** Regex.Replace(x, "\t", "    ") with Regex.Replace(null) => ArgumentNullException */
function rx(v) {
  if (v === null || v === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
  return B.tab(v instanceof Date ? B.netDateString(v) : String(v));
}

// public void ExportReport(string Vendortype, string SearchField, string SearchValue, int? page, string GST_No)
// (writes ~/Vender_List.xls on the server only; no download response; every exception is swallowed)
async function ExportReport(Vendortype, SearchField, SearchValue, page, GST_No) {
  if (Vendortype === null) Vendortype = '';
  if (GST_No === null) GST_No = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  try {
    let MaxRows = await UtilityClass.GridPageSize();
    MaxRows = 1000; void MaxRows;
    if (page === null) page = 1;
    const VList = mapRows(await vendorList(page, 999999, Vendortype, SearchField, SearchValue, GST_No), VENDORLIST_PROPS);
    if (VList.length > 0) {
      const filepath = B.mapPath('~/Vender_List.xls');
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      // PORT-NOTE: new StreamWriter(filepath) creates the file; on an exception inside the loop the legacy writer was never closed
      // (buffered text lost) - here the file is created empty first and only the complete content is written on success.
      fs.writeFileSync(filepath, '');
      let out = '';
      const wr = (x) => { out += x; };
      for (const h of ['SrNo', 'V.Id', 'Type', 'Name', 'EmailID', 'ContactNo', 'PanNo', 'Date', 'Address', 'City', 'Pincode', 'State', 'GST No', 'TIN No']) {
        wr(`${h} \t`);
      }
      for (const item of VList) {
        wr('\n');
        wr(B.tab(B.cellStr(item, 'rownumber')) + ' \t');
        wr(B.tab(B.cellStr(item, 'vendorId')) + ' \t');
        wr(rx(item.vendorType) + ' \t');
        wr(rx(item.vendorName) + ' \t');
        wr(rx(item.vendorEmail) + ' \t');
        wr(rx(item.vendorMobile) + ' \t');
        wr(rx(item.vendorPanno) + ' \t');
        wr(rx(item.createDate) + ' \t');
        const s = item.vendor_address;
        if (s === null || s === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
        const replacement = String(s).replace(/\t|\n|\r/g, '');
        wr(B.tab(replacement) + ' \t');
        wr(rx(item.Vendor_ctid) + ' \t');
        wr(rx(item.Pincode) + ' \t');
        wr(rx(item.stateName) + ' \t');
        wr(rx(item.GST_No) + ' \t');
        wr(rx(item.vendor_tinno) + ' \t');
      }
      fs.writeFileSync(filepath, out);
    }
  } catch (ex) {
    // catch (Exception ex) { } - swallowed
  }
}

// ---------------------------------------------------------------- Index(string Vendortype, string SearchField, string SearchValue, string btnexel, int? page, string GST_No)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Vendor-List" -> Vender_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Vendor-List'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let Vendortype = B.nStr(req.p.Vendortype);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  const btnexel = B.s0(req.p.btnexel);
  let page = B.nInt(req.p.page);
  let GST_No = B.nStr(req.p.GST_No);
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // USP_EXCEL_LINK @url,@ISACTIVE out  (result ignored: isactive = 0)
  await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const isactive = 0;
  ViewBag.excelactive = isactive;
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
  const p = await B.inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (Vendortype === null) Vendortype = '';
  if (GST_No === null) GST_No = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  let MaxRows = await UtilityClass.GridPageSize();
  MaxRows = 1000;
  if (page === null) page = 1;
  const VList = mapRows(await vendorList(page, MaxRows, Vendortype, SearchField, SearchValue, GST_No), VENDORLIST_PROPS);
  // DBO.USP_GetCategoryDetails @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@TOTALCOUNT out,@Category
  const CategoryMasterDetails = mapRows(await db.proc(DB, 'USP_GetCategoryDetails', {
    fromDate: '', toDate: '', MAXROWS: 100, STARTROWINDEX: 1, Category: '',
  }), CATEGORY_PROPS);
  ViewBag.CategoryMaster = CategoryMasterDetails;
  if (btnexel === 'Export Excel') {
    await ExportReport(Vendortype, SearchField, SearchValue, page, GST_No);
  }
  return viewJson(res, '~/Views/AdminPanel/Vender_List/Index.cshtml', VList, ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport(string Vendortype, string SearchField, string SearchValue, int? page, string GST_No)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  await ExportReport(v('Vendortype'), v('SearchField'), v('SearchValue'), B.nInt(req.p.page), v('GST_No'));
  return sendVoid(res, { sent: false });
}));

// ---------------------------------------------------------------- JsonResult CreditOnVendor(string vender, decimal amount)
// auth (reads Session["Admin_User"] first - legacy NullReference without a session)
router.all(`/admin/${C}/CreditOnVendor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const vender = B.nStr(req.p.vender);
  const amount = B.reqDec(req.p.amount, 'amount');
  const empcode = req.user.emp_code; void empcode; // (unused, like legacy; new UtilityClass() unused too)
  let retvalue = '';
  // dbo.usp_CreditOnVendor @VenderId,@crAmount,@strResult out
  const row = await db.procOne(DB, 'usp_CreditOnVendor', { VenderId: vender, crAmount: amount });
  retvalue = B.str(B.col(row, 'strresult'));
  return res.json(retvalue);
}));

// ---------------------------------------------------------------- JsonResult Deactivate_Vendor(string vendorId)
// auth (reads Session["Admin_User"] first - legacy NullReference without a session)
router.all(`/admin/${C}/Deactivate_Vendor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const vendorId = B.nStr(req.p.vendorId);
  const empcode = req.user.emp_code; void empcode;
  let retvalue = '';
  // db._vendor_master.Where(a => a.vendor_id == vendorId).FirstOrDefault()
  const rows = await db.queryOne(DB, 'select vmid from tbl_vendor_master where vendor_id is not distinct from @vendorId limit 1', { vendorId });
  if (rows !== null) {
    await db.exec(DB, 'update tbl_vendor_master set active = false where vmid = @vmid', { vmid: B.col(rows, 'vmid') });
    retvalue = 'success';
  } else {
    retvalue = 'Some Error occured, Please try later';
  }
  return res.json(retvalue);
}));

// ---------------------------------------------------------------- JsonResult UpdateHead(string vendortype, string newvendortype)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateHead{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const vendortype = B.nStr(req.p.vendortype);
  const newvendortype = B.nStr(req.p.newvendortype);
  let retvalue = '';
  // EF: ForEach(a => a.vendor_type = newvendortype) + first Vendor_Heads_Master row .Vtype = newvendortype ; one SaveChanges (one transaction)
  await db.tx(DB, async (t) => {
    await t.exec('update tbl_vendor_master set vendor_type = @newvendortype where vendor_type is not distinct from @vendortype',
      { newvendortype, vendortype });
    const row = await t.queryOne('select vhid from tbl_vendor_heads where vtype is not distinct from @vendortype limit 1', { vendortype });
    if (row !== null) {
      await t.exec('update tbl_vendor_heads set vtype = @newvendortype where vhid = @vhid', { newvendortype, vhid: B.col(row, 'vhid') });
    }
  });
  retvalue = 'Ok';
  return res.json(retvalue);
}));

// ---------------------------------------------------------------- JsonResult GetVendorDetail(string vendorId)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetVendorDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const vendorId = B.nStr(req.p.vendorId);
  const row = await db.queryOne(DB,
    'select * from tbl_vendor_master where vendor_id is not distinct from @vendorId and active::int = 1 and isdelete::int = 0 limit 1', { vendorId });
  if (row === null) return res.type('application/json').send(''); // Json(null) => empty body
  // PORT-NOTE: the legacy JSON included the whole entity (vendor_password too) - kept for contract parity.
  return res.json(mapRow(row, VENDOR_MASTER_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateVendor(string vendorId, string vendorName, string vendorEmail, string vendorMobile, string vendorPanno, string vendorTinNo, string vendorAddress, string vendorPass, int stateid, string city, string pincode, string servicetax, string ventype, string GST_No)
// auth (reads Session["Admin_User"] after the update - legacy NullReference without a session)
router.all(`/admin/${C}/UpdateVendor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const stateid = B.reqInt(req.p.stateid, 'stateid');
  const vendorId = v('vendorId');
  let Retvalue = '';
  const row = await db.queryOne(DB,
    'select vmid from tbl_vendor_master where vendor_id is not distinct from @vendorId and isdelete::int = 0 and active::int = 1 limit 1', { vendorId });
  if (row !== null) {
    await db.exec(DB, `update tbl_vendor_master set vendor_name = @vendorName, vendor_email = @vendorEmail, vendor_mobile = @vendorMobile,
        vendor_panno = @vendorPanno, vendor_tinno = @vendorTinNo, vendor_address = @vendorAddress, vendor_password = @vendorPass,
        vendor_sid = @stateid, vendor_ctid = @city, pincode = @pincode, gst_no = @GST_No, servicetaxno = @servicetax, vendor_type = @ventype
      where vmid = @vmid`, {
      vendorName: v('vendorName'), vendorEmail: v('vendorEmail'), vendorMobile: v('vendorMobile'), vendorPanno: v('vendorPanno'),
      vendorTinNo: v('vendorTinNo'), vendorAddress: v('vendorAddress'), vendorPass: v('vendorPass'), stateid, city: v('city'),
      pincode: v('pincode'), GST_No: v('GST_No'), servicetax: v('servicetax'), ventype: v('ventype'), vmid: B.col(row, 'vmid'),
    });
    Retvalue = 'success';
    const empcode = req.user.emp_code; void empcode; // (unused, like legacy)
  } else {
    Retvalue = 'Some error occurred. Please try later !';
  }
  return res.json(Retvalue);
}));

module.exports = router;
