'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\All_Member_List_Free.cs (class All_Member_List_freeController => /admin/All_Member_List_free/...)
// Database: affiliate (Db_Affiliate). Tables: member_master, member_login.
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const { adminAuth, isAdmin, errorInsert, legacyUrl, issueAdminToken } = require('./_shared/admin-session');
const {
  DB, nint, nstr, nre, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, mapRow,
} = require('./_shared/batch02-common');

const router = express.Router();
const C = 'All_Member_List_free';

/** class AllMemberList (Controllers/AdminPanel/All_Member_List.cs) */
const ALLMEMBERLIST_PROPS = ['rowNumber', 'ROWNUMBERS', 'Regno', 'LoginId', 'Membername', 'mobile', 'respounserId', 'RESPOUNSEREMAILID', 'RespounserName',
  'Regdate', 'ppv', 'gpv', 'Panno', 'PBV', 'CityName', 'Accountno', 'Bankname', 'BRANCHNAME', 'IfscCode', 'Active', 'Activestatus', 'PV', 'LID', 'RID',
  'rootID', 'TLBV', 'TRBV', 'PaidBV', 'ADDRESS', 'addres', 'Kycstatus', 'Status', 'ChallanStatus', 'IsPanVerified', 'ChallanVerifiedOrNot',
  'Member_Unique_Id', 'DOC', 'Package', 'Password', 'MemType', 'Username', 'sponsername', 'TPASSWORD', 'JoiningType', 'EMAILID', 'STATENAME', 'PARENTID'];
