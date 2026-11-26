// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\CommonController.cs
'use strict';
// class CommonController => /portal/Common/<Action>{/:id}. Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check (ps.portalSession).
// No RouteConfig url points at CommonController.
// Controller instance fields (sessionctid, sessionctname, ...) live for one request in MVC: they are a per-request `ctx` object here.
// Non-action members: updatemerchantkyc (public static) and SendMailconfirmation (protected, never called) are ported as internal functions.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const GetIP = require('../../lib/portal/GetIP');
const Common = require('../../lib/portal/common');
const CustomerAddressDal = require('../../lib/portal/AddressDAL');
const CompanySettingsMod = require('../../lib/portal/CompanySettings');
const { dataSetGetXml, fire, need } = require('./_shared/batch-02-common');
const {
  DB, NRE, s, strParam, bindInt, bindDouble, toInt32, toDouble, dropNulls, outv, csStr, emptyResult, findAddress, serializeCustomerAddress,
} = require('./_shared/batch-18-common');

const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;
const router = express.Router();
const C = '/portal/Common';

const LOCATION_SEARCH_RECORDS = ['LOCATION', 'FOMATEDLOCATION', 'AREANAME'];
const SEARCH_RECORDS = ['SEARCHRESULT', 'FOMATEDDATA', 'PMID', 'DealsUrl'];
const TREE_VIEW_DETAILS = ['parentRegno', 'childRegno', 'side', 'loginID', 'Name', 'regNo', 'spID', 'spName', 'RegDate', 'DOC', 'Title',
  'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName',
  'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV',
  'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate'];

/** string.Replace(old, new) on a C# string (null => NullReferenceException) */
const csReplace = (v, a, b) => need(v).split(a).join(b);
/** String concatenation of a C# value ("" for null) */
const cat = (v) => (v === undefined || v === null ? '' : String(v));
/** Convert.ToInt32(string) (null => 0, invalid => FormatException) */
const toInt32Str = (v) => toInt32(v === undefined ? null : v);
const g = (req, k) => strParam(req.p[k]);

// ================================================================ ContactUs(Type, name, email, Mobile, message, state, city)
// public
router.all(`${C}/ContactUs{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const name = g(req, 'name'); const email = g(req, 'email'); const Mobile = g(req, 'Mobile'); const message = g(req, 'message');
  const state = g(req, 'state'); const city = g(req, 'city');
  const source = 'Customer Enquiry';
  const rows = await db.proc(DB, 'usp_Submit_Enquiry', dropNulls({
    name, email, subject: '', message, Type: 'Enquiry', replymsg: '', mode: 'Add', Mobile, city, state, Source: source,
  }));
  // PORT-NOTE: ExecuteSqlCommand(...).ToString() returned the affected-row count; usp_Submit_Enquiry mode 'Add' (no SET NOCOUNT)
  // inserts exactly one row into Tbl_Enquiry, so the legacy value is "1".
  const result = '1';
  const out = outv(rows, 'strResult');
  if (out === null) throw NRE(); // (spOutput.Value).ToString() on a null value
  const outputresult = String(out);
  if (outputresult === 'ok') {
    const subject = 'Enquiry Submission';
    const myString = 'Dear ' + cat(name) + ',<br/><br/> Thank you for  showing interest in ' + cat(CompanySettings.CompanyName)
      + '.<br/> This email is to notify you that we have submitted  your Enquiry Successfully.<br/><br/>Regards Admin';
    await UtilityClass.Send('', email, '', '', subject, myString);
    // background thread
    fire(() => UtilityClass.SendMsgOnMobile(Mobile, 'Dear Sir/ Ma\u2019am \r\n Thanks!\r\n for  showing  interest in ' + cat(CompanySettings.CompanyName)
      + ' we have submitted  your Enquiry Successfully .\r\n ' + cat(CompanySettings.CompanyName) + ' Team'));
  }
  return res.json(result);
}));

// ================================================================ GetEncryptedSPRID(SearchText)
// public
router.all(`${C}/GetEncryptedSPRID{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const revalue = await UtilityClass.Encryptword(g(req, 'SearchText'));
  return res.json(revalue);
}));

