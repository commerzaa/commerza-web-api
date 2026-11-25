'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Map_PinCode.cs (class Map_PinCodeController => /Map_PinCode/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_Show_Pincode, USP_FRANCHISEPINCODEMAPPING, USP_FRANCHISEDETAILSBYFRID.
// Tables: tbl_franchisepincodemapping, tbl_smsaction, tbl_emailaction. Session keys (sessionStore): 'FIMID', 'PrevURL'.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, reqInt, cvtInt, outIntOf, at, col, nullRef } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Map_PinCode';

/** class ALLPinCode */
const ALL_PINCODE = ['COUNTRYNAME', 'STATENAME', 'CITYNAME', 'PinCode', 'ROWNUMBER', 'AID'];
/** class MappedPinCode */
const MAPPED_PINCODE = ['FIMID', 'AID', 'AREANAME', 'PINCODE', 'COUNTRYNAME', 'STATENAME'];
/** class FranchiseDetails (Controllers/AdminPanel/Pending_RequestController.cs) */
const FRANCHISE_DETAILS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];

/** Convert.ToInt32(object) on a Session value (null => 0) */
const sessInt = (v) => (v === null || v === undefined ? 0 : cvtInt(String(v)));
/** int parameter with a C# default value (missing => default; invalid => model-binding error) */
function optInt(v, name, def) {
  if (v === undefined || v === null || v === '') return def;
  return reqInt(v, name);
}

