'use strict';
/**
 * Port of Controllers/WebPanelCntrl/ProductsController.cs (24 active routes; 3 commented-out routes dropped).
 * Browsing / category / search endpoints are public, cart / wishlist endpoints are protected with JWT.
 */
const express = require('express');
const config = require('../config');
const { query, scalar, exec, proc, procOne } = require('../db');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { netDate } = require('../utils/shape');
const ManageOfferData = require('../lib/ManageOfferData');
const IMS_MasterProductAttribute = require('../lib/IMS_MasterProductAttribute');
const WebsiteDetail = require('../lib/WebsiteDetail');
const UtilityCommon = require('../lib/UtilityCommon');

const router = express.Router();

// ---------------------------------------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------------------------------------
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const badRequest = (msg) => { const e = new Error(msg); e.status = 400; return e; };

/** string action parameter: absent => null (C# null) */
const str = (v) => (v === undefined || v === null ? null : String(v));

/** Convert.ToInt64(string) : null => 0, malformed => FormatException */
function convInt64(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
/** Convert.ToInt32(string) */
function convInt32(v) {
  const n = convInt64(v);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}
/** required non-nullable Int64/Int32/int action parameter */
function reqInt(v, name) {
  if (v === undefined || v === null || String(v).trim() === '') throw badRequest(`The parameters dictionary contains a null entry for parameter '${name}'.`);
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw badRequest(`The parameter '${name}' could not be converted.`);
  return Number(s);
}
/** nullable int? action parameter */
function optInt(v, name) {
  if (v === undefined || v === null || String(v).trim() === '') return null;
  return reqInt(v, name);
}

/** Typed projection restoring the C# class property names + C# default values for missing columns. */
const DEF_DATE = '0001-01-01T00:00:00';
function mapTyped(rows, spec) {
  return (rows || []).map((r) => {
    const lower = {};
    for (const k of Object.keys(r)) lower[k.toLowerCase()] = r[k];
    const out = {};
    for (const [name, t] of spec) {
      let v = lower[name.toLowerCase()];
      const nullable = t[0] === '?';
      const type = nullable ? t[1] : t;
      if (v === undefined || v === null) {
        v = nullable ? null : (type === 'n' ? 0 : type === 'b' ? false : type === 'd' ? DEF_DATE : null);
      } else if (type === 'd') v = netDate(v);
      out[name] = v;
    }
    return out;
  });
}

const PRODUCT_SPEC = [['CashOnDelivery', 'b'], ['CatId', 'n'], ['CreatedDate', 'd'], ['DAP', 'n'], ['DealsIds', 's'], ['DiscountPercentage', 'n'],
  ['FullDescription', 's'], ['IsOutOfStock', 'b'], ['KeyFeatures', 's'], ['MainCategoryId', 'n'], ['ModifyDate', 'd'], ['MPRID', 'n'],
  ['ProcurementSLA', 'n'], ['ProductCode', 's'], ['ProductImages', 's'], ['ProductTitle', 's'], ['PrSKUCode', 's'], ['RatingStar', 'n'],
  ['ReplacementDay', 'n'], ['RowNo', 'n'], ['SellMRP', 'n'], ['ShippingCharges', 'n'], ['ShotDescription', 's'], ['SPRID', 'n'], ['StockIn', 'n'],
  ['StockNet', 'n'], ['StockOut', 'n'], ['SubCategoryId', 'n'], ['BV', 'n'], ['PV', 'n'], ['CASHBACK', 'n'], ['Main_Cat_Code', 's'],
  ['Sub_Cat_Code', 's'], ['Cat_Code', 's'], ['INCLUDINGTAX', 'n'], ['ACTIVATIONPV_PER', 'n'], ['IS_OFFER', 'b'], ['OfferDetails', 's']];
const CART_DATA_SPEC = [['CategoryId', 'n'], ['CheckoutType', 's'], ['DAP', 'n'], ['GrandTotal', 'n'], ['Images', 's'], ['PaybleAmount', 'n'],
  ['PaybleAmount_OnPurchase', 'n'], ['PayblePurchaseTotal', 'n'], ['TotalVatAmount', 'n'], ['VatAmount', 'n'], ['VatPrecentage', 'n'],
  ['PinCodeAvailability', 's'], ['IsStockCount', 'n'], ['PrTitle', 's'], ['quantity', 'n'], ['sellMRP', 'n'], ['ShippingCharges', 'n'],
  ['SPRID', 'n'], ['TotalAmount', 'n'], ['TotalShipping', 'n'], ['BV', 'n'], ['PV', 'n'], ['CASHBACK', 'n'], ['title', 's'], ['value', 's'],
  ['productdetails', 's'], ['ProductRealAmount', 'n']];
const CART_ITEM_SPEC = [['SPRID', 'n'], ['CLID', 'n'], ['QTY', 'n']];
const WISH_SPEC = [['DAP', 'n'], ['prodImages', 's'], ['prodTitle', 's'], ['rowNumber', 'n'], ['shortDesc', 's'], ['Sprid', 'n'], ['wlid', 'n'],
  ['PV', 'n'], ['BV', 'n'], ['DID', 'n'], ['IsOutOfStock', 'b'], ['dist_BV', 'n'], ['dist_PV', 'n']];
const MAIN_CAT1_SPEC = [['AdminCharge', '?n'], ['ImageName', 's'], ['isDelete', 'b'], ['IsHot_Links', '?b'], ['IsHot_Menu', '?b'], ['IsHot_WithItem', '?b'],
  ['IsSelected', 'b'], ['main_cat_code', 's'], ['main_cat_imgname', 's'], ['maincatId', 'n'], ['maincatname', 's'], ['sequence', 'n'],
  ['status', 'b'], ['TotalProduct', 'n'], ['Category_ICON', 's']];
const CATEGORY_SPEC = [['CatId', 'n'], ['MainCatId', '?n'], ['CatName', 's'], ['Status', '?b'], ['Cat_Code', 's'], ['Cat_ImgName', 's'], ['Sequence', '?n'],
  ['isDelete', '?b'], ['AdminCharge', '?n'], ['IsHot_Links', '?b'], ['IsHot_Menu', '?b'], ['IsHot_WithItem', '?b'], ['DelieveryCharge', '?n'],
  ['HandlingCharge', '?n'], ['FixedFee', '?n'], ['TOTALACTIVE', '?n'], ['TOTALQCSEND', '?n'], ['TOTALREADY', '?n'], ['TOTALFAILED', '?n']];
const SUBCATEGORY_SPEC = [['SUBCATID', 'n'], ['CatId', 'n'], ['MainCatId', 'n'], ['SubCatName', 's'], ['Status', '?b'], ['Sub_Cat_Code', 's'],
  ['Sub_Cat_Imgname', 's'], ['Sequence', '?n'], ['IsDelete', '?b'], ['AdminCharge', '?n'], ['IsHot_Links', '?b'], ['IsHot_Menu', '?b'],
  ['IsHot_WithItem', '?b'], ['DelieveryCharge', '?n'], ['HandlingCharge', '?n'], ['FixedFee', '?n'], ['BVPER', '?n'], ['GstGroup', '?n'],
  ['Cashback_Per', '?n'], ['TOTALACTIVE', '?n'], ['TOTALQCSEND', '?n'], ['TOTALREADY', '?n'], ['TOTALFAILED', '?n'], ['RETURN', '?n'],
  ['REFUND', '?n'], ['EXCHANGE', '?n'], ['DAYS', '?n'], ['POLICYREMARKS', 's'], ['RedeemCashback_Per', '?n'], ['ActivationPV_Per', '?n']];

const products = (rows) => mapTyped(rows, PRODUCT_SPEC);
const ok = (res, extra) => res.json([{ status: 'true', message: 'success', ...extra }]);

/** value of a stored-procedure OUT parameter (returned by the PG function as a column of the single row) */
function outVal(row, col) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === col.toLowerCase());
  return k !== undefined ? row[k] : row[Object.keys(row)[0]];
}
const outStr = (v) => (v === null || v === undefined ? '' : String(v)); // SqlParameter.Value.ToString() (DBNull => "")