// ================================================================ DataSearchEcommerce(SearchText)
// public
router.all(`${C}/DataSearchEcommerce{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SearchText = csReplace(g(req, 'SearchText'), '+apostopis', "'");
  const ds = await UtilityClass.GetDataSetSPNamed([{ ParameterName: '@serchItem', Value: SearchText }], 'usp_DataSearch', 'dsData');
  // ds.GetXml()
  return res.json(dataSetGetXml('dsData', (ds && ds.dsData) || []));
}));

// ================================================================ InsertHistoryData(textsearchvalue)
// public (Session["PLID"] optional)
router.all(`${C}/InsertHistoryData{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const textsearchvalue = g(req, 'textsearchvalue');
  let PLID = 0;
  if (ps.isCustomer(req)) PLID = toInt32(req.user.plid);
  // legacy concatenated the values into the SQL text (parameterised here); a null string concatenated as ''
  const n = await db.exec(DB,
    'insert into tbl_searchrecordhistorydatalog (serachvalue, plid, status, createddate) values (@v, @plid, 1, now())',
    { v: cat(textsearchvalue), plid: PLID });
  return res.json(String(n));
}));

// ================================================================ LocationSearch(string Location, int CountryID)
// public
router.all(`${C}/LocationSearch{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let CID = bindInt(req.p.CountryID, 'CountryID');
  let SerachLocationText = g(req, 'Location');
  SerachLocationText = csReplace(SerachLocationText, '+apostopis', "'");
  if (ps.sessionGet(req, 'COUNTRYID') !== null) CID = toInt32(ps.sessionGet(req, 'COUNTRYID'));
  else CID = 96;
  const rows = mapRows(await db.proc(DB, 'USP_MASTER_PINCODE_AREA_CITY_STATE_M', {
    KEYUPVALUE: SerachLocationText.trim(), CID: String(CID).trim(),
  }), LOCATION_SEARCH_RECORDS);
  let lst = "<rss version='2.0'><LocationSerarchRecords>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<LocationText>' + cat(r.LOCATION) + '</LocationText>';
    lst += '<FOMATEDLOCATION>' + cat(r.FOMATEDLOCATION) + '</FOMATEDLOCATION>';
    lst += '<AREANAME>' + cat(r.AREANAME) + '</AREANAME>';
    lst += '</Row>';
  }
  lst += '</LocationSerarchRecords></rss>';
  return res.json(lst);
}));

// ================================================================ DataSearch(string SearchText, int CountryID, string SearchType)
// public
router.all(`${C}/DataSearch{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let CID = bindInt(req.p.CountryID, 'CountryID');
  const SearchText = csReplace(g(req, 'SearchText'), '+apostopis', "'");
  const SearchType = csReplace(g(req, 'SearchType'), '+apostopis', "'");
  if (ps.sessionGet(req, 'COUNTRYID') !== null) CID = toInt32(ps.sessionGet(req, 'COUNTRYID'));
  else CID = 96;
  const rows = mapRows(await db.proc(DB, 'USP_SEARCHRESULT_M', {
    INPUTSEARCHTEXT: SearchText.trim(), CTID: '0', AID: '', CID: String(CID).trim(), SearchType: SearchType.trim(),
  }), SEARCH_RECORDS);
  let lst = "<rss version='2.0'><SerarchRecords>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<SEARCHRESULT>' + cat(r.SEARCHRESULT) + '</SEARCHRESULT>';
    lst += '<FOMATEDDATA>' + cat(r.FOMATEDDATA) + '</FOMATEDDATA>';
    lst += '<PMID>' + cat(r.PMID === null || r.PMID === undefined ? 0 : r.PMID) + '</PMID>';
    lst += '</Row>';
  }
  lst += '</SerarchRecords></rss>';
  return res.json(lst);
}));

// ================================================================ keyword hits management (public methods => MVC actions too)

/** ModifyUrlText(string UrlTest) */
function ModifyUrlText(UrlTest) {
  let u = need(UrlTest).toLowerCase().trim();
  const r = (a, b) => { u = u.split(a).join(b); };
  r('c#', 'C-Sharp'); r(' ', '-'); r('&', 'and'); r('amp;', ''); r('/', '-'); r('\\', '-'); r('.', ''); r(',', '-'); r('|', '-'); r('#', '-');
  r('*', 'star'); r(':', '-'); r('+', 'plus'); r('---', '-'); r('--', '-');
  u = u.trim();
  u = u.replace(/^-+|-+$/g, ''); // Trim('-')
  return u;
}

