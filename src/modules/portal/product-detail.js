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
    "select * from ims_customeraddress where touserid = @RegNo and lower(tousertype) = 'customer' and isdefault = true limit 1", { RegNo }),
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
    "select * from ims_customeraddress where touserid = @RegNo and lower(tousertype) = 'customer' and isdefault = true limit 1", { RegNo }),
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

// ---------------------------------------------------------------- small conversion helpers
/** array[i] with .NET IndexOutOfRangeException */
function at(arr, i) {
  if (!arr || i >= arr.length || i < 0) throw new Error('Index was outside the bounds of the array.');
  return arr[i];
}
/** Convert.ToDecimal(string).ToString(): keeps the scale of the input ("100.00" stays "100.00"), null => "0". */
function decStr(v) {
  if (v === null || v === undefined) return '0';
  let s = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  let neg = false;
  if (s[0] === '+' || s[0] === '-') { neg = s[0] === '-'; s = s.slice(1); }
  let [ip, fp] = s.split('.');
  ip = ip.replace(/^0+(?=\d)/, '') || '0';
  const out = fp ? `${ip}.${fp}` : ip;
  return neg && /[1-9]/.test(out) ? '-' + out : out;
}
/** Int32 action parameter (non-nullable) */
function reqInt(req, k) {
  const v = req.p[k];
  const n = v === undefined || v === null || String(v).trim() === '' ? NaN : Number(v);
  if (!Number.isInteger(n)) {
    throw new Error(`The parameters dictionary contains a null entry for parameter '${k}' of non-nullable type 'System.Int32'.`);
  }
  return n;
}
/** int.Parse(x.ToString()) */
function intParse(v) {
  const s = str(v);
  if (!/^\s*[+-]?\d+\s*$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** DID of the session Login (Nullable<int>; 0 without a session) */
function loginDID(req) {
  const L = ps.getCustomerLogin(req);
  return L != null ? (L.DID === undefined ? null : L.DID) : 0;
}
/** bind a Dictionary<string,string> action parameter (JSON object, "dic[0].Key/Value" or "dic[key]" keys); null when absent */
function bindDict(req, name) {
  for (const b of [req.body || {}, req.query || {}]) {
    const k0 = Object.keys(b).find((k) => k.toLowerCase() === String(name).toLowerCase());
    if (k0 !== undefined) {
      let v = b[k0];
      if (typeof v === 'string') { try { v = JSON.parse(v); } catch (_) { v = null; } }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        return Object.fromEntries(Object.entries(v).map(([a, c]) => [a, c == null ? null : String(c)]));
      }
    }
    const idx = {};
    const named = {};
    const reIdx = new RegExp(`^${name}\\[(\\d+)\\]\\.(key|value)$`, 'i');
    const reNamed = new RegExp(`^${name}\\[([^\\]]+)\\]$`, 'i');
    for (const k of Object.keys(b)) {
      let m = reIdx.exec(k);
      if (m) { idx[m[1]] = idx[m[1]] || {}; idx[m[1]][m[2].toLowerCase()] = b[k]; continue; }
      m = reNamed.exec(k);
      if (m) named[m[1]] = b[k] == null ? null : String(b[k]);
    }
    const ids = Object.keys(idx);
    if (ids.length) {
      const o = {};
      for (const i of ids.sort((a, c) => a - c)) if (idx[i].key != null) o[String(idx[i].key)] = idx[i].value == null ? null : String(idx[i].value);
      return o;
    }
    if (Object.keys(named).length) return named;
  }
  return null; // DefaultModelBinder: no value => null
}

// ---------------------------------------------------------------- non-ActionResult public methods (also MVC actions)

/** public int GetProductQuantity(Int64 PRID) / GetStockCount(Int64 SPRID): StockIn of the sub product (0 when missing) */
async function getStockIn(SPRID) {
  const row = await db.queryOne(DB, 'select stockin from ims_subproduct where sprid = @SPRID limit 1', { SPRID });
  return row ? toInt32(row.stockin) : 0;
}
/** public List<ShoppingCartItems> GetShoppingCartItems() */
async function GetShoppingCartItems(req) {
  let CLID = 0;
  let cartItems = [];
  try {
    if (ps.isCustomer(req)) CLID = toInt64(req.user.plid);
    const sessionId = ps.getSid(req);
    cartItems = mapRows(await db.proc(DB, 'USP_GETSHOPPINGCARTITEMS', { CLID, SESSIONID: sessionId }), SHOPPING_CART_ITEMS_PROPS);
  } catch (ex) {
    cartItems = null;
    await UtilityClass.TrackError(String(ex.message));
  }
  return cartItems;
}
/** void ManageRecentlyViewedItems / RemoveRecentlyViewedItems: USP_RECENTLYVIEWEDITEMS @MODE,@SPRID,@SESSIONID,@STROUTPUT OUT */
async function recentlyViewed(MODE, SPRID, SESSIONID) {
  const rows = await db.proc(DB, 'USP_RECENTLYVIEWEDITEMS', { MODE, SPRID, SESSIONID });
  return str(outOf(rows, 'STROUTPUT'));
}

// ================================================================ routes
const R = `/portal/${C}`;

// public  (cart is keyed by the portal session id; Session["Plid"] optional)
router.all(`${R}/AfterDelete_updateQty{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  const totalAmount = 0;
  const newstringval = '';
  ensureManageCart(req);
  const sessionId = ps.getSid(req);
  const CustCLID = custClid(req);
  await manageAddToCart(2, PRID, CustCLID, 1, sessionId); // cartStatus (unused)
  res.json(totalAmount + '|' + newstringval);
}));

// public  (legacy answers "expired" itself)
router.all(`${R}/checkloginsession{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let ReturnValue = 'yes';
  if (!ps.isCustomer(req)) {
    ReturnValue = 'expired';
  } else {
    const cart = ps.sessionGet(req, 'Cart');
    if (cart == null || String(cart).trim() === '') ReturnValue = 'emptycart';
  }
  res.json(ReturnValue);
}));