/** EF6 `a.Col == variable` (string) : case-insensitive collation + null == null semantics */
const textEq = (col, p) => `(lower(${col}) = lower(@${p}::text) or (${col} is null and @${p}::text is null))`;

const shopQ = (sql, p) => query('shopping', sql, p);

/** USP_MANAGEADDTOCART wrapper. Returns { i, cartStatus } */
async function manageAddToCart(mode, sprid, clid, qty, sessionId) {
  const row = await procOne('shopping', 'usp_manageaddtocart', { mode, sprid, clid, qty, sessionid: sessionId });
  // PORT-NOTE: ExecuteSqlCommand returned the affected-row count (0 => "no"); a PG function cannot report it, so a
  // successful call is treated as i = 1.
  return { i: 1, cartStatus: outStr(outVal(row, 'stroutput')) };
}

/** AddProductInCart (public helper of the controller) */
async function AddProductInCart(PRID, Plid, SessionID) {
  let ReturnValue = 'added';
  if (SessionID === null || SessionID === undefined) throw NRE(); // SessionID.ToString()
  const sessionId = String(SessionID);
  let CustCLID = 0;
  if (Plid !== null) CustCLID = convInt32(Plid);
  const r = await manageAddToCart(1, PRID, CustCLID, 1, sessionId);
  if (r.i === 0) ReturnValue = 'no';
  return ReturnValue;
}

