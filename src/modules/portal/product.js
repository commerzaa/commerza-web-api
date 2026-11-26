'use strict';
// Ported from ClusterofferShopingPortal\Controllers\Product.cs (class ProductController)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const Main_Product_Attributes = require('../../lib/portal/Main_Product_Attributes');
const DealsForYou = require('../../lib/portal/DealsForYou');
const OfferManagerDAL = require('../../lib/portal/OfferManagerDAL');
const CS = require('../../lib/portal/CompanySettings');
const Tbl_Product_Category = require('../../lib/portal/Tbl_Product_Category');
const Main_Product_Category = require('../../lib/portal/Main_Product_Category');
const Product_Sub_Category = require('../../lib/portal/Product_Sub_Category');
const Wish_List = require('../../lib/portal/Wish_List');
const ps = require('./_shared/portal-session');
const { DB, pageUrl, str, NRE, toInt32 } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'Product';
const CompanySettings = CS.CompanySettings || CS;

/** class product_Master_Custom (HomeController.cs) */
const PRODUCT_MASTER_CUSTOM_PROPS = ['CashOnDelivery', 'CatId', 'CreatedDate', 'DAP', 'DealsIds', 'DiscountPercentage', 'FullDescription',
  'IsOutOfStock', 'KeyFeatures', 'MainCategoryId', 'ModifyDate', 'MPRID', 'ProcurementSLA', 'ProductCode', 'ProductImages', 'ProductTitle',
  'PrSKUCode', 'RatingStar', 'ReplacementDay', 'RowNo', 'SellMRP', 'ShippingCharges', 'ShotDescription', 'SPRID', 'StockIn', 'StockNet',
  'StockOut', 'SubCategoryId', 'BV', 'PV', 'CASHBACK', 'Main_Cat_Code', 'Sub_Cat_Code', 'Cat_Code', 'INCLUDINGTAX', 'ACTIVATIONPV_PER',
  'ATTRIBUTEVALUES'];

const companyUrl = () => {
  if (!CompanySettings.CompanyURL && CS.CompanyMasterSettings) CS.CompanyMasterSettings.GetResellerData(); // Global.asax start-up load
  return str(CompanySettings.CompanyURL);
};
const nonEmpty = (v) => v !== null && v !== undefined && v !== '';
const optInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = Number(v); return Number.isInteger(n) ? n : null; };

// EF entity lookups (FirstOrDefault). PORT-NOTE: SQL Server's case-insensitive collation is not reproduced (exact match, like the libs).
const firstCategoryByCode = async (code) => mapRow(await db.queryOne(DB,
  'select * from tbl_category where cat_code = @code and status::int = 1 limit 1', { code: code ?? null }), Tbl_Product_Category.PROPS);
const firstCategoryById = async (catId) => mapRow(await db.queryOne(DB,
  'select * from tbl_category where catid = @catId and status::int = 1 limit 1', { catId }), Tbl_Product_Category.PROPS);
const firstMainById = async (id) => mapRow(await db.queryOne(DB,
  'select * from tbl_main_category where maincatid = @id and status::int = 1 limit 1', { id }), Main_Product_Category.PROPS);
const firstMainByCode = async (code) => mapRow(await db.queryOne(DB,
  'select * from tbl_main_category where main_cat_code = @code and status::int = 1 limit 1', { code: code ?? null }), Main_Product_Category.PROPS);
const firstSubByCode = async (code) => mapRow(await db.queryOne(DB,
  'select * from tbl_sub_category where sub_cat_code = @code and status::int = 1 limit 1', { code: code ?? null }), Product_Sub_Category.PROPS);

/**
 * The Request.Url.AbsoluteUri "?..." splitting of Index/AllProduct. `variant` = 'Index' | 'AllProduct'
 * (the only difference: in the non-"discount" branch Index resets QueryStrings when a part contains "sort", AllProduct does nothing).
 */