// public  (cookie "comp")
router.all(`${R}/DeleteIntoCompareCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const sprid = toInt64(await UtilityClass.Decryptword(pv(req, 'SPRID')));
  let newstringval = '';
  const val = trimPipes(compCookieValue(req));
  const splitrecords = val.split('|');
  for (const rcrd of splitrecords) {
    const splitvales = rcrd.split('^');
    const po = {};
    po.SPRID = toInt64(await UtilityClass.Decryptword(at(splitvales, 0)));
    if (po.SPRID !== sprid) {
      po.CategoryId = toInt32(await UtilityClass.Decryptword(at(splitvales, 1)));
      po.PrTitle = at(splitvales, 2);
      po.DAP = decStr(at(splitvales, 3));
      po.Images = at(splitvales, 4);
      newstringval += (await UtilityClass.Encryptword(String(po.SPRID))) + '^' + (await UtilityClass.Encryptword(String(po.CategoryId))) + '^'
        + po.PrTitle + '^' + po.DAP + '^' + po.Images + '^' + '|';
    }
  }
  ps.setCookie(res, 'comp', newstringval, { expires: addYears(1) });
  res.json(newstringval);
}));

/** Index(string PrName, string PrCode, string UserRef) */
async function Index(req, res) {
  const PrName = pv(req, 'PrName');
  let PrCode = pv(req, 'PrCode');
  const UserRef = pv(req, 'UserRef');
  const PrCodeEnc = PrCode;
  const ViewBag = {};
  ps.sessionSet(req, 'RecentlyViewedItems', 1);
  ps.getSid(req, res); // sessionId (unused further)
  let s = '';
  let CurrentCategoryName = ''; let Price = ''; let ProductName = ''; let MetaKeywords = '';
  const Currency = config.app.Currency === undefined ? null : config.app.Currency;
  // controller instance fields MainCatId/CatId/SubCatId (0 at this point)
  let MainCatId = 0; let CatId = 0; let SubCatId = 0;
  if (PrCode == null) {
    return res.json({ redirect: '/home/Index' });
  }
  PrCode = await UtilityClass.Decryptword(PrCode);
  { // For Maintain The History
    const Obj = new DealsForYou();
    const TempPlid = ps.isCustomer(req) ? toInt32(req.user.plid) : 0;
    const ip = ps.sessionGet(req, 'IPADDRESS');
    const IpAddress = ip == null ? '' : String(ip);
    await Obj.MainTainHistoryOfDealsForYou(IpAddress, TempPlid, MainCatId, CatId, SubCatId, toInt32(PrCode));
  }
  // PinCode Add in Cookies
  const cookies = ps.parseCookies(req);
  if (cookies.pincode !== undefined) {
    s = cookies.pincode;
    ViewBag.PinCode = s;
  }
  // Recent View Add in Cookies (session cookie, no Expires)
  if (cookies.rece_view !== undefined) {
    s = cookies.rece_view;
    if (!s.includes(str(PrCode))) ps.setCookie(res, 'rece_view', s + ',' + str(PrCode));
  } else {
    ps.setCookie(res, 'rece_view', PrCode);
  }
  const strARR = s.split(',');
  s = '';
  for (let i = strARR.length - 1; i >= 0; i--) s = s + strARR[i] + ','; // (result unused, as legacy)

  const DID = loginDID(req);
  const Allproduct_Master_Custom = { product_detail_cutom: {}, RelatedProduct: [], attributes: [] };
  const pdRows = await db.proc(DB, 'USP_PRODUCT_DETAILING', { PRCODE: PrCode, DID });
  const product_detail_cutom = pdRows.length ? mapRow(pdRows[0], PRODUCT_DETAIL_CUTOM_PROPS) : null;
  Allproduct_Master_Custom.product_detail_cutom = product_detail_cutom;
  if (product_detail_cutom == null) throw NRE();
  ViewBag.AllRatings = await All_Reviews(product_detail_cutom.SPRID);
  ViewBag.ReviewList = await All_ReviewsList(product_detail_cutom.SPRID);

  // validate offer product
  if (isTrue(product_detail_cutom.IS_OFFER_ACTIVE)) {
    const offers = await db.proc(DB, 'USP_GET_OFFER_LIST', { SPRIDs: PrCode });
    ViewBag.offerDetails = offers.length ? mapRow(offers[0], OFFER_LIST_MODEL_PROPS) : null;
  }

  const RelatedProduct = mapRows(await db.proc(DB, 'IMS_USP_PRODUCT_SEARCHING', {
    MAINCATID: product_detail_cutom.maincatid, CATID: product_detail_cutom.catid, SUBCATID: product_detail_cutom.subcatid, SORTING: '',
    QUERYSTRING: '', PAGENO: 1, NOOFROWS: 100, DID,
  }), PRODUCT_MASTER_CUSTOM_PROPS);

  ProductName = product_detail_cutom.ProdTitle;
  Price = product_detail_cutom.PaybleAmount === null ? '0' : String(product_detail_cutom.PaybleAmount);
  Allproduct_Master_Custom.RelatedProduct = RelatedProduct;

  const ac = await db.queryOne(DB,
    "select coalesce(value, '') as v from ims_masterproductattribute where sprid = @PrCode and lower(title) = 'color' limit 1", { PrCode });
  ViewBag.AttrColor = ac ? ac.v : null;

  const MPC = Main_Product_Category.PROPS; const TPC = Tbl_Product_Category.PROPS; const PSC = Product_Sub_Category.PROPS;
  const mainBy = async (col, v) => mapRow(await db.queryOne(DB, `select * from tbl_main_category where ${col} = @v limit 1`, { v }), MPC);
  const catBy = async (col, v) => mapRow(await db.queryOne(DB, `select * from tbl_category where ${col} = @v limit 1`, { v }), TPC);
  const subBy = async (col, v) => mapRow(await db.queryOne(DB, `select * from tbl_sub_category where ${col} = @v limit 1`, { v }), PSC);

  const maincatid = toInt32(product_detail_cutom.maincatid);
  const catid = toInt32(product_detail_cutom.catid);
  const subcatid = toInt32(product_detail_cutom.subcatid);
  const rowmaincatnames = await mainBy('maincatid', maincatid);
  const rowcatnames = await catBy('catid', catid);
  const rowsubcats = await subBy('subcatid', subcatid);
  let category = '';
  if (rowmaincatnames != null) {
    ViewBag.maincatname = rowmaincatnames.maincatname;
    CurrentCategoryName = rowmaincatnames.maincatname;
    ViewBag.maincatcode = rowmaincatnames.main_cat_code;
    category = rowmaincatnames.main_cat_code;
  }
  if (rowcatnames != null) {
    ViewBag.catname = rowcatnames.catname;
    CurrentCategoryName = rowcatnames.catname;
    ViewBag.catcode = rowcatnames.cat_code;
    category = rowcatnames.cat_code;
  }
  if (rowsubcats != null) {
    ViewBag.subcatname = rowsubcats.subcatname;
    CurrentCategoryName = rowsubcats.subcatname;
    ViewBag.subcatcode = rowsubcats.sub_cat_code;
    category = rowsubcats.sub_cat_code;
  }
  if (category == null) throw NRE(); // category.ToString()

  const Cate1 = await catBy('cat_code', String(category));
  if (Cate1 != null) {
    ViewBag.ActiveCate = Cate1.catname;
    const Ctem1 = await mainBy('maincatid', Cate1.maincatId);
    if (Ctem1 != null) {
      ViewBag.CateDemo = mapRows(await db.query(DB, 'select * from tbl_category where maincatid = @m', { m: Ctem1.maincatId }), TPC);
      ViewBag.category = Ctem1.maincatname;
    }
  } else {
    ViewBag.ActiveCate = '';
  }

  const MPA_PROPS = Main_Product_Attributes.PROPS;
  const row = await mainBy('main_cat_code', String(category));
  if (row == null) {
    const rowcat = await catBy('cat_code', String(category));
    if (rowcat == null) {
      const rowsubcat = await subBy('sub_cat_code', String(category));
      if (rowsubcat == null) {
        ViewBag.mainCatid = null;
        ViewBag.Catid = null;
        MainCatId = 0; CatId = 0; SubCatId = 0;
        if (category === 'ALL' || category === 'all' || category === 'All' || category == null) ViewBag.empty = 'no';
        else ViewBag.empty = 'NotExist';
      } else {
        if (rowsubcat.subcatname == null) throw NRE();
        ViewBag.subcatname = String(rowsubcat.subcatname);
        ViewBag.subcatcode = rowsubcat.sub_cat_code;
        const rowmaincatname = await mainBy('maincatid', rowsubcat.maincatId);
        const rowcatname = await catBy('catid', rowsubcat.catId);
        if (rowmaincatname == null) throw NRE();
        ViewBag.maincatname = rowmaincatname.maincatname;
        ViewBag.maincatcode = rowmaincatname.main_cat_code;
        if (rowcatname == null) throw NRE();
        ViewBag.catname = rowcatname.catname;
        ViewBag.catcode = rowcatname.cat_code;
        ViewBag.SubCatid = rowsubcat.subcatId;
        SubCatId = rowsubcat.subcatId;
        ViewBag.MainCatForSideValue = rowsubcat.maincatId;
      }
    } else {
      ViewBag.catname = rowcat.catname;
      ViewBag.catcode = rowcat.cat_code;
      const rowmaincatname = await mainBy('maincatid', rowcat.maincatId);
      if (rowmaincatname == null) throw NRE();
      ViewBag.maincatname = rowmaincatname.maincatname;
      ViewBag.maincatcode = rowmaincatname.main_cat_code;
      ViewBag.Catid = rowcat.catId;
      CatId = rowcat.catId;
      ViewBag.MainCatForSideValue = rowcat.maincatId;
      ViewBag.ProductAttribute = mapRows(await db.query(DB,
        'select * from ims_masterproductattribute where catid = @c and isactive = true', { c: rowcat.maincatId }), MPA_PROPS);
    }
  } else {
    ViewBag.tblCategory = mapRows(await db.query(DB,
      'select * from tbl_category where maincatid = @m and status = true and isdelete = false', { m: row.maincatId }), TPC);
    ViewBag.ProductAttribute = mapRows(await db.query(DB,
      'select * from ims_masterproductattribute where catid = @c and isactive = true', { c: row.maincatId }), MPA_PROPS);
    ViewBag.maincatname = row.maincatname;
    ViewBag.maincatcode = row.main_cat_code;
    ViewBag.mainCatid = row.maincatId;
    MainCatId = row.maincatId;
    ViewBag.MainCatForSideValue = row.maincatId;
  }
  void MainCatId; void CatId; void SubCatId; // per-request controller fields (legacy never read them afterwards)
  const purl = pageUrl(req);
  const website = config.app.Website === undefined || config.app.Website === null ? '' : config.app.Website;
  MetaKeywords = ProductName;
  ViewBag.Title = str(ProductName) + website;
  ViewBag.MetaDesc = 'Buy ' + str(ProductName) + '-' + str(CurrentCategoryName) + ' for ' + str(Currency) + ' ' + Price + ' Online, Check '
    + str(ProductName) + ' Specifications and Features. Only Genuine Products, Free Shipping, Cash On Delivery at' + website;
  ViewBag.MetaKeyword = 'Online ' + str(MetaKeywords) + website;
  ViewBag.Canonical = purl;
  if (ps.isCustomer(req)) {
    ViewBag.Regno = req.user.plid;
    ViewBag.DistributorID = req.user.did === undefined ? null : req.user.did;
    product_detail_cutom.SharLink = await ShareLink(req, str(PrName) + '/' + str(PrCodeEnc), String(req.user.plid));
    if (nonEmpty(UserRef)) {
      ps.sessionSet(req, 'AffiliateUserId', str(PrName) + '^' + str(PrCode) + '^' + UserRef + '^' + str(product_detail_cutom.SharLink));
    }
  }
  const na = await db.queryOne(DB,
    'select noofattempts from tbl_outofstockhitsdata where mprid = @MPRID and sprid = @SPRID and plid = @Plid limit 1',
    { MPRID: product_detail_cutom.MPRID, SPRID: product_detail_cutom.SPRID, Plid: product_detail_cutom.Plid });
  if (na && na.noofattempts === null) throw new Error("The cast to value type 'System.Int64' failed because the materialized value is null.");
  const Noofattempts = na ? toInt64(na.noofattempts) : 0;
  ViewBag.Paymode = mapRows(await db.query(DB, 'select name from pay_mode where active = true'), ['Name']);
  if (Noofattempts === 1) {
    for (let i = 1; i < 3; i++) {
      if (i === 1) {
        const pl = await db.queryOne(DB, 'select emailid, fname, lname from portal_login where plid = @plid limit 1', { plid: 1 });
        if (pl == null) throw NRE();
        const Emailid = pl.emailid;
        const Name = str(pl.fname) + ' ' + str(pl.lname);
        const subject = 'Order Out of stock';
        const myString = 'Dear ' + Name + ',<br/> Thank you for choosing ' + str(CompanySettings.CompanyName) + ' <br/> This email is to notify, that your current apparel is out of stock. Please redeem the stock. Below we have listed down the requirement of the quantity that is required.<br/>For further queries please feel free to reach the Admin Department.<br/>Thanks and Regards<br/>Admin ' + str(CompanySettings.CompanyName) + '';
        await UtilityClass.Send('', Emailid, '', '', subject, myString);
      } else {
        const subject = 'Order Out Of Stock For';
        const em = await db.queryOne(DB, 'select emp_email, emp_name from tbl_employee_master limit 1');
        if (em == null) throw NRE();
        const Emailid = em.emp_email;
        const Name = em.emp_name;
        if (rowmaincatnames == null) throw NRE();
        const myString = 'Dear ' + str(Name) + ',<br/> This email is to notify, that ' + str(rowmaincatnames.maincatname) + ' is getting Out-of –stock with ' + str(product_detail_cutom.ProdTitle) + '.Make sure that this stock gets resupplied to the earliest, so that our users does not face further problems in building better bond with us.<br/>Get in touch with the merchant and refill the stock.<br/>Thanks and Regards<br/>Team ' + str(CompanySettings.CompanyName) + '';
        await UtilityClass.Send('', Emailid, '', '', subject, myString);
      }
    }
  }

  // Manage Recently Viewed Products (multi-value cookie "Products", key product_id, 2 days)
  const twoDays = new Date(Date.now() + 2 * 864e5);
  if (cookies.Products !== undefined) {
    const old = ps.parseCookieValues(cookies.Products).product_id; // null += "," + x  => ",x"
    ps.setCookie(res, 'Products', null, { values: { product_id: (old == null ? '' : old) + ',' + str(product_detail_cutom.SPRID) }, expires: twoDays });
  } else {
    ps.setCookie(res, 'Products', null, { values: { product_id: str(product_detail_cutom.SPRID) }, expires: twoDays });
  }

  Allproduct_Master_Custom.attributes = await getProductProperties(requestQueryString(req), product_detail_cutom.ProdTitle);

  ps.sessionSet(req, 'reviewPMID', product_detail_cutom.MPRID);
  return res.json({ view: '~/Views/Product_Detail/Index.cshtml', Model: Allproduct_Master_Custom, ViewBag });
}
// public  ([DistributerSessionExpireCheck] has an empty body in legacy)
router.all([R, `${R}/Index{/:id}`], ps.DistributerSessionExpireCheck, asyncHandler(Index));
// public  // route-config: "p/{PrName}/{PrCode}/{UserRef}" (ShoppingDetailing) -> Product_Detail/Index
router.all('/portal/p{/:PrName}{/:PrCode}{/:UserRef}', ps.DistributerSessionExpireCheck, asyncHandler(Index));

// public  (string action -> Content)
router.all(`${R}/ShareLink{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  content(res, await ShareLink(req, pv(req, 'productUrl'), pv(req, 'userID')));
}));