/** Getshipingcharge(MPRID) - public non-routed helper (kept for completeness) */
async function Getshipingcharge(MPRID) {
  let shippingcharges = 0;
  const rows = await shopQ('select shippingcharges from ims_subproduct where sprid = @sprid', { sprid: MPRID });
  for (const row of rows) shippingcharges = Number(row.shippingcharges);
  return shippingcharges;
}

/** getvatcharge(MPRID) - public non-routed helper (kept for completeness) */
async function getvatcharge(MPRID) {
  let vatcharges = 0;
  const VatCategoryId = await scalar('shopping', 'select vatcategoryid from ims_subproduct where sprid = @sprid limit 1', { sprid: MPRID });
  const row = await scalar('shopping', 'select vcid from tbl_vat_categories where vcid = @vcid limit 1', { vcid: VatCategoryId === null ? 0 : VatCategoryId });
  if (row === null || row === undefined) vatcharges = 0; else vatcharges = Number(row);
  return vatcharges;
}

// ---------------------------------------------------------------------------------------------------------
// product lists (public)
// ---------------------------------------------------------------------------------------------------------

// public
router.post('/api/TrendingProduct', asyncHandler(async (req, res) => {
  let list = [];
  try {
    const DID = convInt32(config.app.DID);
    const rows = await proc('shopping', 'usp_get_trending_products', {
      maincatid: 0, catid: 0, subcatid: 0, sorting: '', querystring: '', pageno: 1, noofrows: 100, did: DID,
    });
    list = products(rows);
  } catch (ex) {
    list = null;
  }
  ok(res, { data: list });
}));

// public
router.post('/api/SuperValueOffers', asyncHandler(async (req, res) => {
  let list = [];
  try {
    const DID = convInt32(config.app.DID);
    const rows = await proc('shopping', 'usp_get_supervalueoffers_products', {
      maincatid: 0, catid: 0, subcatid: 0, sorting: '', querystring: '', pageno: 1, noofrows: 100, plid: 0, ipaddress: '', did: DID,
    });
    list = products(rows);
  } catch (ex) {
    list = null;
  }
  ok(res, { data: list });
}));

// public
router.post('/api/LatestProducts', asyncHandler(async (req, res) => {
  let list = [];
  try {
    const DID = convInt32(config.app.DID);
    const rows = await proc('shopping', 'usp_get_latest_products', {
      maincatid: 0, catid: 0, subcatid: 0, sorting: '', querystring: '', pageno: 1, noofrows: 20, did: DID,
    });
    list = products(rows);
  } catch (ex) {
    list = null;
  }
  ok(res, { data: list });
}));

// public
router.post('/api/GetOfferProducts', asyncHandler(async (req, res) => {
  const _offer = new ManageOfferData();
  let list = [];
  try {
    list = await _offer.GetOfferProductList();
  } catch (ex) {
    list = null;
  }
  ok(res, { data: list });
}));

function readCookie(req, name) {
  const h = req.headers.cookie;
  if (!h) return null;
  for (const part of String(h).split(';')) {
    const i = part.indexOf('=');
    const k = (i < 0 ? part : part.slice(0, i)).trim();
    if (k === name) return i < 0 ? '' : part.slice(i + 1).trim();
  }
  return null;
}