/** creatingcitysessionobj(string cityname): fills the controller fields of ctx */
async function creatingcitysessionobj(ctx, req, cityname) {
  let cid = 0;
  if (ps.sessionGet(req, 'COUNTRYID') === null) cid = 96;
  else cid = 96; // cid = Convert.ToInt32(Session["COUNTRYID"]) is commented out in legacy
  const rows = await db.proc(DB, 'USP_MAKINGSESSIONOF_AREA_CITY', dropNulls({ CITYNAMEPARAM: cityname, CID: cid }));
  // CTID.Value.ToString() etc. (DBNull => "", Convert.ToInt32("") => FormatException)
  ctx.sessionctid = toInt32Str(csStr(rows, 'CTID'));
  ctx.sessionctname = csStr(rows, 'CITYNAME');
  ctx.sessionstatename = csStr(rows, 'STATENAME');
  ctx.areaname = csStr(rows, 'AREANAME');
  if (ctx.areaname === null || ctx.areaname === '') ctx.sessionareaname = '';
  else ctx.sessionareaname = csStr(rows, 'AREANAME');
  ctx.pincodeout = csStr(rows, 'PINCODE');
  if (ctx.pincodeout === null || ctx.pincodeout === '') ctx.sessionpincode = '';
  else ctx.pincodeout = csStr(rows, 'PINCODE'); // legacy bug kept: sessionpincode is never set to the pincode
}

/** NumberofHits(string keyword, int ctid, string areaname, string pincode, string ipaddress, int CountryID) */
async function NumberofHits(keyword, ctid, areaname, pincode, ipaddress, CountryID) {
  const t = await db.proc(DB, 'USP_NOOF_HITS_FIND_KEYWORD_ID_AND_EXISTS', { KEYWORDNAME: need(keyword).trim() });
  const resultvalue = toInt32(outv(t, 'INTRESULT'));
  if (resultvalue > 0) {
    const keyid = toInt32(outv(t, 'KMID'));
    const catid = toInt32(outv(t, 'CATID'));
    if (keyid !== 0 && catid === 0) {
      const p = await db.proc(DB, 'USP_NOOFHITS', dropNulls({
        KEYID: keyid, CTID: ctid, AREANAME: need(areaname).trim(), IPADDRESS: ipaddress, PINCODE: pincode, CIDIN: CountryID,
      }));
      void toInt32(outv(p, 'INTRESULT')); // int result = Convert.ToInt32(Param[3].Value) (unused)
    } else if (keyid === 0 && catid !== 0) {
      const p = await db.proc(DB, 'USP_NOOFHITS_CAT', dropNulls({
        KEYID: catid, CTID: ctid, AREANAME: need(areaname).trim(), IPADDRESS: ipaddress, PINCODE: pincode, CIDIN: CountryID,
      }));
      void toInt32(outv(p, 'INTRESULT'));
    }
  }
}

/** CreateURl(SelectedSearchType, int SearchType, AreaName, Pincode, CityName, StateName, CountryName, double Cid, SearchText, double Pmid) */
async function CreateURl(SelectedSearchType, SearchType, AreaName, Pincode, CityName, StateName, CountryName, Cid, SearchText, Pmid) {
  let Url = ''; let Location = ''; let UnMatchText = '';
  if (SearchType === 2 || SearchType === 3 || SearchType === 0) {
    if (SearchType === 0) UnMatchText = ' 31215451t';
    else UnMatchText = '';
    if (StateName !== '' && CityName !== '' && AreaName !== '' && Pincode !== '') {
      Location = cat(AreaName) + ' (' + cat(Pincode) + ')' + ' in' + ' ' + cat(CityName) + ' in' + ' ' + cat(StateName) + ' in' + ' ' + cat(CountryName) + '';
    }
    if (StateName !== '' && CityName !== '' && AreaName !== '' && Pincode === '') {
      Location = cat(AreaName) + ' in' + ' ' + cat(CityName) + ' in' + ' ' + cat(StateName) + ' in' + ' ' + cat(CountryName) + '';
    }
    if (StateName !== '' && CityName !== '' && AreaName === '' && Pincode === '') {
      Location = cat(CityName) + ' in' + ' ' + cat(StateName) + ' in' + ' ' + cat(CountryName) + '';
    }
    if (StateName === '' && CityName === '' && AreaName === '' && Pincode === '') {
      Location = CountryName;
    }
    Location = ModifyUrlText(Location); // eslint-disable-line no-unused-vars
    SearchText = ModifyUrlText(cat(SearchText) + UnMatchText);
    if (SelectedSearchType === '1') {
      if (AreaName === '') {
        if (CityName !== '') Url = 'listing/' + SearchText + '/' + ModifyUrlText(CityName);
        else Url = 'listing/' + SearchText;
      } else {
        Url = 'listing/' + SearchText + '/' + ModifyUrlText(CityName) + '/' + ModifyUrlText(AreaName) + '';
      }
    } else if (SelectedSearchType === '2') {
      if (AreaName === '') {
        if (CityName !== '') Url = 'deals-offers/' + SearchText + '/' + ModifyUrlText(CityName);
        else Url = 'deals-offers/' + SearchText;
      } else {
        Url = 'deals-offers/' + SearchText + '/' + ModifyUrlText(CityName) + '/' + ModifyUrlText(AreaName) + '';
      }
    }
  }
  if (SearchType === 1) {
    if (SelectedSearchType === '1') {
      const p = await db.proc(DB, 'USP_GETTITLEANDCATEGORY', dropNulls({ PMID: Pmid, CID: Cid, TITLEINPUT: SearchText }));
      let Title = csStr(p, 'TITLEOUTPUT');
      const CategoryName = csStr(p, 'CATNAMEOUTPUT'); // eslint-disable-line no-unused-vars
      const CityNameTemp = csStr(p, 'CITYNAME');
      const pmidTemp = csStr(p, 'PMIDOUT'); // eslint-disable-line no-unused-vars
      if (Title.includes('.')) Title = Title.split('.').join('');
      if (CityNameTemp !== '') Url = Title;
      else Url = Title;
      Url = ModifyUrlText(Url);
    } else if (SelectedSearchType === '2') {
      // legacy concatenated DEALID=" + Pmid (parameterised here)
      const r = await db.queryOne(DB,
        "select replace(replace(genratingdeallistingsurl(dealid), '/', '/'), '''', '+opos') as url from portal_deal_master where dealid = @Pmid limit 1",
        { Pmid });
      Url = r ? r.url : null;
      if (Url === null || Url === undefined) throw NRE();
      Url = String(Url);
      if (Url.length < 1) throw new RangeError('Length cannot be less than zero.\r\nParameter name: length');
      Url = Url.substring(1, Url.length);
    }
  }
  return Url;
}

