// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\HomeController.cs
'use strict';
// class HomeController => /portal/Home/<Action>{/:id}. Database: shopping (Db_Shopping). No action filter.
// RouteConfig: Default "{controller}/{action}/{id}" (Home/Index) => site root, registered as /portal only (never "/");
//   "reseller/{reseller}" => Home/Index; "Apps/Androidapp" => Home/Download; "shop/women/jewellery" => Home/RedirectInformation
//   (that action is commented out in legacy => 404). "/Home" alone is caught by the "{title}" route (BusinessDetails) in legacy.
// The constructor sets ViewBag.Canonical/Title/MetaDesc/MetaKeyword for every action: included in each view JSON.
// Public non-ActionResult methods (GetProductMainCategories, GetProductSubCategories, GetCustromerNotificationsCount,
// GetCustromerWishlistCount) are MVC actions too (ContentResult of value.ToString()).
const fs = require('fs');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const WebsiteDetail = require('../../lib/portal/WebsiteDetail');
const OfferManagerDAL = require('../../lib/portal/OfferManagerDAL');
const Common = require('../../lib/portal/common');
const Tbl_Product_Category = require('../../lib/portal/Tbl_Product_Category');
const Product_Sub_Category = require('../../lib/portal/Product_Sub_Category');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const {
  DB, NRE, s, bindInt, toInt32, dropNulls, outv, view,
} = require('./_shared/batch-18-common');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const CompanyMasterSettings = CompanySettingsMod.CompanyMasterSettings;
const router = express.Router();
const C = '/portal/Home';

const BANNER = ['ROWNUMBER', 'brId', 'Title', 'Url', 'Status', 'CreateDate'];
const MAIN_CATEGORY = ['MainCategoryId', 'MainCatName', 'main_cat_imgname', 'url', 'product_on_Category'];
const PRODUCT_MASTER_CUSTOM = ['CashOnDelivery', 'CatId', 'CreatedDate', 'DAP', 'DealsIds', 'DiscountPercentage', 'FullDescription', 'IsOutOfStock',
  'KeyFeatures', 'MainCategoryId', 'ModifyDate', 'MPRID', 'ProcurementSLA', 'ProductCode', 'ProductImages', 'ProductTitle', 'PrSKUCode', 'RatingStar',
  'ReplacementDay', 'RowNo', 'SellMRP', 'ShippingCharges', 'ShotDescription', 'SPRID', 'StockIn', 'StockNet', 'StockOut', 'SubCategoryId', 'BV', 'PV',
  'CASHBACK', 'Main_Cat_Code', 'Sub_Cat_Code', 'Cat_Code', 'INCLUDINGTAX', 'ACTIVATIONPV_PER', 'ATTRIBUTEVALUES'];

/** HomeController() constructor ViewBag */
const ctorBag = () => ({ Canonical: CompanySettings.CompanyDomain, Title: '', MetaDesc: '', MetaKeyword: '' });

/** if (Session["Plid"] != null) ViewBag.Regno = ((Login)Session["Plid"]).Plid; */
function regno(req, bag) {
  if (ps.isCustomer(req)) bag.Regno = req.user.plid;
}

/** Layout _OuterSearchLayout: when Session["COUNTRYID"] == null => GetCountry.SettingVisitor (no-op) + InitializeVisitorCountrySession */
function outerLayout(req) {
  if (ps.sessionGet(req, 'COUNTRYID') === null) ps.initializeVisitorCountrySession(req);
}

/** Nullable<int> DID = Convert.ToInt32(AppSettings["DID"].ToString()) (missing key => NullReferenceException) */
function appDID() {
  const v = config.app.DID;
  if (v === undefined || v === null) throw NRE();
  return toInt32(String(v));
}

/** int.Parse(spOutput.Value.ToString()) of the @TOTALCOUNT output */
function parseTotal(rows) {
  // PORT-NOTE: the OUT value is read from the first result row; when the function returns no row/column the (unused) total is skipped
  // instead of throwing (SQL Server always set the OUT parameter).
  if (!rows || !rows.length) return 0;
  const v = outv(rows, 'TOTALCOUNT');
  if (v === null) return 0;
  const n = String(v).trim();
  if (!/^[+-]?\d+$/.test(n)) throw new Error('Input string was not in a correct format.');
  return parseInt(n, 10);
}

