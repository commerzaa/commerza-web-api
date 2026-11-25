'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Product_Detail.cs (class Product_DetailController + static helpers of product_detail_cutom)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
//
// PORT-NOTE: MVC actions whose return type is not an ActionResult (string/int/void/List/array/Dictionary) answered with
// ContentResult(Convert.ToString(value)): strings/ints as text, void as an empty body, and collections as their .NET TYPE NAME
// (e.g. "System.String[]"). That is reproduced (the side effects of those actions still run).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const DealsForYou = require('../../lib/portal/DealsForYou');
const Main_Product_Attributes = require('../../lib/portal/Main_Product_Attributes');
const CommonDal = require('../../lib/portal/CommonDal');
const Hexcolorcode = require('../../lib/portal/Hexcolorcode');
const CS = require('../../lib/portal/CompanySettings');
const Tbl_Product_Category = require('../../lib/portal/Tbl_Product_Category');
const Main_Product_Category = require('../../lib/portal/Main_Product_Category');
const Product_Sub_Category = require('../../lib/portal/Product_Sub_Category');
const CustomerAddress = require('../../lib/portal/CustomerAddress');
const Area = require('../../lib/portal/Area');
const Courier_picodes = require('../../lib/portal/Courier_picodes');
const ps = require('./_shared/portal-session');
const { DB, pageUrl, str, NRE, toInt32, toInt64, toDecimal, outOf } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'Product_Detail';
const CompanySettings = CS.CompanySettings || CS;

// ---------------------------------------------------------------- C# property bags
const PRODUCT_DETAIL_CUTOM_PROPS = ['Breadth_cms', 'CashOnDelivery', 'catid', 'DiscountPercentage', 'FullDesc', 'Height_cms', 'IsOutOfStock',
  'KeyFeatures', 'Length_cms', 'maincatid', 'MPRID', 'PaybleAmount', 'ProcurementSLA', 'ProdImages', 'ProdTitle', 'ReplacementDay', 'rowNumber',
  'SellerRating', 'sellMRP', 'ShippingCharges', 'shortDesc', 'SoldBy', 'SPRID', 'StockIn', 'StockNet', 'StockOut', 'subcatid', 'Weight_kg', 'BV',
  'PV', 'CASHBACK', 'Plid', 'Sellercity', 'Specification', 'EXCHANGE', 'RETURN', 'INCLUDINGTAX', 'PrSKUCode', 'SharLink', 'isPreview',
  'ACTIVATIONPV_PER', 'IS_OFFER_ACTIVE', 'IS_AFFILIATE', 'IS_AFFILIATE_ENABLE'];
const PRODUCT_MASTER_CUSTOM_PROPS = ['CashOnDelivery', 'CatId', 'CreatedDate', 'DAP', 'DealsIds', 'DiscountPercentage', 'FullDescription',
  'IsOutOfStock', 'KeyFeatures', 'MainCategoryId', 'ModifyDate', 'MPRID', 'ProcurementSLA', 'ProductCode', 'ProductImages', 'ProductTitle',
  'PrSKUCode', 'RatingStar', 'ReplacementDay', 'RowNo', 'SellMRP', 'ShippingCharges', 'ShotDescription', 'SPRID', 'StockIn', 'StockNet',
  'StockOut', 'SubCategoryId', 'BV', 'PV', 'CASHBACK', 'Main_Cat_Code', 'Sub_Cat_Code', 'Cat_Code', 'INCLUDINGTAX', 'ACTIVATIONPV_PER',
  'ATTRIBUTEVALUES'];
const OFFER_LIST_MODEL_PROPS = ['OPID', 'SPRID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END',
  'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE', 'TAG_LINE', 'OFFER_COUNT_DOWN', 'OFFER_DESCIPTION'];
const ALL_REVIEWS_PROPS = ['TOTALREVIEWS', 'TOTALRATINGS', 'AVERAGESTARS', 'FIVERATINGS', 'FOURRATINGS', 'THREERATINGS', 'TWORATINGS',
  'ONERATINGS', 'REMAININGSTARS'];