// public
router.post('/api/RecentlyViewedProducts', asyncHandler(async (req, res) => {
  const Products = str(req.p.Products);
  let list = [];
  try {
    if (Products !== null) {
      const cookiesSPRID = readCookie(req, 'product_id');
      // PORT-NOTE: legacy passed the HttpCookie object itself as @SPRID; when the cookie exists ADO.NET throws
      // ("No mapping exists from object type HttpCookie") which the catch turned into data = null. Reproduced here.
      if (cookiesSPRID !== null) throw new Error('No mapping exists from object type System.Web.HttpCookie to a known managed provider native type.');
      const rows = await proc('shopping', 'usp_get_recentlyvieweditems', { mode: 1, sprid: null });
      list = products(rows);
    } else {
      list = null;
    }
  } catch (ex) {
    list = null;
  }
  ok(res, { data: list });
}));

// public
router.post('/api/SaveSystemEnquiry', asyncHandler(async (req, res) => {
  const LookingFor = str(req.p.LookingFor);
  const EmailId = str(req.p.EmailId);
  const Mbile = str(req.p.Mbile);
  // PORT-NOTE: legacy executed this on the DataBaseContext connection with a [db_shopping] cross-db prefix; run on 'shopping'.
  const row = await procOne('shopping', 'usp_managesystemenquiry', { mobile: Mbile, emailid: EmailId, lookingfor: LookingFor });
  const ReturnOutPut = outStr(outVal(row, 'intresult'));
  ok(res, { data: ReturnOutPut });
}));

// ---------------------------------------------------------------------------------------------------------
// cart (protected)
// ---------------------------------------------------------------------------------------------------------

// auth
router.post('/api/GetShoppingCartItems', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const SessionID = str(req.p.SessionID);
  let CLID = 0;
  let cartItems = [];
  try {
    if (Plid !== null) CLID = convInt64(Plid);
    if (SessionID === null) throw NRE();
    const sessionId = String(SessionID);
    const rows = await proc('shopping', 'usp_getshoppingcartitems', { clid: CLID, sessionid: sessionId });
    cartItems = mapTyped(rows, CART_ITEM_SPEC);
  } catch (ex) {
    cartItems = null;
  }
  ok(res, { data: cartItems });
}));

// auth
router.post('/api/GetShoppingCartItemsCount', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const SessionID = str(req.p.SessionID);
  let cartItemsCount = 0;
  let CLID = 0;
  try {
    if (Plid !== null) CLID = convInt64(Plid);
    if (SessionID === null) throw NRE();
    const sessionId = String(SessionID);
    const row = await procOne('shopping', 'usp_getshoppingcartitemscount', { clid: CLID, sessionid: sessionId });
    const v = outVal(row, 'count');
    cartItemsCount = v === null || v === undefined ? 0 : Number(v);
  } catch (ex) {
    cartItemsCount = 0;
  }
  ok(res, { data: cartItemsCount });
}));

// auth
router.post('/api/GetShoppingCartData', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const SessionID = str(req.p.SessionID);
  let CLID = 0;
  let cartItemsCount = 0;
  let cartData = [];
  try {
    if (Plid !== null) CLID = convInt64(Plid);
    if (SessionID === null) throw NRE();
    const sessionId = String(SessionID);
    const rows = await proc('shopping', 'usp_getshoppingcartdata', { clid: CLID, sessionid: sessionId });
    cartData = mapTyped(rows, CART_DATA_SPEC);
    const row = await procOne('shopping', 'usp_getshoppingcartitemscount', { clid: CLID, sessionid: sessionId });
    const v = outVal(row, 'count');
    cartItemsCount = v === null || v === undefined ? 0 : Number(v);
  } catch (ex) {
    cartData = null;
  }
  ok(res, { CountItem: cartItemsCount, data: cartData });
}));

// auth
router.post('/api/getOrderpurchasedetails', auth, asyncHandler(async (req, res) => {
  const sprid = str(req.p.sprid); const Plid = str(req.p.Plid);
  let ret = 0;
  if (Plid === null) {
    ret = 0;
  } else {
    const Customerid = convInt64(Plid);
    // PORT-NOTE: legacy called "db_shoooing.dbo.USPORDERRODUCTDATA" (typo'd, non-existent database => always threw 500).
    // The port calls the existing USPORDERRODUCTDATA procedure on the shopping database.
    const row = await procOne('shopping', 'usporderroductdata', { customerid: Customerid, sprid });
    ret = parseInt(String(outVal(row, 'intresult')), 10);
    if (Number.isNaN(ret)) throw new Error('Input string was not in a correct format.');
  }
  ok(res, { data: ret });
}));