// ================================================================ Index()
// public
// route-config: Default "{controller}/{action}/{id}" (root => /portal), "reseller/{reseller}"
router.all([`${C}/Index{/:id}`, '/portal', '/portal/reseller/:reseller'], ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = ctorBag();
  const sessionId = ps.getSid(req); // eslint-disable-line no-unused-vars
  await CompanyMasterSettings.GetResellerData();
  const PageUrl = CompanySettings.CompanyDomain;
  let Ref = null; let sortBy = null; let offer = null;
  ViewBag.Canonical = PageUrl;
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(15);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  // #region Product Section (QueryStrings is computed but unused)
  if (Ref === null) Ref = '';
  if (sortBy === null) sortBy = '';
  if (offer === null) offer = '';
  else offer = await UtilityClass.Decryptword(offer);
  void Ref; void sortBy; void offer;

  // #region Banner Images
  const homebindlist = {
    LiBusinessList: null, LiMostPopularDeals: null, LiAllproduct_Master_Custom: null, LiAllproduct_Master_CustomHot: null,
    LiAllproduct_Master_Deals: null, LiAllproduct_Master_latest: null, LiAllproduct_Master_recentlyadded: null, LiAllBannerList: null, mainCategory: null,
  };
  const banner = mapRows(await db.query(DB, 'select brid, title, url, status, createdate from tbl_homepagebanners where status = 1', {}), BANNER)
    .map((b) => ({ ...b, ROWNUMBER: b.ROWNUMBER === null || b.ROWNUMBER === undefined ? 0 : b.ROWNUMBER }));
  homebindlist.LiAllBannerList = banner;
  const category = mapRows(await db.query(DB, `select imp.maincategoryid, mc.maincatname, mc.main_cat_imgname,
      concat('https://clusteroffer.com/shop/', mc.maincatname) as url,
      count(1) as product_on_category from ims_masterproduct imp
      inner join tbl_main_category mc on mc.maincatid = imp.maincategoryid
      where mc.status = true
      group by imp.maincategoryid, mc.maincatname, mc.main_cat_imgname
      having count(1) > 20`, {}), MAIN_CATEGORY);
  homebindlist.mainCategory = category;
  regno(req, ViewBag);
  // Views/Home/Index.cshtml: if (Session["FavoriteURL"] != null) Session["FavoriteURL"] = null;  + _OuterSearchLayout country session
  if (ps.sessionGet(req, 'FavoriteURL') !== null) ps.sessionSet(req, 'FavoriteURL', null);
  outerLayout(req);
  return view(res, '~/Views/Home/Index.cshtml', homebindlist, ViewBag);
}));

// ================================================================ RedirectInformation (commented out in legacy)
// public
// route-config: "shop/women/jewellery" => Home/RedirectInformation. PORT-NOTE: the action is commented out in legacy, so MVC answered 404.
router.all('/portal/shop/women/jewellery', (req, res) => res.status(404).json({ message: 'The resource cannot be found.' }));

// ================================================================ SaveSystemEnquiry(LookingFor, EmailId, Mbile)
// public
router.all(`${C}/SaveSystemEnquiry{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const g = (k) => (req.p[k] === undefined || req.p[k] === '' ? null : String(req.p[k]));
  await db.proc(DB, 'Usp_ManageSystemEnquiry', dropNulls({ Mobile: g('Mbile'), EmailId: g('EmailId'), LookingFor: g('LookingFor') }));
  // PORT-NOTE: legacy text "[Usp_ManageSystemEnquiry] @Mobile,@EmailId,@LookingFor,@IntResult" passes @IntResult without OUT, so the
  // output parameter was never filled: Convert.ToString(DBNull) => "". Reproduced (the procedure still runs).
  const ReturnOutPut = '';
  return res.json(ReturnOutPut);
}));

// ================================================================ SAVEFAVOURITE(int DealID)
// public (returns "3" without a session)
router.all(`${C}/SAVEFAVOURITE{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const DealID = bindInt(req.p.DealID, 'DealID');
  let resv = 0; let ret = 0; let plid = 0;
  try {
    const obj2 = new Common();
    if (ps.isCustomer(req)) {
      plid = toInt32(req.user.plid);
      ret = await obj2.SaveFavourite(0, plid, DealID);
      if (ret > 0) resv = ret;
    } else {
      resv = 3;
    }
  } catch (e) {
    resv = 0;
  }
  return res.json(String(resv));
}));

// ================================================================ Download()  (FileResult)
// public
// route-config: "Apps/Androidapp"
router.all([`${C}/Download{/:id}`, '/portal/Apps/Androidapp'], ps.portalSession, asyncHandler(async (req, res) => {
  const DownloadFile = config.app.AppURL;
  // File.ReadAllBytes(@"" + DownloadFile + "") ("" => ArgumentException, missing file => FileNotFoundException)
  const p = s(DownloadFile);
  if (p === '') throw new Error('Empty path name is not legal.');
  const fileBytes = fs.readFileSync(p);
  const fileName = 'Reseller_' + s(CompanySettings.DID) + '.apk';
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  return res.send(fileBytes);
}));

// ================================================================ GetTrendingProducts()  (PartialView)
// public
router.all(`${C}/GetTrendingProducts{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = ctorBag();
  let Li = [];
  try {
    const DID = appDID();
    const rows = await db.proc(DB, 'USP_GET_TRENDING_PRODUCTS', {
      MAINCATID: 0, CATID: 0, SUBCATID: 0, SORTING: '', QUERYSTRING: '', PAGENO: 1, NOOFROWS: 10, DID,
    });
    Li = mapRows(rows, PRODUCT_MASTER_CUSTOM);
    regno(req, ViewBag);
    parseTotal(rows); // int TotalRecord (unused)
  } catch (ex) {
    Li = null;
  }
  return view(res, 'GetTrendingProducts', Li, ViewBag);
}));

// ================================================================ GetSuperValueOffers()  (PartialView)
// public
router.all(`${C}/GetSuperValueOffers{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = ctorBag();
  let Li = [];
  try {
    const DID = appDID();
    Li = mapRows(await db.proc(DB, 'USP_GET_SUPERVALUEOFFERS_PRODUCTS', {
      MAINCATID: 0, CATID: 0, SUBCATID: 0, SORTING: '', QUERYSTRING: '', PAGENO: 1, NOOFROWS: 100, PLID: 0, IPADDRESS: '', DID,
    }), PRODUCT_MASTER_CUSTOM);
    regno(req, ViewBag);
  } catch (ex) {
    Li = null;
  }
  return view(res, 'GetSuperValueOffers', Li, ViewBag);
}));