const REVIEWS_LIST_PROPS = ['PMID', 'NAME', 'REVIEWTITLE', 'REVIEWDESC', 'STARS', 'Reviewdate'];
const SHOPPING_CART_ITEMS_PROPS = ['SPRID', 'CLID', 'QTY'];
const SHOPPING_CART_DATA_PROPS = ['CategoryId', 'CheckoutType', 'DAP', 'GrandTotal', 'Images', 'PaybleAmount', 'PaybleAmount_OnPurchase',
  'PayblePurchaseTotal', 'TotalVatAmount', 'VatAmount', 'VatPrecentage', 'PinCodeAvailability', 'IsStockCount', 'PrTitle', 'quantity', 'sellMRP',
  'ShippingCharges', 'SPRID', 'TotalAmount', 'TotalShipping', 'BV', 'PV', 'CASHBACK', 'title', 'value', 'productdetails', 'ProductRealAmount'];
const ATTRIBUTESLIST_PROPS = ['SPRID', 'TITLE', 'VALUE', 'IS_SELECTED', 'HELPER_URL', 'IS_AVAILABLE'];

// .NET type names produced by Convert.ToString(collection) for non-ActionResult actions
const T_ATTR_LIST = 'System.Collections.Generic.List`1[ATTRIBUTESLIST]';
const T_STRING_ARRAY = 'System.String[]';
const T_DICT = 'System.Collections.Generic.Dictionary`2[System.String,System.String]';
const T_CART_ITEMS = 'System.Collections.Generic.List`1[ShoppingCartItems]';

const content = (res, v) => res.type('text/html').send(v === null || v === undefined ? '' : String(v));
const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';
const nonEmpty = (v) => v !== null && v !== undefined && v !== '';
const pv = (req, k) => (req.p[k] === undefined ? null : req.p[k]);
/** Int64 action parameter (non-nullable): missing/invalid => MVC threw ArgumentException for the null entry. */
function reqLong(req, k) {
  const v = req.p[k];
  const n = v === undefined || v === null || String(v).trim() === '' ? NaN : Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${k}' of non-nullable type 'System.Int64'.`);
  }
  return n;
}
const decToString0 = (v) => { // decimal.ToString("0") (MidpointRounding.AwayFromZero)
  const n = toDecimal(v);
  return String(Math.sign(n) * Math.round(Math.abs(n)));
};
const addYears = (y) => { const d = new Date(); d.setFullYear(d.getFullYear() + y); return d; };

/** ASP.NET HttpUtility.UrlEncode (UTF-8, space => '+', lower-case hex, unreserved: A-Z a-z 0-9 - _ . ! * ( ) ). */
function aspUrlEncode(s) {
  if (s === null || s === undefined) return '';
  let out = '';
  for (const b of Buffer.from(String(s), 'utf8')) {
    const c = String.fromCharCode(b);
    if (/[A-Za-z0-9\-_.!*()]/.test(c)) out += c;
    else if (c === ' ') out += '+';
    else out += '%' + b.toString(16).padStart(2, '0');
  }
  return out;
}
function aspUrlDecode(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (_) { return String(s); }
}
/** Request.QueryString.ToString() (HttpValueCollection: parse "a&b=c", re-encode; key-less parts keep only the value). */
function requestQueryString(req) {
  const u = req.originalUrl || '';
  const i = u.indexOf('?');
  if (i < 0) return '';
  const parts = [];
  for (const seg of u.slice(i + 1).split('&')) {
    if (seg === '') continue;
    const e = seg.indexOf('=');
    if (e < 0) parts.push(aspUrlEncode(aspUrlDecode(seg)));
    else parts.push(aspUrlEncode(aspUrlDecode(seg.slice(0, e))) + '=' + aspUrlEncode(aspUrlDecode(seg.slice(e + 1))));
  }
  return parts.join('&');
}

/** Session["ManageCart"] == null => Session.Add("ManageCart","SyncCart") */
function ensureManageCart(req) {
  if (ps.sessionGet(req, 'ManageCart') == null) ps.sessionSet(req, 'ManageCart', 'SyncCart');
}
const custClid = (req) => (ps.isCustomer(req) ? toInt32(req.user.plid) : 0);

