'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\CommonController.cs (class CommonController => /admin/Common/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const Kit_Master = require('../../lib/admin/Kit_Master');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nInt, nStr, reqInt, col, str, outStr, nullRef, netDateString } = require('./_shared/batch11-common');

const router = express.Router();
const C = 'Common';
const P = `/admin/${C}`;

const nz = (v) => (v === undefined || v === null ? '' : String(v));
const need = (v) => { if (v === undefined || v === null) throw nullRef(); return String(v); };
/** new SqlParameter("@x", null) is not sent => the proc default applies */
const dropNull = (o) => { const r = {}; for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null) r[k] = v; return r; };
const fmtErr = () => new Error('Input string was not in a correct format.');
/** Convert.ToInt64(string) */
function cvtInt64(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!/^[-+]?\d+$/.test(s)) throw fmtErr();
  return Number(s);
}
/** Convert.ToDouble(string) */
function cvtDouble(v) {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) throw fmtErr();
  return parseFloat(s);
}
/** non-nullable double action parameter */
function reqDouble(v, name) {
  const s = v === undefined || v === null ? '' : String(v).trim();
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Double'`);
    e.status = 500;
    throw e;
  }
  return n;
}
/** "FName MName LName" exactly like  Row.FName + " " + Convert.ToString(Row.MName) + " " + Convert.ToString(Row.LName) */
const fullName = (r) => nz(col(r, 'fname')) + ' ' + nz(col(r, 'mname')) + ' ' + nz(col(r, 'lname'));
const xmlEsc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** fire-and-forget (legacy new Thread(...).Start()) */
const background = (fn) => { setImmediate(() => { Promise.resolve().then(fn).catch((e) => console.error('[admin/Common] background:', e.message)); }); };

// EF: db._Member_Master.Where(...).FirstOrDefault()   (EF6 null-compensated "==" => IS NOT DISTINCT FROM)
const memberBy = (where, params) => db.queryOne(DB, `select * from member_master where ${where} limit 1`, params);

/** class TreeViewDetails */
const TREE_PROPS = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title',
  'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName',
  'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV',
  'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER',
  'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER'];
/** class AllDownlineMemberList */
const ALLDOWN_PROPS = ['rootID', 'LoginID', 'EmpLevel'];
/** class Sub_Menu (Add_SubMenu.cs) */
const SUBMENU_PROPS = ['MID', 'TITLE', 'HrefTitle'];
/** usp_DataSearch result columns (DataSet.GetXml element names) */
const DATASEARCH_COLS = ['searchResult', 'fomatedResult', 'forurl', 'serachText', 'Mprid', 'cnt'];

