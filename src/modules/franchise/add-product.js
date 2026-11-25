'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const config = require('../../config');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const ProductDal = require('../../lib/franchise/ProductDal');
const CategoryDAL = require('../../lib/franchise/CategoryDal');
// Port of Franchise\Controllers\CustomerPanel\Add_Product.cs (5 actions: addorupdateproduct, Index, ProductCodeCheck, saveImage, GetDivStatus)
// (friendly routes merchant/add-product ... are commented out in RouteConfig.cs)
// PORT-NOTE: model classes Main_Product_Category (file "Main_ Product_Category.cs") and Tbl_Product_Category are expected in lib/franchise (class export, instance methods).
function requireAny(names) {
  for (const n of names) { try { return require('../../lib/franchise/' + n); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; } }
  throw new Error('lib not found: ' + names.join(' | '));
}
const OriginalImageFolder = config.app.OriginalProductImage;
const ThumbNailImageFolder = config.app.ThumbNailProductImage;
const s = (v) => (v === undefined || v === null ? '' : String(v));
const bool = (v) => String(v).toLowerCase() === 'true';
const fmt2 = (v) => (v === undefined || v === null || v === '' ? '' : Number(v).toFixed(2));
const isEmpty = (v) => v === undefined || v === null || v === '';
const baseName = (p) => String(p).split(/[\\/]/).pop();

async function saveImage(imgecode, titlename, SellerCode) {
  titlename = String(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = String(imgecode).split('^');
  for (const Items of getcolltionimage) {
    const IdForAppend = SellerCode + '_' + titlename.trim();
    if (Items.trim() !== '' && Items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodEComm(Items, OriginalImageFolder, ThumbNailImageFolder, UtilityClass.ImageMode.Both, IdForAppend);
      if (s(getnewfilename).trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    } else if (Items.trim() !== '' && !Items.includes('base64,')) {
      if (returnfilename.trim() === '') returnfilename = baseName(Items);
      else returnfilename = returnfilename + '^' + baseName(Items);
    }
  }
  return returnfilename;
}

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

// auth
router.all('/franchise/Add_Product/addorupdateproduct{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let returnmess = '';
  try {
    const DealsIds = '';
    const GroupId = '';
    const ProductCode = '';
    const Plid = parseInt(req.user.did, 10);
    let FullDesc = s(p.FullDesc);
    FullDesc = FullDesc.split('+#!#+').join('<');
    FullDesc = FullDesc.split('+!#!+').join('>');
    const dal = new ProductDal();
    const imageByteCode = s(p.imageByteCode).split('hariOmNamahshivay').join('^');
    const SellerCode = String(Plid);
    const productimagename = await saveImage(imageByteCode, p.prodTitle, SellerCode);
    const paymentmode = p.paymentmode;
    returnmess = await dal.AddUpdateProduct(Plid, paymentmode, Number(p.SPRID), Number(p.MPRID), parseInt(p.CompanyID, 10), parseInt(p.catid, 10),
      parseInt(p.subcatid, 10), parseInt(p.brandid, 10), ProductCode, p.SubProductCode, p.prodTitle, p.fromdate, p.todate, p.shrtdesc, FullDesc,
      bool(p.isAllowCoupon), parseInt(p.minOrderQty, 10), parseInt(p.maxOrderQty, 10), paymentmode,
      Number(p.sellMRP), Number(p.discountPer), parseInt(p.quantity, 10), p.prodUnit, p.color, p.size, p.Attributes, parseInt(p.vcid, 10),
      Number(p.VATP), Number(p.directAmt), Math.round(Number(p.DAP)), Number(p.shippingcharges), productimagename, p.KeyFeatures, parseInt(p.StockIn, 10),
      parseInt(p.ReplacementDay, 10), parseInt(p.ProcurementSLA, 10), bool(p.CashOnDelivery), Number(p.Pkg_Weight_Kg), Number(p.Pkg_Length_cms),
      Number(p.Pkg_Breadth_cms), Number(p.Pkg_Height_cms), parseInt(p.WarrantyInfoCare, 10), DealsIds, GroupId, Number(p.YWillRece), p.ismerchantstatus,
      p.productentry, p.packerdetail, p.importerdetail, p.manufacturedetail, p.hsn, p.luxurycess, p.procurementsla1, p.ddlseller, p.ddlprocurement);
  } catch (ex) {
    returnmess = String(ex.message);
  }
  res.json(returnmess);
}));

// auth
router.all('/franchise/Add_Product/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const PrId = req.p.PrId;
  const SubPr = s(req.p.SubPr);
  const NewAdd = req.p.NewAdd;
  const pdal = new ProductDal();
  const cdal = new CategoryDAL();
  let pobj = {};
  const Main_Product_Category = requireAny(['Main_Product_Category', 'Main_ Product_Category']);
  const Tbl_Product_Category = requireAny(['Tbl_Product_Category']);
  const mpcatde = new Main_Product_Category();
  const pdcs = new Tbl_Product_Category();
  const SPRID = SubPr === '' ? 0 : Number(SubPr);
  const MPRID = isEmpty(NewAdd) ? 0 : Number(NewAdd);
  const V = { SPRID };

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

// auth
router.all('/franchise/Add_Product/ProductCodeCheck{/:id}', auth, asyncHandler(async (req, res) => {
  const dal = new ProductDal();
  const pb = await dal.ProductCodeCheck(req.p.ProductCode);
  res.json(pb);
}));

// auth (public C# method, exposed as an MVC action)
router.all('/franchise/Add_Product/saveImage{/:id}', auth, asyncHandler(async (req, res) => {
  res.send(await saveImage(s(req.p.imgecode), s(req.p.titlename), s(req.p.SellerCode)));
}));

// auth (public C# method, exposed as an MVC action; List<DynamicFields> bound from body "Obj")
router.all('/franchise/Add_Product/GetDivStatus{/:id}', auth, asyncHandler(async (req, res) => {
  const Obj = (req.body && req.body.Obj) || [];
  res.send(GetDivStatus(Obj, s(req.p.DivId)));
}));

module.exports = router;
