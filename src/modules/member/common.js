'use strict';
// Ported from Member\Controllers\CommonController.cs (database: affiliate - Member DataBaseContext points at Db_Affiliate)
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const { auth, optionalAuth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');
const common = require('../../lib/member/common');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/Common';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const need = (v) => { if (v === undefined || v === null) throw NRE(); return String(v); };
const nz = (v) => (v === undefined || v === null ? '' : v);
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
// OUT parameters are returned as columns of the first result row
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
// session values (case-insensitive keys, as ASP.NET Session)
const sget = (req, k) => sessionStore.get(req, k.toLowerCase());
const sset = (req, k, v) => sessionStore.set(req, k.toLowerCase(), v);
const SEARCH_COLS = ['SEARCHRESULT', 'FOMATEDDATA', 'PMID', 'DealsUrl'];
const TREE = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title', 'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName', 'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER', 'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER', 'KID'];
const TREE1 = ['parentID', 'childID', 'PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'Active', 'ImageName', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDPV', 'USERNAME', 'PBV', 'DLBV', 'DRBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'RegDate', 'DOC', 'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER', 'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER'];
const SUBMENU = ['MID', 'TITLE', 'HrefTitle'];
const SPECIAL = (UtilityClass && UtilityClass.SpecialCharsForLoginID) ? Array.from(UtilityClass.SpecialCharsForLoginID) : Array.from("!#$%^&*();,?+~`'");
const hasSpecial = (s) => [...s].some((c) => SPECIAL.includes(c));

// ---- GetAddressOnPostCode ----
// public
router.all(`${P}/GetAddressOnPostCode{/:id}`, asyncHandler(async (req, res) => {
  const baseurl = 'http://getpincodes.info/api.php?pincode=' + need(req.p.PostCode);
  const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d] });
  res.json(r.data);
}));

// ---- ContactUs ----
// public
router.all(`${P}/ContactUs{/:id}`, asyncHandler(async (req, res) => {
  const { Type, name, email, Mobile, message } = req.p;
  const rows = await db.proc(DB, 'usp_submitenquiry', {
    name, email, subject: '', type: Type, message, replymsg: '', mode: 'Add', mobile: Mobile,
  });
  const o = outv(rows, 'strresult');
  if (o === undefined || o === null) throw NRE();
  const result = String(o);
  // legacy: background threads (SMS + e-mail); failures must not break the request
  Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(Mobile, message, '1')).catch((e) => console.error(e.message));
  Promise.resolve().then(() => UtilityClass.SendEmailByApiSetting(name, '', '', '', '', '', need(email).toLowerCase(), Type, message, null)).catch((e) => console.error(e.message));
  res.json(result);
}));

// public
router.all(`${P}/GetEncryptedSPRID{/:id}`, asyncHandler(async (req, res) => {
  res.json(await UtilityClass.Encryptword(req.p.SearchText));
}));

// public
router.all(`${P}/DataSearchEcommerce{/:id}`, asyncHandler(async (req, res) => {
  const SearchText = need(req.p.SearchText).split('+apostopis').join("'");
  // PORT-NOTE: UtilityClass.GetDataSetSPNamed + DataSet.GetXml() reproduced locally (table dsData, NULL columns omitted)
  const rows = await db.proc(DB, 'usp_datasearch', { serchItem: SearchText });
  let xml;
  if (!rows.length) xml = '<NewDataSet />';
  else {
    xml = '<NewDataSet>';
    for (const r of rows) {
      xml += '<dsData>';
      for (const k of Object.keys(r)) {
        if (r[k] === null || r[k] === undefined) continue;
        const name = SEARCH_COLS.find((c) => c.toLowerCase() === k.toLowerCase()) || k;
        xml += `<${name}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${name}>`;
      }
      xml += '</dsData>';
    }
    xml += '</NewDataSet>';
  }
  res.json(xml);
}));