// ================================================================ GetSearchUrl(SearchType, cityname, searchval, pmidSearch)
// public
router.all(`${C}/GetSearchUrl{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctx = { sessionctid: 0, sessionctname: '', sessionstatename: '', sessionareaname: '', sessionpincode: '', sessionCountryName: '', areaname: '', pincodeout: '' };
  let SearchType = g(req, 'SearchType'); let cityname = g(req, 'cityname'); let searchval = g(req, 'searchval'); let pmidSearch = g(req, 'pmidSearch');
  let FinalUrl = '';
  if (pmidSearch === 'undefined' || pmidSearch === null) pmidSearch = '0';
  cityname = csReplace(cityname, '+apostopis', "'");
  searchval = csReplace(searchval, '+apostopis', "'");
  SearchType = csReplace(SearchType, '+apostopis', "'");
  let searchtypeoutput = 0;
  if (cityname !== '') await creatingcitysessionobj(ctx, req, cityname);
  const cityhits = ctx.sessionctid !== 0 ? toInt32(ctx.sessionctid) : 0;
  const areahits = ctx.sessionareaname !== '' ? ctx.sessionareaname : '';
  const localIpaddress = await GetIP.GetLocalIP(req);
  const countryid = toInt32(ps.sessionGet(req, 'countryid'));
  const kw = searchval.trim(); const pin = ctx.sessionpincode;
  // new Thread(() => NumberofHits(...)).Start()
  fire(() => NumberofHits(kw, cityhits, areahits, pin, localIpaddress, countryid));
  const t = await db.proc(DB, 'FINDTYPEOFSEARCH', { SEARCHVALUE: searchval.trim(), CID: countryid, SearchTypeParam: toInt32Str(SearchType) });
  const intresultout = toInt32(outv(t, 'INTRESULT'));
  if (intresultout > 0) {
    searchtypeoutput = toInt32(outv(t, 'SEARCHTYPE'));
    // searchlogmaintain(...) is commented out in legacy
  } else {
    searchtypeoutput = 0;
  }
  ctx.sessionCountryName = s(ps.sessionGet(req, 'countryName'));
  FinalUrl = await CreateURl(SearchType, searchtypeoutput, ctx.sessionareaname.trim(), ctx.sessionpincode.trim(), ctx.sessionctname.trim(),
    ctx.sessionstatename.trim(), ctx.sessionCountryName, toDouble(ps.sessionGet(req, 'countryid')), searchval.trim(), toDouble(pmidSearch));
  ps.sessionSet(req, 'SelectedCity', cityname);
  ps.sessionSet(req, 'SearchedItem', searchval);
  return res.json(FinalUrl);
}));

// ================================================================ searchlogmaintain(keyword, int ctid, areaname, searchtype, int cid)  (public void)
// public
router.all(`${C}/searchlogmaintain{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const keyword = g(req, 'keyword'); const ctid = bindInt(req.p.ctid, 'ctid'); const areaname = g(req, 'areaname');
  const searchtype = g(req, 'searchtype'); const cid = bindInt(req.p.cid, 'cid');
  void ctid; void areaname; void cid;
  try {
    const t = await db.proc(DB, 'USP_FINDING_SEARCH_CRITERIA_FOR_LOG', { SEARCHVALUE: need(keyword).trim(), SEARCHTYPE: toInt32Str(searchtype) });
    const resultvalue = toInt32(outv(t, 'INTRESULT'));
    if (resultvalue > 0) {
      const ctx = { pmid: toInt32(outv(t, 'PMID')), keyid: toInt32(outv(t, 'KMID')), catid: toInt32(outv(t, 'CATID')) };
      void ctx;
      let ipaddress = s(await GetIP.GetLocalIP(req));
      if (ipaddress.includes(',')) ipaddress = ipaddress.substring(0, ipaddress.indexOf(','));
      const loc = ps.sessionGet(req, 'Propertysessionofcountrystatecity');
      if (loc !== null) {
        need(loc.CountryName).trim(); need(loc.RegionName).trim(); need(loc.CityName).trim();
        // PORT-NOTE: the legacy text "USP_SEARCHLOG @SEARCHVALUE,@SEARCHTYPE,@INTRESULT Out,@PMID Out,@KMID Out,@CATID Out" references
        // variables that are not in its parameter array (@PMID/@KMID/@CATID) => SqlException "Must declare the scalar variable", always
        // swallowed by the catch below. The procedure is therefore never executed here either.
        throw new Error('Must declare the scalar variable "@PMID".');
      }
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message (no view)
  }
  return emptyResult(res);
}));