/** [DBO].[USP_MANAGEADDTOCART] @MODE,@SPRID,@CLID,@QTY,@SESSIONID,@STROUTPUT OUT  -> STROUTPUT */
async function manageAddToCart(MODE, SPRID, CLID, QTY, SESSIONID) {
  const rows = await db.proc(DB, 'USP_MANAGEADDTOCART', { MODE, SPRID, CLID, QTY, SESSIONID });
  return str(outOf(rows, 'STROUTPUT'));
}

// ---------------------------------------------------------------- static helpers (not actions)

/** product_detail_cutom.getshipingcharge(Int64 MPRID) (compares SPRID with the argument, as the C#) */
async function getshipingcharge(MPRID) {
  let shippingcharges = 0;
  const row = await db.queryOne(DB, 'select shippingcharges from ims_subproduct where sprid = @MPRID limit 1', { MPRID });
  if (row != null) shippingcharges = toDecimal(row.shippingcharges);
  return shippingcharges;
}
/** product_detail_cutom.getvatcharge(Int64 MPRID) */
async function getvatcharge(MPRID) {
  let vatcharges = 0;
  const v = await db.queryOne(DB, 'select vatcategoryid from ims_subproduct where sprid = @MPRID limit 1', { MPRID });
  const VatCategoryId = v ? v.vatcategoryid : null;
  const row = await db.queryOne(DB, 'select vatpercvalue from tbl_vat_categories where vcid is not distinct from @VatCategoryId limit 1',
    { VatCategoryId });
  if (row == null) vatcharges = 0;
  else vatcharges = toDecimal(row.vatpercvalue);
  return vatcharges;
}

/** public static List<AllReviews> All_Reviews(Int64 Productid) (null on error) */
async function All_Reviews(Productid) {
  try {
    return mapRows(await db.proc(DB, 'USP_TOTAL_AVG_REVIEWS', { PRODUCTID: Productid }), ALL_REVIEWS_PROPS);
  } catch (ex) {
    return null;
  }
}
/** public static List<ReviewsList> All_ReviewsList(Int64 Productid) (null on error) */
async function All_ReviewsList(Productid) {
  try {
    return mapRows(await db.proc(DB, 'USP_REVIEWSLIST', { PRODUCTID: Productid }), REVIEWS_LIST_PROPS);
  } catch (ex) {
    return null;
  }
}

/** public static int GetShoppingCartItemsCount() (HttpContext.Current => req) */
async function GetShoppingCartItemsCount(req) {
  let cartItemsCount = 0;
  let CLID = 0;
  try {
    if (ps.isCustomer(req)) CLID = toInt64(req.user.plid);
    const sessionId = ps.getSid(req);
    const rows = await db.proc(DB, 'USP_GETSHOPPINGCARTITEMSCOUNT', { CLID, SESSIONID: sessionId });
    const r = rows[0];
    cartItemsCount = r ? toInt32(r[Object.keys(r)[0]]) : 0;
  } catch (ex) {
    cartItemsCount = 0;
    await UtilityClass.TrackError(String(ex.message));
  }
  return cartItemsCount;
}
/** public static List<ShoppingCartData> GetShoppingCartData() (HttpContext.Current => req) */
async function GetShoppingCartData(req) {
  let CLID = 0;
  let cartData = [];
  try {
    if (ps.isCustomer(req)) CLID = toInt64(req.user.plid);
    const sessionId = ps.getSid(req);
    cartData = mapRows(await db.proc(DB, 'USP_GETSHOPPINGCARTDATA', { CLID, SESSIONID: sessionId }), SHOPPING_CART_DATA_PROPS);
  } catch (ex) {
    cartData = null;
    await UtilityClass.TrackError(String(ex.message));
  }
  return cartData;
}

// ---------------------------------------------------------------- instance helpers that are also actions

/** AvailableOnly(List<ATTRIBUTESLIST> attList, string att1, string selectTitle) - mutates the items like the C# (same list reference). */
function AvailableOnly(attList, att1, selectTitle) {
  let availableAttList = attList;
  if (nonEmpty(att1)) {
    for (const item of attList) {
      if (item.VALUE == null) throw NRE();
      if (item.VALUE.toLowerCase() === String(att1).toLowerCase()) {
        availableAttList.filter((x) => x.SPRID === item.SPRID).forEach((x) => { x.IS_AVAILABLE = true; });
      }
    }
    availableAttList.forEach((y) => {
      if (y.TITLE == null || selectTitle == null) throw NRE();
      if (y.TITLE.toLowerCase().includes(String(selectTitle).toLowerCase())) y.IS_AVAILABLE = true;
    });
  } else {
    return attList.map((x) => { x.IS_AVAILABLE = true; return x; });
  }
  return availableAttList;
}

