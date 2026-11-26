// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Add_Product.cs (class Add_ProductController; DB: Db_Shopping, via ProductDal/CategoryDAL)
// Started from src/modules/merchant/add-product.js; portal differences: no Specification/YWillRece/BV/PV/... parameters, ImageUploadMasterMethodEComm
// (no semi-large folder), no maincatlist / FixedFee / checksellingpricelist, GetDivStatus starts with "hide".
// SessionExpireCheck.OnActionExecuting (Session["Plid"] == null => Redirect("~/")) is ps.SessionExpireCheck.
'use strict';
const express = require('express');
const path = require('path');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ProductDal = require('../../lib/portal/ProductDal');
const CategoryDAL = require('../../lib/portal/CategoryDal');
const Main_Product_Category = require('../../lib/portal/Main_Product_Category');
const Tbl_Product_Category = require('../../lib/portal/Tbl_Product_Category');

const router = express.Router();
const P = '/portal/Add_Product';

// AppSettings["OriginalProductImage"] / AppSettings["ThumbNailProductImage"]
const OriginalImageFolder = () => (config.app.OriginalProductImage || '');
const ThumbNailImageFolder = () => (config.app.ThumbNailProductImage || '');

/** Convert.ToInt32(decimal) (banker's rounding) */
function decToInt32(d) {
  const f = Math.floor(d);
  const diff = d - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
/** Convert.ToDecimal(string): null => 0, otherwise FormatException on bad input */
function toDecimalStr(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw c.FormatError();
  return Number(t);
}
/** Regex.Replace(null, ...) => ArgumentNullException */
const argNull = (name) => new Error(`Value cannot be null.\r\nParameter name: ${name}`);

/** public string saveImage(string imgecode, string titlename, string SellerCode) */
async function saveImage(imgecode, titlename, SellerCode) {
  if (titlename === null || titlename === undefined) throw argNull('input');
  titlename = String(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  if (imgecode === null || imgecode === undefined) throw c.NRE();
  const getcolltionimage = String(imgecode).split('^');
  for (const items of getcolltionimage) {
    let IdForAppend = '';
    IdForAppend = String(SellerCode === null || SellerCode === undefined ? '' : SellerCode) + '_' + titlename.trim();
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodEComm(items, OriginalImageFolder(), ThumbNailImageFolder(), UtilityClass.ImageMode.Both, IdForAppend);
      if (c.str(getnewfilename).trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      if (returnfilename.trim() === '') returnfilename = path.win32.basename(items);
      else returnfilename = returnfilename + '^' + path.win32.basename(items);
    }
  }
  return returnfilename;
}

/** public string GetDivStatus(List<DynamicFields> Obj, string DivId) */
function GetDivStatus(Obj, DivId) {
  let Status = 'hide';
  if (Obj === null || Obj === undefined) throw c.NRE();
  for (const Items of Obj) {
    if (Items.CHECKED === null || Items.CHECKED === undefined) throw c.NRE();
    if (String(Items.CHECKED).toLowerCase() === 'checked') {
      if (Items.DIVID === null || Items.DIVID === undefined || DivId === null || DivId === undefined) throw c.NRE();
    }
    if (String(Items.CHECKED).toLowerCase() === 'checked' && String(Items.DIVID).toLowerCase() === String(DivId).toLowerCase()) {
      Status = 'show';
      break;
    } else {
      Status = 'hide';
    }
  }
  return Status;
}

/** MVC binding of List<DynamicFields> Obj: JSON array (body.Obj) or form keys Obj[0].CHECKED ...; nothing posted => null */
function bindDynamicFields(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const all = { ...(req.query || {}), ...body };
  const key = Object.keys(all).find((k) => k.toLowerCase() === 'obj');
  if (key !== undefined && Array.isArray(all[key])) return all[key].map((o) => ({ ...(o || {}) }));
  const list = [];
  for (const k of Object.keys(all)) {
    const m = /^obj\[(\d+)\]\.(\w+)$/i.exec(k);
    if (!m) continue;
    const i = Number(m[1]);
    list[i] = list[i] || {};
    const prop = ['ROWNUMBER', 'TCFMID', 'TFMID', 'FIELDNAME', 'DIVID', 'FIELDTYPE', 'DEFAULTVALUE', 'STATUS', 'ACTIVE', 'ISMANDATORY', 'CHECKED']
      .find((x) => x.toLowerCase() === m[2].toLowerCase()) || m[2];
    list[i][prop] = all[k];
  }
  if (!list.length) return null;
  // the default binder stops at the first missing index
  const out = [];
  for (let i = 0; i < list.length && list[i]; i++) out.push(list[i]);
  return out;
}

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/addorupdateproduct{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  // non-nullable action parameters: a missing/invalid value fails model binding before the action runs
  const SPRID = c.bindInt(req, 'SPRID', 'System.Int64');
  const MPRID = c.bindInt(req, 'MPRID', 'System.Int64');
  const CompanyID = c.bindInt(req, 'CompanyID');
  const catid = c.bindInt(req, 'catid');
  const subcatid = c.bindInt(req, 'subcatid');
  const brandid = c.bindInt(req, 'brandid');
  const isAllowCoupon = b.bindBool(req, 'isAllowCoupon');
  const minOrderQty = c.bindInt(req, 'minOrderQty');
  const maxOrderQty = c.bindInt(req, 'maxOrderQty');
  const sellMRP = b.bindDecimal(req, 'sellMRP');
  const discountPer = b.bindDecimal(req, 'discountPer');
  const quantity = c.bindInt(req, 'quantity');
  const vcid = c.bindInt(req, 'vcid');
  const VATP = b.bindDecimal(req, 'VATP');
  const directAmt = b.bindDecimal(req, 'directAmt');
  const DAP = b.bindDecimal(req, 'DAP');
  const shippingcharges = b.bindDecimal(req, 'shippingcharges');
  const StockIn = c.bindInt(req, 'StockIn');
  const ReplacementDay = c.bindInt(req, 'ReplacementDay');
  const ProcurementSLA = c.bindInt(req, 'ProcurementSLA');
  const CashOnDelivery = b.bindBool(req, 'CashOnDelivery');
  const WarrantyInfoCare = c.bindInt(req, 'WarrantyInfoCare');
  const s = (n) => b.mvcStr(req, n);
  const SubProductCode = s('SubProductCode'); const prodTitle = s('prodTitle'); const fromdate = s('fromdate'); const todate = s('todate');
  const shrtdesc = s('shrtdesc'); let FullDesc = s('FullDesc'); const paymentmode = s('paymentmode'); const prodUnit = s('prodUnit');
  const color = s('color'); const size = s('size'); const Attributes = s('Attributes'); let imageByteCode = s('imageByteCode');
  const KeyFeatures = s('KeyFeatures'); const Pkg_Weight_Kg = s('Pkg_Weight_Kg'); const Pkg_Length_cms = s('Pkg_Length_cms');
  const Pkg_Breadth_cms = s('Pkg_Breadth_cms'); const Pkg_Height_cms = s('Pkg_Height_cms');

  let returnmess = '';
  try {
    const DealsIds = '';
    const GroupId = '';
    const ProductCode = '';
    const Plid = c.toInt32(req.user.plid);
    if (FullDesc === null) throw c.NRE();
    FullDesc = c.csReplace(FullDesc, '+#!#+', '<');
    FullDesc = c.csReplace(FullDesc, '+!#!+', '>');
    const dal = new ProductDal();
    if (imageByteCode === null) throw c.NRE();
    imageByteCode = c.csReplace(imageByteCode, 'hariOmNamahshivay', '^');
    let productimagename = '';
    let SellerCode = '';
    SellerCode = String(Plid); // db._Branch lookup commented out in legacy
    productimagename = await saveImage(imageByteCode, prodTitle, SellerCode);

    returnmess = await dal.AddUpdateProduct(Plid, paymentmode, SPRID, MPRID, CompanyID, catid, subcatid, brandid, ProductCode, SubProductCode, prodTitle,
      fromdate, todate, shrtdesc, FullDesc, isAllowCoupon, minOrderQty, maxOrderQty, paymentmode,
      sellMRP, discountPer, quantity, prodUnit, color, size, Attributes, vcid,
      VATP, directAmt, decToInt32(DAP), shippingcharges, productimagename, KeyFeatures, StockIn,
      ReplacementDay, ProcurementSLA, CashOnDelivery, toDecimalStr(Pkg_Weight_Kg), toDecimalStr(Pkg_Length_cms),
      toDecimalStr(Pkg_Breadth_cms), toDecimalStr(Pkg_Height_cms), WarrantyInfoCare, DealsIds, GroupId);
  } catch (ex) {
    returnmess = String(ex.message);
  }
  res.json(returnmess);
}));