// auth
router.post('/api/InsertProductInCart', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const PRID = reqInt(req.p.PRID, 'PRID'); const SessionID = str(req.p.SessionID);
  let ReturnValue = 'added';
  if (SessionID === null) throw NRE();
  const sessionId = String(SessionID);
  let CustCLID = 0;
  if (Plid !== null) CustCLID = convInt32(Plid);
  const r = await manageAddToCart(1, PRID, CustCLID, 1, sessionId);
  if (r.i === 0) ReturnValue = 'no';
  ok(res, { data: ReturnValue });
}));

// auth
router.post('/api/insertIntoWishList', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const PRID = reqInt(req.p.PRID, 'PRID');
  let ReturnValue = 'added';
  if (Plid === null) {
    ReturnValue = 'login';
    return res.json(ReturnValue);
  }
  const row = await procOne('shopping', 'usp_insertupdatewishlist', { loginid: Plid, sprid: PRID });
  ReturnValue = outStr(outVal(row, 'strresult'));
  return ok(res, { data: ReturnValue });
}));

// auth
router.post('/api/DeleteWishListItem', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const PRID = reqInt(req.p.PRID, 'PRID');
  convInt64(Plid); // Int64 LoginId = Convert.ToInt64(Plid)
  const rows = await shopQ('select wlid from tbl_wishlist where sprid = @prid and status = 1 limit 1', { prid: PRID });
  const row = rows[0];
  if (row) {
    await exec('shopping', 'DELETE FROM tbl_wishlist WHERE wlid = @wlid', { wlid: row.wlid });
    // legacy "Count" (SqlQuery<dynamic> over a DELETE) was always null => nothing appended
    return ok(res, { data: 'Delete from WishList' });
  }
  return ok(res, { data: 'failed' });
}));

// auth
router.post('/api/RemoveWishListItem', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const PRID = reqInt(req.p.PRID, 'PRID'); const SessionID = str(req.p.SessionID);
  const x = await AddProductInCart(PRID, Plid, SessionID);
  if (x === 'added') {
    convInt64(Plid); // Int64 LoginId = Convert.ToInt64(Plid)
    const rows = await shopQ('select wlid from tbl_wishlist where sprid = @prid and status = 1 limit 1', { prid: PRID });
    const row = rows[0];
    if (row) {
      await exec('shopping', 'DELETE FROM tbl_wishlist WHERE wlid = @wlid', { wlid: row.wlid });
      return ok(res, { data: 'added In Cart and remove from WishList' });
    }
    return ok(res, { data: 'failed' });
  }
  return ok(res, { data: 'failed' });
}));

// auth
router.post('/api/WishList', auth, asyncHandler(async (req, res) => {
  // SearchField / SearchValue / fromDate / toDate are defaulted to "" in C# but never used
  const Plid = str(req.p.Plid);
  const LoginId = convInt64(Plid);
  const rows = await proc('shopping', 'usp_user_wish_list', { loginid: String(LoginId), did: 1, mode: 1 });
  // PORT-NOTE: @TotalCount OUT is read from a "totalcount" column of the function result (null/0 when absent).
  const TotalCount = rows.length && rows[0].totalcount !== undefined ? rows[0].totalcount : null;
  const objAllOrderList = mapTyped(rows, WISH_SPEC);
  ok(res, { ProductCount: TotalCount, data: objAllOrderList });
}));

// auth
router.post('/api/AfterDelete_updateQty', auth, asyncHandler(async (req, res) => {
  const PRID = reqInt(req.p.PRID, 'PRID'); const Plid = str(req.p.Plid); const SessionID = str(req.p.SessionID);
  if (SessionID === null) throw NRE();
  const sessionId = String(SessionID);
  let CustCLID = 0;
  if (Plid !== null) CustCLID = convInt32(Plid);
  const r = await manageAddToCart(2, PRID, CustCLID, 1, sessionId);
  ok(res, { data: r.cartStatus });
}));

// auth
router.post('/api/UpdateQuantity', auth, asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid); const PRID = reqInt(req.p.PRID, 'PRID'); const sessionID = str(req.p.sessionID); const qty = reqInt(req.p.qty, 'qty');
  if (sessionID === null) throw NRE();
  const sessionId = String(sessionID);
  let CustCLID = 0;
  if (Plid !== null) CustCLID = convInt32(Plid);
  const r = await manageAddToCart(1, PRID, CustCLID, qty, sessionId);
  ok(res, { data: r.cartStatus });
}));