/** [NonAction] getProductProperties(string queryString, string productTitle) */
async function getProductProperties(queryString, productTitle) {
  const MPA = new Main_Product_Attributes();
  let list = [];
  const p = String(queryString).split('&');
  let p1 = '';
  let p2 = '';
  if (p.length === 1) p1 = await UtilityClass.Decryptword(p[0]);
  if (p.length === 2 && p.length !== 0) {
    p1 = await UtilityClass.Decryptword(p[0]);
    p2 = await UtilityClass.Decryptword(p[1]);
  }
  const eqCI = (a, b) => {
    if (a == null) throw NRE();
    return b != null && String(a).toUpperCase() === String(b).toUpperCase();
  };
  if (nonEmpty(productTitle)) {
    list = mapRows(await MPA.GETALLPRODUCTSPRIDBYATTRIBUTES(productTitle), ATTRIBUTESLIST_PROPS)
      .map((x) => ({ ...x, IS_SELECTED: isTrue(x.IS_SELECTED), IS_AVAILABLE: isTrue(x.IS_AVAILABLE) }));
    list.filter((x) => { if (p1 == null) throw NRE(); return eqCI(x.VALUE, p1); }).forEach((x) => { x.IS_SELECTED = true; x.HELPER_URL = p[0]; });
    list.filter((x) => eqCI(x.VALUE, p2)).forEach((x) => {
      x.IS_SELECTED = true;
      if (p.length < 2) throw new Error('Index was outside the bounds of the array.');
      x.HELPER_URL = p[1];
    });
  }
  const sel = list.find((x) => x.VALUE === p1);
  const selectTitle = sel ? sel.TITLE : null;
  const availableList = AvailableOnly(list, p1, selectTitle);
  // GroupBy(VALUE) (first-appearance order) => available ones, or the first item of the group
  const groups = new Map();
  for (const x of availableList) {
    const k = x.VALUE;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(x);
  }
  const groupedList = [];
  for (const g of groups.values()) {
    if (g.some((x) => x.IS_AVAILABLE)) groupedList.push(...g.filter((x) => x.IS_AVAILABLE));
    else groupedList.push(...g.slice(0, 1));
  }
  return groupedList;
}

/** ShareLink(string productUrl, string userID) */
async function ShareLink(req, productUrl, userID) {
  const host = (req.get && req.get('host')) || '';
  const baseUrl = `${req.protocol || 'http'}://${host}/`; // request.ApplicationPath "/" (site root)
  return baseUrl + 'p/' + str(productUrl) + '/' + (await UtilityClass.Encryptword(userID));
}

/** checkAvailabilityOtherAttr(string attrFilterTitle, string filterAttrValue, string productTitle) */
async function checkAvailabilityOtherAttr(attrFilterTitle, filterAttrValue, productTitle) {
  let attributesList = mapRows(await db.proc(DB, 'USP_GETOTHERPRODUCTSPRIDBYATTRIBUTES', {
    PRODUCTTITLE: productTitle, attrFilterTitle, attrFilterValue: filterAttrValue,
  }), ATTRIBUTESLIST_PROPS).map((x) => ({ ...x, IS_SELECTED: isTrue(x.IS_SELECTED), IS_AVAILABLE: isTrue(x.IS_AVAILABLE) }));
  if (attributesList != null && attributesList.length > 0) {
    // first TITLE group only, distinct VALUE (first item of each value)
    const firstTitle = attributesList[0].TITLE;
    const group = attributesList.filter((x) => x.TITLE === firstTitle);
    const seen = new Set();
    attributesList = [];
    for (const item of group) {
      if (seen.has(item.VALUE)) continue;
      seen.add(item.VALUE);
      attributesList.push({ SPRID: item.SPRID, TITLE: item.TITLE, VALUE: item.VALUE, IS_SELECTED: false, HELPER_URL: null, IS_AVAILABLE: false });
    }
  }
  return attributesList;
}

