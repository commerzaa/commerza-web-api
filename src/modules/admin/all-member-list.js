'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Member_List.cs (class All_Member_ListController => /All_Member_List/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const DataUtility = require('../../lib/admin/DataUtility');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const Helper = require('../../lib/admin/Helper');
const ToDataTable = require('../../lib/admin/ToDataTable');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, reqInt, toInt32, nullRef, netFormat, netDateStr, nowStamp } = require('./_shared/batch03-common');
const {
  MEMBERDETAILS_PROPS, ALLMEMBERLIST_PROPS, CITYNAME_PROPS, WALLETS_PROPS,
} = require('./_shared/batch03-models');
const { PdfTable, renderPdf } = require('./_shared/batch03-pdf');

const router = express.Router();
const C = 'All_Member_List';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (module state).
// `private string regno, translatetext` are per-request instance fields (regno is only copied to Session["regno"]).
let url = '';
let url1 = '';
// private static CLIENT_ID / CLIENT_SECRET / API_URL (whatsmate translation API). PORT-NOTE: the credentials are read from config
// (keys TranslateClientId / TranslateClientSecret; legacy hard-coded the public trial values) - never copied into code.
const CLIENT_ID = () => (config.app.TranslateClientId || '');
const CLIENT_SECRET = () => (config.app.TranslateClientSecret || '');
const API_URL = 'http://api.whatsmate.net/v1/translation/translate';