// public
router.all(`${R}/insertIntoCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  const Type = pv(req, 'Type');
  const attrFilterTitle = pv(req, 'attrFilterTitle');
  const filterAttrValue = pv(req, 'filterAttrValue');
  const productTitle = pv(req, 'productTitle');
  let listATTRIBUTESLIST = [];
  if (nonEmpty(attrFilterTitle) && nonEmpty(filterAttrValue) && nonEmpty(productTitle)) {
    listATTRIBUTESLIST = await checkAvailabilityOtherAttr(attrFilterTitle, filterAttrValue, productTitle);
  }
  if (listATTRIBUTESLIST != null && listATTRIBUTESLIST.length > 0) return res.json({ ReturnValue: 'other', ATTRIBUTESLIST: listATTRIBUTESLIST });
  return res.json({ ReturnValue: await InsertProductInCart(req, PRID, Type) });
}));

// public  (cookie "comp")
router.all(`${R}/InsertIntoCompareCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const sprid = toInt64(await UtilityClass.Decryptword(pv(req, 'SPRID')));
  let ReturnValue = 'added';
  let newstringval = '';
  const val = trimPipes(compCookieValue(req));
  const splitrecords = val.split('|');
  let i = 0;
  if (val !== '') {
    for (const rcrd of splitrecords) {
      const splitvales = rcrd.split('^');
      const po = {};
      po.SPRID = toInt64(await UtilityClass.Decryptword(at(splitvales, 0)));
      po.CategoryId = toInt32(await UtilityClass.Decryptword(at(splitvales, 1)));
      po.PrTitle = at(splitvales, 2);
      po.DAP = decStr(at(splitvales, 3));
      po.Images = at(splitvales, 4);
      const DID = loginDID(req);
      const encS = await UtilityClass.Encryptword(String(po.SPRID));
      const encC = await UtilityClass.Encryptword(String(po.CategoryId));
      if (DID !== null && DID > 0) {
        // legacy bug kept: DID is compared with the SPRID ("and DID=" + po.SPRID)
        const RowSubcat1 = await db.queryOne(DB, `select coalesce(dpw.bv, 0) as bv, coalesce(dpw.pv, 0) as pv from ims_subproduct vp
          left join tbl_distributor_comm_productwise dpw on dpw.sprid = vp.sprid where dpw.sprid = @s and did = @s limit 1`, { s: po.SPRID });
        if (RowSubcat1 == null) throw NRE();
        newstringval += encS + '^' + encC + '^' + po.PrTitle + '^' + po.DAP + '^' + po.Images + '^' + decToString0(RowSubcat1.bv) + '^' + '^'
          + decToString0(RowSubcat1.pv) + '^' + '|';
      } else {
        const RowSubcat = await db.queryOne(DB, 'select * from ims_subproduct where sprid = @s and isactive = true limit 1', { s: po.SPRID });
        if (RowSubcat == null) throw NRE();
        newstringval += encS + '^' + encC + '^' + po.PrTitle + '^' + po.DAP + '^' + po.Images + '^' + str(RowSubcat.bv) + '^' + '^' + str(RowSubcat.pv) + '^' + '|';
      }
      if (po.SPRID === sprid) i = 1;
    }
  }
  if (i === 0) {
    // legacy: db.Database.SqlQuery<Product_Master_Sub>("select BV,PV from IMS_SubProduct where IsActive=1 and SPRID=" + sprid)
    await db.queryOne(DB, 'select bv, pv from ims_subproduct where isactive = true and sprid = @sprid limit 1', { sprid });
    // PORT-NOTE: EF6 SqlQuery<Product_Master_Sub> over a reader that only has BV,PV throws ("The data reader is incompatible with the
    // specified 'Product_Master_Sub'..."), so adding a NEW product to the compare list always failed in legacy (500, cookie not
    // rewritten). Reproduced; the unreachable remainder (IMS_MasterProduct lookup, first image or "default-product-image.png",
    // "^1" + BV + "^|" entry) is therefore not executed.
    throw new Error("The data reader is incompatible with the specified 'Product_Master_Sub'. A member of the type, 'SPRID', does not have a corresponding column in the data reader with the same name.");
  }
  newstringval = trimPipes(newstringval.trim());
  ps.setCookie(res, 'comp', newstringval, { expires: addYears(1) });
  if (i !== 0) ReturnValue = 'no';
  res.json(ReturnValue);
}));