// ================================================================ searchnotfoundlog(search, int ctid, areaname, catid)  (public void)
// public
router.all(`${C}/searchnotfoundlog{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const search = g(req, 'search'); const ctid = bindInt(req.p.ctid, 'ctid'); const areaname = g(req, 'areaname');
  let catid = g(req, 'catid');
  try {
    // legacy concatenated '" + search + "' (parameterised here)
    const TotalKeyword = toInt32(await db.scalar(DB, 'select count(1) from keyword_master where ltrim(rtrim(keywordname)) = @search', { search: cat(search) }));
    const ipaddress = await GetIP.GetLocalIP(req);
    const P = { SEARCHITEM: search, CTID: ctid, AREANAME: need(areaname).trim(), IPADDRESS: ipaddress, CATID: catid };
    if (TotalKeyword !== 0) {
      const kmid = toInt32(await db.scalar(DB, 'select kmid from keyword_master where ltrim(rtrim(keywordname)) = @search limit 1', { search: cat(search) }));
      P.KMID = kmid;
      catid = '0'; // legacy: assigned after Param[5] was built, so @CATID keeps the original value
    } else {
      P.KMID = 0;
    }
    await db.proc(DB, 'USP_SEARCHNOTFOUNDLOG', dropNulls(P));
  } catch (Exp) {
    // ViewBag.Message = Exp.Message (no view)
  }
  return emptyResult(res);
}));

// ================================================================ creatingcitysessionobj(cityname)  (public void)
// public
router.all(`${C}/creatingcitysessionobj{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctx = {};
  await creatingcitysessionobj(ctx, req, g(req, 'cityname'));
  return emptyResult(res);
}));

// ================================================================ NumberofHits(keyword, int ctid, areaname, pincode, ipaddress, int CountryID)  (public void)
// public
router.all(`${C}/NumberofHits{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ctid = bindInt(req.p.ctid, 'ctid'); const CountryID = bindInt(req.p.CountryID, 'CountryID');
  await NumberofHits(g(req, 'keyword'), ctid, g(req, 'areaname'), g(req, 'pincode'), g(req, 'ipaddress'), CountryID);
  return emptyResult(res);
}));

// ================================================================ CreateURl(...)  (public string => ContentResult)
// public
router.all(`${C}/CreateURl{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SearchType = bindInt(req.p.SearchType, 'SearchType');
  const Cid = bindDouble(req.p.Cid, 'Cid');
  const Pmid = bindDouble(req.p.Pmid, 'Pmid');
  const Url = await CreateURl(g(req, 'SelectedSearchType'), SearchType, g(req, 'AreaName'), g(req, 'Pincode'), g(req, 'CityName'),
    g(req, 'StateName'), g(req, 'CountryName'), Cid, g(req, 'SearchText'), Pmid);
  return res.type('text/html').send(Url);
}));