// ---------------------------------------------------------------------------------------------------------
// search (public)
// ---------------------------------------------------------------------------------------------------------
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const SEARCH_COLS = ['SEARCHRESULT', 'FOMATEDDATA', 'PMID', 'DealsUrl'];

// public
router.post('/api/DataSearchEcommerce', asyncHandler(async (req, res) => {
  let SearchText = str(req.p.SearchText);
  if (SearchText === null) throw NRE();
  SearchText = SearchText.split('+apostopis').join("'");
  // PORT-NOTE: UtilityClass.GetDataSetSPNamed + DataSet.GetXml() reproduced locally: the first result set is serialised
  // as <NewDataSet><dsData>..</dsData></NewDataSet> (NULL columns omitted, like DataSet.GetXml).
  const rows = await proc('shopping', 'usp_datasearch', { serchitem: SearchText });
  let xml;
  if (!rows.length) xml = '<NewDataSet />';
  else {
    xml = '<NewDataSet>';
    for (const r of rows) {
      xml += '<dsData>';
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (v === null || v === undefined) continue;
        const name = SEARCH_COLS.find((c) => c.toLowerCase() === k.toLowerCase()) || k;
        xml += `<${name}>${xmlEsc(v instanceof Date ? netDate(v) : v)}</${name}>`;
      }
      xml += '</dsData>';
    }
    xml += '</NewDataSet>';
  }
  ok(res, { data: xml });
}));

// ---------------------------------------------------------------------------------------------------------
// category / product listing (public)
// ---------------------------------------------------------------------------------------------------------

