'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ProductManagement.cs (class ProductManagementController => /admin/ProductManagement/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nstr, reqInt, toInt32, toDec, outStr, col, nre } = require('./_shared/batch02-common');
const { productIndex, productExportReport, productHandlers, productImage } = require('./_shared/batch13-02-common');

const router = express.Router();
const C = 'ProductManagement';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, int? page, string Prcode, string prname, string PCategory, string btnexel)
// auth (reads Session["Admin_User"] first; then Session["Admin_User"] == null || Session["Admin_User_Menu"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/ManageProduct" -> ProductManagement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ManageProduct'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // this controller tests USP_EXCEL_LINK's value against "0" (DBNull => "" => FormatException, like legacy)
  return productIndex(req, res, { url, viewPath: '~/Views/AdminPanel/ProductManagement/Index.cshtml', excelEmpty0: false });
}));

// ---------------------------------------------------------------- public void ExportReport(string Prcode, string prname, string PCategory)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await productExportReport(req, res, url, nstr(req.p.Prcode), nstr(req.p.prname), nstr(req.p.PCategory), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult BINDATTRIBUTE(int Main, int Category, int subcategory, int Mode, int DDID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/BINDATTRIBUTE{/:id}`, adminAuth, asyncHandler(productHandlers.BINDATTRIBUTE));

// ---------------------------------------------------------------- JsonResult Getkitdetils(int TKPMID)
// auth (PORT-NOTE: legacy had no session check)
router.all(`/admin/${C}/Getkitdetils{/:id}`, adminAuth, asyncHandler(productHandlers.Getkitdetils));

// ---------------------------------------------------------------- JsonResult DeleteProductforhamaramart(string PrCode)
// auth (PORT-NOTE: legacy had no session check; admin-only write)
router.all(`/admin/${C}/DeleteProductforhamaramart{/:id}`, adminAuth, asyncHandler(productHandlers.DeleteProductforhamaramart));

// ---------------------------------------------------------------- JsonResult Getattribute(int TKPMID)
// auth (PORT-NOTE: legacy had no session check)
router.all(`/admin/${C}/Getattribute{/:id}`, adminAuth, asyncHandler(productHandlers.Getattribute));

// ---------------------------------------------------------------- JsonResult Updateattribute(string MPAID, int Category, int PSCID, int PSSCID, string attr_name)
// auth (PORT-NOTE: legacy had no session check; admin-only write)
router.all(`/admin/${C}/Updateattribute{/:id}`, adminAuth, asyncHandler(productHandlers.Updateattribute));

// ---------------------------------------------------------------- JsonResult UpdateProduct(string TKPMID, ..., string PSCID, string PSSCID, string attr_name)
// auth (legacy dereferenced Session["Admin_User"] BEFORE its null check => NullReferenceException without a session;
//       the "This Page Has Been Expired" branch was unreachable)
router.all(`/admin/${C}/UpdateProduct{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  let PACKAGENAME = P('PACKAGENAME');
  let SUBSCRIPTIONDETAILS = P('SUBSCRIPTIONDETAILS');
  let RBV = P('RBV');
  let BUSINESSVOLUME = P('BUSINESSVOLUME');
  let HANDLINGFEE = P('HANDLINGFEE');
  let Ret = '0';
  if (PACKAGENAME === null) throw nre();
  PACKAGENAME = PACKAGENAME.split("'").join('');
  if (SUBSCRIPTIONDETAILS === null) throw nre();
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.split('lessthan').join('<').split('greatthan').join('>');
  SUBSCRIPTIONDETAILS = SUBSCRIPTIONDETAILS.replace(/<[\s\S]*?>/g, ''); // Regex.Replace(x, @"<(.|\n)*?>", "")
  // (MVC binds "" as null, so these "" tests never match; null => Convert.ToDecimal(null) = 0 - same result)
  if (RBV === '') RBV = '0';
  if (BUSINESSVOLUME === '') BUSINESSVOLUME = '0';
  if (HANDLINGFEE === '') HANDLINGFEE = '0';
  const imgname = await productImage(req, P('IMAGE'));
  // PORT-NOTE: legacy also did `new Kit_Master()` here (object unused).
  const BarCode = P('BarCode');
  const TKPMID = toInt32(P('TKPMID'));
  const MRP = toDec(P('MRP'));
  const DISCOUNT = toDec(P('DISCOUNT'));
  const DP = toDec(P('DP'));
  const BV = toDec(BUSINESSVOLUME);
  const RBVd = toDec(RBV);
  const GST = toInt32(P('GST'));
  const STATUS = toInt32(P('STATUS'));
  const HF = toDec(HANDLINGFEE);
  const PRCODE = 'PR-' + String(await UtilityClass.GetRandom(99999, 999999));
  if (BarCode === null) throw nre();
  // [DBO].[USP_CREATE_NEW_PIN_Product] @TKPMID,...,@STRRESULT out,@PRCODE,...,@PSCID,@PSSCID,@allAttributes
  const row = await db.procOne(DB, 'USP_CREATE_NEW_PIN_Product', {
    TKPMID, PACKAGENAME, MRP, DISCOUNT, DP, BUSINESSVOLUME: BV, RBV: RBVd, SUBSCRIPTIONDETAILS, GST, IMAGE: imgname, STATUS, HANDLINGFEE: HF,
    PRCODE, CATEGORY: P('Category'), BARCODE: BarCode.trim(), COLOR: P('color'), SIZE: P('size'), UNITID: P('ddlUnit'), UNIT: P('Unit'),
    BRANDID: P('DDLBrand'), HSNCODE: P('HSNCode'), PSCID: P('PSCID'), PSSCID: P('PSSCID'), allAttributes: P('attr_name'),
  });
  Ret = outStr(col(row, 'strresult'));
  return res.json(Ret);
}));

/** offertype => Tbl_KitProductMaster column (Kit_Product_Master property) */
const OFFER_COLUMNS = {
  chknewoffer: 'isnewoffer', chknewarrival: 'isnewarrival', chkbigsaving: 'isbigsaving', chkfestivaloffer: 'isfestivaloffer',
  chkquickshop: 'isquickshop', Isactive: 'status',
};

// ---------------------------------------------------------------- JsonResult updateoffer(int subprcode, int offer, string offertype)
// auth (PORT-NOTE: legacy had no session check; admin-only write)
router.all(`/admin/${C}/updateoffer{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const subprcode = reqInt(req.p.subprcode, 'subprcode');
  const offer = reqInt(req.p.offer, 'offer');
  const offertype = nstr(req.p.offertype);
  let ret = 'NotOk';
  // var pms = db._Kit_Product_Master.Where(a => a.TKPMID == subprcode).FirstOrDefault();
  const column = Object.prototype.hasOwnProperty.call(OFFER_COLUMNS, offertype) ? OFFER_COLUMNS[offertype] : null;
  let count = 0;
  if (column !== null) {
    const pms = await db.queryOne(DB, `select tkpmid, ${column} as v from tbl_kitproductmaster where tkpmid = @subprcode limit 1`, { subprcode });
    if (!pms) throw nre(); // pms.X = offer on null
    // EF SaveChanges only writes (and counts) when the value actually changed
    if (Number(col(pms, 'v')) !== offer) {
      count = await db.exec(DB, `update tbl_kitproductmaster set ${column} = @offer where tkpmid = @subprcode`, { offer, subprcode });
    }
  }
  if (count > 0) ret = 'ok';
  return res.json(ret);
}));

module.exports = router;