// auth ([SessionExpireCheck])
// route-config: merchant/add-product -> Add_Product/Index ; merchant/add-product/{PrId}/{SubPr} -> add_product/Index (PrId, SubPr optional)
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/add-product{/:PrId}{/:SubPr}'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const PrId = b.mvcStr(req, 'PrId');
  let SubPr = b.mvcStr(req, 'SubPr');
  const NewAdd = b.mvcStr(req, 'NewAdd');
  const isEmpty = (v) => v === null || v === undefined || v === '';
  const pdal = new ProductDal();
  let pobj = b.PRODUCT_FULL_DETAIL_DEFAULT();
  const cdal = new CategoryDAL();
  if (SubPr === '' || SubPr === null) SubPr = '';
  let SPRID = 0; let MPRID = 0;
  SPRID = isEmpty(SubPr) ? 0 : c.toInt64(SubPr);
  MPRID = isEmpty(NewAdd) ? 0 : c.toInt64(NewAdd);
  const ViewBag = {};
  ViewBag.SPRID = SPRID;
  const mpcatde = new Main_Product_Category();
  const pdcs = new Tbl_Product_Category();
  const hasVal = (v) => v !== null && v !== undefined;

  if ((isEmpty(PrId) && !isEmpty(SubPr)) || !isEmpty(NewAdd)) {
    pobj = await pdal.GetProudctDetail(SPRID, MPRID);
    // the lib returns {} when the query failed (legacy kept new ProductFullDetail())
    if (pobj && typeof pobj === 'object' && Object.keys(pobj).length === 0) pobj = b.PRODUCT_FULL_DETAIL_DEFAULT();
    if (pobj !== null && pobj !== undefined) {
      const rowsubcat = await cdal.GetProductSubCategoryDetail(c.toInt32(pobj.SubCategoryId));
      if (rowsubcat !== null && rowsubcat !== undefined) {
        ViewBag.CatName = rowsubcat.subcatname;
        ViewBag.CatId = rowsubcat.maincatId; // Added for finding the category of the product for dynamic field view
        ViewBag.productType = 'subcat';
        ViewBag.productID = rowsubcat.subcatId;
        if (hasVal(rowsubcat.AdminCharge)) {
          ViewBag.AdminCharge = rowsubcat.AdminCharge;
        } else {
          const row2 = (await pdcs.Product_Category_List()).find((a) => Number(a.catId) === Number(rowsubcat.catId));
          if (!row2) throw c.NRE();
          ViewBag.CatId = row2.maincatId;
          ViewBag.AdminCharge = row2.AdminCharge;
          ViewBag.DelieveryCharge = row2.DelieveryCharge;
          ViewBag.HandlingCharge = row2.HandlingCharge;
        }
      } else {
        const row = await cdal.GetProductCategoryDetail(c.toInt32(pobj.catid));
        if (!row) throw c.NRE();
        ViewBag.CatId = row.maincatId;
        ViewBag.CatName = row.catname;
        ViewBag.productType = 'cat';
        ViewBag.productID = row.catId;
        if (hasVal(row.AdminCharge)) {
          ViewBag.AdminCharge = row.AdminCharge;
        } else {
          const row2 = (await mpcatde.mainProduct_Category_List()).find((a) => Number(a.maincatId) === Number(row.maincatId));
          if (!row2) throw c.NRE();
          ViewBag.AdminCharge = row2.AdminCharge;
        }
      }
    }
  } else {
    const row = await cdal.GetProductCategoryDetail(PrId === null ? null : String(PrId));
    if (row !== null && row !== undefined) {
      ViewBag.CatName = row.catname;
      ViewBag.productType = 'cat';
      ViewBag.productID = row.catId;
      ViewBag.CatId = row.maincatId;
      if (hasVal(row.AdminCharge)) {
        ViewBag.AdminCharge = row.AdminCharge;
      } else {
        const row2 = (await mpcatde.mainProduct_Category_List()).find((a) => Number(a.maincatId) === Number(row.maincatId));
        if (!row2) throw c.NRE();
        ViewBag.AdminCharge = row2.AdminCharge;
      }
    } else {
      const rowsubcat = await cdal.GetProductSubCategoryDetail(PrId === null ? null : String(PrId));
      if (rowsubcat !== null && rowsubcat !== undefined) {
        ViewBag.CatId = rowsubcat.maincatId;
        ViewBag.CatName = rowsubcat.subcatname;
        ViewBag.productType = 'subcat';
        ViewBag.productID = rowsubcat.subcatId;
        if (hasVal(rowsubcat.AdminCharge)) {
          ViewBag.AdminCharge = rowsubcat.AdminCharge;
        } else {
          const row2 = (await pdcs.Product_Category_List()).find((a) => Number(a.catId) === Number(rowsubcat.catId));
          if (!row2) throw c.NRE();
          ViewBag.CatId = row2.maincatId;
          ViewBag.AdminCharge = row2.AdminCharge;
        }
      }
    }
  }
  return c.viewJson(res, '~/Views/CustomerPanel/Add_Product/Index.cshtml', pobj, ViewBag);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/ProductCodeCheck{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let pb = { Message: null, ReturnValue: null, Success: null };
  const dal = new ProductDal();
  pb = await dal.ProductCodeCheck(b.mvcStr(req, 'ProductCode'));
  res.json(pb);
}));

// auth (public string action without [SessionExpireCheck] in legacy; protected here because it writes image files)
router.all(`${P}/saveImage{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const ret = await saveImage(b.mvcStr(req, 'imgecode'), b.mvcStr(req, 'titlename'), b.mvcStr(req, 'SellerCode'));
  res.type('text/html').send(ret);
}));

// public (public string action without a session check; pure computation)
router.all(`${P}/GetDivStatus{/:id}`, asyncHandler(async (req, res) => {
  const ret = GetDivStatus(bindDynamicFields(req), b.mvcStr(req, 'DivId'));
  res.type('text/html').send(ret);
}));

module.exports = router;
