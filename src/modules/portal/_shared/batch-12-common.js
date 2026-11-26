'use strict';
/**
 * Shared helpers for portal batch 12 (OuterPages, PageNotFound, privacy_policy, pricing, Proceed_To_CheckOut).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: requestUrl(req), seoViewBag(req, wid), getshipingcharge(SPRID), getvatcharge(SPRID), GetStockCount(SPRID),
 *          PinCodeCheckAvalibility(PRID, RegNo), GetShoppingCartData(req), toDec(v)
 *
 * PORT-NOTE: product_detail_cutom.getshipingcharge/getvatcharge and Product_DetailController.PinCodeCheckAvalibility/GetStockCount/
 * GetShoppingCartData live in Controllers/Product_Detail.cs (a controller, no lib port) - re-implemented here from that C#.
 */
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const ps = require('./portal-session');

const DB = 'shopping';

const toDec = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** HttpContext.Request.Url.ToString() */
function requestUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/** ViewBag.Canonical/Title/MetaDesc/MetaKeyword block + WebsiteDetail.GetWebsiteInfo(wid). */
async function seoViewBag(req, wid) {
  const ViewBag = { Canonical: requestUrl(req), Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(wid);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return ViewBag;
}

/** product_detail_cutom.getshipingcharge(MPRID): IMS_SubProduct.ShippingCharges by SPRID (0 when missing). */
async function getshipingcharge(MPRID) {
  let shippingcharges = 0;
  const row = await db.queryOne(DB, 'select shippingcharges from ims_subproduct where sprid = @MPRID limit 1', { MPRID });
  if (row) shippingcharges = toDec(row.shippingcharges);
  return shippingcharges;
}

/** product_detail_cutom.getvatcharge(MPRID): tbl_Vat_Categories.vatPercValue of the sub product's VatCategoryId. */
async function getvatcharge(MPRID) {
  let vatcharges = 0;
  const sp = await db.queryOne(DB, 'select vatcategoryid from ims_subproduct where sprid = @MPRID limit 1', { MPRID });
  const VatCategoryId = sp ? (sp.vatcategoryid === null ? 0 : sp.vatcategoryid) : 0; // FirstOrDefault() of int => 0
  const row = await db.queryOne(DB, 'select vatpercvalue from tbl_vat_categories where vcid = @VatCategoryId limit 1', { VatCategoryId });
  if (row == null) vatcharges = 0;
  else vatcharges = toDec(row.vatpercvalue);
  return vatcharges;
}

/** Product_DetailController.GetStockCount(SPRID) */
async function GetStockCount(SPRID) {
  const row = await db.queryOne(DB, 'select stockin from ims_subproduct where sprid = @SPRID limit 1', { SPRID });
  return row && row.stockin !== null ? Number(row.stockin) : 0;
}

/** Product_DetailController.PinCodeCheckAvalibility(string PRID, Int64 RegNo) -> string[4] */
async function PinCodeCheckAvalibility(PRID, RegNo) {
  const ReturnValue = [null, null, null, null];
  ReturnValue[0] = 'not found';
  const Datacount = Number(await db.scalar(DB,
    "select count(1) from ims_customeraddress where touserid = @RegNo and tousertype = 'Customer'", { RegNo })) || 0;
  if (Datacount === 1) {
    await db.exec(DB, "update ims_customeraddress set isdefault = true where touserid = @RegNo and tousertype = 'Customer'", { RegNo });
  }
  const adrs = await db.queryOne(DB,
    "select * from ims_customeraddress where touserid = @RegNo and tousertype = 'Customer' and isdefault = true limit 1", { RegNo });
  const sprid = Number(UtilityClass.Decryptword(PRID));
  if (!Number.isFinite(sprid)) throw new Error('Input string was not in a correct format.');
  const pms = await db.queryOne(DB, 'select sprid from ims_subproduct where sprid = @sprid limit 1', { sprid });
  // legacy: ar = new Area() (lookup commented out) so the "ar == null" branch (pms.GroupId = 0) never ran; pms unused.
  void pms;
  let pg = {}; // new Courier_picodes()
  if (adrs) {
    pg = await db.queryOne(DB, 'select * from tbl_courierpincodes where pincode = @PinCode limit 1', { PinCode: adrs.pincode });
  }
  if (pg && adrs) {
    ReturnValue[0] = 'found';
    ReturnValue[1] = adrs.pincode;
  } else {
    ReturnValue[1] = '';
  }
  return ReturnValue;
}

const CART_PROPS = ['CategoryId', 'CheckoutType', 'DAP', 'GrandTotal', 'Images', 'PaybleAmount', 'PaybleAmount_OnPurchase', 'PayblePurchaseTotal',
  'TotalVatAmount', 'VatAmount', 'VatPrecentage', 'PinCodeAvailability', 'IsStockCount', 'PrTitle', 'quantity', 'sellMRP', 'ShippingCharges', 'SPRID',
  'TotalAmount', 'TotalShipping', 'BV', 'PV', 'CASHBACK', 'title', 'value', 'productdetails', 'ProductRealAmount'];

/** Product_DetailController.GetShoppingCartData(): DBO.USP_GETSHOPPINGCARTDATA @CLID,@SESSIONID; null on error. */
async function GetShoppingCartData(req) {
  let CLID = 0;
  let cartData = [];
  try {
    if (ps.isCustomer(req)) CLID = Number(req.user.plid);
    const sessionId = ps.getSid(req);
    cartData = mapRows(await db.proc(DB, 'usp_getshoppingcartdata', { clid: CLID, sessionid: sessionId }), CART_PROPS);
  } catch (ex) {
    cartData = null;
    try { await UtilityClass.TrackError(String(ex.message)); } catch (_) { /* ignore */ }
  }
  return cartData;
}

module.exports = {
  toDec, requestUrl, seoViewBag, getshipingcharge, getvatcharge, GetStockCount, PinCodeCheckAvalibility, GetShoppingCartData, CART_PROPS,
};