function parseQueryStrings(QueryStringsf, sortBy, variant) {
  let QueryStrings = '';
  const UrlArray1 = QueryStringsf.split('?');
  for (let i = 1; i < UrlArray1.length; i++) {
    if (UrlArray1[i].includes('discount')) {
      const splitpage2 = UrlArray1[i].split('&');
      for (let m = 0; m < splitpage2.length; m++) {
        if (splitpage2[m].includes('sort')) { /* skip */ } else if (splitpage2[m].includes('page')) { /* skip */ } else if (splitpage2[m].includes('storeid')) { /* skip */ } else if (splitpage2[m] !== '') {
          QueryStrings = QueryStrings + '&' + splitpage2[m];
        }
      }
      if (QueryStrings !== '') QueryStrings = QueryStrings.substring(1);
    } else {
      const splitpage2 = UrlArray1[i].split('&');
      for (let l = 0; l < splitpage2.length; l++) {
        if (splitpage2[l].includes('sort')) {
          if (variant === 'Index') QueryStrings = '';
        }
        if (splitpage2[l].includes('page')) {
          QueryStrings = '';
        }
        if (splitpage2[l].includes('storeid')) {
          QueryStrings = '';
        } else {
          QueryStrings = QueryStrings + '&' + splitpage2[l];
        }
      }
      if (QueryStrings !== '') QueryStrings = QueryStrings.substring(1);
    }
    if (UrlArray1[i].includes('sort')) {
      const sortbu = UrlArray1[i].split('&');
      for (let j = 0; j < sortbu.length; j++) {
        if (sortbu[j].includes('sort')) {
          const parts = sortbu[j].split('=');
          if (parts.length < 2) throw new Error('Index was outside the bounds of the array.');
          sortBy = parts[1];
        }
      }
    }
  }
  return { QueryStrings, sortBy };
}

/** HttpUtility.ParseQueryString(Request.QueryString.ToString()) as a plain object (repeated keys joined with ",", like NameValueCollection). */
function parsedQuery(req) {
  const qs = (req.originalUrl || '').split('?').slice(1).join('?');
  const out = {};
  for (const [k, v] of new URLSearchParams(qs)) out[k] = k in out ? `${out[k]},${v}` : v;
  return out;
}
const rawQuery = (req) => { const u = req.originalUrl || ''; const i = u.indexOf('?'); return i < 0 ? '' : u.slice(i + 1); };