// public  (legacy answers "login" itself)
router.all(`${R}/insertIntoWishList{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  let ReturnValue = 'added';
  if (!ps.isCustomer(req)) {
    ReturnValue = 'login';
    return res.json(ReturnValue);
  }
  const plid = toInt32(req.user.plid);
  const rows = await db.proc(DB, 'usp_InsertUpdateWishlist', { LoginId: plid, sprid: PRID });
  ReturnValue = str(outOf(rows, 'strResult'));
  return res.json(ReturnValue);
}));

// public  (string action -> Content)
router.all(`${R}/InsertProductInCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  content(res, await InsertProductInCart(req, PRID, pv(req, 'Type')));
}));

// public  (legacy answers "expired" itself and keeps the review in Session["WriteReviewTemp"])
router.all(`${R}/insreviewsandcomments{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const RWID = pv(req, 'RWID'); const NAME = pv(req, 'NAME'); const Title = pv(req, 'Title');
  const RATE = pv(req, 'RATE'); const TYPE = pv(req, 'TYPE'); const REVIEW = pv(req, 'REVIEW');
  if (!ps.isCustomer(req)) {
    if (nonEmpty(RWID) && nonEmpty(NAME) && nonEmpty(TYPE) && nonEmpty(REVIEW)) {
      ps.sessionSet(req, 'WriteReviewTemp', { NAME, RATE, REVIEW, RWID, Title, TYPE });
    }
    return res.json('expired');
  }
  toInt32(ps.sessionGet(req, 'reviewPMID')); // int pmid = Convert.ToInt32(Session["reviewPMID"])
  // PORT-NOTE: legacy cast Session["PLID"] (a Login) to Member_Master_Custom to read EmailID -> InvalidCastException for every
  // logged-in caller, so CommonDal.InsertReview was never reached. Reproduced (500).
  throw new Error("Unable to cast object of type 'Login' to type 'Member_Master_Custom'.");
}));

// public  (cookie "comp")
router.all(`${R}/LoadCompareCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let s = '';
  const v = ps.parseCookies(req).comp;
  if (v !== undefined) s = trimPipes(v === null ? '' : v);
  res.json(s);
}));