// ================================================================ ModifyUrlText(UrlTest)  (public string => ContentResult)
// public
router.all(`${C}/ModifyUrlText{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  return res.type('text/html').send(ModifyUrlText(g(req, 'UrlTest')));
}));

// ================================================================ showreview(int ReviewType)
// public
router.all(`${C}/showreview{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ReviewType = bindInt(req.p.ReviewType, 'ReviewType');
  let pmid = 0;
  if (ps.sessionGet(req, 'reviewPMID') !== null) pmid = toInt32(ps.sessionGet(req, 'reviewPMID'));
  const DetailList = await new Common().GetProductReviewsAndComments(pmid, ReviewType);
  return res.json(DetailList);
}));

// ================================================================ showreviewDeals()
// public
router.all(`${C}/showreviewDeals{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let DealId = 0;
  if (ps.sessionGet(req, 'reviewDEALID') !== null) DealId = toInt32(ps.sessionGet(req, 'reviewDEALID'));
  const DetailList = await new Common().GetProductReviewsAndCommentsDEAL(DealId);
  return res.json(DetailList);
}));

// ================================================================ insreviewsandcomments(int RWID, NAME, EMAIL, RATE, TYPE, REVIEW)
// public (anonymous review with EMAIL; without EMAIL the session is required and "expired" is returned without it)
router.all(`${C}/insreviewsandcomments{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const RWID = bindInt(req.p.RWID, 'RWID');
  const NAME = g(req, 'NAME'); let EMAIL = g(req, 'EMAIL'); const RATE = g(req, 'RATE'); const TYPE = g(req, 'TYPE'); const REVIEW = g(req, 'REVIEW');
  let PLID = 0;
  let ReviewType = 1;
  if (EMAIL === '' || EMAIL === null) {
    if (!ps.isCustomer(req)) return res.json('expired');
    PLID = toInt32(req.user.plid);
    ReviewType = 2;
    // legacy concatenated CLID='" + PLID + "' (parameterised here)
    const r = await db.queryOne(DB, 'select loginid from tbl_customerlogin where clid = @PLID limit 1', { PLID });
    EMAIL = r ? r.loginid : null;
  }
  const pmid = toInt32(ps.sessionGet(req, 'reviewPMID'));
  const DetailList = await new Common().InsertReviewsAndComments(pmid, RWID, NAME, EMAIL, toInt32Str(RATE), TYPE, REVIEW, ReviewType);
  return res.json(DetailList);
}));

/** public static int updatemerchantkyc(double plid) - static, not an MVC action (no caller in the portal); ported for completeness. */
async function updatemerchantkyc(plid) { // eslint-disable-line no-unused-vars
  let result = 0;
  // "Select distinct count(1) ..." = one count row
  const countkyc = toInt32(await db.scalar(DB, 'select count(1) from kyc where isaprove = 0 and regno = @plid', { plid }));
  const countbankverifyied = toInt32(await db.scalar(DB, 'select count(1) from bank_accounts_merchant where plid = @plid and active = true and isaprove = 0', { plid }));
  const Entitype = toInt32(await db.scalar(DB, 'select distinct entitytype from tbl_businesskycdetails where plid = @plid limit 1', { plid }));
  if ((Entitype === 1 && countkyc === 2 && countbankverifyied === 1) || (Entitype === 3 && countkyc === 6 && countbankverifyied === 1)) {
    await db.exec(DB, 'update portal_login set iskycapproved = 2 where plid = @plid and active = true', { plid });
    result = 1;
  } else {
    result = 0;
  }
  return result;
}

// ================================================================ insreviewsandcommentsDeals(int RWID, NAME, EMAIL, RATE, TYPE, REVIEW)
// public
router.all(`${C}/insreviewsandcommentsDeals{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const RWID = bindInt(req.p.RWID, 'RWID');
  let DealId = 0;
  if (ps.sessionGet(req, 'reviewDEALID') !== null) DealId = toInt32(ps.sessionGet(req, 'reviewDEALID'));
  const DetailList = await new Common().InsertReviewsAndCommentsDeals(DealId, RWID, g(req, 'NAME'), g(req, 'EMAIL'), toInt32Str(g(req, 'RATE')),
    g(req, 'TYPE'), g(req, 'REVIEW'));
  return res.json(DetailList);
}));

// ================================================================ validatePlacementAndWithSponsor(SponsorID, PlacementID)
// public
router.all(`${C}/validatePlacementAndWithSponsor{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const SponsorID = g(req, 'SponsorID');
  let RetMsg = 'Invalid';
  const RowSp = await db.queryOne(DB, 'select loginid from portal_login where username is not distinct from @SponsorID and active = true limit 1', { SponsorID });
  if (RowSp === null) return res.json(RetMsg);
  RetMsg = 'valid|^' + cat(RowSp.loginid);
  return res.json(RetMsg);
}));