/** GetLatestProducts / GetOfferProducts (same body, different procedure) */
async function latestLike(req, res, procName, viewName) {
  const ViewBag = ctorBag();
  let Li = [];
  try {
    const DID = appDID();
    Li = mapRows(await db.proc(DB, procName, {
      MAINCATID: 0, CATID: 0, SUBCATID: 0, SORTING: '', QUERYSTRING: '', PAGENO: 1, NOOFROWS: 20, DID,
    }), PRODUCT_MASTER_CUSTOM);
    regno(req, ViewBag);
    // Get Offer details with sprids
    const sprids = Li.map((x) => s(x.SPRID === null || x.SPRID === undefined ? 0 : x.SPRID));
    ViewBag.offerList = await new OfferManagerDAL().GetOfferAvailableList(sprids);
  } catch (ex) {
    Li = null;
  }
  return view(res, viewName, Li, ViewBag);
}

// ================================================================ GetLatestProducts()  (PartialView)
// public
router.all(`${C}/GetLatestProducts{/:id}`, ps.portalSession, asyncHandler(async (req, res) => latestLike(req, res, 'USP_GET_LATEST_PRODUCTS', 'GetLatestProducts')));

// ================================================================ GetOfferProducts()  (PartialView)
// public
router.all(`${C}/GetOfferProducts{/:id}`, ps.portalSession, asyncHandler(async (req, res) => latestLike(req, res, 'USP_GET_OFFER_PRODUCTS', 'GetOfferProducts')));

// ================================================================ GetRecentlyViewedProducts()  (PartialView)
// public (reads cookie Products[product_id])
router.all(`${C}/GetRecentlyViewedProducts{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = ctorBag();
  let Li = [];
  try {
    const cookies = ps.parseCookies(req);
    if (cookies.Products !== undefined) {
      const cookiesSPRID = ps.parseCookieValues(cookies.Products).product_id;
      Li = mapRows(await db.proc(DB, 'USP_GET_RECENTLYVIEWEDITEMS', dropNulls({ MODE: 1, SPRID: cookiesSPRID })), PRODUCT_MASTER_CUSTOM);
      regno(req, ViewBag);
    } else {
      Li = null;
    }
  } catch (ex) {
    Li = null;
  }
  return view(res, 'GetRecentlyViewedProducts', Li, ViewBag);
}));

// ================================================================ GetProductMainCategories()  (public List<> => ContentResult)
// public. PORT-NOTE: MVC wrapped the non-ActionResult return value in ContentResult(value.ToString()), i.e. the CLR type name.
router.all(`${C}/GetProductMainCategories{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  await new Tbl_Product_Category().Product_Category_List1();
  return res.type('text/html').send('System.Collections.Generic.List`1[Tbl_Product_Category1]');
}));

// ================================================================ GetProductSubCategories()  (public List<> => ContentResult)
// public. PORT-NOTE: same as GetProductMainCategories (CLR type name).
router.all(`${C}/GetProductSubCategories{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  await new Product_Sub_Category().Product_Sub_Category_List1();
  return res.type('text/html').send('System.Collections.Generic.List`1[Product_Sub_Category1]');
}));

// ================================================================ GetCustromerNotificationsCount()  (public Int32 => ContentResult)
// public (0 without a session)
router.all(`${C}/GetCustromerNotificationsCount{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let Notificationcount = 0;
  if (ps.isCustomer(req)) {
    const CLID = toInt32(req.user.plid);
    // legacy concatenated clid= '" + CLID + "' (parameterised here)
    Notificationcount = toInt32(await db.scalar(DB,
      'select count(1) from tbl_customer_notifications where clid = @CLID and active = 1 and isread = 0', { CLID }));
  }
  return res.type('text/html').send(String(Notificationcount));
}));

// ================================================================ GetCustromerWishlistCount()  (public Int32 => ContentResult)
// public (0 without a session)
router.all(`${C}/GetCustromerWishlistCount{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let Wishlistcount = 0;
  if (ps.isCustomer(req)) {
    const CLID = toInt32(req.user.plid);
    // legacy concatenated LoginId= '" + CLID + "' (varchar column, parameterised here)
    Wishlistcount = toInt32(await db.scalar(DB, 'select count(1) from tbl_wishlist where loginid = @CLID and status = 1', { CLID: String(CLID) }));
  }
  return res.type('text/html').send(String(Wishlistcount));
}));

module.exports = router;