// public  (int action -> Content)
router.all(`${R}/GetProductQuantity{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  content(res, await getStockIn(PRID));
}));

// auth  (reads the default address of customer RegNo; legacy had no session check, anonymous callers hit a NullReferenceException)
router.all(`${R}/PinCodeCheck{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const PRID = pv(req, 'PRID');
  const RegNo = reqLong(req, 'RegNo');
  const ReturnValue = await PinCodeCheckAvalibilityZoneWise(PRID, RegNo);
  if (ReturnValue[1] == null) throw NRE();
  if (nonEmpty(String(ReturnValue[1]))) ps.setCookie(res, 'pincode', String(ReturnValue[1]));
  res.json(ReturnValue);
}));

// auth  (string[] action -> Content "System.String[]")
router.all(`${R}/PinCodeCheckAvalibility{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const PRID = pv(req, 'PRID');
  const RegNo = reqLong(req, 'RegNo');
  await PinCodeCheckAvalibility(PRID, RegNo);
  content(res, T_STRING_ARRAY);
}));

// auth  (string[] action -> Content "System.String[]")
router.all(`${R}/PinCodeCheckAvalibilityZoneWise{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const PRID = pv(req, 'PRID');
  const RegNo = reqLong(req, 'RegNo');
  await PinCodeCheckAvalibilityZoneWise(PRID, RegNo);
  content(res, T_STRING_ARRAY);
}));