// ---------------------------------------------------------------- non-action helpers
/** public static string validate(string email, string username, string password) - static => not an MVC action */
function validate(email, username, password) {
  if (need(email).trim() === '') return 'empty';
  const isEmail = /^(?:[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)$/.test(email.trim());
  if (!isEmail) return 'wrong';
  if (need(password).trim() === '') return 'empty';
  if (need(username).trim() === '') return 'empty';
  return 'ok';
}

/** public string ModifyUrlText(string UrlTest) */
function ModifyUrlText(UrlTest) {
  const rep = (s, a, b) => s.split(a).join(b);
  let strTitle = need(UrlTest).toLowerCase().trim();
  strTitle = rep(strTitle, 'c#', 'C-Sharp');
  strTitle = rep(strTitle, ' ', '-');
  strTitle = rep(strTitle, '&', 'and');
  strTitle = rep(strTitle, 'amp;', '');
  strTitle = rep(strTitle, '/', '-');
  strTitle = rep(strTitle, '\\', '-');
  strTitle = rep(strTitle, '.', '');
  strTitle = rep(strTitle, ',', '');
  strTitle = rep(strTitle, '|', '-');
  strTitle = rep(strTitle, '#', '-');
  strTitle = rep(strTitle, '*', 'star');
  strTitle = rep(strTitle, ':', '-');
  strTitle = rep(strTitle, '+', 'plus');
  strTitle = rep(strTitle, '---', '-');
  strTitle = rep(strTitle, '--', '-');
  strTitle = strTitle.trim();
  strTitle = strTitle.replace(/^-+|-+$/g, '');
  return strTitle;
}

/** public string CreateURl(int SearchType, string SearchText, double pmid) */
async function CreateURl(SearchType, SearchText, pmid) {
  let url = ''; let location = ''; let UnMatchText = '';
  if (SearchType === 0 || SearchType === 1) {
    if (SearchType === 0) UnMatchText = ' searcht';
    else UnMatchText = '';
    location = ModifyUrlText(location);
    SearchText = ModifyUrlText(nz(SearchText) + UnMatchText);
    url = 'product/' + SearchText;
  }
  if (SearchType === 2) {
    let Title = ''; let CategoryName = ''; let CityNameTemp = ''; let pmidTemp = '';
    // SqlParameter[] param = new SqlParameter[3]; param[0] = @pmid; param[2] = @titleInput;  (param[1] stays null)
    const param = [DataUtility.SqlParameter('@pmid', pmid), null, DataUtility.SqlParameter('@titleInput', SearchText)];
    // PORT-NOTE: legacy DataUtility.GetDataReaderSP did Parameters.Add(param[1]) with a null element => ArgumentNullException
    // (so this branch always failed); reproduced, the remaining code is kept for completeness.
    if (param.some((p) => p === null)) throw new Error('The SqlParameterCollection only accepts non-null SqlParameter type objects.');
    const rows = await new DataUtility().GetDataReaderSP(param, 'usp_find_catname_and_title');
    const dr = rows[0];
    if (dr) {
      Title = str(col(dr, 'title'));
      CategoryName = str(col(dr, 'categoryName'));
      CityNameTemp = str(col(dr, 'CityName'));
      pmidTemp = str(col(dr, 'pmid'));
    }
    void CategoryName; void pmidTemp;
    if (Title.includes('.')) Title = Title.split('.').join('');
    if (CityNameTemp !== '') url = Title;
    else url = Title;
    url = ModifyUrlText(url);
    url = 'product-details/' + url;
  }
  return url;
}

/** public string GetBranchAgencyBalance(string BrCode) */
async function GetBranchAgencyBalance(BrCode) {
  const row = await db.procOne(DB, 'usp_AgencyBalance', dropNull({ BrCode }));
  return outStr(row, 'strResult') + '^' + outStr(row, 'Balance');
}

/** public AgencyCurrentBalance GetAgencyCurrentBalce(string LoginID, string AgencyNo, string Password) */
async function GetAgencyCurrentBalce(LoginID, AgencyNo, Password) {
  const row = await db.procOne(DB, 'Usp_CheckAgencyBalance', dropNull({ loginID: LoginID, AgencyNo, password: Password }));
  const OutputResult = outStr(row, 'strResult');
  const b = col(row, 'Balance');
  if (b === null || b === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
  const Balace = Number(b);
  const s = OutputResult.split('^');
  if (s.length < 2) throw new Error('Index was outside the bounds of the array.');
  return { Result: s[0], Message: s[1], Balance: Balace };
}

/** protected void SendMailconfirmation(string email, string Name) */
async function SendMailconfirmation(req, email, Name) {
  try {
    const date = netDateString(new Date());
    const subject = 'CryptoInbox Support Center';
    const bcc = ''; const cc = ''; const to = email; const from1 = '';
    let body = " <div style='margin: auto; background: #fff url(http://qlook.bz/images/topborder.png) top left repeat-x; border: 2px solid #ddd; width: 700px; padding-bottom: 7px; -webkit-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); -moz-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65);'>\r\n           <table width='700' style='background: #14c5aa; margin: 0px auto; padding: 45px 0px;'>\r\n        <tr>\r\n            <td>\r\n\r\n                <table cellpadding='0' cellspacing='0' style='background: none repeat scroll 0 0 #fff; border: 7px solid #dcdcdc; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0 48px; width: 585px;'>\r\n\r\n                    <tr>\r\n                        <td>\r\n\r\n                            <table width='585'>\r\n                                <tr>\r\n                                    <td style='width: 350px; height: 70px;'><a href='http://cryptoinbox.mlmkabila.com/'>\r\n                                        <img src='http://cryptoinbox.mlmkabila.com/images/logo.png' height='45px' border='0' style='height: 45px; margin-left: 6px; float: left;' />\r\n                                    </a></td>\r\n                                    <td style='text-align: right; font-size: 15px; padding-right: 15px; color: #333; font-family: Arial,Helvetica,sans-serif; width: 250px;'>$date$\r\n                                    </td>\r\n                                </tr>\r\n                            </table>\r\n                        </td>\r\n                    </tr>\r\n\r\n                    <tr>\r\n                        <td>\r\n                            <div>\r\n                                <div class='clear'></div>\r\n\r\n                                <table style='border-top: 1px solid rgb(204, 204, 204); height: auto; padding-bottom: 0px; padding-left: 12px; padding-top: 6px; width: 585px;'>\r\n                                    <tr>\r\n                                        <td>\r\n                                            <h1 style='font-size: 15px; font-family: arial; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-decoration:none;'> Dear,<span style='color:#3b7bd1;'> $Name$ </span> </h1>\r\n                                            <p style='font-size: 13px;   margin: 0px; color: #484848;'>Thank you for Contacting</p>\r\n\r\n                                             <br/>\r\n\r\n                                            </table>\r\n                                            <div style='clear: both'></div>\r\n                                            <p style='font-size: 12px; font-family: Arial; font-weight: normal; margin: 15px 0px 7px 15px; color: #3f3f42;'>\r\n                                               Thank you for Submitting your query. Your request has been forwarded to our support team. You will receive reply mail within 24 hours.\r\n                                            </p>\r\n                                            <p style='font-size: 12px; font-family: Arial; font-weight: 500; margin: 15px 0px 7px 15px; color: #131313;'>You can contact  us on support@cryptoinbox.com</p>\r\n                                            <div style='clear: both'></div>\r\n                                        </td>\r\n                                    </tr>\r\n\r\n                                    <tr>\r\n                                        <td>\r\n                                            <table width='554'>\r\n                                                <tr>\r\n                                                    <td width='70%' style='padding-top:10px;'>\r\n\r\n                                                        <p style='font-size: 12px; font-family: Arial; font-weight: normal; margin: 6px 0px 7px 15px; float: left; color: #3f3f42;'>\r\n\r\n                                                            Sincerely,\r\n                <br />\r\n                                                            CryptoInbox Team<br/><br/>\r\nhttp://cryptoinbox.mlmkabila.com/\r\n\r\n                                                        </p>\r\n                                                    </td>\r\n                                                </tr>\r\n                                            </table>\r\n\r\n                                        </td>\r\n                                    </tr>\r\n                                </table>\r\n                                <div class='clear'></div>\r\n                            </div>\r\n                        </td>\r\n                    </tr>\r\n                </table>\r\n            </td>\r\n        </tr>\r\n    </table>\r\n        </div>";
    // mail body will be here
    body = body.split('$$Name$$').join(nz(Name));
    body = body.split('$$date$$').join(date);
    await UtilityClass.Send(from1, to, cc, bcc, subject, body);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SendMailconfirmation');
  }
}

/** private static void SendMail1(string emailid) */
async function SendMail1(emailid) {
  try {
    let body = '';
    const date = netDateString(new Date());
    const subject = 'Congratulation For Subscribing CryptoInbox News Letter';
    body = " <div style='margin: auto; background: #fff url(http://qlook.bz/images/topborder.png) top left repeat-x; border: 2px solid #ddd; width: 700px; padding-bottom: 7px; -webkit-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); -moz-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65);'>\r\n           <table width='700' style='background: #14c5aa; margin: 0px auto; padding: 45px 0px;'>\r\n        <tr>\r\n            <td>\r\n\r\n                <table cellpadding='0' cellspacing='0' style='background: none repeat scroll 0 0 #fff; border: 7px solid #dcdcdc; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0 48px; width: 585px;'>\r\n\r\n                    <tr>\r\n                        <td>\r\n\r\n                            <table width='585'>\r\n                                <tr>\r\n                                    <td style='width: 350px; height: 70px;'><a href='http://cryptoinbox.mlmkabila.com/'>\r\n                                        <img src='http://cryptoinbox.mlmkabila.com/images/logo.png' height='45px' border='0' style='height: 45px; margin-left: 6px; float: left;' />\r\n                                    </a></td>\r\n                                    <td style='text-align: right; font-size: 15px; padding-right: 15px; color: #333; font-family: Arial,Helvetica,sans-serif; width: 250px;'>$date$\r\n                                    </td>\r\n                                </tr>\r\n                            </table>\r\n                        </td>\r\n                    </tr>\r\n\r\n                    <tr>\r\n                        <td>\r\n                            <div>\r\n                                <div class='clear'></div>\r\n\r\n                                <table style='border-top: 1px solid rgb(204, 204, 204); height: auto; padding-bottom: 0px; padding-left: 12px; padding-top: 6px; width: 585px;'>\r\n                                    <tr>\r\n                                        <td>\r\n                                            <h1 style='font-size: 15px; font-family: arial; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-decoration:none;'> Dear,<span style='color:#3b7bd1;'> $Name$ </span> </h1>\r\n                                            <p style='font-size: 13px;   margin: 0px; color: #484848;'>Thank you for subscribing to the CryptoInbox newsletter. You will now receive regular updates about CryptoInbox.</p>\r\n\r\n                                             <br/>\r\n                                            </table>\r\n\r\n                                            <p style='font-size: 12px; font-family: Arial; font-weight: 500; margin: 15px 0px 7px 15px; color: #131313;'>You can contact  us on support@cryptoinbox.com</p>\r\n                                            <div style='clear: both'></div>\r\n                                        </td>\r\n                                    </tr>\r\n\r\n                                    <tr>\r\n                                        <td>\r\n                                            <table width='554'>\r\n                                                <tr>\r\n                                                    <td width='70%' style='padding-top:10px;'>\r\n\r\n                                                        <p style='font-size: 12px; font-family: Arial; font-weight: normal; margin: 6px 0px 7px 15px; float: left; color: #3f3f42;'>\r\n\r\n                                                            Sincerely,\r\n                <br />\r\n                                                            CryptoInbox Team<br/><br/>\r\nhttp://cryptoinbox.mlmkabila.com/\r\n\r\n                                                        </p>\r\n                                                    </td>\r\n                                                </tr>\r\n                                            </table>\r\n\r\n                                        </td>\r\n                                    </tr>\r\n                                </table>\r\n                                <div class='clear'></div>\r\n                            </div>\r\n                        </td>\r\n                    </tr>\r\n                </table>\r\n            </td>\r\n        </tr>\r\n    </table>\r\n        </div>";
    body = body.split('$$Name$$').join(nz(emailid));
    body = body.split('$$date$$').join(date);
    const result = await UtilityClass.Send('', emailid, '', '', subject, body);
    void result;
  } catch (ExpObj) {
    try {
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'SendMail1', 0, 'Controllers/AdminPanel/CustomEncriptionAndDecription');
    } catch (e) { console.error('[admin/Common] ErrorInsert failed:', e.message); }
  }
}

// ---------------------------------------------------------------- ActionResult Index()
// public
router.all([`${P}/Index{/:id}`, P], (req, res) => res.json({ view: '~/Views/Common/Index.cshtml' }));

// ---------------------------------------------------------------- JsonResult GetParentDetails(string SponserId, int Side)
// public
router.all(`${P}/GetParentDetails{/:id}`, asyncHandler(async (req, res) => {
  const SponserId = req.p.SponserId;
  const Side = reqInt(req.p.Side, 'Side');
  let ParentId = '';
  try {
    // legacy: "Select ParentId from [FN_ParentForPreJoin]('" + SponserId + "'," + Side + ")" (now parameterised)
    const r = await db.queryOne(DB, 'select parentid from fn_parentforprejoin(@s, @side)', { s: nz(SponserId), side: Side });
    ParentId = r ? col(r, 'parentid') : null;
    if (ParentId === null || ParentId === undefined) ParentId = '';
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetParentDetails');
    return res.json(ParentId);
  }
  return res.json(ParentId);
}));

// ---------------------------------------------------------------- JsonResult DataSearch(string SearchText)
// public
router.all(`${P}/DataSearch{/:id}`, asyncHandler(async (req, res) => {
  const SearchText = need(req.p.SearchText).split('+apostopis').join("'");
  const ds = await new DataUtility().GetDataSetSPNamed([DataUtility.SqlParameter('@serchItem', SearchText)], 'usp_DataSearch', 'dsData');
  const rows = ds.dsData || [];
  // DataSet.GetXml(): <NewDataSet><dsData><col>v</col>...</dsData></NewDataSet>, NULL columns omitted
  let xml;
  if (!rows.length) xml = '<NewDataSet />';
  else {
    const parts = ['<NewDataSet>'];
    for (const r of rows) {
      parts.push('  <dsData>');
      for (const k of Object.keys(r)) {
        if (r[k] === null || r[k] === undefined) continue;
        const name = DATASEARCH_COLS.find((c) => c.toLowerCase() === k.toLowerCase()) || k;
        parts.push(`    <${name}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${name}>`);
      }
      parts.push('  </dsData>');
    }
    parts.push('</NewDataSet>');
    xml = parts.join('\r\n');
  }
  return res.json(xml);
}));

// ---------------------------------------------------------------- JsonResult GetEncryptedSPRID(string SearchText)
// public
router.all(`${P}/GetEncryptedSPRID{/:id}`, asyncHandler(async (req, res) => {
  const revalue = await UtilityClass.Encryptword(nStr(req.p.SearchText));
  return res.json(revalue);
}));

// ---------------------------------------------------------------- JsonResult GetSearchUrl(string searchval, string pmidSearch)
// public
router.all(`${P}/GetSearchUrl{/:id}`, asyncHandler(async (req, res) => {
  let searchval = nStr(req.p.searchval);
  let pmidSearch = nStr(req.p.pmidSearch);
  let url = ''; let catsubcatsearch = ''; let querypart = ''; let searchtypeoutput = 0; let searchbyuser = '';
  if (pmidSearch === 'undefined' || pmidSearch === null) pmidSearch = '0';
  searchval = need(searchval).split('+apostopis').join("'");
  const saperator = ':|';
  if (searchval.indexOf(saperator) > -1) {
    const split = searchval.split('^');
    catsubcatsearch = split[0].split('subcat:|').join('').toLowerCase().trim();
    catsubcatsearch = catsubcatsearch.split('cat:|').join('').toLowerCase().trim();
    catsubcatsearch = catsubcatsearch.split(' ').join('-');
    searchbyuser = catsubcatsearch;
    if (split.length > 1) {
      const brandmodel = split[1].toLowerCase().trim();
      if (brandmodel.indexOf('brand:|') > -1) {
        let brand = brandmodel.split('brand:|').join('').toLowerCase().trim();
        brand = brand.split(' ').join('-');
        querypart = '?brand=' + brand;
      }
      if (brandmodel.indexOf('model:|') > -1) {
        let model = brandmodel.split('model:|').join('').toLowerCase().trim();
        model = model.split(' ').join('-');
        querypart = '?model=' + model;
      }
    }
    searchtypeoutput = 1;
  } else {
    searchbyuser = searchval;
    if (cvtInt64(pmidSearch) > 0) searchtypeoutput = 2;
    else searchtypeoutput = 0;
  }
  url = await CreateURl(searchtypeoutput, searchbyuser.trim(), cvtDouble(pmidSearch));
  url = url + querypart;
  return res.json(url);
}));

// ---------------------------------------------------------------- public string CreateURl(int SearchType, string SearchText, double pmid)
// public (public instance method => routable MVC action returning a string => text/html content)
router.all(`${P}/CreateURl{/:id}`, asyncHandler(async (req, res) => {
  const SearchType = reqInt(req.p.SearchType, 'SearchType');
  const pmid = reqDouble(req.p.pmid, 'pmid');
  return res.send(await CreateURl(SearchType, nStr(req.p.SearchText), pmid));
}));

// ---------------------------------------------------------------- public string ModifyUrlText(string UrlTest)
// public (string action)
router.all(`${P}/ModifyUrlText{/:id}`, asyncHandler(async (req, res) => res.send(ModifyUrlText(nStr(req.p.UrlTest)))));

// ---------------------------------------------------------------- public string GetBranchAgencyBalance(string BrCode)
// public (string action)
router.all(`${P}/GetBranchAgencyBalance{/:id}`, asyncHandler(async (req, res) => res.send(await GetBranchAgencyBalance(nStr(req.p.BrCode)))));

// ---------------------------------------------------------------- public AgencyCurrentBalance GetAgencyCurrentBalce(string LoginID, string AgencyNo, string Password)
// public
// PORT-NOTE: a non-ActionResult return value is written by MVC as Convert.ToString(obj) => the class name "AgencyCurrentBalance".
router.all(`${P}/GetAgencyCurrentBalce{/:id}`, asyncHandler(async (req, res) => {
  const obj = await GetAgencyCurrentBalce(nStr(req.p.LoginID), nStr(req.p.AgencyNo), nStr(req.p.Password));
  void obj;
  return res.send('AgencyCurrentBalance');
}));

// ---------------------------------------------------------------- JsonResult GetKitList(string PlanName)
// public
router.all(`${P}/GetKitList{/:id}`, asyncHandler(async (req, res) => {
  const PlanName = nStr(req.p.PlanName);
  let li;
  if (PlanName === null) {
    // Kit_Master.GetKitList(string null): EF "Type == null" => type IS NULL (the lib dispatches null to the kid overload)
    li = Kit_Master.mapAll(await db.query(DB, 'select * from kit_master where status=1 and type is null'));
  } else {
    li = await new Kit_Master().GetKitList(PlanName);
  }
  return res.json(li);
}));

// ---------------------------------------------------------------- JsonResult checkSponsorOnPlacementID(string MemberID, string placementid)
// public
router.all(`${P}/checkSponsorOnPlacementID{/:id}`, asyncHandler(async (req, res) => {
  const MemberID = nStr(req.p.MemberID);
  const placementid = nStr(req.p.placementid);
  let RetMsg = '';
  let Row = await memberBy('loginid is not distinct from @id and status::int = 1', { id: MemberID });
  if (!Row) return res.json('invalid^Invalid Sponsor ID');
  const PlaceRow = await memberBy('loginid is not distinct from @id and status::int = 1', { id: placementid });
  if (PlaceRow) {
    if (String(col(Row, 'regno')) !== String(col(PlaceRow, 'regno'))) {
      const treerow = await db.queryOne(DB, 'select * from levelentry where parentregno = @p and childregno = @c and status::int = 1 limit 1',
        { p: col(Row, 'regno'), c: col(PlaceRow, 'regno') });
      if (!treerow) return res.json("invalid^Not Exists in Placement Member's Upline");
    }
  } else if (need(placementid).trim() !== '') {
    return res.json('invalid^Invalid Placement ID');
  }
  Row = await memberBy('loginid is not distinct from @id and status::int = 1', { id: MemberID });
  if (Row) RetMsg = 'valid|^' + fullName(Row);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateMemberID(string MemberID)
// public
router.all(`${P}/ValidateMemberID{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'invalid';
  const Row = await memberBy('username is not distinct from @id and status::int = 1', { id: nStr(req.p.MemberID) });
  if (Row) RetMsg = 'valid|^' + fullName(Row);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateMemberIDByuserName(string MemberID)
// public
router.all(`${P}/ValidateMemberIDByuserName{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'invalid';
  const Row = await memberBy('username is not distinct from @id and status::int = 1', { id: nStr(req.p.MemberID) });
  if (Row) RetMsg = 'valid|^' + fullName(Row);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult validateSponsorID(string SponsorID, string placementID)
// public
router.all(`${P}/validateSponsorID{/:id}`, asyncHandler(async (req, res) => {
  const SponsorID = nStr(req.p.SponsorID);
  let RetMsg = 'invalid';
  let RowSp = await memberBy('loginid is not distinct from @id and status::int = 1', { id: SponsorID });
  if (!RowSp) {
    RowSp = await memberBy('sponserid is not distinct from @id and status::int = 1', { id: SponsorID });
    if (RowSp) {
      RetMsg = 'valid|^' + fullName(RowSp);
      return res.json(RetMsg);
    }
    RowSp = await memberBy('mobile is not distinct from @id and status::int = 1', { id: SponsorID });
    if (RowSp) {
      RetMsg = 'valid|^' + fullName(RowSp);
      return res.json(RetMsg);
    }
    RowSp = await memberBy('loginid is not distinct from @id and status::int = 1', { id: SponsorID });
    if (!RowSp) return res.json(RetMsg);
    RetMsg = 'Deactive';
    return res.json(RetMsg);
  }
  RetMsg = 'valid|^' + fullName(RowSp) + '^' + nz(col(RowSp, 'loginid'));
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult validatePlacementAndWithSponsor(string SponsorID, string placementID)
// public
router.all(`${P}/validatePlacementAndWithSponsor{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'Invalid';
  const RowSp = await db.queryOne(DB, 'select * from portal_login where username is not distinct from @u and active::int = 1 limit 1',
    { u: nStr(req.p.SponsorID) });
  if (!RowSp) return res.json(RetMsg);
  RetMsg = 'valid|^' + nz(col(RowSp, 'loginid')) + '^' + nz(col(RowSp, 'fname')) + ' ' + nz(col(RowSp, 'lname'));
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateMobileNo(string MobileNo)
// public
router.all(`${P}/ValidateMobileNo{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = '0';
  const RowSp = await db.query(DB, 'select * from member_master where mobile is not distinct from @m and status::int = 1', { m: nStr(req.p.MobileNo) });
  if (RowSp.length >= 3) {
    RetMsg = '1';
    return res.json(RetMsg);
  }
  RetMsg = '0';
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateEmailID(string EmailId)
// public
router.all(`${P}/ValidateEmailID{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = '0';
  const RowSp = await memberBy('emailid is not distinct from @e and status::int = 1', { e: nStr(req.p.EmailId) });
  if (!RowSp) return res.json(RetMsg);
  RetMsg = '1';
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult ValidateUserName(string UserName)
// public
router.all(`${P}/ValidateUserName{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'valid';
  const Row = await memberBy('(username is not distinct from @u or loginid is not distinct from @u)', { u: nStr(req.p.UserName) });
  if (Row) RetMsg = 'invalid';
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult getCitiesOnSid(int SID)
// public
router.all(`${P}/getCitiesOnSid{/:id}`, asyncHandler(async (req, res) => {
  const SID = reqInt(req.p.SID, 'SID');
  return res.json(await new CITY().City_List_On_SID(SID));
}));

// ---------------------------------------------------------------- JsonResult getStatedOnSid(int SID)
// public
router.all(`${P}/getStatedOnSid{/:id}`, asyncHandler(async (req, res) => {
  const SID = reqInt(req.p.SID, 'SID');
  return res.json(await new State().State_List_On_CID(SID)); // _State.Where(Cid == SID && SActive).OrderBy(StateName)
}));

// ---------------------------------------------------------------- JsonResult getCitiesOnstatename(string SID)
// public
router.all(`${P}/getCitiesOnstatename{/:id}`, asyncHandler(async (req, res) => {
  let SID = nStr(req.p.SID);
  if (SID === null || SID.trim() === '') return res.json('');
  const st = await new State().State_List_On_CID(String(SID));
  if (!st) throw nullRef();
  SID = String(st.Sid);
  let nSID = 0;
  if (SID !== null && SID.trim() !== '') nSID = cvtInt64(SID);
  return res.json(await new CITY().City_List_On_SID(nSID));
}));

// ---------------------------------------------------------------- JsonResult ValidateMemberToActivate(string MemberID)
// public
router.all(`${P}/ValidateMemberToActivate{/:id}`, asyncHandler(async (req, res) => {
  const MemberID = nStr(req.p.MemberID);
  let RetMsg = 'invalid';
  let Row = await memberBy('loginid is not distinct from @id and status::int = 1', { id: MemberID });
  if (!Row) return res.json('invalid');
  Row = await memberBy('loginid is not distinct from @id', { id: MemberID });
  if (Row) RetMsg = 'valid|^' + fullName(Row);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult TreeToRegistration(string tempvalue)
// public (TempData["regNoAndSide"] => sessionStore 'regNoAndSide')
router.all(`${P}/TreeToRegistration{/:id}`, optionalAuth, (req, res) => {
  let ret = 'ok';
  try {
    sessionStore.set(req, 'regNoAndSide', nStr(req.p.tempvalue));
  } catch (ex) {
    ret = 'error';
  }
  return res.json(ret);
});

// ---------------------------------------------------------------- JsonResult GetRegNoFromLoginID(string LoginID)
// public
router.all(`${P}/GetRegNoFromLoginID{/:id}`, asyncHandler(async (req, res) => {
  let Regno = '0';
  const Row = await memberBy('username is not distinct from @u', { u: nStr(req.p.LoginID) });
  if (Row) Regno = col(Row, 'loginid');
  return res.json(need(Regno));
}));

// ---------------------------------------------------------------- JsonResult GetRegNomemberCapping(string Username)
// public
router.all(`${P}/GetRegNomemberCapping{/:id}`, asyncHandler(async (req, res) => {
  let Regno = 0;
  const Row = await memberBy('username is not distinct from @u', { u: nStr(req.p.Username) });
  if (Row) Regno = col(Row, 'regno');
  // legacy: "Select isnull(CAPPINGLIMIT,0) From MEMBER_PERFORMANCE where regno=" + Regno (parameterised)
  const v = await db.scalar(DB, 'select coalesce(cappinglimit,0) from member_performance where regno=@r limit 1', { r: Regno });
  const capping = v === null || v === undefined ? 0 : Number(v);
  return res.json(capping);
}));

// ---------------------------------------------------------------- JsonResult CheckLoginValidAndInDownline(string LoginID, string LoginType)
// public
router.all(`${P}/CheckLoginValidAndInDownline{/:id}`, asyncHandler(async (req, res) => {
  const LoginID = need(nStr(req.p.LoginID));
  const LoginType = nStr(req.p.LoginType);
  let ret = 'ok';
  if ([...LoginID].some((c) => UtilityClass.SpecialCharsForLoginID.includes(c))) {
    ret = 'invalid';
    return res.json(ret);
  }
  const Row = await memberBy('username is not distinct from @u', { u: LoginID });
  if (!Row) {
    ret = 'invalid';
    return res.json(ret);
  }
  if (LoginType === 'member') {
    const loginid = await memberBy('username is not distinct from @u', { u: LoginID });
    if (!loginid) throw nullRef();
    const sessionID = str(col(loginid, 'regno'));
    if (sessionID.trim().toLowerCase() !== LoginID.trim().toLowerCase()) {
      const row = await db.procOne(DB, 'usp_checkMemberInDownline', { sessionID, LoginID });
      const returnval = outStr(row, 'strResult');
      if (returnval === 'no') ret = 'invalid';
      else {
        const regno = await memberBy('username is not distinct from @u', { u: LoginID });
        if (!regno) throw nullRef();
        ret = 'Success' + '^' + str(col(regno, 'regno'));
      }
    }
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult BindDirectTreeView(double RegNo)
// public
router.all(`${P}/BindDirectTreeView{/:id}`, asyncHandler(async (req, res) => {
  const RegNo = reqDouble(req.p.RegNo, 'RegNo');
  const rows = await db.proc(DB, 'Usp_CreateDirectTreeView', { regNo: RegNo, maxLevel: 3 });
  return res.json(mapRows(rows, TREE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult AllDownlineMemberList(string LoginID)
// public
// PORT-NOTE: legacy called the 2-parameter TVF with one argument (T-SQL requires all TVF arguments => SQL error);
// PostgreSQL applies the @ACTIVE default (0). LoginID parameter is unused (hard-coded 199) like the C#.
router.all(`${P}/AllDownlineMemberList{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, "select loginid, rootid, emplevel from fun_all_downline_memberlist('199') order by emplevel asc");
  return res.json(mapRows(rows, ALLDOWN_PROPS));
}));

// ---------------------------------------------------------------- JsonResult BindTreeView(double RegNo)
// public
router.all(`${P}/BindTreeView{/:id}`, asyncHandler(async (req, res) => {
  const RegNo = reqDouble(req.p.RegNo, 'RegNo');
  const rows = await db.proc(DB, 'USP_CREATETREEVIEW', { REGNO: RegNo, MAXLEVEL: 2 });
  return res.json(mapRows(rows, TREE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult CheckMobileNo()
// public
// PORT-NOTE: the hard-coded sarvsms username / msg_token moved to config.app.SarvSmsUserName / SarvSmsMsgToken.
router.all(`${P}/CheckMobileNo{/:id}`, asyncHandler(async (req, res) => {
  const baseurl = 'http://manage.sarvsms.com/api/api_get_misscall_did_no_data.php?username=' + (config.app.SarvSmsUserName || '')
    + '&msg_token=' + (config.app.SarvSmsMsgToken || '') + '&did_no=8010933223&start_from=1';
  const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d] });
  return res.json(r.data);
}));

// ---------------------------------------------------------------- JsonResult CheckIFSC(string IFSC)
// public
router.all(`${P}/CheckIFSC{/:id}`, asyncHandler(async (req, res) => {
  const baseurl = 'http://labs.govasool.com/api/getBankDetailByIFSC&ifsc=' + nz(req.p.IFSC);
  const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d] });
  return res.json(r.data);
}));

// ---------------------------------------------------------------- JsonResult getAddressOnPincode(string postCode)
// public
router.all(`${P}/getAddressOnPincode{/:id}`, asyncHandler(async (req, res) => {
  const baseurl = 'http://getpincodes.info/api.php?pincode=' + nz(req.p.postCode);
  const r = await axios.get(baseurl, { responseType: 'text', transformResponse: [(d) => d] });
  return res.json(r.data);
}));

// ---------------------------------------------------------------- [HttpPost] JsonResult SendContactEnquiry(string name, string email, string Mobile, string message, int state, int city, int Enquiry_type)
// public
router.post(`${P}/SendContactEnquiry{/:id}`, asyncHandler(async (req, res) => {
  const name = nStr(req.p.name); const email = nStr(req.p.email); const Mobile = nStr(req.p.Mobile);
  const state = reqInt(req.p.state, 'state');
  const city = reqInt(req.p.city, 'city');
  const Enquiry_type = reqInt(req.p.Enquiry_type, 'Enquiry_type');
  let message = need(nStr(req.p.message));
  message = message.split('+#!#+').join('<');
  message = message.split('+!#!+').join('>');
  const row = await db.procOne(DB, 'usp_SubmitEnquiey', dropNull({
    name, email, subject: '', message, replymsg: '', mode: 'Add', website: '', Stateid: state, Cityid: city, Mobile, Enquiry_type,
  }));
  const ret = outStr(row, 'strResult');
  background(() => SendMailconfirmation(req, email, name));
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult Submitfeedback(string name, string email, string Mobile, string message, string orgname)
// public
router.all(`${P}/Submitfeedback{/:id}`, asyncHandler(async (req, res) => {
  const name = nStr(req.p.name); const email = nStr(req.p.email);
  const row = await db.procOne(DB, 'usp_SubmitEnquiey', dropNull({
    name, email, subject: nStr(req.p.Mobile), message: nStr(req.p.message), replymsg: nStr(req.p.orgname), mode: 'feedback', website: '',
  }));
  const ret = outStr(row, 'strResult');
  background(() => SendMailconfirmation(req, email, name));
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult adminMasterLeftMenu(string clicktype)
// public (Session["adminMasterLeftMenu"] => sessionStore 'adminMasterLeftMenu', per admin token when present)
router.all(`${P}/adminMasterLeftMenu{/:id}`, optionalAuth, (req, res) => {
  const clicktype = nStr(req.p.clicktype);
  const cur = sessionStore.get(req, 'adminMasterLeftMenu');
  if (cur === undefined || cur === null) {
    sessionStore.set(req, 'adminMasterLeftMenu', '0');
    return res.json('0');
  }
  if (need(clicktype).trim() === '') return res.json(String(cur));
  const sesttionval = String(cur);
  if (sesttionval.trim() === '0') {
    sessionStore.set(req, 'adminMasterLeftMenu', '1');
    return res.json('1');
  }
  sessionStore.set(req, 'adminMasterLeftMenu', '0');
  return res.json('0');
});

// ---------------------------------------------------------------- JsonResult insert_email_newsletter(string emaild)
// public
// PORT-NOTE: legacy passed only @emailID although usp_subscribeNewsLetter also requires @IPADDRESS/@IPCOUNTRY (no defaults) =>
// SQL error => "Please try again Later ". Same call kept.
router.all(`${P}/insert_email_newsletter{/:id}`, asyncHandler(async (req, res) => {
  const emaild = nStr(req.p.emaild);
  let ret = 'ok';
  try {
    const row = await db.procOne(DB, 'usp_subscribeNewsLetter', dropNull({ emailID: emaild }));
    ret = outStr(row, 'strResult');
    if (ret === 'ok') background(() => SendMail1(emaild));
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'insert_email_newsletter');
    return res.json('Please try again Later ');
  }
}));

// ---------------------------------------------------------------- JsonResult GetName(string MemberID)
// public
router.all(`${P}/GetName{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'invalid';
  const Row = await memberBy('loginid is not distinct from @id and status::int = 1', { id: nStr(req.p.MemberID) });
  if (Row) RetMsg = 'valid|^' + fullName(Row);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult GetPlacement(string MemberID)
// public
router.all(`${P}/GetPlacement{/:id}`, asyncHandler(async (req, res) => {
  let RetMsg = 'Invalid';
  const Row = await db.queryOne(DB, 'select * from portal_login where loginid is not distinct from @m and active::int = 1 limit 1', { m: nStr(req.p.MemberID) });
  if (Row) RetMsg = 'valid|^' + nz(col(Row, 'loginid'));
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult VerifyMobileNo(string MobileNo, string Mode, string VerificationCode, string EmailId)
// public
// PORT-NOTE: Session["Member_Master"] is never set in the admin app => ((Member_Master_Custom)null).regNo threw NullReferenceException (500);
// reproduced through sessionStore 'member_master' (see SESSION.md); the rest is kept for completeness.
router.all(`${P}/VerifyMobileNo{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let MobileNo = nStr(req.p.MobileNo);
  const Mode = nStr(req.p.Mode); const VerificationCode = nStr(req.p.VerificationCode); const EmailId = nStr(req.p.EmailId);
  const mm = sessionStore.get(req, 'member_master');
  if (mm === undefined || mm === null) throw nullRef();
  const row = await db.procOne(DB, 'USP_MemberMobileEmailIdVerification', dropNull({
    MobileNo, MobileVerificationCode: VerificationCode, EmailId, EmailVerificationCode: '', RegNo: mm.regNo, Mode,
  }));
  const ReturnResult = outStr(row, 'StrResult');
  background(async () => {
    const ReturnResultWords = ReturnResult.split('^');
    if (ReturnResultWords.length > 1) {
      let MobileMsg = '';
      if (ReturnResultWords.length < 3) throw new Error('Index was outside the bounds of the array.');
      MobileNo = ReturnResultWords[2];
      MobileMsg = ReturnResultWords[1];
      if (MobileNo !== '') {
        MobileMsg = 'Your Verification Code For Your Account : ' + ReturnResultWords[1];
        await UtilityClass.SendMsgOnMobile(MobileNo, MobileMsg);
      }
      if (EmailId !== '') {
        const VerificationLink = '';
        const MailContent = 'You Verification Code:' + ReturnResultWords[1] + " And Your Verification Link <a target='_blank'>" + VerificationLink + '</a>';
        await UtilityClass.Send('', EmailId, '', '', 'Email ID Verification', MailContent);
      }
    }
  });
  return res.json(ReturnResult);
}));

// ---------------------------------------------------------------- JsonResult Checkticket()
// public
router.all(`${P}/Checkticket{/:id}`, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'USP_GETTICKETDETAILS', { MODE: 1 });
  const v = col(row, 'count');
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  const totalticket = Math.round(Number(v));
  const RetMsg = String(totalticket);
  return res.json(RetMsg);
}));

// ---------------------------------------------------------------- JsonResult GetMenu(string prefix, int isgeturl = 0)
// auth (reads Session["Admin_User"])
router.all(`${P}/GetMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let isgeturl = nInt(req.p.isgeturl);
  if (isgeturl === null) isgeturl = 0;
  const rows = await db.proc(DB, 'Usp_PickAdminUserRights_Mainsearch', dropNull({ EmpID: req.user.emp_id, functionname: nStr(req.p.prefix), geturl: isgeturl }));
  return res.json(mapRows(rows, SUBMENU_PROPS));
}));

module.exports = router;
module.exports.validate = validate;
module.exports.ModifyUrlText = ModifyUrlText;