// ---------------------------------------------------------------- Index(string MainCategoryName, string CategoryName, string SubCategoryName, string sortBy,
//   string offer, string price, string instock, int? page, string Title, string Discount, int? MaxRows)
// public (product browsing; [DistributerSessionExpireCheck] commented out; session optional)
// route-config: "shop/{MainCategoryName}/{CategoryName}/{SubCategoryName}/" -> Product/Index
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/shop/:MainCategoryName{/:CategoryName}{/:SubCategoryName}{/}'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const p = (k) => (req.p[k] === undefined ? null : req.p[k]);
    const MainCategoryName = p('MainCategoryName'); const CategoryName = p('CategoryName'); const SubCategoryName = p('SubCategoryName');
    let sortBy = p('sortBy'); let page = optInt(req.p.page); let Title = p('Title'); let MaxRows = optInt(req.p.MaxRows);
    let MainCatId = 0; let CatId = 0; let SubCatId = 0;
    let QueryStrings = ''; let category = '';
    const ViewBag = {};

    if (MainCategoryName !== '' && MainCategoryName != null) category = MainCategoryName;
    if (CategoryName != null && CategoryName !== '') category = CategoryName;
    if (SubCategoryName !== '' && SubCategoryName != null) category = SubCategoryName;

    if (rawQuery(req) !== '') {
      const parsed = parsedQuery(req);
      const r = parseQueryStrings(pageUrl(req), sortBy, 'Index');
      QueryStrings = r.QueryStrings; sortBy = r.sortBy;
      ViewBag.parsed = parsed;
      ViewBag.Categ = category;
    }
    if (sortBy == null) sortBy = '';
    if (Title == null) Title = '';

    // PORT-NOTE (legacy reproduced): EF evaluated CategoryName.ToString() client-side => NullReferenceException when CategoryName is null.
    if (CategoryName == null) throw NRE();
    const Cate1 = await firstCategoryByCode(String(CategoryName));
    if (Cate1 != null) {
      ViewBag.ActiveCate = Cate1.catname;
      const Ctem1 = await firstMainById(Cate1.maincatId);
      if (Ctem1 != null) {
        ViewBag.CateDemo = mapRows(await db.query(DB, 'select * from tbl_category where maincatid = @id and status::int = 1',
          { id: Ctem1.maincatId }), Tbl_Product_Category.PROPS);
        ViewBag.category = Ctem1.maincatname;
      }
    } else {
      ViewBag.ActiveCate = '';
      ViewBag.category = MainCategoryName;
    }

    const row = await firstMainByCode(MainCategoryName);
    if (row == null) {
      const rowcat = await firstCategoryByCode(CategoryName);
      if (rowcat == null) {
        const rowsubcat = await firstSubByCode(SubCategoryName);
        if (rowsubcat == null) {
          ViewBag.mainCatid = null;
          ViewBag.Catid = null;
          MainCatId = 0; CatId = 0; SubCatId = 0;
          if (category === 'ALL' || category === 'all' || category === 'All' || category == null) ViewBag.empty = 'no';
          else ViewBag.empty = 'NotExist';
        } else {
          const rowmaincatname = await firstMainById(rowsubcat.maincatId);
          const rowcatname = await firstCategoryById(rowsubcat.catId);
          if (rowmaincatname == null) throw NRE();
          ViewBag.maincatname = rowmaincatname.maincatname;
          ViewBag.maincatcode = rowmaincatname.main_cat_code;
          if (rowcatname == null) throw NRE();
          ViewBag.catname = rowcatname.catname;
          ViewBag.catcode = rowcatname.cat_code;
          if (rowsubcat.subcatname == null) throw NRE();
          ViewBag.subcatname = String(rowsubcat.subcatname);
          ViewBag.subcatcode = rowsubcat.sub_cat_code;
          ViewBag.SubCatid = rowsubcat.subcatId;
          SubCatId = rowsubcat.subcatId;
          ViewBag.MainCatForSideValue = rowsubcat.maincatId;
        }
      } else {
        ViewBag.catname = rowcat.catname;
        ViewBag.catcode = rowcat.cat_code;
        const rowmaincatname = await firstMainById(rowcat.maincatId);
        if (rowmaincatname == null) throw NRE();
        ViewBag.maincatname = rowmaincatname.maincatname;
        ViewBag.maincatcode = rowmaincatname.main_cat_code;
        const rowsubcat = await firstSubByCode(SubCategoryName);
        if (rowsubcat == null) {
          // PORT-NOTE (legacy bug reproduced): "if (rowsubcat == null) ViewBag.subcatname = rowsubcat.subcatname" => NullReferenceException
          throw NRE();
        }
        ViewBag.Catid = rowcat.catId;
        CatId = rowcat.catId;
        ViewBag.MainCatForSideValue = rowcat.maincatId;
        // PORT-NOTE (legacy bug reproduced): attr.GetAttributeByMainCatId(row.maincatId) with row == null => NullReferenceException.
        // This whole branch (main category code not found but category found) therefore always failed in legacy.
        throw NRE();
      }
    } else {
      const rowcat = await firstCategoryByCode(CategoryName);
      if (rowcat != null) {
        ViewBag.Catid = rowcat.catId;
        CatId = rowcat.catId;
        ViewBag.catname = rowcat.catname;
        ViewBag.catcode = rowcat.cat_code;
      }
      const rowsubcat = await firstSubByCode(SubCategoryName);
      if (rowsubcat != null) {
        ViewBag.SubCatid = rowsubcat.subcatId;
        SubCatId = rowsubcat.subcatId;
        if (rowsubcat.subcatname == null) throw NRE();
        ViewBag.subcatname = String(rowsubcat.subcatname);
        ViewBag.subcatcode = rowsubcat.sub_cat_code;
      }
      ViewBag.tblCategory = mapRows(await db.query(DB,
        'select * from tbl_category where maincatid = @id and status::int = 1 and isdelete::int = 0', { id: row.maincatId }), Tbl_Product_Category.PROPS);
      const attr = new Main_Product_Attributes();
      let attrlist = [];
      if (rowsubcat != null) attrlist = await attr.GetAttributeBySubCatId(rowsubcat.subcatId);
      else if (rowcat != null) attrlist = await attr.GetAttributeByCatId(rowcat.catId);
      else attrlist = await attr.GetAttributeByMainCatId(row.maincatId);
      ViewBag.ProductAttribute = attrlist;
      ViewBag.maincatname = row.maincatname;
      ViewBag.maincatcode = row.main_cat_code;
      ViewBag.mainCatid = row.maincatId;
      MainCatId = row.maincatId;
      ViewBag.MainCatForSideValue = row.maincatId;
    }

    let DID = 0;
    const LoginDetails = ps.getCustomerLogin(req);
    if (LoginDetails != null) DID = LoginDetails.DID;
    if (MaxRows == null) {
      if (nonEmpty(MainCategoryName)) MaxRows = 50;
      else MaxRows = 999999;
    }
    if (page == null) page = 1;
    if (Title !== '') { MainCatId = 0; CatId = 0; SubCatId = 0; }
    if (config.app.DID === undefined || config.app.DID === null) throw NRE();
    DID = toInt32(String(config.app.DID));

    const searchRows = await db.proc(DB, 'IMS_USP_PRODUCT_SEARCHING', {
      MAINCATID: MainCatId, CATID: CatId, SUBCATID: SubCatId, SORTING: sortBy, QUERYSTRING: QueryStrings, PAGENO: page, NOOFROWS: MaxRows, DID,
    });
    const Allproduct_Master_Custom = mapRows(searchRows, PRODUCT_MASTER_CUSTOM_PROPS);
    const r0 = searchRows[0] || {};
    const TotalRecord = toInt32(str(r0.totalcount)); // int.Parse(spOutput.Value.ToStringOrEmpty())
    const Totalcount = toInt32(str(r0.currentcount));
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.sortBy = sortBy;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.TOTALCOUNT = Totalcount;
    ViewBag.SearchTitle = Title;

    ViewBag.AllRelatedproduct_Master_Custom = mapRows(await db.proc(DB, 'IMS_USP_PRODUCT_SEARCHING_RELATEDPRODUCTS', {
      MAINCATID: MainCatId, CATID: CatId, SUBCATID: SubCatId, SORTING: '', QUERYSTRING: '', PAGENO: page, NOOFROWS: MaxRows, DID,
    }), PRODUCT_MASTER_CUSTOM_PROPS);

    const purl = pageUrl(req);
    const cu = companyUrl();
    // For SEO Management Code
    if (nonEmpty(MainCategoryName) || nonEmpty(CategoryName) || nonEmpty(SubCategoryName)) {
      ViewBag.IsFotterShow = 1;
      let ObjWebsiteDescription = {}; // new WebsiteDescription()
      if (nonEmpty(MainCategoryName)) ObjWebsiteDescription = await WebsiteDetail.GetListPageDetailsOfEComm(MainCatId, 1);
      if (nonEmpty(CategoryName)) ObjWebsiteDescription = await WebsiteDetail.GetListPageDetailsOfEComm(CatId, 2);
      if (nonEmpty(SubCategoryName)) ObjWebsiteDescription = await WebsiteDetail.GetListPageDetailsOfEComm(SubCatId, 3);
      if (ObjWebsiteDescription != null) {
        ViewBag.Heading = ObjWebsiteDescription.Heading ?? null;
        ViewBag.Description = ObjWebsiteDescription.Description ?? null;
        ViewBag.Title = ObjWebsiteDescription.SeoTitle ?? null;
        ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription ?? null;
        ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword ?? null;
        ViewBag.Canonical = purl;
      } else {
        ViewBag.Title = '' + cu + '- Best Online Shopping Site | Buy Mobiles, Electronics, Appliances, Clothing and More Online';
        ViewBag.MetaDesc = "Shop Online for mobiles, electronics, appliances, lifestyle and wide range of original products with cash on delivery and free shipping options only at India&amp;#x27;s Best online shopping website " + cu + '';
        ViewBag.MetaKeyword = 'Online Shopping, India, Books, Store, ' + cu + '';
        ViewBag.Canonical = purl;
      }
    } else {
      ViewBag.Title = '' + cu + ' - Best Online Shopping Site | Buy Mobiles, Electronics, Appliances, Clothing and More Online';
      ViewBag.MetaDesc = "Shop Online for mobiles, electronics, appliances, lifestyle and wide range of original products with cash on delivery and free shipping options only at India&amp;#x27;s Best online shopping website " + cu + '';
      ViewBag.MetaKeyword = 'Online Shopping, India, Books, Store, ' + cu + '';
      ViewBag.Canonical = purl;
    }
    if (ps.isCustomer(req)) {
      ViewBag.Regno = req.user.plid;
      ViewBag.DistributorID = req.user.did;
    }

    // For Maintain The History
    const Obj = new DealsForYou();
    const TempPlid = toInt32(ps.isCustomer(req) ? req.user.plid : 0);
    const ipS = ps.sessionGet(req, 'IPADDRESS');
    const IpAddress = ipS == null ? '' : String(ipS);
    await Obj.MainTainHistoryOfDealsForYou(IpAddress, TempPlid, MainCatId, CatId, SubCatId, 0);

    // Get Offer details with sprids
    const sprids = Allproduct_Master_Custom.map((x) => String(x.SPRID));
    ViewBag.offerList = await new OfferManagerDAL().GetOfferAvailableList(sprids);

    return res.json({ view: '~/Views/Shopping_Listing/Index.cshtml', Model: Allproduct_Master_Custom, ...ViewBag });
  }));

