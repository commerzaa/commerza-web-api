'use strict';
// Ported from Franchise\Controllers\CommonController.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, optionalAuth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const GetIP = require('../../lib/franchise/GetIP');
const common = require('../../lib/franchise/common');
const CustomerAddressDal = require('../../lib/franchise/AddressDAL');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/Common';
const DB = 'shopping';
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
const TREE = ['parentRegno', 'childRegno', 'side', 'loginID', 'Name', 'regNo', 'spID', 'spName', 'RegDate', 'DOC', 'Title', 'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName', 'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV', 'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate'];
const ADDR = ['AddressGuid', 'AddressType', 'CityId', 'CityName', 'CountryId', 'CountryName', 'CreatedDate', 'CurrencyId', 'DistrictName', 'Email1', 'Email2', 'FaxNo1', 'FaxNo2', 'Id', 'IsActive', 'IsDefault', 'IsVerified', 'LandMark', 'LogId', 'PhoneNo1', 'PhoneNo2', 'PinCode', 'Remarks', 'ShortAddress', 'StateId', 'StateName', 'ToUserId', 'ToUserType', 'VillageName'];
const SPECIAL = "!#$%^&*();,?+~`'"; // UtilityClass.SpecialCharsForLoginID

// ---- ContactUs ----------------------------------------------------------------------------
const MAIL_BODY = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'>
<img src='https://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: 'Exo', sans-serif, Helvetica, sans-serif; width: 250px'>$$date$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px

15px; color: #000'>Dear $$Name$$</h1>
<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>Thank you for contacting $$CompanyName$$.</strong>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
Your request has been forwarded to our Support Team. And will reach you soon.
</p>

<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #000'>
If you have any issues, we will be happy to help you.
</p>
<strong style='font-size: 16px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'>You can contact  us on $$CompanySupportEmailID$$</strong>
<div style='margin: auto; padding-top: 15px; padding-bottom: 7px; margin-top: 20px'>
<center>
<img src='http://webwebmail.mlmkabila.com/imp/themes/default/graphics/spacer_red.png' htmlimgblocked='https://$$CompanyURL$$/images/divider.png'></center>
</div>

<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>

<p style='font-size: 16px; line-height:1.6; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Sincerely,
<br>
$$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<div style='margin-right: 7px'>
<font style='margin-right:0px; font-size: 16px; color:#000; font-family:  Arial, Helvetica, sans-serif; float: left; margin-top:2px; font-weight: normal; padding-top:3px'>Follow us on </font>
<a href='javascript:void(0)' style='color:#3b5998; border: none; text-decoration: none' target='8SE_b89lng5GVbx5a7NZME9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-facebook'></i></a>
<a href='javascript:void(0)' style='color:#55acee; border: none; text-decoration: none' target='e3PP7S0O2rDcb5kT5Qxvkl9'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-twitter'></i></a>
<a href='javascript:void(0)' style='color:#dd4b39; border: none; text-decoration: none' target='k_lu77WHdSxxe84MTtrgPlD'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-google-plus'></i></a>
<a href='javascript:void(0)' style='color: #0072a4;' border: none; text-decoration: none' target='1QtmtsX-zlkY3NH-RX8bXJB'>
<i style='margin:4px 6px 0 0; font-size:20px;' class='fa fa-linkedin'></i></a>
<a href='javascript:void(0)' style='color:#cb2027; border: none; text-decoration: none' target='FTivBEnhJ2wIlo_i9yYL1Xk'>
<i style='margin:4px 0 0 0; font-size:20px;' class='fa fa-pinterest-p'></i></a>
</div>
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

