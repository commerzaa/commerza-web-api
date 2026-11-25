'use strict';
/**
 * Shared helpers for portal batch 01 (ClusterofferShopingPortal controllers About_us .. ClassifiedAd).
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports: DB, pageUrl, seoViewBag, toTitleCase, cvtInt32, reqInt, nre, argNull, content, background, masterpageshow,
 *          makingSessionOfAreaCity, listingIndex
 */
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const ps = require('./portal-session');
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');
const GetCountry = require('../../../lib/portal/GetCountry');
const { CompanySettings } = require('../../../lib/portal/CompanySettings');

const DB = 'shopping';

/** HttpContext.Request.Url.ToString() */
function pageUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/** NullReferenceException */
function nre() {
  return new TypeError('Object reference not set to an instance of an object.');
}
/** ArgumentNullException */
function argNull(name) {
  return new Error(`Value cannot be null.\r\nParameter name: ${name}`);
}

/**
 * The "Domain Management" + SEO block repeated in most outer pages:
 *   ViewBag.Canonical = Request.Url; Title/MetaDesc/MetaKeyword = "" then WebsiteDetail.GetWebsiteInfo(wid) if not null.
 * (the try block only reads Request.Url parts: it cannot throw, so ViewBag.Message is never set.)
 */
async function seoViewBag(req, wid, ViewBag = {}) {
  ViewBag.Canonical = pageUrl(req);
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(wid);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return ViewBag;
}

/** new CultureInfo("en-US").TextInfo.ToTitleCase(s): words fully in upper case are kept (acronyms), others => Xxxx. */
function toTitleCase(s) {
  if (s === null || s === undefined) throw argNull('str');
  return String(s).replace(/[\p{L}\p{M}\p{N}'’]+/gu, (w) => {
    if (w === w.toUpperCase()) return w;
    const lower = w.toLowerCase();
    const i = lower.search(/\p{L}/u);
    if (i < 0) return lower;
    return lower.slice(0, i) + lower.charAt(i).toUpperCase() + lower.slice(i + 1);
  });
}

/** Convert.ToInt32(string): null => 0, otherwise int.Parse (FormatException / OverflowException). */
function cvtInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('Input string was not in a correct format.');
    return Math.round(v);
  }
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  const n = Number(t);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}

/**
 * MVC model binding of a non-nullable int/long action parameter: missing or unparsable => ArgumentException
 * ("The parameters dictionary contains a null entry for parameter ...") before the action runs.
 */
function reqInt(v, name, method) {
  let n = null;
  if (v !== undefined && v !== null && String(v).trim() !== '' && /^[+-]?\d+$/.test(String(v).trim())) n = Number(String(v).trim());
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32' for method '${method}'.`);
    e.status = 500;
    throw e;
  }
  return n;
}

/** Non-ActionResult return value of an MVC action => ContentResult(Convert.ToString(value)) ; void => empty result. */
function content(res, value) {
  res.type('text/html');
  return res.send(value === null || value === undefined ? '' : String(value));
}

/** new Thread(...).Start(): fire and forget, errors only logged. */
function background(fn) {
  setImmediate(() => {
    Promise.resolve().then(fn).catch((e) => console.error('[portal batch-01 background]', e && e.message ? e.message : e));
  });
}

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin"; else "" */
const masterpageshow = (req) => (ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '');

/** [DBO].[USP_MAKINGSESSIONOF_AREA_CITY] @CITYNAMEPARAM,@CID,@CTID Out,@CITYNAME Out,@AREANAME Out,@STATENAME Out,@PINCODE Out => OUT values (DBNull => "") */
async function makingSessionOfAreaCity(cityname, cid) {
  const row = await db.procOne(DB, 'usp_makingsessionof_area_city', { citynameparam: cityname, cid });
  const get = (k) => {
    if (!row) return '';
    const key = Object.keys(row).find((x) => x.toLowerCase() === k);
    const v = key === undefined ? null : row[key];
    return v === null || v === undefined ? '' : String(v);
  };
  return { CTID: get('ctid'), CITYNAME: get('cityname'), AREANAME: get('areaname'), STATENAME: get('statename'), PINCODE: get('pincode') };
}

/** GetCityName(string cityname) / GetAreaName(string cityname) of AllOuterDeals / AllSellerList / BusinessList (cid is always 96). */
async function getCityName(req, cityname) {
  // if (Session["COUNTRYID"] == null) cid = 96; else cid = 96;
  ps.sessionGet(req, 'COUNTRYID');
  const cid = 96;
  return (await makingSessionOfAreaCity(cityname, cid)).CITYNAME;
}
async function getAreaName(req, cityname) {
  ps.sessionGet(req, 'COUNTRYID');
  const cid = 96;
  return (await makingSessionOfAreaCity(cityname, cid)).AREANAME;
}