/** InsertProductInCart(Int64 PRID, string Type) */
async function InsertProductInCart(req, PRID /* , Type */) {
  let ReturnValue = 'added';
  let i = 0;
  ensureManageCart(req);
  const sessionId = ps.getSid(req);
  const CustCLID = custClid(req);
  if (i === 0) {
    await manageAddToCart(1, PRID, CustCLID, 1, sessionId);
    // PORT-NOTE: legacy i = ExecuteSqlCommand(...) rows affected (the proc has no SET NOCOUNT and always writes the cart row);
    // a PG function call has no rows-affected count, a successful call is taken as non-zero.
    i = 1;
  }
  if (i === 0) ReturnValue = 'no';
  return ReturnValue;
}

/** PinCodeCheckAvalibility(string PRID, Int64 RegNo) : string[4] */
async function PinCodeCheckAvalibility(PRID, RegNo) {
  const ReturnValue = [null, null, null, null];
  ReturnValue[0] = 'not found';
  const Datacount = toInt32(await db.scalar(DB,
    "select count(1) from ims_customeraddress where touserid = @RegNo and lower(tousertype) = 'customer'", { RegNo }));
  if (Datacount === 1) {
    await db.exec(DB, "update ims_customeraddress set isdefault = true where touserid = @RegNo and lower(tousertype) = 'customer'", { RegNo });
  }
  const adrs = mapRow(await db.queryOne(DB,
    "select * from ims_customeraddress where touserid = @RegNo and tousertype = 'Customer' and isdefault::int = 1 limit 1", { RegNo }),
  CustomerAddress.PROPS);
  const sprid = toInt64(await UtilityClass.Decryptword(PRID));
  await db.queryOne(DB, 'select * from ims_subproduct where sprid = @sprid limit 1', { sprid }); // pms (only used in a dead branch)
  let pg = {}; // new Courier_picodes()
  if (adrs != null) {
    pg = mapRow(await db.queryOne(DB, 'select * from tbl_courierpincodes where pincode is not distinct from @pin limit 1', { pin: adrs.PinCode }),
      Courier_picodes.PROPS);
  }
  if (pg != null && adrs != null) {
    ReturnValue[0] = 'found';
    ReturnValue[1] = adrs.PinCode;
  } else {
    ReturnValue[1] = '';
  }
  return ReturnValue;
}

/** PinCodeCheckAvalibilityZoneWise(string PRID, Int64 RegNo) : string[4] */
async function PinCodeCheckAvalibilityZoneWise(PRID, RegNo) {
  const ReturnValue = [null, null, null, null];
  ReturnValue[0] = 'not found';
  const adrs = mapRow(await db.queryOne(DB,
    "select * from ims_customeraddress where touserid = @RegNo and tousertype = 'Customer' and isdefault::int = 1 limit 1", { RegNo }),
  CustomerAddress.PROPS);
  const sprid = toInt64(await UtilityClass.Decryptword(PRID));
  await db.queryOne(DB, 'select * from ims_subproduct where sprid = @sprid limit 1', { sprid }); // pms (unused)
  if (adrs == null || adrs.PinCode == null) throw NRE(); // adrs.PinCode.ToString()
  const ar = mapRow(await db.queryOne(DB, `select * from ${Area.TABLE} where pincode = @pin and cid = 96 limit 1`, { pin: String(adrs.PinCode) }),
    Area.PROPS);
  if (ar != null) {
    ReturnValue[0] = 'found';
    ReturnValue[1] = adrs.PinCode;
  } else {
    ReturnValue[1] = '';
  }
  return ReturnValue;
}

