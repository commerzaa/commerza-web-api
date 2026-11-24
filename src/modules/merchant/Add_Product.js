'use strict';
// Port of Merchant Panel\Controllers\CustomerPanel\Add_Product.cs (Add_ProductController: addorupdateproduct, Index, ProductCodeCheck, saveImage,
// GetDivStatus, checksellingpricelist; SessionExpireCheck.OnActionExecuting is the auth middleware) - DB: shopping (Db_Shopping)
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const ProductDal = require('../../lib/merchant/ProductDal');
const CategoryDAL = require('../../lib/merchant/CategoryDal');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/Add_Product';

// PORT-NOTE: model classes Main_Product_Category (file "Main_ Product_Category.cs") and Tbl_Product_Category are expected in lib/merchant (class export, instance methods).
function requireAny(names) {
  for (const n of names) { try { return require('../../lib/merchant/' + n); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
  throw new Error('lib not found: ' + names.join(' | '));
}
const OriginalImageFolder = config.app.OriginalProductImage;
const SemiLargeImageFolder = config.app.SemiLargeProductImage || '';
const ThumbNailImageFolder = config.app.ThumbNailProductImage;
const s = (v) => (v === undefined || v === null ? '' : String(v));
const bool = (v) => String(v).toLowerCase() === 'true';
const fmt2 = (v) => (v === undefined || v === null || v === '' ? '' : Number(v).toFixed(2));
const isEmpty = (v) => v === undefined || v === null || v === '';
const baseName = (p) => String(p).split(/[\\/]/).pop();
// Convert.ToDecimal(string)
function toDecimal(v) {
  if (v === undefined || v === null || String(v).trim() === '') {
    if (v === undefined || v === null) return 0; // Convert.ToDecimal(null) => 0
    throw new Error('Input string was not in a correct format.');
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
function reqInt(v) { const n = parseInt(v, 10); if (Number.isNaN(n)) throw new Error('Value was either too large or too small, or not a valid number.'); return n; }
function reqDec(v) { const n = Number(v); if (v === undefined || v === null || v === '' || Number.isNaN(n)) throw new Error('Value was either too large or too small, or not a valid number.'); return n; }
const optDec = (v, d) => (v === undefined || v === null || v === '' ? d : reqDec(v));

// public string saveImage(string imgecode, string titlename, string SellerCode)
async function saveImage(imgecode, titlename, SellerCode) {
  titlename = String(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = String(imgecode).split('^');
  for (const items of getcolltionimage) {
    const IdForAppend = SellerCode + '_' + titlename.trim();
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, SemiLargeImageFolder, ThumbNailImageFolder, UtilityClass.ImageMode.Both, IdForAppend);
      if (s(getnewfilename).trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      if (returnfilename.trim() === '') returnfilename = baseName(items);
      else returnfilename = returnfilename + '^' + baseName(items);
    }
  }
  return returnfilename;
}

// public string GetDivStatus(List<DynamicFields> Obj, string DivId)
function GetDivStatus(Obj, DivId) {
  let Status = 'show';
  for (const Items of Obj || []) {
    if (String(Items.CHECKED).toLowerCase() === 'checked' && String(Items.DIVID).toLowerCase() === String(DivId).toLowerCase()) {
      Status = 'show';
      break;
    } else {
      Status = 'hide';
    }
  }
  return Status;
}

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(P + '/addorupdateproduct{/:id}', ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  let returnmess = '';
  try {
    const DealsIds = '';
    const GroupId = '';
    const ProductCode = '';
    const Plid = parseInt(req.user.plid, 10);
    // model binding of the typed (non-optional) parameters: a missing/invalid value fails the action in MVC
    const SPRID = reqInt(p.SPRID); const MPRID = reqInt(p.MPRID);
    let FullDesc = s(p.FullDesc);
    if (p.FullDesc == null) throw new TypeError('Object reference not set to an instance of an object.');
    FullDesc = FullDesc.split('+#!#+').join('<');
    FullDesc = FullDesc.split('+!#!+').join('>');
    if (p.Specification == null) throw new TypeError('Object reference not set to an instance of an object.');
    let Specification = s(p.Specification);
    Specification = Specification.split('+#!#+').join('<');
    Specification = Specification.split('+!#!+').join('>');
    if (p.KeyFeatures == null) throw new TypeError('Object reference not set to an instance of an object.');
    let KeyFeatures = s(p.KeyFeatures);
    KeyFeatures = KeyFeatures.split('+#!#+').join('<');
    KeyFeatures = KeyFeatures.split('+!#!+').join('>');
    const objPDal = new ProductDal();
    if (p.imageByteCode == null) throw new TypeError('Object reference not set to an instance of an object.');
    const imageByteCode = s(p.imageByteCode).split('hariOmNamahshivay').join('^');
    let SellerCode = '';
    SellerCode = String(Plid);
    const productimagename = await saveImage(imageByteCode, p.prodTitle, SellerCode);
    const paymentmode = p.paymentmode;
    returnmess = await objPDal.AddUpdateProduct(Plid, paymentmode, SPRID, MPRID, reqInt(p.CompanyID), reqInt(p.catid),
      reqInt(p.subcatid), reqInt(p.brandid), ProductCode, p.SubProductCode, p.prodTitle, p.fromdate, p.todate, p.shrtdesc, FullDesc,
      bool(p.isAllowCoupon), reqInt(p.minOrderQty), reqInt(p.maxOrderQty), paymentmode,
      reqDec(p.sellMRP), reqDec(p.discountPer), reqInt(p.quantity), p.prodUnit, p.color, p.size, p.Attributes, reqInt(p.vcid),
      reqDec(p.VATP), reqDec(p.directAmt), reqDec(p.DAP), reqDec(p.shippingcharges), productimagename, KeyFeatures, reqInt(p.StockIn),
      reqInt(p.ReplacementDay), reqInt(p.ProcurementSLA), bool(p.CashOnDelivery), toDecimal(p.Pkg_Weight_Kg), toDecimal(p.Pkg_Length_cms),
      toDecimal(p.Pkg_Breadth_cms), toDecimal(p.Pkg_Height_cms), reqInt(p.WarrantyInfoCare), DealsIds, GroupId, reqDec(p.YWillRece), p.ismerchantstatus,
      p.productentry, p.packerdetail, p.importerdetail, p.manufacturedetail, p.hsn, p.luxurycess, p.procurementsla1, p.ddlseller, p.ddlprocurement,
      Specification, p.productSKUCode, optDec(p.BV, 0), optDec(p.PV, 0), optDec(p.CASHBACK, 0), optDec(p.ActivationPv, 0));
  } catch (ex) {
    returnmess = String(ex.message);
  }
  res.json(returnmess);
}));

// auth ([SessionExpireCheck])
// route-config: merchant/add-product  and  merchant/add-product/{PrId}/{SubPr}
router.all([P + '/Index{/:id}', '/merchant/add-product', '/merchant/add-product/:PrId/:SubPr'], ...guard, asyncHandler(async (req, res) => {
  const PrId = req.p.PrId;
  let SubPr = req.p.SubPr;
  const NewAdd = req.p.NewAdd;
  const pdal = new ProductDal();
  const cdal = new CategoryDAL();
  let pobj = {};
  const Main_Product_Category = requireAny(['Main_Product_Category', 'Main_ Product_Category']);
  const Tbl_Product_Category = requireAny(['Tbl_Product_Category']);
  if (SubPr === '' || SubPr === null || SubPr === undefined) SubPr = '';
  SubPr = s(SubPr);
  const SPRID = SubPr === '' ? 0 : reqInt(SubPr);
  const MPRID = isEmpty(NewAdd) ? 0 : reqInt(NewAdd);
  const V = { SPRID };

  const mpcatde = new Main_Product_Category();
  const pdcs = new Tbl_Product_Category();

  const mpcatdelist = mapRows(await db.query(DB,
    `SELECT MAINCATID AS MAINCATID, MAINCATNAME AS MAINCATNAME FROM TBL_MAIN_CATEGORY WHERE MAINCATID
     IN( SELECT CATID FROM KEYWORD_MASTER WHERE SCATID::text IN
     (SELECT trim(x) FROM unnest(string_to_array((SELECT SUBCATEGORY FROM TBL_MERCHANTCAT_SUBCAT_KEYWORDMASTER
     WHERE PLID = @plid LIMIT 1), ',')) AS x)) ORDER BY SEQUENCE LIMIT 100`, { plid: String(req.user.plid) }), ['maincatId', 'maincatname']);
  V.maincatlist = mpcatdelist;

  if ((isEmpty(PrId) && SubPr !== '') || !isEmpty(NewAdd)) {
    pobj = await pdal.GetProudctDetail(SPRID, MPRID);
    if (pobj !== null && pobj !== undefined) {
      const rowsubcat = await cdal.GetProductSubCategoryDetail(pobj.SubCategoryId);
      if (rowsubcat) {
        V.CatName = rowsubcat.subcatname;
        V.CatId = rowsubcat.maincatId;
        V.productType = 'subcat';
        V.productID = rowsubcat.subcatId;
        if (rowsubcat.AdminCharge !== null && rowsubcat.AdminCharge !== undefined) {
          V.AdminCharge = rowsubcat.AdminCharge;
          V.DelieveryCharge = rowsubcat.DelieveryCharge;
          V.HandlingCharge = fmt2(rowsubcat.HandlingCharge);
          V.FixedFee = fmt2(rowsubcat.FixedFee);
        } else {
          const row2 = (await pdcs.Product_Category_List()).find((a) => a.catId === rowsubcat.catId);
          V.CatId = row2.maincatId;
          V.AdminCharge = row2.AdminCharge;
          V.DelieveryCharge = row2.DelieveryCharge;
          V.HandlingCharge = fmt2(row2.HandlingCharge);
          V.FixedFee = fmt2(row2.FixedFee);
        }
      } else {
        const row = await cdal.GetProductCategoryDetail(pobj.catid);
        V.CatId = row.maincatId;
        V.CatName = row.catname;
        V.productType = 'cat';
        V.productID = row.catId;
        if (row.AdminCharge !== null && row.AdminCharge !== undefined) {
          V.AdminCharge = row.AdminCharge;
        } else {
          const row2 = (await mpcatde.mainProduct_Category_List()).find((a) => a.maincatId === row.maincatId);
          V.AdminCharge = row2.AdminCharge;
        }
        V.DelieveryCharge = row.DelieveryCharge;
        V.HandlingCharge = fmt2(row.HandlingCharge);
        V.FixedFee = fmt2(row.FixedFee);
      }
    }
  } else {
    const row = await cdal.GetProductCategoryDetail(PrId);
    if (row) {
      V.CatName = row.catname;
      V.productType = 'cat';
      V.productID = row.catId;
      V.CatId = row.maincatId;
      if (row.AdminCharge !== null && row.AdminCharge !== undefined) {
        V.AdminCharge = row.AdminCharge;
        V.DelieveryCharge = row.DelieveryCharge;
        V.HandlingCharge = fmt2(row.HandlingCharge);
        V.FixedFee = fmt2(row.FixedFee);
      } else {
        const row2 = (await mpcatde.mainProduct_Category_List()).find((a) => a.maincatId === row.maincatId);
        V.AdminCharge = row2.AdminCharge;
      }
    } else {
      const rowsubcat = await cdal.GetProductSubCategoryDetail(PrId);
      if (rowsubcat) {
        V.CatId = rowsubcat.maincatId;
        V.CatName = rowsubcat.subcatname;
        V.productType = 'subcat';
        V.productID = rowsubcat.subcatId;
        if (rowsubcat.AdminCharge !== null && rowsubcat.AdminCharge !== undefined) {
          V.AdminCharge = rowsubcat.AdminCharge;
          V.DelieveryCharge = rowsubcat.DelieveryCharge;
          V.HandlingCharge = fmt2(rowsubcat.HandlingCharge);
          V.FixedFee = fmt2(rowsubcat.FixedFee);
        } else {
          const row2 = (await pdcs.Product_Category_List()).find((a) => a.catId === rowsubcat.catId);
          V.CatId = row2.maincatId;
          V.AdminCharge = row2.AdminCharge;
          V.DelieveryCharge = row2.DelieveryCharge;
          V.HandlingCharge = fmt2(row2.HandlingCharge);
          V.HandlingCharge = fmt2(row2.FixedFee); // legacy bug kept: FixedFee overwrites HandlingCharge
        }
      }
    }
  }
  res.json(Object.assign({ Model: pobj }, V));
}));

// auth ([SessionExpireCheck])
router.all(P + '/ProductCodeCheck{/:id}', ...guard, asyncHandler(async (req, res) => {
  const objPDal = new ProductDal();
  const pb = await objPDal.ProductCodeCheck(req.p.ProductCode);
  res.json(pb);
}));

// auth (public C# method, exposed as an MVC action)
router.all(P + '/saveImage{/:id}', ...guard, asyncHandler(async (req, res) => {
  res.send(await saveImage(s(req.p.imgecode), s(req.p.titlename), s(req.p.SellerCode)));
}));

// auth (public C# method, exposed as an MVC action; List<DynamicFields> bound from body "Obj")
router.all(P + '/GetDivStatus{/:id}', ...guard, asyncHandler(async (req, res) => {
  const Obj = (req.body && req.body.Obj) || [];
  res.send(GetDivStatus(Obj, s(req.p.DivId)));
}));

// auth ([SessionExpireCheck])
router.all(P + '/checksellingpricelist{/:id}', ...guard, asyncHandler(async (req, res) => {
  const sellprice = reqDec(req.p.sellprice);
  const rows = await db.proc(DB, 'usp_getsellingpricelist1', { subcatid: req.p.sprid, selingprice: sellprice });
  res.json(mapRows(rows, ['Rownumber', 'categoryname', 'Localprice', 'Zonalprice', 'Nationalprice', 'Metro']));
}));

module.exports = router;