/** class MemberDetails (Controllers/AdminPanel/All_Member_List.cs) */
const MEMBERDETAILS_PROPS = ['regNo', 'LoginId', 'Password', 'FName', 'MName', 'LName', 'mobile', 'Emailid', 'dob', 'gender', 'pincode', 'address', 'ctid',
  'cityname', 'Panno', 'spounserId', 'RespounserName', 'Regdate', 'name', 'relation', 'Accountno', 'Bankname', 'branchName', 'IfscCode', 'addres', 'gpv',
  'status', 'Kycstatus', 'Active', 'DTHCustomerId', 'Application_FormNo', 'BitCoinWalletAddress', 'AcHolderName', 'PaypalEmail', 'MoneygarmName',
  'MoneygarmAddress', 'HighestQualification', 'USERNAME', 'Title', 'GaKeyStatus', 'SID', 'parentid', 'CID', 'Atc_WalletAddress'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** string.IndexOfAny(UtilityClass.SpecialCharsForLoginID) >= 0 */
const hasSpecial = (s) => (UtilityClass.SpecialCharsForLoginID || []).some((ch) => s.includes(ch));

// public void ExportReport(string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, int? page)
async function ExportReport(req, res, SearchField, SearchValue, VarifiedPanStatus, fromDate, toDate, ddlStatus, page, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'All_Member_List_free' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const MaxRows = await UtilityClass.GridPageSize(); // (unused)
  void MaxRows;
  if (page === null) page = 1;
  for (const v of [SearchField, SearchValue, fromDate, toDate, ddlStatus, VarifiedPanStatus]) if (v === null) throw nre();
  const rows = await db.proc(DB, 'usp_All_memberList_free', {
    StartRowIndex: page, MaxRows: '1000000', SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(),
    ToDate: toDate.trim(), userType: ddlStatus.trim(), VarifiedPanStatus: VarifiedPanStatus.trim(),
  });
  const LRMember = mapRows(rows, ALLMEMBERLIST_PROPS);
  if (LRMember.length > 0) {
    return tsvDownload({
      req, res, ViewBag, xlsName: 'All_Member_List_Free.xls', Filename,
      headers: ['S.No.', 'Username', 'Name', 'Contact', 'Email_ID', 'Sponser', 'Sponser Email_ID', 'Join Date', 'PAN No', 'BANK NAME', 'IFSC CODE',
        'ACCOUNT NO', 'State', 'City', 'Address'],
      rows: LRMember,
      innerProc: null, // bare `catch { wr.Close(); }` (no ErrorInsert)
      outerProc: 'ExportReport',
      cells: (item, w) => {
        for (const k of ['rowNumber', 'Username', 'Membername', 'mobile', 'EMAILID', 'RespounserName', 'RESPOUNSEREMAILID', 'Regdate', 'Panno', 'Bankname',
          'IfscCode', 'Accountno', 'STATENAME', 'CityName']) {
          w(tab(cs(item[k])) + ' \t');
        }
        const s = item.ADDRESS;
        if (s === null || s === undefined) throw new Error("Value cannot be null.\r\nParameter name: input"); // Regex.Replace(null)
        const replacement = String(s).replace(/\t|\n|\r/g, '');
        w(tab(replacement) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string datetype, string SearchField, string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, int? page, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/All-Member-List-free" -> All_Member_list_free/Index (controller names are case-insensitive)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Member-List-free'], adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nstr(req.p[k]);
  let dynamicpagging = nint(req.p.dynamicpagging);
  let page = nint(req.p.page);
  let datetype = s('datetype'); let SearchField = s('SearchField'); let SearchValue = s('SearchValue'); let fromDate = s('fromDate');
  let toDate = s('toDate'); let ddlStatus = s('ddlStatus'); let VarifiedPanStatus = s('VarifiedPanStatus'); let btnexel = s('btnexel');
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (datetype === null) datetype = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlStatus === null) ddlStatus = '';
  if (VarifiedPanStatus === null) VarifiedPanStatus = '';
  if (btnexel === null) btnexel = '';
  const Empid = req.user.emp_id;
  // Session["Admin_User_Menu"] = UtilityClass.UpdateAdminMenu(Empid); Session["Admin_User"] = objUtil.UpdateAdminUserSession(Empid);
  const menu = await UtilityClass.UpdateAdminMenu(Empid);
  sessionStore.set(req, 'Admin_User_Menu', menu);
  const EM = await new UtilityClass().UpdateAdminUserSession(Empid);
  if (!EM) throw nre(); // EM.Emp_ID on null
  const Employeeid = EM.Emp_ID;
  const token = issueAdminToken(EM); // refreshed session => refreshed token
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  try {
    const MaxRows = toInt32(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'usp_All_memberList_free', {
      StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: fromDate.trim(), ToDate: toDate.trim(),
      userType: ddlStatus.trim(), VarifiedPanStatus: VarifiedPanStatus.trim(), Emp_ID: Empid, Page_Name: url, SessionID: '0', orderbydate: datetype,
    });
    const AllEPinRequestsList = mapRows(rows, ALLMEMBERLIST_PROPS);
    const TotalRecord = toInt32(outStr(col(rows[0], 'totalcount')) || 'x'); // int.Parse(DBNull => "") => FormatException => catch
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, dynamicpagging,
      orderbydate: datetype, fromDate, toDate, ddlStatus, VarifiedPanStatus,
    });
    ViewBag.LiState = await new State().State_List_On_CID(96);
    ViewBag.LiCity = await new CITY().City_List_On_CID(96);
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, VarifiedPanStatus, fromDate, toDate, ddlStatus, page, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/All_Member_List_free/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag, token });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', token });
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberProfile(string regNo, string loginid, ..., int gender, ..., int ctid, ..., string AccountHolderName)
// auth (reads Session["Admin_User"] => NullReferenceException without a session)
router.all(`/admin/${C}/UpdateMemberProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => nstr(req.p[k]);
  const gender = reqInt(req.p.gender, 'gender');
  const ctid = reqInt(req.p.ctid, 'ctid');
  const imgname = '';
  let OutputResult = '';
  let dob = P('dob');
  if (dob === null) throw nre();
  if (dob.trim() === '01/01/0001') dob = '';
  try {
    if (dob.trim() !== '') {
      const arrdob = dob.split('-');
      if (arrdob.length < 3) throw new Error('Index was outside the bounds of the array.');
      dob = arrdob[2] + '-' + arrdob[1] + '-' + arrdob[0];
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateMemberProfile');
    dob = null;
  }
  const MoneyGramAddress = P('MoneyGramAddress');
  // PORT-NOTE: the legacy EXEC text passed @MoneyGramName,@MoneyGramAddress,@AcountHolderName POSITIONALLY into the procedure's
  //   (AcountHolderName, MoneyGramName, MoneyGramAddress) slots, and @MoneyGramName carried the MoneyGramAddress value; reproduced here.
  //   "" passed to the INT parameters @stid / @cid => 0 (SQL Server conversion).
  const row = await db.procOne(DB, 'USP_MEMBERPROFILE', {
    regno: toInt32(P('regNo')), loginid: P('loginid'), fname: P('fName'), mname: P('mName'), lName: P('lName'), Gender: gender, Dob: dob,
    Email: P('email'), mobile: P('mobile'), Pincode: P('pincode'), stid: 0, ctid, CityName: P('citynm'), StateName: '', addres: P('address'),
    imagefilename: imgname, tpassword: P('password'), cid: 0, panno: P('panno'), nomineename: P('nomineename'), relation: P('relation'),
    bankname: P('bankname'), ifsccode: P('ifsccode'), acountno: P('acountno'), CHALLANIMAGE: '', DTHCustomerId: P('DTHCustomerId'),
    Application_FormNo: P('ApplicationFormNo'), BitCoinWalletAddress: P('BitCoinWalletAddress'), PayPalEmail: P('PayPalEmail'),
    AcountHolderName: MoneyGramAddress, MoneyGramName: MoneyGramAddress, MoneyGramAddress: P('AccountHolderName'),
  });
  OutputResult = outStr(col(row, 'result'));
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult GetMemberDetail(double regno)
// auth (legacy had no session check; member personal data => adminAuth)
router.all(`/admin/${C}/GetMemberDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const raw = req.p.regno;
  const regno = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isFinite(regno)) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'regno' of non-nullable type 'System.Double'" });
  }
  const rows = await db.proc(DB, 'usp_GetMemberDetails', { regno });
  if (!rows.length) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(rows[0], MEMBERDETAILS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(int regno, string mode)
// auth (reads Session["Admin_User"] => NullReferenceException without a session)
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const regno = reqInt(req.p.regno, 'regno');
  const mode = nstr(req.p.mode);
  let retvalue = '';
  // legacy concatenated regno (int) into the SQL; parameterised here
  if (mode === 'Activate') {
    await db.exec(DB, 'update member_master set status = 1 where regno = @regno', { regno });
    await db.exec(DB, 'update member_login set status = 1 where regno = @regno', { regno });
    retvalue = 'Activate';
  }
  if (mode === 'Deactivate') {
    await db.exec(DB, 'update member_master set status = 0 where regno = @regno', { regno });
    await db.exec(DB, 'update member_login set status = 0 where regno = @regno', { regno });
    retvalue = 'Deactivate';
  }
  return res.json(retvalue);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nstr(req.p[k]);
  const r = await ExportReport(req, res, s('SearchField'), s('SearchValue'), s('VarifiedPanStatus'), s('fromDate'), s('toDate'), s('ddlStatus'), nint(req.p.page), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult checkClientAndGetData(string clients)
// auth-by-check (legacy returned "error^This page has been expired,Please login again" after the input checks)
router.all(`/admin/${C}/checkClientAndGetData{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const clients = nstr(req.p.clients);
  if (clients === null) throw nre();
  if (clients.length > 10) return res.json('error^Invalid customer ID');
  if (clients.trim() === '' || hasSpecial(clients)) return res.json('error^Please enter valid Client ID');
  if (!isAdmin(req)) return res.json('error^This page has been expired,Please login again');
  try {
    // legacy concatenated `clients` into the SQL (SQL injection) => parameterised
    const r = await db.queryOne(DB, `select ((fname || ' ' || coalesce(mname, '') || ' ' || coalesce(lname, '')) || '  Mob. ' || mobile || '  SPID:' || sponserid) as name
      from member_master where loginid = @clients limit 1`, { clients });
    const Ret = r ? col(r, 'name') : null;
    if (Ret !== null && Ret !== undefined && String(Ret) !== '') return res.json('ok^' + Ret);
    return res.json('error^Invalid Client ID');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkClientAndGetData');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- JsonResult ChangeSponsor(string ChangeMemID, string NewSPID)
// auth-by-check (legacy returned "error^This page has been expired,Please login again" after the input checks)
router.all(`/admin/${C}/ChangeSponsor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const ChangeMemID = nstr(req.p.ChangeMemID);
  const NewSPID = nstr(req.p.NewSPID);
  if (ChangeMemID === null) throw nre();
  if (ChangeMemID.length > 10) return res.json('error^Invalid Client ID');
  if (ChangeMemID.trim() === '' || hasSpecial(ChangeMemID)) return res.json('error^Please enter valid Client ID');
  if (NewSPID === null) throw nre();
  if (NewSPID.length > 10) return res.json('error^Invalid Sponsor ID');
  if (NewSPID.trim() === '' || hasSpecial(NewSPID)) return res.json('error^Please enter valid Sponsor ID');
  if (!isAdmin(req)) return res.json('error^This page has been expired,Please login again');
  try {
    // "usp_ChangeSponsor @newSPID,@LoginID,@strResult out" is POSITIONAL: proc params are (USERNAME, SPONCERNAME, STRRESULT, ...)
    // PORT-NOTE: reproduced positionally => USERNAME = NewSPID, SPONCERNAME = ChangeMemID (as the legacy EXEC did).
    const row = await db.procOne(DB, 'usp_ChangeSponsor', { USERNAME: NewSPID, SPONCERNAME: ChangeMemID });
    return res.json(outStr(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'ChangeSponsor');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- JsonResult CreateParent(string ChangeMemID, string RootID, int Side)
// auth-by-check (legacy returned "error^This page has been expired,Please login again" first)
router.all(`/admin/${C}/CreateParent{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Side = reqInt(req.p.Side, 'Side');
  if (!isAdmin(req)) return res.json('error^This page has been expired,Please login again');
  const ChangeMemID = nstr(req.p.ChangeMemID);
  const RootID = nstr(req.p.RootID);
  if (ChangeMemID === null) throw nre();
  if (ChangeMemID.length > 10) return res.json('error^Invalid Client ID');
  if (ChangeMemID.trim() === '' || hasSpecial(ChangeMemID)) return res.json('error^Please enter valid Client ID');
  if (RootID === null) throw nre();
  if (RootID.length > 10) return res.json('error^Invalid Parent ID');
  if (RootID.trim() === '' || hasSpecial(RootID)) return res.json('error^Please enter valid Parent ID');
  if (Side < 1 || Side > 2) return res.json('error^Please select valid side');
  try {
    // PORT-NOTE: usp_ProvideRootIDToMember is not in the Db_Affiliate schema dump; parameter names taken from the EXEC text.
    const row = await db.procOne(DB, 'usp_ProvideRootIDToMember', { LoginID: ChangeMemID, rootID: RootID, Side });
    return res.json(outStr(col(row, 'strresult')));
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'CreateParent');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- JsonResult ChangeStatusOfPanno(string Regno)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/ChangeStatusOfPanno{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'uspVerified_And_UnVerifiedPan', { regNo: nstr(req.p.Regno) });
  return res.json(outStr(col(row, 'strresult')));
}));

module.exports = router;