const mapPath = (v) => path.join(config.uploadDir, String(v || '').replace(/^~?[\\/]*/, ''));
const s = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? netDateStr(v) : String(v))); // DataRow[x].ToString()
/** Convert.ToDecimal(object) / Convert.ToInt32(object) on a DataRow value (DBNull => InvalidCastException) */
function cdec(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
const cint = (v) => Math.trunc(cdec(v));
function cbool(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  const t = String(v).trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
}
const fix2 = (v) => Number(v).toFixed(2);
/** DataTable.Rows[i] (IndexOutOfRange => "There is no row at position i.") */
const rowAt = (t, i) => { if (!t || !t[i]) throw new Error(`There is no row at position ${i}.`); return t[i]; };
/** DataSet.Tables[i] */
const tableAt = (tables, i) => { if (!tables[i]) throw new Error('Cannot find table ' + i + '.'); return tables[i]; };
/** string.IndexOfAny(UtilityClass.SpecialCharsForLoginID) >= 0 */
const hasSpecial = (x) => (UtilityClass.SpecialCharsForLoginID || []).some((c) => x.includes(c));

/**
 * objdut.GetDataSetSPNamed(@Regno, "dbo.usp_View_all_detail_Member", "dsData") => ds.Tables[0..6]
 * PORT-NOTE: the SQL Server proc returns 7 result sets (basic, withdrawals, purchases, KYC, BV, ?, bank). The lib's GetDataSetSPNamed keeps
 * only one set, so the function is executed directly and every result set of a multi-statement response is kept (like the franchise
 * Order_List port). Adapt if the migrated PostgreSQL function exposes the sets differently (e.g. refcursors).
 */
async function viewAllDetailMember(Regno) {
  const { getPool } = db;
  const r = await getPool(DB).query('select * from usp_view_all_detail_member("regno" => $1)', [Regno]);
  if (Array.isArray(r)) return r.map((x) => x.rows);
  return [r.rows];
}

/** public void getwallettype()  => ViewBag.walletlst */
async function getwallettype(ViewBag) {
  const walletlist = mapRows(await db.proc(DB, 'usp_wallet_type', {}), WALLETS_PROPS);
  ViewBag.walletlst = walletlist;
}

const exportParams = (p) => ({
  SEARCHFIELD: p.SearchField.trim(), SEARCHVALUE: p.SearchValue.trim(), FROMDATE: p.fromDate.trim(), TODATE: p.toDate.trim(),
  USERTYPE: p.ddlStatus === null ? '' : String(p.ddlStatus), MEMTYPE: toInt32(p.ddlchange), JOININGTYPE: p.ddltype,
  VARIFIEDPANSTATUS: p.VarifiedPanStatus.trim(), USERDOWNLINEMEMBER: p.downlinesearch, SIDE: p.Side,
});

/** [SessionExpireCheck] public void ExportReport(...) - Helper.GenerateExcelReport (ClosedXML) => ~/DownloadedExcel/<Filename>.xlsx then Response.Redirect */
async function ExportReport(req, res, p) {
  const nn = (v) => { if (v === null || v === undefined) nullRef(); return v; };
  ['SearchField', 'SearchValue', 'fromDate', 'toDate', 'VarifiedPanStatus'].forEach((k) => nn(p[k]));
  const Emp_ID = req.user.emp_id;
  const MaxRows = 1000000;
  // DBO.USP_ALL_MEMBERLIST (20 params here: no @RANKID)
  const AllEPinRequestsList = mapRows(await db.proc(DB, 'USP_ALL_MEMBERLIST', {
    STARTROWINDEX: '1', MAXROWS: MaxRows, ...exportParams(p), EMP_ID: Emp_ID, PAGE_NAME: url, SESSIONID: '0',
    ACTIVATIONDATE: p.activationdate, ORDERBYDATE: p.orderbydate, MAINSEARCH: p.MainSearch, DDLIDSTATUS: p.ddlIDStatus,
  }), ALLMEMBERLIST_PROPS);
  const helper = new Helper();
  const dt = await ToDataTable.ListToDatatable(AllEPinRequestsList, 'AllMemberList');
  const Filename = `All_Member_List_${Emp_ID}_${nowStamp()}`;
  const filepath1 = mapPath(`~/DownloadedExcel/${Filename}.xlsx`);
  fs.mkdirSync(path.dirname(filepath1), { recursive: true });
  await helper.GenerateExcelReport(filepath1, 'All_Member_List', dt);
  // Response.Redirect("~/DownloadedExcel/<Filename>.xlsx") => the generated file is sent directly
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', `attachment; filename=${Filename}.xlsx`);
  res.send(fs.readFileSync(filepath1));
  return true;
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(Int32? dynamicpagging, string datetype, string orderbydate, string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, string ddlchange, Int32? ddltype, Int32? page, string btnexel, string downlinesearch, Int32? Side, string activationdate, string MainSearch, string ddlIDStatus)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/All-Member-List" -> All_Member_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Member-List'], adminAuth, asyncHandler(async (req, res) => {
  const p = {};
  let dynamicpagging = nint(req.p.dynamicpagging);
  for (const k of ['datetype', 'orderbydate', 'SearchField', 'SearchValue', 'VarifiedPanStatus', 'fromDate', 'toDate', 'ddlStatus', 'ddlchange',
    'btnexel', 'downlinesearch', 'activationdate', 'MainSearch', 'ddlIDStatus']) p[k] = sv(req.p[k]);
  p.ddltype = nint(req.p.ddltype);
  p.Side = nint(req.p.Side);
  let page = nint(req.p.page);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (p.datetype === null) p.datetype = '';
  if (p.SearchField === null) p.SearchField = '';
  if (p.orderbydate === null) p.orderbydate = '';
  if (p.activationdate === null) p.activationdate = '';
  if (p.SearchValue === null) p.SearchValue = '';
  if (p.fromDate === null) p.fromDate = '';
  if (p.toDate === null) p.toDate = '';
  if (p.ddlStatus === null) p.ddlStatus = '';
  if (p.ddlchange === null) p.ddlchange = '0';
  if (p.ddlchange === '') p.ddlchange = '0';
  if (p.ddltype === null) p.ddltype = 0;
  if (p.VarifiedPanStatus === null) p.VarifiedPanStatus = '';
  if (p.btnexel === null) p.btnexel = '';
  if (p.downlinesearch === null) p.downlinesearch = '';
  if (p.Side === null) p.Side = 0;
  if (p.MainSearch === null) p.MainSearch = '';
  if (p.ddlIDStatus === null) p.ddlIDStatus = '';
  // eslint-disable-next-line no-unused-vars
  const Decryptt = await UtilityClass.Encryptword('7567685');
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_ALL_MEMBERLIST', {
    STARTROWINDEX: page, MAXROWS: MaxRows, ...exportParams(p), EMP_ID: Empid, PAGE_NAME: url, SESSIONID: '0',
    ACTIVATIONDATE: p.activationdate, ORDERBYDATE: p.orderbydate, MAINSEARCH: p.MainSearch, DDLIDSTATUS: p.ddlIDStatus, RANKID: '0',
  });
  const AllEPinRequestsList = mapRows(rows, ALLMEMBERLIST_PROPS);
  const TotalRecord = toInt32(str(col(rows[0], 'totalcount')) || 'x'); // Int32.Parse(DBNull.ToString()) => FormatException
  ViewBag.orderbydate = p.orderbydate;
  ViewBag.dynamicpagging = dynamicpagging;
  // objDb._TBL_COMPANYMASTER.Where(a => a.COMID == 1).Select(a => a.SOFTWARE_URL).FirstOrDefault()
  ViewBag.softurl = await db.scalar(DB, 'select software_url from tbl_companymaster where comid = 1 limit 1', {});
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = p.SearchField;
  ViewBag.fromDate = p.fromDate;
  ViewBag.toDate = p.toDate;
  ViewBag.ddlStatus = p.ddlStatus;
  ViewBag.ddlchange = p.ddlchange;
  ViewBag.ddltype = p.ddltype;
  ViewBag.VarifiedPanStatus = p.VarifiedPanStatus;
  ViewBag.activationdate = p.activationdate;
  ViewBag.MainSearch = p.MainSearch;
  ViewBag.ddlIDStatus = p.ddlIDStatus;
  // eslint-disable-next-line no-unused-vars
  const test = await UtilityClass.Encryptword('CO9833423');
  ViewBag.LiState = await new State().State_List_On_CID(96);
  ViewBag.LiCity = await new CITY().City_List_On_CID(96);
  await getwallettype(ViewBag);
  if (p.btnexel === 'Export Excel') {
    if (await ExportReport(req, res, p)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/All_Member_List/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public string translate(string FromLang, string ToLang, string Text)
// auth (PORT-NOTE: legacy had no session check: an open proxy to the paid translation API with the company credentials - protected here)
router.all(`/admin/${C}/translate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const payloadObj = { fromLang: sv(req.p.FromLang), toLang: sv(req.p.ToLang), text: sv(req.p.Text) }; // class Payload
  const postData = JSON.stringify(payloadObj); // JavaScriptSerializer (nulls serialised as null)
  try {
    const r = await axios.post(API_URL, postData, {
      headers: { 'Content-Type': 'application/json', 'X-WM-CLIENT-ID': CLIENT_ID(), 'X-WM-CLIENT-SECRET': CLIENT_SECRET() },
      responseType: 'text', transformResponse: (x) => x,
    });
    return res.type('text/html').send(r.data === null || r.data === undefined ? '' : String(r.data));
  } catch (webEx) {
    // catch (WebException webEx) { return webEx.Message; }
    const msg = webEx.response ? `The remote server returned an error: (${webEx.response.status}) ${webEx.response.statusText || ''}.`.replace(' .', '.') : webEx.message;
    return res.type('text/html').send(msg);
  }
}));

// ---------------------------------------------------------------- [SessionExpireCheck] public void ExportReport(...15 params...)
// auth
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = {};
  for (const k of ['datetype', 'orderbydate', 'SearchField', 'SearchValue', 'VarifiedPanStatus', 'fromDate', 'toDate', 'ddlStatus', 'ddlchange',
    'downlinesearch', 'activationdate', 'MainSearch', 'ddlIDStatus']) p[k] = sv(req.p[k]);
  p.ddltype = nint(req.p.ddltype);
  p.Side = nint(req.p.Side);
  await ExportReport(req, res, p);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult UpdateMemberProfile(...)
// auth
router.all(`/admin/${C}/UpdateMemberProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const g = (k) => sv(req.p[k]);
  const gender = reqInt(req.p.gender, 'gender');
  // eslint-disable-next-line no-unused-vars
  const ctid = reqInt(req.p.ctid, 'ctid');
  const HighestQualification = reqInt(req.p.HighestQualification, 'HighestQualification');
  const Country = reqInt(req.p.Country, 'Country');
  const State_ = reqInt(req.p.State, 'State');
  const Eid = req.user.emp_id;
  const password = await UtilityClass.Encryptword(g('password'));
  const imgname = '';
  let OutputResult = '';
  let dob = g('dob');
  if (dob === null) nullRef(); // dob.Trim()
  if (dob.trim() === '01/01/0001') dob = '';
  try {
    if (dob.trim() !== '') {
      const arrdob = dob.split('-');
      if (arrdob.length < 3) throw new Error('Index was outside the bounds of the array.');
      dob = `${arrdob[2]}-${arrdob[1]}-${arrdob[0]}`;
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateMemberProfile');
    dob = null;
  }
  const regNo = g('regNo'); // Convert.ToInt64(regNo) (null => 0, non-numeric => FormatException)
  const row = await db.procOne(DB, 'USP_MEMBERPROFILE', {
    regno: toInt32(regNo), loginid: g('loginid'), fname: g('fName'), mname: '', lName: '', Gender: gender, Dob: dob, Email: g('email'),
    mobile: g('mobile'), Pincode: g('pincode'), stid: State_, ctid: 0, CityName: g('citynm'), StateName: '', addres: g('address'),
    imagefilename: imgname, tpassword: password, cid: Country, panno: g('panno'), nomineename: g('nomineename'), relation: g('relation'),
    bankname: g('bankname'), ifsccode: g('ifsccode'), acountno: g('acountno'), CHALLANIMAGE: '', DTHCustomerId: g('DTHCustomerId'),
    Application_FormNo: g('ApplicationFormNo'), BitCoinWalletAddress: g('BitCoinWalletAddress'), PayPalEmail: g('PayPalEmail'),
    AcountHolderName: g('AccountHolderName'),
    MoneyGramName: g('MoneyGramAddress'), // PORT-NOTE: legacy bug kept - @MoneyGramName receives MoneyGramAddress
    MoneyGramAddress: g('MoneyGramAddress'), OTPForUpdateMobile: '', IsMemberPanel: 0, BranchName: g('branchName'),
    HighestQualification, CPERTITLE: g('cpertitle'), CPERDESIGNATION: '', USERNAME: g('username'), FatherOrMotherName: '', Remark: g('remark'), Eid,
  });
  OutputResult = str(col(row, 'result'));
  // eslint-disable-next-line no-unused-vars
  const empcode = req.user.emp_code;
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult DeactivateGoogleAuthenticator(string RegNo)
// auth
router.all(`/admin/${C}/DeactivateGoogleAuthenticator{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Result = 'Error';
  // update TBL_GAKEYAUTHORIZATION_HISTORY set status= 0 where PLID='<RegNo>'  (parameterised)
  await db.exec(DB, 'update tbl_gakeyauthorization_history set status = 0 where plid::text = @RegNo', { RegNo: sv(req.p.RegNo) });
  Result = 'success';
  return res.json(Result);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult GetMemberDetail(double regno)
// auth (PORT-NOTE/security: legacy returns the member's DECRYPTED password - kept)
router.all(`/admin/${C}/GetMemberDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqInt(req.p.regno, 'regno', 'System.Double');
  const row = await db.procOne(DB, 'usp_GetMemberDetails', { regno });
  if (!row) nullRef(); // AllMemberDetailsReturns.Password on null
  const AllMemberDetailsReturns = mapRow(row, MEMBERDETAILS_PROPS);
  AllMemberDetailsReturns.Password = await UtilityClass.Decryptword(AllMemberDetailsReturns.Password);
  return res.json(AllMemberDetailsReturns);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult UpdateStatus(Int32 regno, string mode, string remark)
// auth
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqInt(req.p.regno, 'regno');
  const Eid = req.user.emp_id;
  let retvalue = '';
  // eslint-disable-next-line no-unused-vars
  const empcode = req.user.emp_code;
  const ObjDUT = new DataUtility();
  const Param = [
    DataUtility.SqlParameter('@MODE', sv(req.p.mode)),
    DataUtility.SqlParameter('@regno', regno),
    DataUtility.SqlParameter('@INTRESULT', null, 'Output'),
    DataUtility.SqlParameter('@Remark', sv(req.p.remark)),
    DataUtility.SqlParameter('@EID', Eid),
  ];
  const Reply = await ObjDUT.ExecuteSqlSP(Param, '[Usp_Update_Member_Status]');
  const Result = String(Reply); // Param[2].Value.ToString() (= the @INTRESULT ExecuteSqlSP parsed)
  if (Result === '1') retvalue = 'Activate';
  else if (Result === '2') retvalue = 'Deactivate';
  return res.json(retvalue);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult checkClientAndGetData(string clients)
// auth
router.all(`/admin/${C}/checkClientAndGetData{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const clients = sv(req.p.clients);
  if (clients === null) nullRef();
  if (clients.length > 10) return res.json('error^Invalid customer ID');
  if (clients.trim() === '' || hasSpecial(clients)) return res.json('error^Please enter valid Client ID');
  try {
    // select ((fname+' '+isnull(mname,'')+' '+ISNULL(LName,'')) +'  Mob. '+mobile +'  SPID:'+sponserID) as name from member_master where loginid='<clients>'
    const Ret = await db.scalar(DB, `select ((fname || ' ' || coalesce(mname, '') || ' ' || coalesce(lname, '')) || '  Mob. ' || mobile || '  SPID:' || sponserid) as name
      from member_master where loginid = @clients limit 1`, { clients });
    if (Ret !== null && Ret !== undefined && String(Ret) !== '') return res.json('ok^' + Ret);
    return res.json('error^Invalid Client ID');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkClientAndGetData');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult ChangeSponsor(string ChangeMemID, string NewSPID)
// auth
router.all(`/admin/${C}/ChangeSponsor{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ChangeMemID = sv(req.p.ChangeMemID);
  const NewSPID = sv(req.p.NewSPID);
  if (ChangeMemID === null) nullRef();
  if (ChangeMemID.length > 10) return res.json('error^Invalid Client ID');
  if (ChangeMemID.trim() === '' || hasSpecial(ChangeMemID)) return res.json('error^Please enter valid Client ID');
  if (NewSPID === null) nullRef();
  if (NewSPID.length > 10) return res.json('error^Invalid Sponsor ID');
  if (NewSPID.trim() === '' || hasSpecial(NewSPID)) return res.json('error^Please enter valid Sponsor ID');
  try {
    // usp_ChangeSponsor @newSPID,@LoginID,@strResult out  (DoNotEnsureTransaction)
    const row = await db.procOne(DB, 'usp_ChangeSponsor', { newSPID: NewSPID, LoginID: ChangeMemID });
    return res.json(str(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ChangeSponsor');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult CreateParent(string ChangeMemID, string RootID, Int32 Side)
// auth
router.all(`/admin/${C}/CreateParent{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ChangeMemID = sv(req.p.ChangeMemID);
  const RootID = sv(req.p.RootID);
  const Side = reqInt(req.p.Side, 'Side');
  if (ChangeMemID === null) nullRef();
  if (ChangeMemID.length > 10) return res.json('error^Invalid Client ID');
  if (ChangeMemID.trim() === '' || hasSpecial(ChangeMemID)) return res.json('error^Please enter valid Client ID');
  if (RootID === null) nullRef();
  if (RootID.length > 10) return res.json('error^Invalid Parent ID');
  if (RootID.trim() === '' || hasSpecial(RootID)) return res.json('error^Please enter valid Parent ID');
  if (Side < 1 || Side > 2) return res.json('error^Please select valid side');
  try {
    const row = await db.procOne(DB, 'usp_ProvideRootIDToMember', { LoginID: ChangeMemID, rootID: RootID, Side });
    return res.json(str(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'CreateParent');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult ChangeStatusOfPanno(string Regno)
// auth
router.all(`/admin/${C}/ChangeStatusOfPanno{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'uspVerified_And_UnVerifiedPan', { regNo: sv(req.p.Regno) });
  return res.json(str(col(row, 'strresult')));
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult member_details(string Regno)
// auth
router.all(`/admin/${C}/member_details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = sv(req.p.Regno);
  const basic_info = [];
  try {
    const Tables = await viewAllDetailMember(Regno);
    if (Tables.length > 0) {
      let dt1 = Tables[0];
      const regno = Regno;
      sessionStore.set(req, 'regno', '');
      sessionStore.set(req, 'regno', regno);
      const r = rowAt(dt1, 0);
      const c = (k) => col(r, k);
      // class Basic_Info (property order of the C# class)
      const basic = {
        Name: null, EMAILID: null, MOBILE: null, USERNAME: null, COUNTRYNAME: null, STATENAME: null, CITYNAME: null, BANKNAME: null, BRANCHNAME: null,
        ACCOUNTNO: null, IFSCCODE: null, REGDATE: null, E_Wallet: 0, Coin_Wallet: 0, commission_wallet: 0, Shopping_Wallet: 0, PANNO: null,
        KYCSTATUS: null, PASSWORD: null, TPASSWORD: null, Address: null, pincode: null, AcHolderName: null, CID: 0, SID: 0, CTID: 0, Status: 0,
        IsVisibleE: 0, IsVisibleS: 0, IsVisibleC: 0, IsVisibleCO: 0, Remarks: null, GaKeyStatus: false, SPONSOR: null, LOGINID: null, IMAGENAME: null,
      };
      basic.CITYNAME = s(c('CITYNAME'));
      basic.Coin_Wallet = cdec(c('Coin_Wallet'));
      basic.commission_wallet = cdec(c('commission_wallet'));
      basic.USERNAME = s(c('USERNAME'));
      basic.COUNTRYNAME = s(c('COUNTRYNAME'));
      basic.E_Wallet = cdec(c('E_Wallet'));
      basic.EMAILID = s(c('EMAILID'));
      basic.KYCSTATUS = s(c('KYCSTATUS'));
      basic.MOBILE = s(c('MOBILE'));
      basic.Name = s(c('Name'));
      basic.GaKeyStatus = cbool(c('GaKeyStatus'));
      sessionStore.set(req, 'name', basic.Name);
      basic.PANNO = s(c('PANNO'));
      basic.IMAGENAME = s(c('IMAGENAME'));
      basic.PASSWORD = ''; // (decryption commented out in legacy)
      basic.REGDATE = s(c('REGDATE'));
      basic.Shopping_Wallet = cdec(c('Shopping_Wallet'));
      basic.STATENAME = s(c('STATENAME'));
      basic.TPASSWORD = '';
      basic.Address = s(c('Address'));
      basic.pincode = s(c('pincode'));
      basic.CID = cint(c('CID'));
      basic.SID = cint(c('SID'));
      basic.CTID = cint(c('CTID'));
      basic.Status = cint(c('Status'));
      basic.IsVisibleC = cint(c('IsVisibleC'));
      basic.IsVisibleCO = cint(c('IsVisibleCO'));
      basic.IsVisibleE = cint(c('IsVisibleE'));
      basic.IsVisibleS = cint(c('IsVisibleS'));
      basic.Remarks = '';
      basic.SPONSOR = s(c('SPONSOR'));
      basic.LOGINID = s(c('LOGINID'));
      dt1 = tableAt(Tables, 6);
      if (dt1.length > 0) {
        const b = dt1[0];
        basic.BANKNAME = s(col(b, 'BANKNAME'));
        basic.BRANCHNAME = s(col(b, 'BRANCHNAME'));
        basic.ACCOUNTNO = s(col(b, 'ACCOUNTNO'));
        basic.IFSCCODE = s(col(b, 'IFSCCODE'));
        basic.AcHolderName = s(col(b, 'ACCOUNTHOLDERNAME'));
      }
      basic_info.push(basic);
    }
    // ViewBag.basic = basic_info (not visible in a JsonResult)
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_View_all_detail_Member');
  }
  return res.json(basic_info);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult package_Info(string Regno)
// auth
router.all(`/admin/${C}/package_Info{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const purchase_info = [];
  try {
    const Tables = await viewAllDetailMember(sv(req.p.Regno));
    if (Tables.length > 0) {
      const dt3 = tableAt(Tables, 2);
      for (let k = 0; k < dt3.length; k++) {
        const r = dt3[k];
        // class Purchase_Info: REGNO, ROWNUMBER, PayItForward, PuchaseDate, AllPackageAmount, AllPackageName
        const pur = { REGNO: 0, ROWNUMBER: 0, PayItForward: null, PuchaseDate: null, AllPackageAmount: 0, AllPackageName: null };
        pur.AllPackageAmount = cdec(col(r, 'AllPackageAmount'));
        pur.AllPackageName = s(col(r, 'AllPackageName'));
        pur.PayItForward = s(col(r, 'PayItForward'));
        pur.PuchaseDate = s(col(r, 'PuchaseDate'));
        pur.ROWNUMBER = cint(col(r, 'ROWNUMBER'));
        purchase_info.push(pur);
        if (dt3.length === 1) {
          if (cdec(col(r, 'AllPackageAmount')) === 0 && s(col(r, 'AllPackageName')) === '' && s(col(r, 'PuchaseDate')) === '') {
            return res.json('No Records found');
          }
        }
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_View_all_detail_Member');
  }
  return res.json(purchase_info);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult Witjdrawal_Info(string Regno)
// auth
router.all(`/admin/${C}/Witjdrawal_Info{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const With_drawals = [];
  try {
    const Tables = await viewAllDetailMember(sv(req.p.Regno));
    if (Tables.length > 0) {
      const dt2 = tableAt(Tables, 1);
      for (let j = 0; j < dt2.length; j++) {
        const r = dt2[j];
        // class Withdrawal_Info: ROWNUMBER, TDS, ADMINCHARGE, WITHDRAWAMOUNT, PAYBLEAMOUNT, PayModeName, REGNO, DATE, ProcessDate
        const w = { ROWNUMBER: 0, TDS: 0, ADMINCHARGE: 0, WITHDRAWAMOUNT: 0, PAYBLEAMOUNT: 0, PayModeName: null, REGNO: null, DATE: null, ProcessDate: null };
        w.DATE = s(col(r, 'DATE'));
        w.WITHDRAWAMOUNT = cdec(col(r, 'WITHDRAWAMOUNT'));
        w.ADMINCHARGE = cdec(col(r, 'ADMINCHARGE'));
        w.PAYBLEAMOUNT = cdec(col(r, 'PAYBLEAMOUNT'));
        w.PayModeName = s(col(r, 'PayModeName'));
        w.ProcessDate = s(col(r, 'ProcessDate'));
        w.TDS = cdec(col(r, 'TDS'));
        w.ROWNUMBER = cint(col(r, 'ROWNUMBER'));
        With_drawals.push(w);
        if (dt2.length === 1) {
          if (s(col(r, 'DATE')) === '' && cdec(col(r, 'WITHDRAWAMOUNT')) === 0 && cdec(col(r, 'ADMINCHARGE')) === 0
            && cdec(col(r, 'PAYBLEAMOUNT')) === 0 && cdec(col(r, 'TDS')) === 0) {
            return res.json('No Records found');
          }
        }
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_View_all_detail_Member');
  }
  return res.json(With_drawals);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult KYC_Info(string Regno)
// auth
router.all(`/admin/${C}/KYC_Info{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const KYC_Details = [];
  try {
    const Tables = await viewAllDetailMember(sv(req.p.Regno));
    if (Tables.length > 0) {
      const dt4 = tableAt(Tables, 3);
      for (let i = 0; i < dt4.length; i++) {
        const r = dt4[i];
        // class kyc_detail_with_status: ROWNUMBER, Dtm_date, Dtm_Aprove, IsAprove, Type
        const kyc = { ROWNUMBER: 0, Dtm_date: null, Dtm_Aprove: null, IsAprove: null, Type: null };
        kyc.Type = s(col(r, 'Type'));
        kyc.Dtm_Aprove = s(col(r, 'Dtm_Aprove'));
        kyc.Dtm_date = s(col(r, 'Dtm_date'));
        kyc.IsAprove = s(col(r, 'IsAprove'));
        kyc.ROWNUMBER = cint(col(r, 'ROWNUMBER'));
        KYC_Details.push(kyc);
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_View_all_detail_Member');
  }
  return res.json(KYC_Details);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult Binay_Info(string Regno)
// auth
router.all(`/admin/${C}/Binay_Info{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BV_List = [];
  try {
    const Tables = await viewAllDetailMember(sv(req.p.Regno));
    if (Tables.length > 0) {
      const r = rowAt(tableAt(Tables, 4), 0);
      // class BV_Info: CLBV, CRBV, PaidBV, FlushBV, TRBV, TLBV, DLBV, DRBV
      const ob = { CLBV: 0, CRBV: 0, PaidBV: 0, FlushBV: 0, TRBV: 0, TLBV: 0, DLBV: 0, DRBV: 0 };
      ob.CLBV = cdec(col(r, 'CLBV'));
      ob.CRBV = cdec(col(r, 'CRBV'));
      ob.DLBV = cdec(col(r, 'DLBV'));
      ob.DRBV = cdec(col(r, 'DRBV'));
      ob.PaidBV = cdec(col(r, 'PaidBV'));
      ob.TLBV = cdec(col(r, 'TLBV'));
      ob.TRBV = cdec(col(r, 'TRBV'));
      ob.FlushBV = cdec(col(r, 'FlushBV'));
      BV_List.push(ob);
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_View_all_detail_Member');
  }
  return res.json(BV_List);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult Update_Member_Info(string Name, ... string Active)
// auth
router.all(`/admin/${C}/Update_Member_Info{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const g = (k) => sv(req.p[k]);
  let OutputResult = '';
  try {
    const IpAddress = await GetIP.GetLocalIP(req);
    const EmpID = req.user.emp_id;
    let sid = 0; let cityid = 0; let StateName = '';
    let SID = g('SID');
    let CTID = g('CTID');
    let PinCode = g('PinCode');
    let CID = g('CID');
    const Regno = g('Regno');
    if (SID === '') SID = '0';
    else {
      sid = toInt32(SID);
      // dbContext._State.Where(m => m.Sid == sid).FirstOrDefault().StateName
      const states = await db.queryOne(DB, 'select statename from state where sid = @sid limit 1', { sid });
      if (!states) nullRef();
      StateName = col(states, 'statename');
    }
    if (CTID !== '') {
      // dbContext._City.Where(m => m.CityName == CTID).FirstOrDefault()
      const cities = await db.queryOne(DB, 'select ctid from city where cityname is not distinct from @CTID limit 1', { CTID });
      if (cities) cityid = col(cities, 'ctid');
    } else {
      CTID = '0';
      cityid = 0;
    }
    if (PinCode === '') PinCode = 'N/A';
    if (CID === null) CID = '96';
    // dbo.usp_update_basic_info_member ... @Result out  (DoNotEnsureTransaction)
    const row = await db.procOne(DB, 'usp_update_basic_info_member', {
      FName: g('Name'), Mobile: g('Mobile'), EmailId: g('EmailId'), Address: g('Address'), Country: CID, State: SID, City: cityid, Regno, EmpID,
      IPAddress: IpAddress, CityName: CTID, StateName, PinCode, Active: g('Active'),
    });
    OutputResult = str(col(row, 'result'));
    if (OutputResult === 'Success') {
      const reg_no = toInt32(Regno);
      const MM = await db.queryOne(DB, 'select username, mobile from member_master where regno = @reg_no limit 1', { reg_no });
      const sms = await db.queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 1057 limit 1', {});
      if (!MM || !sms) nullRef();
      const SendMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(col(MM, 'username'), col(sms, 'sms_content'), g('Remark'), '', 30);
      if (Number(col(sms, 'sms_send_status')) === 1) {
        // new Thread(() => UtilityClass.SendSMSWithAPI(MM.mobile, SendMsg, "1")).Start()  => fire-and-forget
        const mobile = col(MM, 'mobile');
        setImmediate(() => {
          Promise.resolve(UtilityClass.SendSMSWithAPI(mobile, SendMsg, '1'))
            .catch((e) => console.error('[admin/All_Member_List] sms thread failed:', e.message));
        });
      }
    }
    // eslint-disable-next-line no-unused-vars
    const empcode = req.user.emp_code;
    const reg = toInt32(Regno); // Convert.ToInt64(Regno)
    // var mem = dbContext._Member_Master.Where(m => m.regNo == reg).FirstOrDefault();  (unused)
    await db.queryOne(DB, 'select regno from member_master where regno = @reg limit 1', { reg });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_update_basic_info_member');
  }
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult check_city(string cityname, Int32 SID)
// auth
router.all(`/admin/${C}/check_city{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SID = reqInt(req.p.SID, 'SID');
  let cityid = 0;
  // dbContext._City.Where(m => m.CityName == cityname && m.Sid == SID).FirstOrDefault()   (catch => throw)
  const cities = await db.queryOne(DB, 'select ctid from city where cityname is not distinct from @cityname and sid = @SID limit 1', { cityname: sv(req.p.cityname), SID });
  if (cities) cityid = col(cities, 'ctid');
  return res.json(cityid);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] public void getwallettype()
// auth (public void => routable; only fills ViewBag => empty response)
router.all(`/admin/${C}/getwallettype{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await getwallettype({});
  res.send('');
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult CountAllowesPANNum(string PANNUM)
// auth
router.all(`/admin/${C}/CountAllowesPANNum{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let allowedpan = '';
  try {
    // DBO.USP_COUNTNUMBEROFUSEDPANNUMBER @PANNO,@Result out   (SqlQuery<KYCDetails>, rows unused)
    const rows = await db.proc(DB, 'USP_COUNTNUMBEROFUSEDPANNUMBER', { PANNO: sv(req.p.PANNUM) });
    allowedpan = str(col(rows[0], 'result'));
  } catch (ex) {
    await errorInsert(req, ex, 'USP_COUNTNUMBEROFUSEDPANNUMBER');
    // ViewBag.filepath = ex.Message
  }
  return res.json(allowedpan);
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult GetCity(string Prefix, Int32 sid)
// auth
router.all(`/admin/${C}/GetCity{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sid = reqInt(req.p.sid, 'sid');
  const _cityname = mapRows(await db.proc(DB, 'USP_GETCITY_autocomplete', { Prefix: sv(req.p.Prefix), sid }), CITYNAME_PROPS);
  return res.json(_cityname);
}));

// ---------------------------------------------------------------- private static AddCellToHeader / AddCellToBody (iTextSharp cells)
function AddCellToHeader(tableLayout, cellText) {
  tableLayout.AddCell({ text: cellText, colspan: 9, align: 'left', padding: 5, bg: [128, 0, 0], color: [255, 255, 0] });
}
function AddCellToBody(tableLayout, cellText, Colspan) {
  tableLayout.AddCell({ text: cellText, colspan: Colspan, align: 'left', padding: 5, bg: [255, 255, 255], color: [0, 0, 0] });
}

/** protected PdfPTable Add_Content_To_PDF(PdfPTable tableLayout) */
async function Add_Content_To_PDF(req, tableLayout) {
  tableLayout.SetWidths([30, 30, 30, 30, 30, 30, 30, 30, 30]);
  tableLayout.WidthPercentage = 100;
  tableLayout.HeaderRows = 1;
  const logo = await db.scalar(DB, 'select logo from tbl_companymaster limit 1', {});
  // eslint-disable-next-line no-unused-vars
  const image = mapPath('~/Images/' + (logo === null || logo === undefined ? '' : logo)); // (computed, never added to the PDF in legacy)
  const nm = sessionStore.get(req, 'name');
  if (nm === null || nm === undefined) nullRef(); // Session["name"].ToString()
  tableLayout.AddCell({ text: 'Member Details' + ' ' + 'of' + ' ' + String(nm), colspan: 6, border: 0, paddingBottom: 5, align: 'center', color: [0, 0, 0] });
  AddCellToHeader(tableLayout, 'Basic Information');
  const sreg = sessionStore.get(req, 'regno');
  if (sreg !== null && sreg !== undefined) {
    const reg = String(sreg);
    const Tables = await viewAllDetailMember(reg);
    if (Tables.length > 0) {
      const r = rowAt(Tables[0], 0);
      const c = (k) => col(r, k);
      const basic = {};
      basic.ACCOUNTNO = s(c('ACCOUNTNO'));
      basic.BANKNAME = s(c('BANKNAME'));
      basic.BRANCHNAME = s(c('BRANCHNAME'));
      basic.CITYNAME = s(c('CITYNAME'));
      basic.Coin_Wallet = cdec(c('Coin_Wallet'));
      basic.commission_wallet = cdec(c('commission_wallet'));
      basic.USERNAME = s(c('USERNAME'));
      basic.COUNTRYNAME = s(c('COUNTRYNAME'));
      basic.E_Wallet = cdec(c('E_Wallet'));
      basic.EMAILID = s(c('EMAILID'));
      basic.IFSCCODE = s(c('IFSCCODE'));
      basic.KYCSTATUS = s(c('KYCSTATUS'));
      basic.MOBILE = s(c('MOBILE'));
      basic.Name = s(c('Name'));
      basic.PANNO = s(c('PANNO'));
      sessionStore.set(req, 'name', basic.Name);
      // PORT-NOTE/security: legacy decrypts and prints the member password and transaction password in the PDF - kept.
      basic.PASSWORD = await UtilityClass.Decryptword(s(c('PASSWORD')));
      basic.REGDATE = s(c('REGDATE'));
      basic.Shopping_Wallet = cdec(c('Shopping_Wallet'));
      basic.STATENAME = s(c('STATENAME'));
      basic.TPASSWORD = await UtilityClass.Decryptword(s(c('TPASSWORD')));
      basic.Address = s(c('Address'));
      basic.pincode = s(c('pincode'));
      basic.AcHolderName = s(c('AcHolderName'));
      AddCellToBody(tableLayout, 'Name:' + basic.Name, 5);
      AddCellToBody(tableLayout, 'Mobile No.:' + basic.MOBILE, 5);
      AddCellToBody(tableLayout, 'Email Id:' + basic.EMAILID, 5);
      AddCellToBody(tableLayout, 'Username:' + basic.USERNAME, 5);
      AddCellToBody(tableLayout, 'Date of Reg:' + basic.REGDATE, 5);
      AddCellToBody(tableLayout, 'Bank Name.:' + basic.BANKNAME, 5);
      AddCellToBody(tableLayout, 'Branch Name:' + basic.BRANCHNAME, 5);
      AddCellToBody(tableLayout, 'A/C Holder Name:' + basic.AcHolderName, 5);
      AddCellToBody(tableLayout, 'IFSC Code:' + basic.IFSCCODE, 5);
      AddCellToBody(tableLayout, 'A/C No.:' + basic.ACCOUNTNO, 5);
      AddCellToBody(tableLayout, 'PAN No.:' + basic.PANNO, 5);
      AddCellToBody(tableLayout, 'KYC Status:' + basic.KYCSTATUS, 5);
      AddCellToBody(tableLayout, 'Password:' + basic.PASSWORD, 5);
      AddCellToBody(tableLayout, 'Transaction Password:' + basic.TPASSWORD, 5);
      AddCellToHeader(tableLayout, 'Adress Information');
      AddCellToBody(tableLayout, 'Address:' + basic.Address, 5);
      AddCellToBody(tableLayout, 'Country.:' + basic.COUNTRYNAME, 5);
      AddCellToBody(tableLayout, 'State.:' + basic.STATENAME, 5);
      AddCellToBody(tableLayout, 'City:' + basic.CITYNAME, 5);
      AddCellToBody(tableLayout, 'PinCode:' + basic.pincode, 5);
      AddCellToBody(tableLayout, '', 5);
      AddCellToHeader(tableLayout, 'Wallet Information');
      AddCellToBody(tableLayout, 'E-Wallet.:' + fix2(basic.E_Wallet), 2);
      AddCellToBody(tableLayout, 'Commission Wallet.:' + fix2(basic.commission_wallet), 2);
      AddCellToBody(tableLayout, 'Coin Wallet:' + fix2(basic.Coin_Wallet), 2);
      AddCellToBody(tableLayout, 'Shopping Wallet:' + fix2(basic.Shopping_Wallet), 3);
      AddCellToHeader(tableLayout, 'Purchase Information');
      AddCellToBody(tableLayout, 'S No.', 1);
      AddCellToBody(tableLayout, 'Purchase Date', 2);
      AddCellToBody(tableLayout, 'Amount', 2);
      AddCellToBody(tableLayout, 'Name', 2);
      AddCellToBody(tableLayout, 'Payitforward', 2);
      const dt3 = tableAt(Tables, 2);
      for (let k = 0; k < dt3.length; k++) {
        const x = dt3[k];
        if (dt3.length === 1 && (cdec(col(x, 'AllPackageAmount')) === 0 && s(col(x, 'AllPackageName')) === '' && s(col(x, 'PuchaseDate')) === '')) {
          AddCellToBody(tableLayout, 'No Record found', 9);
        } else {
          const AllPackageAmount = cdec(col(x, 'AllPackageAmount'));
          const AllPackageName = s(col(x, 'AllPackageName'));
          const PayItForward = s(col(x, 'PayItForward'));
          const PuchaseDate = s(col(x, 'PuchaseDate'));
          const ROWNUMBER = cint(col(x, 'ROWNUMBER'));
          AddCellToBody(tableLayout, String(ROWNUMBER), 1);
          AddCellToBody(tableLayout, PuchaseDate, 2);
          AddCellToBody(tableLayout, fix2(AllPackageAmount), 2);
          AddCellToBody(tableLayout, AllPackageName, 2);
          AddCellToBody(tableLayout, PayItForward, 2);
        }
      }
      const dt4 = tableAt(Tables, 3);
      AddCellToHeader(tableLayout, 'KYC Information');
      AddCellToBody(tableLayout, 'S No.', 1);
      AddCellToBody(tableLayout, 'Type', 2);
      AddCellToBody(tableLayout, 'Submit Date', 2);
      AddCellToBody(tableLayout, 'Approved Date', 2);
      AddCellToBody(tableLayout, 'Status', 2);
      if (dt4.length > 0) {
        for (const x of dt4) {
          const Type = s(col(x, 'Type'));
          const Dtm_Aprove = s(col(x, 'Dtm_Aprove'));
          const Dtm_date = s(col(x, 'Dtm_date'));
          const IsAprove = s(col(x, 'IsAprove'));
          const ROWNUMBER = cint(col(x, 'ROWNUMBER'));
          AddCellToBody(tableLayout, String(ROWNUMBER), 1);
          AddCellToBody(tableLayout, Type, 2);
          AddCellToBody(tableLayout, Dtm_date, 2);
          AddCellToBody(tableLayout, Dtm_Aprove, 2);
          AddCellToBody(tableLayout, IsAprove, 2);
        }
      } else {
        AddCellToBody(tableLayout, 'No Record found', 9);
      }
      const dt2 = tableAt(Tables, 1);
      AddCellToHeader(tableLayout, 'Withdrawal Information');
      AddCellToBody(tableLayout, 'S No.', 1);
      AddCellToBody(tableLayout, 'Date', 2);
      AddCellToBody(tableLayout, 'Amount', 1);
      AddCellToBody(tableLayout, 'TDS', 1);
      AddCellToBody(tableLayout, 'Admin Charge', 1);
      AddCellToBody(tableLayout, 'Payable Amount', 1);
      AddCellToBody(tableLayout, 'Mode', 1);
      AddCellToBody(tableLayout, 'Process Date', 1);
      for (let j = 0; j < dt2.length; j++) {
        const x = dt2[j];
        if (dt2.length === 1 && (s(col(x, 'DATE')) === '' && cdec(col(x, 'WITHDRAWAMOUNT')) === 0 && cdec(col(x, 'ADMINCHARGE')) === 0
          && cdec(col(x, 'PAYBLEAMOUNT')) === 0 && cdec(col(x, 'TDS')) === 0)) {
          AddCellToBody(tableLayout, 'No Record found', 9);
        } else {
          const DATE = s(col(x, 'DATE'));
          const WITHDRAWAMOUNT = cdec(col(x, 'WITHDRAWAMOUNT'));
          const ADMINCHARGE = cdec(col(x, 'ADMINCHARGE'));
          const PAYBLEAMOUNT = cdec(col(x, 'PAYBLEAMOUNT'));
          const PayModeName = s(col(x, 'PayModeName'));
          const ProcessDate = s(col(x, 'ProcessDate'));
          const TDS = cdec(col(x, 'TDS'));
          const ROWNUMBER = cint(col(x, 'ROWNUMBER'));
          AddCellToBody(tableLayout, String(ROWNUMBER), 1);
          AddCellToBody(tableLayout, DATE, 2);
          AddCellToBody(tableLayout, fix2(WITHDRAWAMOUNT), 1);
          AddCellToBody(tableLayout, fix2(TDS), 1);
          AddCellToBody(tableLayout, fix2(ADMINCHARGE), 1);
          AddCellToBody(tableLayout, fix2(PAYBLEAMOUNT), 1);
          AddCellToBody(tableLayout, PayModeName, 1);
          AddCellToBody(tableLayout, ProcessDate, 1);
        }
      }
      AddCellToHeader(tableLayout, 'Business Information');
      AddCellToBody(tableLayout, 'Left', 4);
      AddCellToBody(tableLayout, 'Right', 5);
      if (Tables.length > 0) {
        const x = rowAt(tableAt(Tables, 4), 0);
        const ob = {
          CLBV: cdec(col(x, 'CLBV')), CRBV: cdec(col(x, 'CRBV')), DLBV: cdec(col(x, 'DLBV')), DRBV: cdec(col(x, 'DRBV')),
          PaidBV: cdec(col(x, 'PaidBV')), TLBV: cdec(col(x, 'TLBV')), TRBV: cdec(col(x, 'TRBV')), FlushBV: cdec(col(x, 'FlushBV')),
        };
        AddCellToBody(tableLayout, 'Currrent :' + ' ' + String(ob.CLBV), 4);
        AddCellToBody(tableLayout, 'Currrent :' + ' ' + String(ob.CRBV), 5);
        AddCellToBody(tableLayout, 'Paid :' + ' ' + fix2(ob.PaidBV), 4);
        AddCellToBody(tableLayout, 'Paid :' + ' ' + fix2(ob.PaidBV), 5);
        AddCellToBody(tableLayout, 'Flush :' + ' ' + fix2(ob.FlushBV), 4);
        AddCellToBody(tableLayout, 'Flush :' + ' ' + fix2(ob.FlushBV), 5);
        AddCellToBody(tableLayout, 'Total :' + ' ' + String(ob.TLBV), 4);
        AddCellToBody(tableLayout, 'Total :' + ' ' + String(ob.TRBV), 5);
        AddCellToBody(tableLayout, 'Direct :' + ' ' + String(ob.DLBV), 4);
        AddCellToBody(tableLayout, 'Direct :' + ' ' + String(ob.DRBV), 5);
      }
    }
  }
  return tableLayout;
}

// ---------------------------------------------------------------- [SessionExpireCheck] FileResult CreatePdf()
// auth (uses Session["name"] / Session["regno"] set by member_details)
router.all(`/admin/${C}/CreatePdf{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const dTime = new Date();
  const nm = sessionStore.get(req, 'name');
  if (nm === null || nm === undefined) nullRef(); // Session["name"].ToString()
  const strPDFFileName = String(nm) + netFormat(dTime, 'yyyyMMdd') + '-' + '.pdf';
  // eslint-disable-next-line no-unused-vars
  const strAttachment = mapPath('~/Downloadss/' + strPDFFileName); // (computed, never written in legacy)
  // PORT-NOTE: iTextSharp Document (margins 0) + PdfPTable(9) => _shared/batch03_pdf.js (see its PORT-NOTE)
  const tableLayout = new PdfTable(9);
  await Add_Content_To_PDF(req, tableLayout);
  const byteInfo = renderPdf(tableLayout, { margins: 0, fontSize: 8 });
  sessionStore.set(req, 'name', '');
  res.set('Content-Type', 'application/pdf');
  res.set('Content-Disposition', `attachment; filename="${strPDFFileName.replace(/"/g, '')}"`);
  return res.send(byteInfo);
}));

module.exports = router;