// public
router.all(`${R}/PinCodeCheckInDetail{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_CHECK_PINCODE', { PRID: pv(req, 'PRID'), PINCODE: pv(req, 'PinCode') });
  const ReturnValue = str(outOf(rows, 'STROUTPUT'));
  const Cod = str(outOf(rows, 'COD'));
  res.json({ ReturnValue, Cod });
}));

// public
router.all(`${R}/ProductCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/Product_Detail/ProductCart.cshtml', ViewBag: {} });
}));

// public  (cookie "comp")
router.all(`${R}/ResetCompareCart{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let s = '';
  if (ps.parseCookies(req).comp !== undefined) {
    ps.deleteCookie(res, 'comp');
    s = 'Reset';
  }
  res.json(s);
}));

// public
router.all(`${R}/showreview{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const dal = new CommonDal();
  const pmid = toInt32(ps.sessionGet(req, 'reviewPMID'));
  const DetailList = await dal.ShowReview(pmid);
  res.json(DetailList);
}));

// public  (cart is keyed by the portal session id)
router.all(`${R}/updateQty{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PRID = reqLong(req, 'PRID');
  const qty = reqInt(req, 'qty');
  if (ps.sessionGet(req, 'Cart') == null) ps.sessionSet(req, 'Cart', '');
  const totalAmount = 0;
  const newstringval = '';
  ensureManageCart(req);
  const sessionId = ps.getSid(req);
  const CustCLID = custClid(req);
  await manageAddToCart(1, PRID, CustCLID, qty, sessionId);
  res.json(totalAmount + '|' + newstringval);
}));

// public  (int action -> Content)
router.all(`${R}/GetStockCount{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SPRID = reqLong(req, 'SPRID');
  content(res, await getStockIn(SPRID));
}));