/** relatedAttrHtml(List<ATTRIBUTESLIST> list, string productTitle, string filterAttrValue) */
async function relatedAttrHtml(list, productTitle, filterAttrValue) {
  if (filterAttrValue == null) throw NRE();
  const arry = String(filterAttrValue).split('~');
  let queryStringUrl = '';
  for (let i = 0; i < arry.length; i++) {
    queryStringUrl = i === 0 ? await UtilityClass.Encryptword(arry[i]) : queryStringUrl + '&' + (await UtilityClass.Encryptword(arry[i]));
  }
  let sb = '';
  try {
    let PrCodeEncrypted1 = '';
    let mainurl = '';
    sb += '<div>';
    sb += '<div class="col-sm-2 wdth">';
    if (!list || list.length === 0) throw new Error('Index was out of range.');
    sb += '<label>' + str(list[0].TITLE) + '</label>';
    sb += '</div>';
    sb += '<div class="col-sm-10 col10-wdth prattrdata">';
    sb += '<ul class="list-inline mob-size ">';
    for (const o of list) {
      let hrer = ''; let attrvalue = ''; let colorCode = '';
      PrCodeEncrypted1 = await UtilityClass.Encryptword(str(o.SPRID));
      mainurl = '';
      if (productTitle == null) throw NRE();
      hrer = '/p/' + String(productTitle).split(' ').join('-').split(' ').join('-').split('/').join('-').split('|').join('-')
        .split(':').join('')
        .split('&')
        .join('-')
        .split('%')
        .join('')
        .trim() + '/' + PrCodeEncrypted1;
      if (o.VALUE == null || o.TITLE == null) throw NRE();
      attrvalue = String(o.VALUE).trim();
      if (String(o.TITLE).toLowerCase().includes('color')) {
        colorCode = await Hexcolorcode.GetColorCodebyColorName(attrvalue.split(' ').join(''));
      }
      attrvalue = await UtilityClass.Encryptword(attrvalue);
      mainurl = hrer + '?' + queryStringUrl + '&' + attrvalue;
      if (String(o.TITLE).toLowerCase().includes('color')) {
        sb += '<li class="color-width' + (nonEmpty(colorCode) ? '' : 'dot') + '" style="background:'
          + (nonEmpty(colorCode) ? String(colorCode).split(' ').join('') : String(o.VALUE).split(' ').join('')) + ';border: 2px solid #686060 !important;">';
      } else {
        sb += '<li>';
      }
      sb += '<input type="hidden" value="' + PrCodeEncrypted1 + '" class="hdfproducid" />';
      sb += '<input type="hidden" value="' + str(o.SPRID) + '" class="hdfsprid" />';
      sb += '<a id="' + str(o.VALUE) + '" href="' + mainurl + '" class="size-dec-cls" data-toggle="tooltip" title="' + str(o.VALUE) + '">';
      sb += '<label class="attrdata">' + str(o.VALUE) + ' </label></a>';
      sb += '</li>';
    }
    sb += '</ul>';
    sb += '</div>';
    sb += '</div>';
    sb += '</div>';
  } catch (ex) { /* legacy: empty catch, partial StringBuilder content is returned */ }
  return sb;
}

/** Request.Cookies["comp"] value ('' when the cookie is missing) */
const compCookieValue = (req) => { const v = ps.parseCookies(req).comp; return v === undefined || v === null ? '' : v; };
/** C# Trim('|').Trim() */
const trimPipes = (s) => String(s).replace(/^\|+|\|+$/g, '').trim();

/** bind a List<ATTRIBUTESLIST> action parameter from the body (JSON array, or MVC "list[i].PROP" form keys) */
function bindAttrList(req, name) {
  const b = req.body || {};
  let v = b[name] !== undefined ? b[name] : b[Object.keys(b).find((k) => k.toLowerCase() === String(name).toLowerCase())];
  if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } }
  if (!Array.isArray(v)) {
    const items = [];
    const re = new RegExp(`^${name}\\[(\\d+)\\]\\.(\\w+)$`, 'i');
    for (const k of Object.keys(b)) {
      const m = re.exec(k);
      if (m) { items[+m[1]] = items[+m[1]] || {}; items[+m[1]][m[2]] = b[k]; }
    }
    v = items.length ? items.filter(Boolean) : null;
  }
  if (v === null) return null; // MVC binds a missing list as null
  return mapRows(v, ATTRIBUTESLIST_PROPS).map((x) => ({
    ...x, SPRID: x.SPRID === null ? 0 : Number(x.SPRID), IS_SELECTED: isTrue(x.IS_SELECTED), IS_AVAILABLE: isTrue(x.IS_AVAILABLE),
  }));
}