// public
router.post('/api/AllProductList', asyncHandler(async (req, res) => {
  const Plid = str(req.p.Plid);
  const MainCategoryName = str(req.p.MainCategoryName);
  const CategoryName = str(req.p.CategoryName);
  const SubCategoryName = str(req.p.SubCategoryName);
  let sortBy = str(req.p.sortBy);
  let page = optInt(req.p.page, 'page');
  let Title = str(req.p.Title);
  let MaxRows = optInt(req.p.MaxRows, 'MaxRows');
  let storeid = str(req.p.storeid);
  // offer, price, instock, Discount : bound but never used

  // instance fields of the controller (per request)
  let MAINCATID = 0; let CatId = 0; let SubCatId = 0;
  let CategoryList = ''; // dynamic CategoryList = ""
  let tblCategory = '';
  const subcatelist = [];
  const QueryStrings = '';
  let category = '';

  if (MainCategoryName !== '' && MainCategoryName !== null) category = MainCategoryName;
  if (CategoryName !== null && CategoryName !== '') category = CategoryName;
  if (SubCategoryName !== '' && SubCategoryName !== null) category = SubCategoryName;
  if (storeid === null) storeid = '0';
  if (sortBy === null) sortBy = '';
  if (Title === null) Title = '';

  if (CategoryName === null) throw NRE(); // CategoryName.ToString()
  const catByCode = async (code) => (await shopQ(`select * from tbl_category where ${textEq('cat_code', 'c')} and status = true limit 1`, { c: code }))[0] || null;
  const mainByCode = async (code) => (await shopQ(`select * from tbl_main_category where ${textEq('main_cat_code', 'c')} and status = true limit 1`, { c: code }))[0] || null;
  const mainById = async (id) => (await shopQ('select * from tbl_main_category where maincatid = @id and status = true limit 1', { id }))[0] || null;
  const subByCode = async (code) => (await shopQ(`select * from tbl_sub_category where ${textEq('sub_cat_code', 'c')} and status = true limit 1`, { c: code }))[0] || null;
  const activeSubs = (catId) => shopQ('select * from tbl_sub_category where catid = @catid and status = true and isdelete = false and totalactive > 0', { catid: catId });

  const Cate1 = await catByCode(CategoryName);
  if (Cate1 !== null) {
    const Ctem1 = await mainById(Cate1.maincatid);
    if (Ctem1 !== null) category = Ctem1.maincatname;
  } else {
    category = MainCategoryName;
  }

  const row = await mainByCode(MainCategoryName);
  if (row === null) {
    const rowcat = await catByCode(CategoryName);
    if (rowcat === null) {
      const rowsubcat = await subByCode(SubCategoryName);
      if (rowsubcat === null) {
        // only local variables are touched in the legacy code; MAINCATID = 0
        MAINCATID = 0;
      } else {
        const rowmaincatname = await mainById(rowsubcat.maincatid);
        const rowcatname = (await shopQ('select * from tbl_category where catid = @id and status = true limit 1', { id: rowsubcat.catid }))[0] || null;
        if (rowmaincatname === null) throw NRE(); // rowmaincatname.MainCatName
        if (rowcatname === null) throw NRE(); // rowcatname.CatName
      }
    } else {
      // legacy: rowsubcat == null => rowsubcat.SubCatName (NRE), otherwise falls to row.MAINCATID where row == null (NRE).
      // Every path of this branch ends in a NullReferenceException (HTTP 500) in the legacy API.
      const rowmaincatname = await mainById(rowcat.maincatid);
      if (rowmaincatname === null) throw NRE();
      await subByCode(SubCategoryName);
      throw NRE();
    }
  } else {
    const rowcat = await catByCode(CategoryName);
    if (rowcat !== null) {
      CatId = rowcat.catid;
      CategoryList = mapTyped(await shopQ(
        'select * from tbl_category where maincatid = @m and catid = @c and status = true and isdelete = false and totalactive > 0',
        { m: row.maincatid, c: rowcat.catid }), CATEGORY_SPEC);
      const SubCategoryList = mapTyped(await activeSubs(CatId), SUBCATEGORY_SPEC);
      subcatelist.push(SubCategoryList);
    }
    const rowsubcat = await subByCode(SubCategoryName);
    if (rowsubcat !== null) SubCatId = rowsubcat.subcatid;

    if (rowcat === null) {
      const catRows = await shopQ('select * from tbl_category where maincatid = @m and status = true and isdelete = false and totalactive > 0', { m: row.maincatid });
      CategoryList = mapTyped(catRows, CATEGORY_SPEC);
      for (const Item of catRows) {
        subcatelist.push(mapTyped(await activeSubs(Item.catid), SUBCATEGORY_SPEC));
      }
    }
    tblCategory = CategoryList;

    const attr = new IMS_MasterProductAttribute();
    if (rowsubcat !== null) await attr.GetAttributeBySubCatId(rowsubcat.subcatid);
    else if (rowcat !== null) await attr.GetAttributeByCatId(rowcat.catid);
    else await attr.GetAttributeByMainCatId(row.maincatid);

    MAINCATID = row.maincatid;
  }

  // DID from TBL_CUSTOMERLOGIN (value is overwritten below, query kept)
  const PLID = convInt64(Plid);
  await shopQ('select did from tbl_customerlogin where clid = @clid limit 1', { clid: PLID });

  if (MaxRows === null) {
    if (MainCategoryName !== null && MainCategoryName !== '') MaxRows = 50;
    else MaxRows = 999999;
  }
  if (page === null) page = 1;
  if (Title !== '') { MAINCATID = 0; CatId = 0; SubCatId = 0; }

  const DID = convInt32(config.app.DID);
  // PORT-NOTE: @TotalCount / @CURRENTCOUNT OUT values were parsed but never used; not read here.
  const prodRows = await proc('shopping', 'ims_usp_product_searching', {
    maincatid: MAINCATID, catid: CatId, subcatid: SubCatId, sorting: sortBy, querystring: QueryStrings,
    pageno: page, noofrows: MaxRows, did: DID, storeid,
  });
  const Allproduct_Master_Custom = products(prodRows);

  // offer details
  const _offer = new ManageOfferData();
  const sprids = Allproduct_Master_Custom.map((x) => String(x.SPRID));
  const offer_list = await _offer.GetOfferAvailableList(sprids);
  for (const item of Allproduct_Master_Custom) {
    const offer1 = (offer_list || []).find((x) => x.SPRID === item.SPRID);
    if (offer1) { item.IS_OFFER = true; item.OfferDetails = offer1; }
  }

  // related products (result unused in the response, call kept)
  await proc('shopping', 'ims_usp_product_searching_relatedproducts', {
    maincatid: MAINCATID, catid: CatId, subcatid: SubCatId, sorting: '', querystring: '', pageno: page, noofrows: MaxRows, did: DID,
  });

  // SEO management (only fills local variables in the legacy code; calls kept)
  if ((MainCategoryName !== null && MainCategoryName !== '') || (CategoryName !== null && CategoryName !== '') || (SubCategoryName !== null && SubCategoryName !== '')) {
    if (MainCategoryName !== null && MainCategoryName !== '') await WebsiteDetail.GetListPageDetailsOfEComm(MAINCATID, 1);
    if (CategoryName !== null && CategoryName !== '') await WebsiteDetail.GetListPageDetailsOfEComm(CatId, 2);
    if (SubCategoryName !== null && SubCategoryName !== '') await WebsiteDetail.GetListPageDetailsOfEComm(SubCatId, 3);
  }

  ok(res, { data: Allproduct_Master_Custom, CategoryList: tblCategory, SubCategoryList: subcatelist });
}));