// public
router.all(`${R}/getdecrypturl{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const anchrurl = pv(req, 'anchrurl');
  const productTitle = pv(req, 'productTitle');
  reqLong(req, 'PRID');
  let searchAttrValue = '';
  let filterAttrValue = '';
  if (anchrurl == null) throw NRE();
  const queryString = String(anchrurl).split('&');
  searchAttrValue = await UtilityClass.Decryptword(queryString[queryString.length - 1]);
  let htmlString = '';
  for (let i = 0; i < queryString.length; i++) {
    if (i === 0) filterAttrValue = await UtilityClass.Decryptword(queryString[i]);
    else filterAttrValue = str(filterAttrValue) + '~' + str(await UtilityClass.Decryptword(queryString[i]));
  }
  await UtilityClass.Decryptword(anchrurl); // url (unused)
  let listATTRIBUTESLIST = [];
  if (nonEmpty(searchAttrValue) && nonEmpty(filterAttrValue) && nonEmpty(productTitle)) {
    listATTRIBUTESLIST = await checkAvailabilityOtherAttr(searchAttrValue, filterAttrValue, productTitle);
  }
  if (listATTRIBUTESLIST != null && listATTRIBUTESLIST.length > 0) {
    htmlString = await relatedAttrHtml(listATTRIBUTESLIST, productTitle, filterAttrValue);
  }
  res.json({ selectedAttr: filterAttrValue, htmlReletedAttr: htmlString });
}));

// public  (string action -> Content; List<ATTRIBUTESLIST> bound from the body)
router.all(`${R}/relatedAttrHtml{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  content(res, await relatedAttrHtml(bindAttrList(req, 'list'), pv(req, 'productTitle'), pv(req, 'filterAttrValue')));
}));