// public
router.all(`${P}/LocationSearch{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const SerachLocationText = need(req.p.Location).split('+apostopis').join("'");
  const csid = sget(req, 'COUNTRYID');
  const CID = csid !== undefined && csid !== null ? parseInt(csid, 10) : 96;
  const rows = await db.proc(DB, 'usp_master_pincode_area_city_state_m', { KEYUPVALUE: SerachLocationText.trim(), CID: String(CID).trim() });
  let lst = "<rss version='2.0'><LocationSerarchRecords>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<LocationText>' + nz(r.location) + '</LocationText>';
    lst += '<FOMATEDLOCATION>' + nz(r.fomatedlocation) + '</FOMATEDLOCATION>';
    lst += '<AREANAME>' + nz(r.areaname) + '</AREANAME>';
    lst += '</Row>';
  }
  lst += '</LocationSerarchRecords></rss>';
  res.json(lst);
}));

// ---- keyword hit management (per-request state replaces the controller instance fields) ----
function newState() {
  return { sessionctid: 0, sessionctname: '', sessionstatename: '', sessionareaname: '', sessionpincode: '', sessionCountryName: '', areaname: '', pincodeout: '' };
}

async function creatingcitysessionobj(req, st, cityname) {
  const cid = 96;
  const rows = await db.proc(DB, 'usp_makingsessionof_area_city', { CITYNAMEPARAM: cityname, CID: cid });
  const g = (n) => { const v = outv(rows, n); if (v === undefined || v === null) throw NRE(); return String(v); };
  st.sessionctid = parseInt(g('ctid'), 10);
  st.sessionctname = g('cityname');
  st.sessionstatename = g('statename');
  st.areaname = g('areaname');
  st.sessionareaname = st.areaname === '' ? '' : st.areaname;
  st.pincodeout = g('pincode');
  // legacy: sessionpincode is only ever assigned "" (never the pin code itself)
  if (st.pincodeout === '') st.sessionpincode = '';
}

async function NumberofHits(keyword, ctid, areaname, pincode, ipaddress, CountryID) {
  const rows = await db.proc(DB, 'usp_noof_hits_find_keyword_id_and_exists', { KEYWORDNAME: String(keyword).trim() });
  const resultvalue = parseInt(outv(rows, 'intresult'), 10);
  if (resultvalue > 0) {
    const keyid = parseInt(outv(rows, 'kmid'), 10);
    const catid = parseInt(outv(rows, 'catid'), 10);
    if (keyid !== 0 && catid === 0) {
      await db.proc(DB, 'usp_noofhits', { KEYID: keyid, CTID: ctid, AREANAME: String(areaname).trim(), IPADDRESS: ipaddress, PINCODE: pincode, CIDIN: CountryID });
    } else if (keyid === 0 && catid !== 0) {
      await db.proc(DB, 'usp_noofhits_cat', { KEYID: catid, CTID: ctid, AREANAME: String(areaname).trim(), IPADDRESS: ipaddress, PINCODE: pincode, CIDIN: CountryID });
    }
  }
}

function ModifyUrlText(UrlTest) {
  let u = need(UrlTest).toLowerCase().trim();
  u = u.split('c#').join('C-Sharp');
  u = u.split(' ').join('-');
  u = u.split('&').join('and');
  u = u.split('amp;').join('');
  u = u.split('/').join('-');
  u = u.split('\\').join('-');
  u = u.split('.').join('');
  u = u.split(',').join('-');
  u = u.split('|').join('-');
  u = u.split('#').join('-');
  u = u.split('*').join('star');
  u = u.split(':').join('-');
  u = u.split('+').join('plus');
  u = u.split('---').join('-');
  u = u.split('--').join('-');
  u = u.trim();
  return u.replace(/^-+|-+$/g, '');
}

async function CreateURl(SelectedSearchType, SearchType, AreaName, Pincode, CityName, StateName, CountryName, Cid, SearchText, Pmid) {
  let Url = ''; let Location = ''; let UnMatchText = '';
  if (SearchType === 2 || SearchType === 3 || SearchType === 0) {
    UnMatchText = SearchType === 0 ? ' 31215451t' : '';
    if (StateName !== '' && CityName !== '' && AreaName !== '' && Pincode !== '') Location = AreaName + ' (' + Pincode + ')' + ' in' + ' ' + CityName + ' in' + ' ' + StateName + ' in' + ' ' + CountryName;
    if (StateName !== '' && CityName !== '' && AreaName !== '' && Pincode === '') Location = AreaName + ' in' + ' ' + CityName + ' in' + ' ' + StateName + ' in' + ' ' + CountryName;
    if (StateName !== '' && CityName !== '' && AreaName === '' && Pincode === '') Location = CityName + ' in' + ' ' + StateName + ' in' + ' ' + CountryName;
    if (StateName === '' && CityName === '' && AreaName === '' && Pincode === '') Location = CountryName;
    Location = ModifyUrlText(Location); // result unused in legacy, call kept (may throw like the C#)
    SearchText = ModifyUrlText(SearchText + UnMatchText);
    if (SelectedSearchType === '1') {
      if (AreaName === '') {
        Url = CityName !== '' ? 'listing/' + SearchText + '/' + ModifyUrlText(CityName) : 'listing/' + SearchText;
      } else {
        Url = 'listing/' + SearchText + '/' + ModifyUrlText(CityName) + '/' + ModifyUrlText(AreaName);
      }
    } else if (SelectedSearchType === '2') {
      if (AreaName === '') {
        Url = CityName !== '' ? 'deals-offers/' + SearchText + '/' + ModifyUrlText(CityName) : 'deals-offers/' + SearchText;
      } else {
        Url = 'deals-offers/' + SearchText + '/' + ModifyUrlText(CityName) + '/' + ModifyUrlText(AreaName);
      }
    }
  }
  if (SearchType === 1) {
    if (SelectedSearchType === '1') {
      const rows = await db.proc(DB, 'usp_gettitleandcategory', { PMID: Pmid, CID: Cid, TITLEINPUT: SearchText });
      let Title = String(nz(outv(rows, 'titleoutput')));
      if (Title.includes('.')) Title = Title.split('.').join('');
      Url = Title;
      Url = ModifyUrlText(Url);
    } else if (SelectedSearchType === '2') {
      const u = await db.scalar(DB, `Select REPLACE(REPLACE(genratingdeallistingsurl(dealid),'/','/'),'''','+opos') AS url From portal_deal_master Where dealid = @id limit 1`, { id: Pmid });
      if (u === null || u === undefined) throw NRE();
      Url = String(u);
      Url = Url.substring(1, Url.length);
    }
  }
  return Url;
}

// public
router.all(`${P}/GetSearchUrl{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let { SearchType, cityname, searchval, pmidSearch } = req.p;
  const st = newState();
  if (pmidSearch === 'undefined' || pmidSearch === undefined || pmidSearch === null) pmidSearch = '0';
  cityname = need(cityname).split('+apostopis').join("'");
  searchval = need(searchval).split('+apostopis').join("'");
  SearchType = need(SearchType).split('+apostopis').join("'");
  let searchtypeoutput = 0;
  if (cityname !== '') await creatingcitysessionobj(req, st, cityname);
  const cityhits = st.sessionctid !== 0 ? st.sessionctid : 0;
  const areahits = st.sessionareaname !== '' ? st.sessionareaname : '';
  const localIpaddress = await GetIP.GetLocalIP(req);
  const countryid = parseInt(sget(req, 'countryid'), 10) || 0;
  // legacy: background thread; failures must not break the request
  NumberofHits(searchval.trim(), cityhits, areahits, st.sessionpincode, localIpaddress, countryid).catch((e) => console.error(e.message));
  const rows = await db.proc(DB, 'findtypeofsearch', { SEARCHVALUE: searchval.trim(), CID: countryid, SearchTypeParam: parseInt(SearchType, 10) });
  const intresultout = parseInt(outv(rows, 'intresult'), 10);
  if (intresultout > 0) searchtypeoutput = parseInt(outv(rows, 'searchtype'), 10);
  else searchtypeoutput = 0;
  st.sessionCountryName = String(nz(sget(req, 'countryName')));
  const FinalUrl = await CreateURl(SearchType, searchtypeoutput, st.sessionareaname.trim(), st.sessionpincode.trim(), st.sessionctname.trim(),
    st.sessionstatename.trim(), st.sessionCountryName, countryid, searchval.trim(), Number(pmidSearch));
  sset(req, 'SelectedCity', cityname);
  sset(req, 'SearchedItem', searchval);
  res.json(FinalUrl);
}));

// public (public void action in legacy)
router.all(`${P}/searchlogmaintain{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const keyword = need(req.p.keyword);
  const ctid = parseInt(req.p.ctid, 10);
  const areaname = need(req.p.areaname);
  const searchtype = need(req.p.searchtype);
  const cid = parseInt(req.p.cid, 10);
  try {
    const rows = await db.proc(DB, 'usp_finding_search_criteria_for_log', { SEARCHVALUE: keyword.trim(), SEARCHTYPE: parseInt(searchtype, 10) });
    const resultvalue = parseInt(outv(rows, 'intresult'), 10);
    if (resultvalue > 0) {
      const pmid = parseInt(outv(rows, 'pmid'), 10);
      const keyid = parseInt(outv(rows, 'kmid'), 10);
      const catid = parseInt(outv(rows, 'catid'), 10);
      let ipaddress = await GetIP.GetLocalIP(req);
      if (ipaddress.includes(',')) ipaddress = ipaddress.substring(0, ipaddress.indexOf(','));
      const loc = sget(req, 'Propertysessionofcountrystatecity');
      if (loc !== undefined && loc !== null) {
        let SEARCHID;
        if (searchtype === '1') SEARCHID = pmid;
        if (searchtype === '2') SEARCHID = keyid;
        if (searchtype === '3') SEARCHID = catid;
        // PORT-NOTE: the legacy call text "USP_SEARCHLOG @SEARCHVALUE,@SEARCHTYPE,@INTRESULT Out,@PMID Out,@KMID Out,@CATID Out" does not match
        // the 11 parameters supplied; the supplied named parameters are passed to usp_searchlog instead.
        await db.proc(DB, 'usp_searchlog', {
          SEARCHVALUE: '', SEARCHID, CTID: ctid, AREANAME: areaname.trim(), IPADDRESS: ipaddress, SEARCHTYPE: searchtype, CID: cid,
          IPCOUNTRYNAME: String(loc.CountryName).trim(), IPSTATENAME: String(loc.RegionName).trim(), IPCITYNAME: String(loc.CityName).trim(),
        });
      }
    }
  } catch (Exp) {
    console.error(Exp.message); // ViewBag.Message
  }
  res.status(200).end();
}));

// public (public void action in legacy)
router.all(`${P}/searchnotfoundlog{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const search = need(req.p.search);
  const ctid = parseInt(req.p.ctid, 10);
  const areaname = need(req.p.areaname);
  let catid = req.p.catid;
  try {
    const TotalKeyword = Number(await db.scalar(DB, 'SELECT COUNT(1) FROM keyword_master WHERE trim(keywordname) = @s', { s: search })) || 0;
    const ipaddress = await GetIP.GetLocalIP(req);
    let kmid = 0;
    if (TotalKeyword !== 0) {
      const k = await db.scalar(DB, 'SELECT kmid FROM keyword_master WHERE trim(keywordname) = @s limit 1', { s: search });
      kmid = k === null || k === undefined ? 0 : parseInt(k, 10);
      catid = '0';
    }
    await db.proc(DB, 'usp_searchnotfoundlog', { SEARCHItem: search, CTID: ctid, AREANAME: areaname.trim(), CATID: catid, IPADDRESS: ipaddress, KMID: kmid });
  } catch (Exp) {
    console.error(Exp.message);
  }
  res.status(200).end();
}));

// public (public void action in legacy)
router.all(`${P}/creatingcitysessionobj{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  // PORT-NOTE: legacy stored the result in controller instance fields that are discarded after the request
  await creatingcitysessionobj(req, newState(), need(req.p.cityname));
  res.status(200).end();
}));

// public (public void action in legacy)
router.all(`${P}/NumberofHits{/:id}`, asyncHandler(async (req, res) => {
  await NumberofHits(need(req.p.keyword), parseInt(req.p.ctid, 10), need(req.p.areaname), req.p.pincode, req.p.ipaddress, parseInt(req.p.CountryID, 10));
  res.status(200).end();
}));

// public (public string action in legacy)
router.all(`${P}/CreateURl{/:id}`, asyncHandler(async (req, res) => {
  const p = req.p;
  res.send(await CreateURl(p.SelectedSearchType, parseInt(p.SearchType, 10), p.AreaName, p.Pincode, p.CityName, p.StateName,
    p.CountryName, Number(p.Cid), p.SearchText, Number(p.Pmid)));
}));

// public (public string action in legacy)
router.all(`${P}/ModifyUrlText{/:id}`, asyncHandler(async (req, res) => res.send(ModifyUrlText(req.p.UrlTest))));

// ---- reviews ----
// public
router.all(`${P}/showreview{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const ReviewType = parseInt(req.p.ReviewType, 10);
  const v = sget(req, 'reviewPMID');
  const pmid = v !== undefined && v !== null ? parseInt(v, 10) : 0;
  res.json(await new common().GetProductReviewsAndComments(pmid, ReviewType));
}));

// public
router.all(`${P}/showreviewDeals{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const v = sget(req, 'reviewDEALID');
  const DealId = v !== undefined && v !== null ? parseInt(v, 10) : 0;
  res.json(await new common().GetProductReviewsAndCommentsDEAL(DealId));
}));

// public (session optional)
router.all(`${P}/insreviewsandcomments{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let EMAIL = p.EMAIL;
  let ReviewType = 1;
  if (EMAIL === '' || EMAIL === undefined || EMAIL === null) {
    if (!req.user) return res.json('expired');
    const PLID = parseInt(req.user.plid, 10);
    ReviewType = 2;
    const e = await db.scalar(DB, 'select loginid from portal_login where plid = @p limit 1', { p: PLID });
    EMAIL = e === undefined ? null : e;
  }
  const pmid = parseInt(sget(req, 'reviewPMID'), 10) || 0;
  res.json(await new common().InsertReviewsAndComments(pmid, parseInt(p.RWID, 10), p.NAME, EMAIL, parseInt(p.RATE, 10), p.TYPE, p.REVIEW, ReviewType));
}));

// public
router.all(`${P}/insreviewsandcommentsDeals{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const v = sget(req, 'reviewDEALID');
  const DealId = v !== undefined && v !== null ? parseInt(v, 10) : 0;
  res.json(await new common().InsertReviewsAndCommentsDeals(DealId, parseInt(p.RWID, 10), p.NAME, p.EMAIL, parseInt(p.RATE, 10), p.TYPE, p.REVIEW));
}));

// ---- network validation ----
// public (session only used when SponsorID is empty)
router.all(`${P}/validatePlacementAndWithSponsor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let RetMsg = 'Invalid|^';
  let SponsorID = req.p.SponsorID;
  if (SponsorID === undefined || SponsorID === null || SponsorID === '') {
    if (!req.user) throw NRE();
    SponsorID = req.user.username;
  }
  let RowSp = null;
  if (SponsorID !== '') {
    const rows = await db.proc(DB, 'usp_scalerdata', { Mode: 3, Identity: SponsorID });
    RowSp = rows && rows.length ? mapRows([rows[0]], ['EMAILID', 'FNAME', 'LNAME', 'loginid', 'Kitprice', 'KYCSTATUS'])[0] : null;
  }
  if (RowSp === null) return res.json(RetMsg);
  RetMsg = 'valid|^' + nz(RowSp.EMAILID) + '^' + nz(RowSp.FNAME) + ' ' + nz(RowSp.LNAME) + ' ' + nz(RowSp.LNAME) + '^' + nz(RowSp.Kitprice) + '^' + await UtilityClass.Encryptword(SponsorID) + '^' + (RowSp.KYCSTATUS === true ? 'True' : RowSp.KYCSTATUS === false ? 'False' : '');
  res.json(RetMsg);
}));

// public
router.all(`${P}/CheckUserExistsOnBlur{/:id}`, asyncHandler(async (req, res) => {
  const RetMsg = 'Available|^';
  const RowSp = await db.queryOne(DB, 'Select emailid, fname, lname From member_master WHERE username = @u limit 1', { u: req.p.UserName });
  if (!RowSp) return res.json(RetMsg);
  res.json('Exists|^' + nz(RowSp.emailid) + '^' + nz(RowSp.fname) + ' ' + nz(RowSp.lname) + ' ' + nz(RowSp.lname));
}));

// public
router.all(`${P}/GetPlacement{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'Invalid';
  const Row = await db.queryOne(DB, 'select loginid from portal_login where loginid = @m and active = true limit 1', { m: req.p.MemberID });
  if (Row) RetMsg = 'valid|^' + Row.loginid;
  res.json(RetMsg);
}));

// ---- tree management: member downline checks (session read only when LoginType == "member") ----
async function checkDownline(req, res, procName, regnoSql) {
  const LoginID = need(req.p.LoginID);
  const LoginType = req.p.LoginType;
  let ret = 'ok';
  if (hasSpecial(LoginID)) return res.json('invalid');
  if (LoginType === 'member') {
    if (!req.user) throw NRE();
    const sessionID = String(req.user.plid);
    if (sessionID.trim().toLowerCase() !== LoginID.trim().toLowerCase()) {
      const rows = await db.proc(DB, procName, { SESSIONID: sessionID, LOGINID: LoginID });
      const returnval = String(nz(outv(rows, 'strresult')));
      if (returnval === 'no') ret = 'invalid';
      else {
        const r = await db.scalar(DB, regnoSql, { u: LoginID });
        const LoginIDRet = r === null || r === undefined ? 0 : r; // Int64 FirstOrDefault => 0
        ret = 'Success' + '^' + LoginIDRet;
      }
    }
  }
  return res.json(ret);
}

// public (session optional)
router.all(`${P}/CheckLoginValidAndInDownline{/:id}`, optionalAuth, asyncHandler((req, res) =>
  checkDownline(req, res, 'usp_checkmemberindownline', 'select regno from member_master where username = @u limit 1')));

// public (session optional)
router.all(`${P}/CheckLoginValidAndInDownlineFirstTree{/:id}`, optionalAuth, asyncHandler((req, res) =>
  checkDownline(req, res, 'usp_checkmemberindownlinefirsttree', 'select m.regno from member_master m join portal_login l on m.plid = l.plid where l.username = @u limit 1')));

// public (session optional)
router.all(`${P}/CheckLoginValidAndInDownlineSecondTree{/:id}`, optionalAuth, asyncHandler((req, res) =>
  checkDownline(req, res, 'usp_checkmemberindownlinesecondtree', 'select m.regno from member_master m join portal_login l on m.plid = l.plid where l.username = @u limit 1')));

// public (session optional)
router.all(`${P}/CheckLoginValidAndInDownlineThirdTree{/:id}`, optionalAuth, asyncHandler((req, res) =>
  checkDownline(req, res, 'usp_checkmemberindownlinethirdtree', 'select m.regno from member_master m join portal_login l on m.plid = l.plid where l.username = @u limit 1')));

// public
router.all(`${P}/BindTreeView{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createtreeview', { REGNO: Number(req.p.RegNo), MAXLEVEL: 3 });
  res.json(mapRows(rows, TREE));
}));

// public
router.all(`${P}/BindTreeViewFirst{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createfirsttreeview', { REGNO: Number(req.p.RegNo), MAXLEVEL: 3 });
  res.json(mapRows(rows, TREE));
}));

// public
router.all(`${P}/BindTreeViewSecond{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createsecondtreeview', { REGNO: Number(req.p.RegNo), MAXLEVEL: 3 });
  res.json(mapRows(rows, TREE));
}));

// public
router.all(`${P}/BindTreeViewThird{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createthirdtreeview', { REGNO: Number(req.p.RegNo), MAXLEVEL: 3 });
  res.json(mapRows(rows, TREE));
}));

// public (TempData["regNoAndSide"] kept in the server-side store)
function treeToRegistration(req, res) {
  let ret = 'ok';
  try {
    sset(req, 'regNoAndSide', req.p.tempvalue); // TempData
  } catch (Exp) {
    ret = 'error' + Exp.message;
  }
  res.json(ret);
}
// public
router.all(`${P}/TreeToRegistration{/:id}`, optionalAuth, treeToRegistration);
// public
router.all(`${P}/TreeToRegistrationFirst{/:id}`, optionalAuth, treeToRegistration);
// public
router.all(`${P}/TreeToRegistrationSecond{/:id}`, optionalAuth, treeToRegistration);
// public
router.all(`${P}/TreeToRegistrationThird{/:id}`, optionalAuth, treeToRegistration);

// public
router.all(`${P}/BindTreeViewGeneology{/:id}`, asyncHandler(async (req, res) => {
  const RegNo = Number(req.p.RegNo);
  const rows = await db.proc(DB, 'usp_createtreeviewgeneology', { regNo: RegNo, REGNOG: RegNo, maxLevel: 3 });
  res.json(mapRows(rows, TREE));
}));

// public
router.all(`${P}/BindTreeViewN{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createtreeview', { regNo: Number(req.p.RegNo), maxLevel: 3 });
  res.json(mapRows(rows, TREE1));
}));

// public (session optional)
router.all(`${P}/CheckSponserValidInUpline{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const LoginID = need(req.p.LoginID);
  const LoginType = req.p.LoginType;
  let ret = 'ok';
  if (hasSpecial(LoginID)) return res.json('invalid');
  if (LoginType === 'member') {
    if (!req.user) throw NRE();
    const sessionID = String(req.user.plid);
    if (sessionID.trim().toLowerCase() !== LoginID.trim().toLowerCase()) {
      const rows = await db.proc(DB, 'usp_checkmemberinupnline', { UPLINEID: LoginID, MYID: sessionID });
      const returnval = String(nz(outv(rows, 'strresult')));
      if (returnval === 'no') ret = 'invalid';
      else {
        const r = await db.scalar(DB, 'select m.loginid from member_master m join portal_login l on m.plid = l.plid where l.username = @u limit 1', { u: LoginID });
        ret = r === undefined ? null : r;
      }
    }
  }
  res.json(ret);
}));

// auth (legacy checks Session["Plid"] == null)
router.all(`${P}/CheckForPreviousDeposit{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  if (!req.user) return res.json('0^Unauthorized Session! please login again.');
  const Username = need(req.p.Username).trim();
  const RegNo = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_checkpreviousdeposit', {
    Username, FromRegNo: RegNo, TransactionPassword: await UtilityClass.Encryptword(req.p.TransactionPassword),
  });
  const v = outv(rows, 'strresult');
  if (v === undefined || v === null) throw NRE();
  res.json(String(v));
}));

// ---- OTP confirmation (values stored by the OTP senders in the server-side session store) ----
// public
router.all(`${P}/ConfirmMobileOTP{/:id}`, optionalAuth, (req, res) => {
  const v = sget(req, 'MobileOTP');
  if (v !== undefined && v !== null) return res.json(String(v) === req.p.OTP ? 'true' : 'false');
  res.json('Invalid OTP');
});

// public
router.all(`${P}/ConfirmEmailOTP{/:id}`, optionalAuth, (req, res) => {
  const v = sget(req, 'Emailvcode');
  if (v !== undefined && v !== null) return res.json(String(v) === req.p.OTP ? 'true' : 'false');
  res.json('Invalid OTP');
});

// public
router.all(`${P}/GetDynaminJsTree{/:id}`, asyncHandler(async (req, res) => {
  const r = await db.scalar(DB, 'SELECT regno FROM member_master WHERE username = @u limit 1', { u: req.p.MembName });
  const Regno = r === null || r === undefined ? 0 : Number(r);
  res.json(Regno);
}));

// public
router.all(`${P}/GetMenu{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_pickmemberuserrights_mainsearch', { functionname: req.p.prefix, geturl: parseInt(req.p.isgeturl, 10) });
  res.json(mapRows(rows, SUBMENU));
}));

// auth
router.all(`${P}/AddSecondValueForLogin{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const plid1 = parseInt(req.user.plid, 10);
  // PORT-NOTE: ExecuteSqlCommand returned the affected-row count of the INSERT inside the procedure (1 row); reproduced as 1.
  await db.proc(DB, 'usp_addsecondvalueforlogin', { plid1 });
  res.json(1);
}));

module.exports = router;