// public
router.post('/api/mainProduct_Category_List1', asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'usp_bind_maincategory', { mode: 1 });
  const LiPC = mapTyped(rows, MAIN_CAT1_SPEC);
  const mainmenus = LiPC.filter((x) => x.TotalProduct > 0);
  ok(res, { data: mainmenus });
}));

// public
router.post('/api/Product_Category_List1', asyncHandler(async (req, res) => {
  const MainCatId = reqInt(req.p.MainCatId, 'MainCatId');
  const rows = await shopQ('select * from tbl_category where maincatid = @m and status = true and isdelete = false and totalactive > 0', { m: MainCatId });
  ok(res, { data: mapTyped(rows, CATEGORY_SPEC) });
}));

// public
router.post('/api/Product_SubCategory_List1', asyncHandler(async (req, res) => {
  const CatId = reqInt(req.p.CatId, 'CatId');
  const rows = await shopQ('select * from tbl_sub_category where catid = @c and status = true and isdelete = false and totalactive > 0', { c: CatId });
  ok(res, { data: mapTyped(rows, SUBCATEGORY_SPEC) });
}));

// public
router.post('/api/Product_SubCategoryProduct_List', asyncHandler(async (req, res) => {
  const MAINCATID = reqInt(req.p.MAINCATID, 'MAINCATID');
  const CatId = reqInt(req.p.CatId, 'CatId');
  const SubCatId = reqInt(req.p.SubCatId, 'SubCatId');
  const sortBy = str(req.p.sortBy);
  let page = optInt(req.p.page, 'page');
  let MaxRows = optInt(req.p.MaxRows, 'MaxRows');
  if (MaxRows === null) {
    if (MAINCATID !== 0) MaxRows = 50;
    else MaxRows = 999999;
  }
  if (page === null) page = 1;
  const QueryStrings = '';
  const DID = convInt32(config.app.DID);
  // PORT-NOTE: legacy call omitted @STOREID (procedure default applies); same here.
  const rows = await proc('shopping', 'ims_usp_product_searching', {
    maincatid: MAINCATID, catid: CatId, subcatid: SubCatId, sorting: sortBy, querystring: QueryStrings, pageno: page, noofrows: MaxRows, did: DID,
  });
  ok(res, { data: products(rows) });
}));

// public
router.post('/api/UpdateCategoryIcon', asyncHandler(async (req, res) => {
  const p = str(req.p.path);
  const query_ = "update tbl_Main_Category set Main_Cat_Imgname='<dd>',Category_Icon='<dd>' where MainCatName like'%<cc>%' ";
  const viewQuery = 'select *from tbl_Main_Category where MainCatName in(';
  const utitli = new UtilityCommon();
  let sb = '';
  let sb1 = '';
  const listOfIcons = await utitli.GetReportFiles(p);
  sb1 += viewQuery;
  if (listOfIcons.length > 0) {
    for (const item of listOfIcons) {
      const MainCatName = item.IMAGE_NAME.split('_s').join(',').split(',')[0].split('_').join(' ');
      const addQuery = query_.split('<dd>').join(item.IMAGE_NAME).split('<cc>').join(MainCatName);
      sb += addQuery + ';';
      sb1 += `'${MainCatName}',`;
    }
  }
  res.json({ status: true, query: sb, select: sb1, listOfIcons });
}));

// helpers that are public (non-routed) methods in the C# controller
router.helpers = { Getshipingcharge, getvatcharge, AddProductInCart };

module.exports = router;