// public  (List action -> Content type name)
router.all(`${R}/AvailableOnly{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const attList = bindAttrList(req, 'attList');
  if (attList == null) throw NRE();
  AvailableOnly(attList, pv(req, 'att1'), pv(req, 'selectTitle'));
  content(res, T_ATTR_LIST);
}));

// public  (List action -> Content type name)
router.all(`${R}/checkAvailabilityOtherAttr{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const l = await checkAvailabilityOtherAttr(pv(req, 'attrFilterTitle'), pv(req, 'filterAttrValue'), pv(req, 'productTitle'));
  content(res, l == null ? '' : T_ATTR_LIST);
}));

// public  (legacy returns 0 without a session)
router.all(`${R}/getOrderpurchasedetails{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let ret = 0;
  if (!ps.isCustomer(req)) {
    ret = 0;
  } else {
    const Customerid = toInt64(req.user.plid);
    const rows = await db.proc(DB, 'USPORDERRODUCTDATA', { Customerid, Sprid: pv(req, 'sprid') });
    ret = intParse(outOf(rows, 'INTRESULT'));
  }
  res.json(ret);
}));

// public  (void action -> empty body)
router.all(`${R}/SetMultipleCookies{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const cookieName = pv(req, 'cookieName');
  const dic = bindDict(req, 'dic');
  if (dic == null) throw NRE();
  ps.setCookie(res, str(cookieName), null, { values: dic, expires: new Date(Date.now() + 20000 * 3600e3) });
  content(res, '');
}));

// public  (Dictionary action -> Content type name; the cookie values were read but only the type name was rendered)
router.all(`${R}/GetMultipleCookies{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  content(res, T_DICT);
}));

// public  (void action -> empty body)
router.all(`${R}/ManageRecentlyViewedItems{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SPRID = reqLong(req, 'SPRID');
  await recentlyViewed(1, SPRID, pv(req, 'SessionID'));
  content(res, '');
}));

// public  (void action -> empty body)
router.all(`${R}/RemoveRecentlyViewedItems{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  await recentlyViewed(2, 0, pv(req, 'sessionID'));
  content(res, '');
}));

// public  (List action -> Content type name, "" when the lookup failed)
router.all(`${R}/GetShoppingCartItems{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const l = await GetShoppingCartItems(req);
  content(res, l == null ? '' : T_CART_ITEMS);
}));

// public
router.all(`${R}/GetSocialMedia{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const plid = pv(req, 'plid');
  let pid = 0;
  if (nonEmpty(plid)) pid = toInt32(plid);
  const Obj = new DealsForYou();
  const MediaList = await Obj.GetSocialMediaLinks(pid);
  // PORT-NOTE: Json(MediaList) without JsonRequestBehavior.AllowGet: MVC rejected GET requests (InvalidOperationException) after the
  // action ran. Reproduced: GET -> error, POST -> JSON.
  if (req.method === 'GET') {
    throw new Error('This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.');
  }
  res.json(MediaList);
}));

// Static helpers for other portal modules (product_detail_cutom.getshipingcharge/getvatcharge,
// Product_DetailController.All_Reviews/All_ReviewsList/GetShoppingCartItemsCount/GetShoppingCartData, [NonAction] getProductProperties).
router.product_detail_cutom = { getshipingcharge, getvatcharge };
router.Product_DetailController = { All_Reviews, All_ReviewsList, GetShoppingCartItemsCount, GetShoppingCartData, getProductProperties };

module.exports = router;