/** GetCountry.SettingVisitor / InitializeVisitorCountrySession block at the top of the listing actions. */
async function countrySessionBlock(req, ViewBag) {
  if (ps.sessionGet(req, 'COUNTRYID') === null) {
    try {
      await GetCountry.SettingVisitor('1');
      await GetCountry.InitializeVisitorCountrySession(req);
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  } else {
    try {
      const Sessionid = ps.getSid(req);
      await GetCountry.SettingVisitor(Sessionid);
    } catch (ex) {
      ViewBag.Message = ex.message;
    }
  }
}

/** class BusinessList (Controllers/BusinessListController.cs) */
const BUSINESS_LIST_PROPS = ['AVGRATING', 'Plid', 'COMEMAILID', 'COMPANYIMAGE', 'COMPLETEADDRESS', 'DETAILSURL', 'MOBILENO', 'NOOFREC', 'PMID',
  'ROWNUMBER', 'TITLE', 'TOTALREVIEWS', 'URL', 'COMPANYDESC'];
/** class RelatedKeywords */
const RELATED_KEYWORDS_PROPS = ['KEYWORDNAME', 'KMID'];

/**
 * Shared body of BusinessListController.Index and AllSellerListController.Index (identical except proc name,
 * PRODUCT_CATEGORY.CategoryRelatedTo and where ViewBag.IsShowCategory is assigned, which has no observable effect).
 * opts: { procName, relatedTo, view }
 */
async function listingIndex(req, res, opts) {
  const ViewBag = {};
  let keywordid = req.p.keywordid === undefined ? null : req.p.keywordid;
  let city = req.p.city === undefined ? null : req.p.city;
  let area = req.p.area === undefined ? null : req.p.area;
  let CityUrl = ''; let areaUrl = '';

  // if (keywordid == null && city == null) IsShowCategory = "1" else "1"
  ViewBag.IsShowCategory = '1';

  keywordid = (keywordid === null ? '' : String(keywordid));
  city = (city === null ? '' : String(city));
  area = (area === null ? '' : String(area));

  ViewBag.Keyword = keywordid;
  ViewBag.city = city;
  ViewBag.area = area;

  await countrySessionBlock(req, ViewBag);

  // For Domain Management Code Start Here
  try {
    const CountryName = 'India';
    // keywordid is never null here (defaulted above); the empty-keyword branch is commented out in legacy.
    keywordid = keywordid.split('-').join(' ');
    keywordid = keywordid.split('(').join('');
    keywordid = keywordid.split(')').join('');
    keywordid = keywordid.trim();
    let keywordUrl = keywordid.split('-').join(' ');
    keywordUrl = toTitleCase(keywordUrl);
    if (city !== null) {
      city = await getCityName(req, city);
      CityUrl = city.split('-').join(' ');
      CityUrl = toTitleCase(CityUrl);
    }
    if (area !== null) {
      area = await getAreaName(req, area);
      areaUrl = area.split('-').join(' ');
      areaUrl = toTitleCase(areaUrl);
    }
    const CompanyName = CompanySettings.CompanyName === null || CompanySettings.CompanyName === undefined ? '' : CompanySettings.CompanyName;
    // For SEO Management Code Start Here
    if (city === null && area === null && (keywordUrl === null || keywordUrl === '')) {
      ViewBag.Title = '' + CompanyName + ' - India Business Details, Directory and Companies';
      ViewBag.MetaDesc = '' + CompanyName + ' - India Business Details and Directory - Online business & companies directory with free business listings of indian companies, Free list yourself at largest & most trusted business directory in india.';
      ViewBag.MetaKeyword = 'Business directory, india business directory, directory of companies';
    } else if (city === null && area === null) {
      ViewBag.IsFotterShow = 1;
      const ObjWebsiteDescription = await WebsiteDetail.GetListPageDetails(keywordid.trim());
      if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
        ViewBag.Heading = ObjWebsiteDescription.Heading;
        ViewBag.Description = ObjWebsiteDescription.Description;
        ViewBag.Title = ObjWebsiteDescription.SeoTitle;
        ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
        ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
      } else {
        const c = (CountryName === 'india' ? 'India' : 'India');
        ViewBag.Title = 'Best ' + keywordUrl + ' in ' + c + ' - ' + CompanyName + '';
        ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + c + '. Get  ' + keywordUrl + ' Companies phone numbers, address, reviews, ratings on ' + CompanyName + '';
        ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + c + '';
      }
    } else if (city !== null && area === null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + CityUrl + ' - Jewria';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + CityUrl + '. Get  ' + keywordUrl + ' Companies phone numbers, address, reviews, ratings on ' + CompanyName + '';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + CityUrl + ' ';
    } else if (city === null && area !== null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + areaUrl + ' - ' + CompanyName + '';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + areaUrl + '. Get  ' + keywordUrl + ' Companies phone numbers, address, reviews, ratings on ' + CompanyName + '';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + areaUrl + ' ';
    } else if (city !== null && area !== null) {
      ViewBag.ShowAlternateUrl = 0;
      ViewBag.Title = 'Best ' + keywordUrl + ' in ' + CityUrl + ' ' + areaUrl + ' - Jewria';
      ViewBag.MetaDesc = 'Best ' + keywordUrl + ' in ' + CityUrl + ' ' + areaUrl + '. Get  ' + keywordUrl + ' Companies phone numbers, address, reviews, ratings on ' + CompanyName + '';
      ViewBag.MetaKeyword = 'Best ' + keywordUrl + ', Best ' + keywordUrl + ' ' + CityUrl + ' ' + areaUrl;
    }
  } catch (ex) {
    ViewBag.Message = ex.message;
  }
  ViewBag.Canonical = pageUrl(req);

  const RandomNo = 1 + Math.floor(Math.random() * 998); // new Random().Next(1, 999)
  const Mode = 's'; let SearchType = ''; const CTID = '0'; const AID = ''; const Pincode = '0'; const PageNo = '1'; const PageSize = '50';
  let CID = ps.sessionGet(req, 'COUNTRYID');
  CID = CID === null ? '' : String(CID); // Convert.ToString(Session["COUNTRYID"])

  ViewBag.MessageForTesting = Mode + '-' + SearchType + '-' + CID + '-' + CTID + '-' + AID + '-' + Pincode + '-' + PageNo + '-' + PageSize + '-' + RandomNo + '-' + keywordid;

  const ObjBusinessList = mapRows(await db.proc(DB, opts.procName, {
    mode: Mode, searchtype: SearchType, cid: CID, ctid: CTID, aid: AID, pincode: Pincode, pageno: PageNo, pagesize: PageSize,
    randnumber: RandomNo, searchtext: keywordid === null ? '' : keywordid.trim(), city: CityUrl === null ? '' : CityUrl.trim(),
    area: areaUrl === null ? '' : areaUrl.trim(),
  }), BUSINESS_LIST_PROPS);

  let ObjRelatedKeywords = [];
  SearchType = '';
  let CatId = 0;
  if (ViewBag.IsShowCategory === '0') {
    // legacy concatenated keywordid into the SQL; parameterised here
    CatId = await db.scalar(DB, `select pc.catid from keyword_master km inner join product_category pc on pc.catid = km.catid
       where km.keywordname = @kw and pc.categoryrelatedto = @rel limit 1`, { kw: keywordid.trim(), rel: opts.relatedTo });
    CatId = CatId === null || CatId === undefined ? 0 : Number(CatId);
    ObjRelatedKeywords = mapRows(await db.query(DB, `select kmid, keywordname from keyword_master
       where catid = @catid and kactive = true and keywordname <> @kw`, { catid: CatId, kw: keywordid.trim() }), RELATED_KEYWORDS_PROPS);
    if (ObjRelatedKeywords.length === 0) {
      CatId = await db.scalar(DB, 'select catid from product_category where catname = @kw and categoryrelatedto = @rel limit 1',
        { kw: keywordid.trim(), rel: opts.relatedTo });
      CatId = CatId === null || CatId === undefined ? 0 : Number(CatId);
      ObjRelatedKeywords = mapRows(await db.query(DB, 'select kmid, keywordname from keyword_master where catid = @catid and kactive = true',
        { catid: CatId }), RELATED_KEYWORDS_PROPS);
    }
  } else if (ViewBag.IsShowCategory === '1') {
    ObjRelatedKeywords = mapRows(await db.query(DB, `select catid as kmid, catname as keywordname from product_category
       where catactive = true and categoryrelatedto = @rel`, { rel: opts.relatedTo }), RELATED_KEYWORDS_PROPS);
  }
  const ObjBusinessListLi = { LiBusinessList: ObjBusinessList, LiRelatedKeywords: ObjRelatedKeywords };
  if (ObjBusinessListLi.LiBusinessList.length === 0 && (ViewBag.Heading === undefined || ViewBag.Heading === null)) {
    // Response.Redirect("/search-not-found") ends the response
    return res.json({ redirect: '/search-not-found' });
  }
  return res.json({ view: opts.view, Model: ObjBusinessListLi, ViewBag });
}

module.exports = {
  DB, pageUrl, seoViewBag, toTitleCase, cvtInt32, reqInt, nre, argNull, content, background, masterpageshow,
  makingSessionOfAreaCity, getCityName, getAreaName, countrySessionBlock, listingIndex, BUSINESS_LIST_PROPS, RELATED_KEYWORDS_PROPS,
};