// ---------------------------------------------------------------- Index(string PinCode, string Country, string State, string City, string FIMID, int? page, int? Cutpage, string URL)
// auth (PORT-NOTE: legacy had no session check on this admin page - protected; Session values are per admin in sessionStore)
// route-config: "AdminPanel/MAP-PINCODE" -> Map_PinCode/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MAP-PINCODE'], adminAuth, asyncHandler(async (req, res) => {
  let PinCode = nStr(req.p.PinCode);
  let Country = nStr(req.p.Country);
  let State = nStr(req.p.State);
  let City = nStr(req.p.City);
  let FIMID = nStr(req.p.FIMID);
  let page = nInt(req.p.page);
  let Cutpage = nInt(req.p.Cutpage);
  const URL = nStr(req.p.URL);
  const ViewBag = {};
  if (URL !== null && URL !== '') {
    sessionStore.set(req, 'PrevURL', '');
    sessionStore.set(req, 'PrevURL', await UtilityClass.Decryptword(URL));
    ViewBag.Prevurl = String(sessionStore.get(req, 'PrevURL') ?? '') + '?' + 'PinCode=' + (PinCode === null ? '' : PinCode);
  } else {
    ViewBag.URL = '';
  }
  if (FIMID !== null && FIMID !== '') {
    FIMID = await UtilityClass.Decryptword(FIMID);
    sessionStore.set(req, 'FIMID', FIMID);
  } else {
    const s = sessionStore.get(req, 'FIMID');
    if (s !== null && s !== undefined) FIMID = String(s);
  }
  ViewBag.FIMID = FIMID;
  if (PinCode === null) PinCode = '';
  if (Country === null) Country = '';
  if (State === null) State = '';
  if (City === null) City = '';
  if (Cutpage === null) Cutpage = 100;
  if (page === null) page = 1;
  let PINCODELIST = [];
  try {
    const MaxRows = 10; void MaxRows;
    // [DBO].[Usp_Show_Pincode] @FMID,@PinCode,@Country,@STATE,@CITY,@STARTROWINDEX,@MAXROWS,@TOTALCOUNT out
    const rows = await db.proc(DB, 'Usp_Show_Pincode', {
      FMID: sessInt(sessionStore.get(req, 'FIMID')), PinCode, Country, STATE: State, CITY: City, STARTROWINDEX: page, MAXROWS: Cutpage,
    });
    PINCODELIST = mapRows(rows, ALL_PINCODE);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      PinCode, Country, State, City, FIMID, GridPageSize: Cutpage, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), CurrentPage: page,
    });
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") FIRST (ThreadAbortException), so its ErrorInsert block never ran.
    console.error('[admin] Map_PinCode/Index:', Exp.message);
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/AdminPanel/Map_PinCode/Index.cshtml', Model: PINCODELIST, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult MapPincodeWithFranchise(int FIMID = 0, int AID = 0, int Mode = 0)
// auth (reads Session["Admin_User"].Emp_ID inside the try; legacy without a session replied "ERROR")
router.all(`/admin/${C}/MapPincodeWithFranchise{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let FIMID = optInt(req.p.FIMID, 'FIMID', 0);
  const AID = optInt(req.p.AID, 'AID', 0);
  const Mode = optInt(req.p.Mode, 'Mode', 0);
  try {
    const s = sessionStore.get(req, 'FIMID');
    if (s !== null && s !== undefined) FIMID = cvtInt(String(s));
    const EID = req.user.emp_id;
    if (FIMID !== 0 && AID !== 0) {
      // [USP_FRANCHISEPINCODEMAPPING] @FRANCHISEID,@AREAID,@ACTIVE,@MODE,@EMPID,@STROUTPUT Out
      const rows = await db.proc(DB, 'USP_FRANCHISEPINCODEMAPPING', { FRANCHISEID: FIMID, AREAID: AID, ACTIVE: 1, MODE: Mode, EMPID: EID });
      const v = col(rows[0], 'stroutput');
      return res.json(v === null || v === undefined ? '' : String(v));
    }
    return res.json('ERROR');
  } catch (ex) {
    return res.json('ERROR');
  }
}));

// ---------------------------------------------------------------- JsonResult GetMappedPincodeData(int FMID)
// auth (reads Session["Admin_User"].Emp_ID outside the try)
router.all(`/admin/${C}/GetMappedPincodeData{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let FMID = reqInt(req.p.FMID, 'FMID');
  const s = sessionStore.get(req, 'FIMID');
  if (s !== null && s !== undefined) FMID = cvtInt(String(s));
  const EID = req.user.emp_id;
  let mappedPincodeData = [];
  try {
    if (FMID !== 0) {
      const rows = await db.proc(DB, 'USP_FRANCHISEPINCODEMAPPING', { FRANCHISEID: FMID, AREAID: 1, ACTIVE: 1, MODE: 3, EMPID: EID });
      mappedPincodeData = mapRows(rows, MAPPED_PINCODE);
    }
    return res.json(mappedPincodeData);
  } catch (ex) {
    mappedPincodeData = null;
    return res.json(mappedPincodeData);
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateFranchisePinCodes(int FMID = 0)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/UpdateFranchisePinCodes{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let FMID = optInt(req.p.FMID, 'FMID', 0);
  const s = sessionStore.get(req, 'FIMID');
  if (s !== null && s !== undefined) FMID = cvtInt(String(s));
  let retData = 0;
  try {
    // UPDATE TBL_FRANCHISEPINCODEMAPPING SET ACTIVE=0 WHERE FRID=<FMID>  (parameterised)
    retData = await db.exec(DB, 'update tbl_franchisepincodemapping set active = 0 where frid = @FMID', { FMID });
    return res.json(retData);
  } catch (ex) {
    return res.json(retData);
  }
}));

// ---------------------------------------------------------------- JsonResult SendingEamilForMapPincodeOrDeMap(int Frid)
// auth (PORT-NOTE: legacy had no session check; it sends SMS/e-mail to a franchise - protected)
router.all(`/admin/${C}/SendingEamilForMapPincodeOrDeMap{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Frid = reqInt(req.p.Frid, 'Frid');
  const fileUploader = null;
  const FranchiseDetails = mapRows(await db.proc(DB, 'USP_FRANCHISEDETAILSBYFRID', { FRID: Frid }), FRANCHISE_DETAILS);
  const SMSVerification = await db.queryOne(DB, 'select sms_content from tbl_smsaction where id = 33 limit 1', {});
  const f0 = at(FranchiseDetails, 0);
  if (!SMSVerification) throw nullRef();
  const MobileSMS = await UtilityClass.FindingSmsContentWithUserIdPassword(f0.NAME, col(SMSVerification, 'sms_content'), '', '', 21);
  const emailVerificationmsg = await db.queryOne(DB, 'select email_subject, email_content from tbl_emailaction where eid = 29 limit 1', {});
  if (!emailVerificationmsg) throw nullRef();
  const EmailSubject = col(emailVerificationmsg, 'email_subject');
  const DynamicEmailSms = await UtilityClass.FindingEmailContentWithUserIdPassword(f0.NAME, col(emailVerificationmsg, 'email_content'), '', '', 20, '');
  // new Thread(...).Start() x2 => fire-and-forget
  Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(f0.MOBILE, MobileSMS, '1'))
    .catch((e) => console.error('[admin] Map_PinCode SMS thread:', e.message));
  Promise.resolve().then(() => {
    if (f0.EMAILID === null || f0.EMAILID === undefined) throw nullRef();
    return UtilityClass.SendEmailByApiSetting(f0.NAME, f0.PASSWORD, '', '', '', '', String(f0.EMAILID).toLowerCase(), EmailSubject, DynamicEmailSms, fileUploader);
  }).catch((e) => console.error('[admin] Map_PinCode e-mail thread:', e.message));
  return res.json('');
}));

module.exports = router;