// ---------------------------------------------------------------- AllProduct(string sortBy, string offer, string price, string instock, int? page,
//   string Title, string Discount, string storeid)
// public (product browsing)
// route-config: "shop" -> Product/AllProduct
router.all([`/portal/${C}/AllProduct{/:id}`, '/portal/shop'], ps.portalSession, asyncHandler(async (req, res) => {
  let sortBy = req.p.sortBy ?? null; let storeid = req.p.storeid ?? null; let page = optInt(req.p.page);
  if (sortBy == null) sortBy = '';
  if (storeid == null) storeid = '0';
  let QueryStrings = '';
  const MaxRows = 999999;
  if (page == null) page = 1;
  const ViewBag = {};
  if (rawQuery(req) !== '') {
    const r = parseQueryStrings(pageUrl(req), sortBy, 'AllProduct');
    QueryStrings = r.QueryStrings; sortBy = r.sortBy;
  }
  // PORT-NOTE: legacy passed @CURRENTCOUNT = "0" positionally (it is an OUTPUT parameter of the proc); the PG function returns it as a column.
  const rows = await db.proc(DB, 'IMS_USP_PRODUCT_SEARCHING', {
    MAINCATID: 0, CATID: 0, SUBCATID: 0, SORTING: sortBy, QUERYSTRING: QueryStrings, PAGENO: page, NOOFROWS: MaxRows, DID: 0,
    STOREID: storeid,
  });
  const Allproduct_Master_Custom = mapRows(rows, PRODUCT_MASTER_CUSTOM_PROPS);
  const TotalRecord = toInt32(str((rows[0] || {}).totalcount));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.sortBy = sortBy;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchTitle = '';
  const purl = pageUrl(req);
  const cu = companyUrl();
  ViewBag.Title = '' + cu + ' - Best Online Shopping Site | Buy Mobiles, Electronics, Appliances, Clothing and More Online';
  ViewBag.MetaDesc = "Shop Online for mobiles, electronics, appliances, lifestyle and wide range of original products with cash on delivery and free shipping options only at India&#x27;s Best online shopping website " + cu + '';
  ViewBag.MetaKeyword = 'Online Shopping, India, Books, Store, ' + cu + '';
  ViewBag.Canonical = purl;
  if (ps.isCustomer(req)) ViewBag.Regno = req.user.plid;
  return res.json({ view: '~/Views/Shopping_Listing/Index.cshtml', Model: Allproduct_Master_Custom, ...ViewBag });
}));

/** public static Wish_List GetCustomerWishlistByProduct(Int64 SPRID, Int64 RegNo) - static, not an MVC action (internal helper). */
// eslint-disable-next-line no-unused-vars
async function GetCustomerWishlistByProduct(SPRID, RegNo) {
  try {
    return mapRow(await db.queryOne(DB, `select * from ${Wish_List.TABLE} where regno = @RegNo and sprid = @SPRID and status = 1 limit 1`,
      { RegNo, SPRID }), Wish_List.PROPS);
  } catch (ex) {
    return null;
  }
}

module.exports = router;
module.exports.GetCustomerWishlistByProduct = GetCustomerWishlistByProduct;