async function SendMailconfirmation(email, Name) {
  try {
    const date = new Date().toString();
    const subject = '' + CompanySettings.CompanyName + ' contact us';
    const rep = (s, a, b) => s.split(a).join(b === undefined || b === null ? '' : b);
    let body = MAIL_BODY;
    body = rep(body, '$$Name$$', Name);
    body = rep(body, '$$date$$', date);
    body = rep(body, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
    body = rep(body, '$$CompanyURL$$', CompanySettings.CompanyURL);
    body = rep(body, '$$CompanyName$$', CompanySettings.CompanyName);
    body = rep(body, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
    // legacy: UtilityClass.Send(from1 = "", to, cc = "", bcc = "", subject, body)
    await UtilityClass.Send('', email, '', '', subject, body);
  } catch (Exp) {
    console.error(Exp.message); // ViewBag.Message
  }
}

// public
router.all(`${P}/ContactUs{/:id}`, asyncHandler(async (req, res) => {
  const { Type, name, email, Mobile, message } = req.p;
  const rows = await db.proc(DB, 'usp_submitenquiry', {
    name, email, subject: '', message, Type, replymsg: '', mode: 'Add', Mobile,
  });
  const o = outv(rows, 'strresult');
  if (o === undefined || o === null) throw NRE();
  const result = String(o);
  SendMailconfirmation(email, name); // legacy: background thread
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

// public
router.all(`${P}/DataSearch{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const SearchText = need(req.p.SearchText).split('+apostopis').join("'");
  const SearchType = need(req.p.SearchType).split('+apostopis').join("'");
  const csid = sget(req, 'COUNTRYID');
  const CID = csid !== undefined && csid !== null ? parseInt(csid, 10) : 96;
  const rows = await db.proc(DB, 'usp_searchresult_m', {
    INPUTSEARCHTEXT: SearchText.trim(), CTID: '0', AID: '', CID: String(CID).trim(), SearchType: SearchType.trim(),
  });
  let lst = "<rss version='2.0'><SerarchRecords>";
  for (const r of rows) {
    lst += '<Row>';
    lst += '<SEARCHRESULT>' + nz(r.searchresult) + '</SEARCHRESULT>';
    lst += '<FOMATEDDATA>' + nz(r.fomateddata) + '</FOMATEDDATA>';
    lst += '<PMID>' + nz(r.pmid) + '</PMID>';
    lst += '</Row>';
  }
  lst += '</SerarchRecords></rss>';
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
    const PLID = parseInt(req.user.did, 10);
    ReviewType = 2;
    const e = await db.scalar(DB, 'select loginid from portal_login where plid = @p limit 1', { p: String(PLID) });
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
// public
router.all(`${P}/validatePlacementAndWithSponsor{/:id}`, asyncHandler(async (req, res) => {
  const row = await db.queryOne(DB, 'select loginid from tbl_distributor where username = @u and active = true limit 1', { u: req.p.SponsorID });
  if (!row) return res.json('Invalid');
  res.json('valid|^' + row.loginid);
}));

// public
router.all(`${P}/GetPlacement{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'Invalid';
  const row = await db.queryOne(DB, 'select loginid from tbl_distributor where loginid = @m and active = true limit 1', { m: req.p.MemberID });
  if (row) RetMsg = 'valid|^' + row.loginid;
  res.json(RetMsg);
}));

// public (reads the session only when LoginType == "member")
router.all(`${P}/CheckLoginValidAndInDownline{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const LoginID = need(req.p.LoginID);
  const LoginType = req.p.LoginType;
  let ret = 'ok';
  if ([...LoginID].some((c) => SPECIAL.includes(c))) return res.json('invalid');
  if (LoginType === 'member') {
    if (!req.user) throw NRE();
    const sessionID = String(req.user.did);
    if (sessionID.trim().toLowerCase() !== LoginID.trim().toLowerCase()) {
      const rows = await db.proc(DB, 'usp_checkmemberindownline', { SESSIONID: sessionID, LOGINID: LoginID });
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

// public
router.all(`${P}/BindTreeView{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_createtreeview', { regNo: Number(req.p.RegNo), maxLevel: 3 });
  res.json(mapRows(rows, TREE));
}));

// public (reads the session only when LoginType == "member")
router.all(`${P}/CheckSponserValidInUpline{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const LoginID = need(req.p.LoginID);
  const LoginType = req.p.LoginType;
  let ret = 'ok';
  if ([...LoginID].some((c) => SPECIAL.includes(c))) return res.json('invalid');
  if (LoginType === 'member') {
    if (!req.user) throw NRE();
    const sessionID = String(req.user.did);
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

// public (TempData["regNoAndSide"] kept in the server-side store)
router.all(`${P}/TreeToRegistration{/:id}`, optionalAuth, (req, res) => {
  let ret = 'ok';
  try {
    sset(req, 'regNoAndSide', req.p.tempvalue); // TempData
  } catch (Exp) {
    ret = 'error' + Exp.message;
  }
  res.json(ret);
});

// ---- addresses (SessionExpireCheck) ----
// auth
router.all(`${P}/IsDefaultAddress{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const adid = Number(need(req.p.AddressId));
  const row = await db.queryOne(DB, 'select * from ims_customeraddress where id = @id limit 1', { id: adid });
  if (!row) throw NRE();
  const adrs = mapRows([row], ADDR)[0];
  adrs.ToUserType = 'Customer'; // UtilityClass.SeclectUserType.Customer.ToString()
  const pb = await new CustomerAddressDal().IsDefault_Address(adrs, '101,102.1.1');
  res.json(pb.Success);
}));

// auth
router.all(`${P}/GetAddressDetail{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const adid = Number(need(req.p.AddressId));
  const row = await db.queryOne(DB, 'select * from ims_customeraddress where id = @id limit 1', { id: adid });
  // JavaScriptSerializer().Serialize(entity) (null => "null")
  res.json(JSON.stringify(row ? mapRows([row], ADDR)[0] : null));
}));

// auth
router.all(`${P}/DeleteMemberAddress{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const adid = Number(need(req.p.AddressId));
  const row = await db.queryOne(DB, 'select id from ims_customeraddress where id = @id limit 1', { id: adid });
  if (!row) throw NRE();
  await db.exec(DB, 'delete from ims_customeraddress where id = @id', { id: adid });
  res.json(true);
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

// public static (not an MVC action): kyc approval helper used by other controllers
async function updatemerchantkyc(plid) {
  const id = Number(plid);
  const countkyc = Number(await db.scalar(DB, 'Select count(1) from kyc_distributor where isaprove = 0 and regno = @id', { id })) || 0;
  const countbankverifyied = Number(await db.scalar(DB, 'Select count(1) from bank_accounts_distributor where did = @id and active = true and isaprove = 0', { id })) || 0;
  const et = await db.scalar(DB, 'Select distinct entitytype from tbl_businesskycdetails_distributor where did = @id limit 1', { id });
  const Entitype = et === null || et === undefined ? 0 : Number(et);
  if (Entitype === 1 && countkyc === 2 && countbankverifyied === 1) {
    await db.exec(DB, 'Update tbl_distributor set iskycapproved = 2 where did = @id and active = true', { id });
    return 1;
  }
  if (Entitype === 3 && countkyc === 6 && countbankverifyied === 1) {
    await db.exec(DB, 'Update tbl_distributor set iskycapproved = 2 where did = @id and active = true', { id });
    return 1;
  }
  return 0;
}

module.exports = router;
module.exports.updatemerchantkyc = updatemerchantkyc;