// ================================================================ GetPlacement(MemberID)
// public
router.all(`${C}/GetPlacement{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const MemberID = g(req, 'MemberID');
  let RetMsg = 'Invalid';
  const Row = await db.queryOne(DB, 'select loginid from portal_login where loginid is not distinct from @MemberID and active = true limit 1', { MemberID });
  if (Row !== null) RetMsg = 'valid|^' + cat(Row.loginid);
  return res.json(RetMsg);
}));

/** shared body of CheckLoginValidAndInDownline / CheckSponserValidInUpline */
async function checkMember(req, res, upline) {
  const LoginID = g(req, 'LoginID'); const LoginType = g(req, 'LoginType');
  let ret = 'ok';
  const chars = UtilityClass.SpecialCharsForLoginID;
  const indexOf = [...need(LoginID)].findIndex((ch) => chars.includes(ch));
  if (indexOf >= 0) {
    ret = 'invalid';
    return res.json(ret);
  }
  if (LoginType === 'member') {
    // legacy cast ((Login)Session["Plid"]).Plid without a null check => NullReferenceException (HTTP 500) when not logged in
    if (!ps.isCustomer(req)) throw NRE();
    const sessionID = s(req.user.plid);
    if (sessionID.trim().toLowerCase() !== LoginID.trim().toLowerCase()) {
      // PORT-NOTE: USP_CHECKMEMBERINUPNLINE was called positionally as "@UPLINEID,@MYID,@STRRESULT OUT" while the procedure declares
      // (@SESSIONID, @UPLINEID, @STRRESULT): LoginID went to @SESSIONID and the session id to @UPLINEID. Same mapping in named notation.
      const r = upline
        ? await db.proc(DB, 'USP_CHECKMEMBERINUPNLINE', { SESSIONID: LoginID, UPLINEID: sessionID })
        : await db.proc(DB, 'USP_CHECKMEMBERINDOWNLINE', { SESSIONID: sessionID, LOGINID: LoginID });
      const v = outv(r, 'STRRESULT');
      if (v === null) throw NRE();
      const returnval = String(v);
      if (returnval === 'no') {
        ret = 'invalid';
      } else {
        // legacy concatenated USERNAME='" + LoginID + "' (parameterised here)
        const row = await db.queryOne(DB,
          'select m.loginid from member_master m join portal_login l on m.plid = l.plid where l.username = @LoginID limit 1', { LoginID });
        ret = row ? row.loginid : null;
      }
    }
  }
  return res.json(ret === undefined ? null : ret);
}

// ================================================================ CheckLoginValidAndInDownline(LoginID, LoginType)
// public (session needed only when LoginType == "member")
router.all(`${C}/CheckLoginValidAndInDownline{/:id}`, ps.portalSession, asyncHandler(async (req, res) => checkMember(req, res, false)));

// ================================================================ BindTreeView(double RegNo)
// public
router.all(`${C}/BindTreeView{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const RegNo = bindDouble(req.p.RegNo, 'RegNo');
  const TreeViewDetials = mapRows(await db.proc(DB, 'Usp_CreateTreeView', { REGNO: RegNo, MAXLEVEL: 3 }), TREE_VIEW_DETAILS);
  return res.json(TreeViewDetials);
}));

// ================================================================ CheckSponserValidInUpline(LoginID, LoginType)
// public (session needed only when LoginType == "member")
router.all(`${C}/CheckSponserValidInUpline{/:id}`, ps.portalSession, asyncHandler(async (req, res) => checkMember(req, res, true)));

// ================================================================ TreeToRegistration(tempvalue)
// public
router.all(`${C}/TreeToRegistration{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let ret = 'ok';
  try {
    ps.tempDataSet(req, 'regNoAndSide', g(req, 'tempvalue'));
  } catch (Exp) {
    ret = 'error' + Exp.message;
  }
  return res.json(ret);
}));

/* eslint-disable */
const CONFIRMATION_BODY = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>\r\n<img src='https://$$CompanyDomain$$/images/anav-exchange-logo.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$date$$</td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #000'>Dear $$Name$$</h1>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thank you for contacting $$CompanyName$$.</strong>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\nYour request has been forwarded to our Support Team. And will reach you soon.\r\n</p>\r\n\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues, we will be happy to help you.\r\n</p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$CompanySupportEmailId$$</strong>\r\n<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>\r\n<center>\r\n<img src='http://webmail.jewria.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>\r\n</div>\r\n\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nSincerely,\r\n<br>\r\n$$CompanyName$$ Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<div style='margin-right: 7px'>\r\n<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>\r\n<a href='https://www.facebook.com/ATCShoppingServices/' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>\r\n<a href='https://twitter.com/ATCShoppingServices' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>\r\n<a href='https://plus.google.com/+ATCShoppingIn' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>\r\n<a href='https://www.linkedin.com/company/ATCShopping' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>\r\n<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>\r\n<a href='https://pinterest.com/ATCShoppingServices/' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>\r\n<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>\r\n</div>\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";
/* eslint-enable */

/** protected void SendMailconfirmation(string email, string Name) - not an MVC action and never called in legacy; ported for completeness. */
async function SendMailconfirmation(email, Name) { // eslint-disable-line no-unused-vars
  try {
    const date = new Date().toLocaleString('en-US'); // DateTime.Now.ToString()
    const subject = '' + cat(CompanySettings.CompanyName) + ' contact us';
    const rep = (b, k, v) => b.split(k).join(cat(v));
    let body = CONFIRMATION_BODY;
    body = rep(body, '$$Name$$', Name);
    body = rep(body, '$$date$$', date);
    body = rep(body, '$$CompanyName$$', CompanySettings.CompanyName);
    body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL);
    body = rep(body, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    body = rep(body, '$$CompanySupportEmailId$$', CompanySettings.CompanySupportEmailId);
    await UtilityClass.Send('', email, '', '', subject, body);
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
  }
}

// ================================================================ IsDefaultAddress(AddressId)  [SessionExpireCheck]
// auth
router.all(`${C}/IsDefaultAddress{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const adid = toInt32Str(g(req, 'AddressId')); // Convert.ToInt64(string)
  const adrs = await findAddress(adid);
  if (adrs === null) throw NRE();
  adrs.ToUserType = 'Customer'; // UtilityClass.SeclectUserType.Customer.ToString()
  const pb = await new CustomerAddressDal().IsDefault_Address(adrs, '101,102.1.1');
  return res.json(pb && pb.Success !== undefined ? pb.Success : false);
}));

// ================================================================ GetAddressDetail(AddressId)  [SessionExpireCheck]
// auth (PORT-NOTE: legacy reads any address by Id, no ownership check - kept)
router.all(`${C}/GetAddressDetail{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const adid = toInt32Str(g(req, 'AddressId'));
  const adrs = await findAddress(adid);
  return res.json(serializeCustomerAddress(adrs));
}));

// ================================================================ DeleteMemberAddress(AddressId)  [SessionExpireCheck]
// auth (PORT-NOTE: legacy deletes any address by Id, no ownership check - kept)
router.all(`${C}/DeleteMemberAddress{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const adid = toInt32Str(g(req, 'AddressId'));
  const row = await findAddress(adid);
  if (row === null) throw new Error('Value cannot be null.\r\nParameter name: entity'); // DbSet.Remove(null)
  await db.exec(DB, 'delete from ims_customeraddress where id = @id', { id: adid });
  return res.json(true);
}));

// ================================================================ ConfirmMobileOTP(MobileNo, OTP)
// public (Session["MobileOTP"] is never written in active legacy code => always "Invalid OTP")
router.all(`${C}/ConfirmMobileOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const OTP = g(req, 'OTP');
  const v = ps.sessionGet(req, 'MobileOTP');
  if (v !== null) return res.json(String(v) === OTP ? 'true' : 'false');
  return res.json('Invalid OTP');
}));

// ================================================================ ConfirmEmailOTP(EmailId, OTP)
// public (Session["Emailvcode"] written by UserPanel/Member_Profile)
router.all(`${C}/ConfirmEmailOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const OTP = g(req, 'OTP');
  const v = ps.sessionGet(req, 'Emailvcode');
  if (v !== null) return res.json(String(v) === OTP ? 'true' : 'false');
  return res.json('Invalid OTP');
}));

module.exports = router;
