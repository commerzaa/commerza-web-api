'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\member_distributed_details.cs (class member_distributed_detailsController
// => /member_distributed_details/...). Database: affiliate (Db_Affiliate).
// Procs: USP_GETMEMBERPROFILESPONSOR, USP_PROFILEKYCREJECTIONDETAILS_FOR_MEMBER, _KYC_STATUS, USP_EDITCONTACTDETAILS, USP_INSERTBANKDETAIS,
// USP_PROFILEKYCREJECTIONDETAILS, USP_UPDATE_PROFILE_BANK_BILLING, KYCApproveAndReject, USP_GET_KYCSTATUSBYREGNO.
// Tables: member_master, tbl_kyc_details, kyc, portal_login, tbl_smsaction, tbl_emailaction.
// Public STATIC methods (NotifyToMemberAboutKYC, GetHtmlBodyForKyc, GetHtmlBodyRejectForKyc, NotifyToMemberAboutRejectKYC) and the private
// ThumbnailCallback are not MVC actions: ported as internal functions (exported on the router for reuse).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const SendMail = require('../../lib/admin/SendMail');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nInt, nStr, reqInt, reqLong, cvtInt, at, col, nullRef, str } = require('./_shared/batch09_common');
const { GetHtmlBodyForKyc, GetHtmlBodyRejectForKyc } = require('./_shared/batch09_kycmail');

const router = express.Router();
const C = 'member_distributed_details';
const SP = (n, v, d) => DataUtility.SqlParameter(n, v, d);

/** nested class member_distributed_detailsController.MemberProfileDetails */
const MEMBER_PROFILE_DETAILS = ['regNo', 'LoginId', 'userName', 'Fname', 'Lname', 'mobile', 'fath_hus_name', 'MOBILEFull', 'Emailid', 'countryName', 'dob',
  'gender', 'pincode', 'address', 'ctid', 'AccountType', 'sponserName', 'CityName', 'sid', 'cid', 'statename', 'bankName', 'ifscCode', 'accountNo',
  'BitCoinWalletAddress', 'ImageName', 'regdate', 'Name', 'relation', 'status', 'PanNo', 'LiState', 'LiCity', 'IsPanVerified', 'ChallanImage',
  'AcHolderName', 'PaypalEmail', 'MoneygarmName', 'MoneygarmAddress', 'sponserID', 'Side', 'nomName', 'nomRel', 'relationId', 'MicrCode', 'aadharno',
  'BRANCHNAME'];
/** class PROFILEKYCREJECTIOND_list */
const PROFILEKYCREJECTIOND = ['Date', 'USERID', 'USERNAME', 'EMAILID', 'PHONE', 'TYPE', 'DESCRIPTION', 'FNAME', 'CityName', 'COUNTRYNAME', 'STATENAME',
  'Address', 'pincode', 'Investamount', 'Activation_Date', 'Joining_Date'];
/** class PROFILEKYC_list */
const PROFILEKYC = ['INT_ROW_NUMMBER', 'ID', 'REGNO', 'TYPE', 'TKDID', 'IMAGE', 'ISAPROVE', 'INT_STATUS', 'COMMENTORREMARK', 'ISDELETED', 'GETMAINTYPE',
  'STATUS_CLASS', 'BANKNAME', 'BRANCHNAME', 'ACCOUNTNO', 'AcHolderName', 'IFSCCODE', 'DOB', 'PANNO', 'IdType', 'IdRefNo'];
/** class Kycdynamic */
const KYCDYNAMIC = ['TKDID', 'KYC_NAME', 'KYC_ACTIVE'];

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") */
function longStamp(d) {
  const p2 = (n) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${p2(d.getDate())} ${d.getFullYear()} ${p2(h)}:${p2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
const rep = (s, a, b) => s.split(a).join(b);
/** DataRow["X"].ToString() */
const cell = (row, name) => { const v = col(row, name); if (v === undefined) throw new Error(`Column '${name}' does not belong to table .`); return str(v); };
/** fire-and-forget "new Thread(...).Start()" */
const thread = (fn, what) => { Promise.resolve().then(fn).catch((e) => console.error(`[admin] member_distributed_details ${what}:`, e.message)); };

// private static bool ThumbnailCallback() { throw new NotImplementedException(); }  (never used)
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }

// public static void NotifyToMemberAboutKYC(Int64 RegNo)
async function NotifyToMemberAboutKYC(RegNo) {
  try {
    const ObjDut = new DataUtility();
    // SELECT ISNULL(FNAME,'') AS NAME, ISNULL(PHONE,'') AS PHONE,EMAILID,USERNAME FROM PORTAL_LOGIN WHERE REGNO = <RegNo>  (parameterised)
    const DT = await ObjDut.GetDataTable([SP('@RegNo', RegNo)],
      "select coalesce(fname, '') as name, coalesce(phone, '') as phone, emailid, username from portal_login where regno = @RegNo");
    const datetime = longStamp(new Date());
    const r0 = at(DT, 0);
    const MemName = cell(r0, 'USERNAME');
    const Message = "Your KYC has been <span style='color:green'>Approved</span> by our Administrative Team.";
    const SmsMessage = 'Dear ' + MemName + ',\r\nYour KYC is approved and verified. Thank you. For further details, visit https: https://cryptoinbox.com/referral-login\r\n The Cryptoinbox Team';
    void SmsMessage; // (built but never sent)
    const Phone = cell(r0, 'Phone'); void Phone;
    const email = cell(r0, 'EMAILID');
    const Username = cell(r0, 'Username');
    let body = GetHtmlBodyForKyc();
    body = rep(body, '$$lblName$$', Username);
    body = rep(body, '$$message$$', Message);
    body = rep(body, '$$datetime$$', datetime);
    thread(() => SendMail.Send('', email, '', '', 'Cryptoinbox Support Center', body), 'SendMail (KYC approved)');
  } catch (e) {
    // (legacy swallowed every error)
  }
}

// public static void NotifyToMemberAboutRejectKYC(int RegNo)
async function NotifyToMemberAboutRejectKYC(RegNo) {
  try {
    const ObjDut = new DataUtility();
    const DT = await ObjDut.GetDataTable([SP('@RegNo', RegNo)],
      "select coalesce(fname, '') as name, coalesce(phone, '') as phone, emailid, username from portal_login where regno = @RegNo");
    const datetime = longStamp(new Date());
    const Message = "Your KYC has been <span style='color:Red'>Rejected</span> by our Administrative Team.";
    const r0 = at(DT, 0);
    const MemName = cell(r0, 'USERNAME');
    const SmsMessage = 'Dear ' + MemName + ',\r\nWe would like to inform you, that your KYC documents have been rejected. For further details, visit https: https://cryptoinbox.com/referral-login\r\nThe Cryptoinbox Team';
    void SmsMessage; // (built but never sent)
    const Phone = cell(r0, 'Phone'); void Phone;
    const email = cell(r0, 'EMAILID');
    const Username = cell(r0, 'Username');
    let body = GetHtmlBodyRejectForKyc();
    body = rep(body, '$$lblName$$', Username);
    body = rep(body, '$$message$$', Message);
    body = rep(body, '$$datetime$$', datetime);
    thread(() => SendMail.Send('', email, '', '', 'Cryptoinbox Support Center', body), 'SendMail (KYC rejected)');
  } catch (e) {
    // (legacy swallowed every error)
  }
}

// public void fun_accept_reject_kyc(Int64 Regno, int allKyc, int kyc_id, int status, string Remarks)
async function fun_accept_reject_kyc(Regno, allKyc, kyc_id, status, Remarks) {
  if (Remarks === null || Remarks === undefined) Remarks = '';
  const mmRow = await db.queryOne(DB, 'select regno, username, emailid, mobile from member_master where regno = @Regno limit 1', { Regno });
  const MM = mmRow ? mapRow(mmRow, ['regNo', 'userName', 'Emailid', 'mobile']) : null;
  // DBO.KYCApproveAndReject @REGNO,@ALLKYC,@KYC_ID,@STATUS,@REMARKS,@STRRESULT OUT
  const row = await db.procOne(DB, 'KYCApproveAndReject', { REGNO: Regno, ALLKYC: allKyc, KYC_ID: kyc_id, STATUS: status, REMARKS: Remarks });
  const ReturnMessage = str(col(row, 'strresult')).toLowerCase(); // SpOutput.Value.ToString().ToLower() (DBNull => '')
  if (ReturnMessage === 'success') {
    const sms = async (id) => db.queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = @id limit 1', { id });
    const mail = async (eid) => db.queryOne(DB, 'select email_subject, email_content, email_send_status from tbl_emailaction where eid = @eid limit 1', { eid });
    const SMSContenForKycReject = await sms(44);
    if (!SMSContenForKycReject || !MM) throw nullRef();
    const Rejectemessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MM.userName, col(SMSContenForKycReject, 'sms_content'), Remarks, '', 31);
    if (status === 1) {
      const EmailContenForKycApprove = await mail(37);
      const SMSContenForKycApprove = await sms(43);
      if (!SMSContenForKycApprove || !EmailContenForKycApprove) throw nullRef();
      const Approvemessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MM.userName, col(SMSContenForKycApprove, 'sms_content'), Remarks, '', 30);
      const EmailSubject = col(EmailContenForKycApprove, 'email_subject');
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(MM.userName, col(EmailContenForKycApprove, 'email_content'), Remarks, '', 29, '');
      if (Number(col(EmailContenForKycApprove, 'email_send_status')) === 1) {
        thread(() => {
          if (MM.Emailid === null || MM.Emailid === undefined) throw nullRef();
          return UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', String(MM.Emailid).toLowerCase(), EmailSubject, DynamicMsg, null);
        }, 'e-mail (KYC approve)');
      }
      if (Number(col(SMSContenForKycApprove, 'sms_send_status')) === 1) {
        thread(() => UtilityClass.SendSMSWithAPI(MM.mobile, Approvemessg, '1'), 'SMS (KYC approve)');
      }
    } else if (status === 2) {
      const EmailContenForKycApprove = await mail(38);
      if (!EmailContenForKycApprove) throw nullRef();
      const EmailSubject = col(EmailContenForKycApprove, 'email_subject');
      const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(MM.userName, col(EmailContenForKycApprove, 'email_content'), Remarks, '', 30, '');
      if (Number(col(EmailContenForKycApprove, 'email_send_status')) === 1) {
        thread(() => {
          if (MM.Emailid === null || MM.Emailid === undefined) throw nullRef();
          return UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', String(MM.Emailid).toLowerCase(), EmailSubject, DynamicMsg, null);
        }, 'e-mail (KYC reject)');
      }
      if (Number(col(SMSContenForKycReject, 'sms_send_status')) === 1) {
        thread(() => UtilityClass.SendSMSWithAPI(MM.mobile, Rejectemessg, '1'), 'SMS (KYC reject)');
      }
    }
  }
}

// ---------------------------------------------------------------- Index(string LoginId, int? Regno, int? PLID, int? KYC, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/member-distributed-details" -> member_distributed_details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-distributed-details'], adminAuth, asyncHandler(async (req, res) => {
  let LoginId = nStr(req.p.LoginId); if (LoginId === null) LoginId = '';
  const Regno = nInt(req.p.Regno);
  let PLID = nInt(req.p.PLID); if (PLID === null) PLID = 0;
  let KYC = nInt(req.p.KYC); if (KYC === null) KYC = 1;
  let page = nInt(req.p.page);
  const ViewBag = { PLID };
  // db._Member_Master.Where(m => m.regNo == Regno).FirstOrDefault()  (null => NullReferenceException)
  const ml = await db.queryOne(DB, 'select loginid from member_master where regno = @Regno limit 1', { Regno });
  if (!ml) throw nullRef();
  LoginId = col(ml, 'loginid');
  ViewBag.loginid = LoginId;
  const sp = await db.proc(DB, 'USP_GETMEMBERPROFILESPONSOR', { LoginId });
  const spdetail = sp.length ? mapRow(sp[0], MEMBER_PROFILE_DETAILS) : null;
  // (new State() / new CITY() were created and never used)
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // [USP_PROFILEKYCREJECTIONDETAILS_FOR_MEMBER] @MODE,@STARTROWINDEX,@MAXROWS,@REGNO,@TYPE,@DESCRIPTION,@USERID,@KYCTYPE,@INTRESULT OUT
  ViewBag.PROFILEKYChistory = mapRows(await db.proc(DB, 'USP_PROFILEKYCREJECTIONDETAILS_FOR_MEMBER', {
    MODE: 3, STARTROWINDEX: page, MAXROWS: MaxRows, REGNO: PLID, TYPE: '', DESCRIPTION: '', USERID: '0', KYCTYPE: KYC,
  }), PROFILEKYCREJECTIOND);
  // _KYC_STATUS @REGNO,@INT_STATUS out,@APPROVALSTATUS out
  ViewBag.PROFILEKYC = mapRows(await db.proc(DB, '_KYC_STATUS', { REGNO: PLID }), PROFILEKYC);
  ViewBag.ObjKycdynamic = mapRows(await db.query(DB, 'select tkdid, kyc_name, kyc_active from tbl_kyc_details', {}), KYCDYNAMIC);
  return res.json({ view: '~/Views/AdminPanel/member_distributed_details/Index.cshtml', Model: spdetail, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberProfile(string username, string title, string Name, string lName, string gender,
//   string fathName, string dob, string Qualification, string mobile, string email, string Designation, string Remark, int plid)
// auth (PORT-NOTE: legacy had no session check on this member-profile write - protected)
router.all(`/admin/${C}/UpdateMemberProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const plid = reqInt(req.p.plid, 'plid');
  const P = (k) => nStr(req.p[k]);
  let OutputResult = '';
  let dob = P('dob');
  if (dob === null) throw nullRef(); // dob.Trim()
  if (dob.trim() === '01-01-0001') dob = '';
  const ObjDut = new DataUtility();
  const Param = [
    SP('@PLID', plid), SP('@CPERTITLE', P('title')), SP('@CPERDESIGNATION', P('Designation')), SP('@CPERMOBILENO', P('mobile')),
    SP('@CPEREMAILID', P('email')), SP('@FIRSTNAME', P('Name')), SP('@LASTNAME', P('lName')), SP('@INTRESULT', null, 'Output'),
    SP('@USERNAME', P('username')), SP('@DOB', dob), SP('@FatherOrMotherName', P('fathName')), SP('@Gender', P('gender')),
    SP('@HighestQualification', P('Qualification')),
  ];
  const x = await ObjDut.ExecuteSqlSP(Param, '[USP_EDITCONTACTDETAILS]');
  if (x === 1) OutputResult = 'Profile updated successfully and confirmation Email sent to member.';
  else if (x === 2) OutputResult = 'Please Enter Fist Name !';
  else if (x === 3) OutputResult = 'Please Enter Your Mobile Number !';
  else if (x === 4) OutputResult = 'Please Enter Your Email Id !';
  else if (x === 5) OutputResult = 'This Mobile Number already exists !';
  else if (x === 6) OutputResult = 'This Email Id already exists !';
  else OutputResult = 'This User name already exists !';
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberBankProfile(string Accountname, string acountno, string ifsccode, string panno,
//   string bankname, string branchName, int plid)
// auth (PORT-NOTE: legacy had no session check on this member-bank write - protected)
router.all(`/admin/${C}/UpdateMemberBankProfile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const plid = reqInt(req.p.plid, 'plid');
  const P = (k) => nStr(req.p[k]);
  let OutputResult = '';
  const ObjDut = new DataUtility();
  const Param = [
    SP('@PLID', plid), SP('@HOLDERNAME', P('Accountname')), SP('@ACOUNTNO', P('acountno')), SP('@BANKNAME', P('bankname')),
    SP('@BRANCHNAME', P('branchName')), SP('@IESCCODE', P('ifsccode')), SP('@PANCARD', P('panno')), SP('@INTRESULT', null, 'Output'),
  ];
  const B = await ObjDut.ExecuteSqlSP(Param, '[USP_INSERTBANKDETAIS]');
  if (B === 1) OutputResult = 'Bank details updated successfully and confirmation Email sent to member.';
  else if (B === 3) OutputResult = '1 PAN Card Can Not Use More Than 3 Times .';
  else OutputResult = 'Some Error Please Try Later !';
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult kycreject(string type, string remarks, Int64 Regno)
// auth (reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/kycreject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = reqLong(req.p.Regno, 'Regno');
  const LoginID = req.user.emp_id;
  const ObjDut = new DataUtility();
  const Param = [
    SP('@MODE', 1), SP('@STARTROWINDEX', 1), SP('@MAXROWS', 100), SP('@REGNO', Regno), SP('@TYPE', nStr(req.p.type)), SP('@DESCRIPTION', nStr(req.p.remarks)),
    SP('@INTRESULT', 0, 'InputOutput'), SP('@USERID', LoginID),
  ];
  const result = await ObjDut.ExecuteSqlSP(Param, 'USP_PROFILEKYCREJECTIONDETAILS');
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult Updatebillinformation(string Name, string Address, string city, string state, string pincode,
//   string Mobile, int plid)
// auth (PORT-NOTE: legacy had no session check on this member-billing write - protected)
router.all(`/admin/${C}/Updatebillinformation{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const plid = reqInt(req.p.plid, 'plid');
  const P = (k) => nStr(req.p[k]);
  let OutputResult = '';
  const ObjDut = new DataUtility();
  const Param = [
    SP('@BUSINESSNAME', P('Name')), SP('@CONTACTNAME', P('Name')), SP('@PHONENUMBER', P('Mobile')), SP('@CID', P('city')), SP('@SID', P('state')),
    SP('@CITY', P('city')), SP('@BADDRESS', P('Address')), SP('@mode', 2), SP('@PLID', plid), SP('@INTRESULT', null, 'Output'), SP('@BILLID', 0),
    SP('@Billing_POSTALCODE', P('pincode')),
  ];
  const B = await ObjDut.ExecuteSqlSP(Param, '[USP_UPDATE_PROFILE_BANK_BILLING]');
  if (B === 1) OutputResult = 'Billing Information Updated Successfully !';
  else OutputResult = 'Some Error Please Try Later !';
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- public void fun_accept_reject_kyc(Int64 Regno, int allKyc, int kyc_id, int status, string Remarks)
// auth (public method => routable in legacy; PORT-NOTE: no session check in legacy - KYC approve/reject is protected)
router.all(`/admin/${C}/fun_accept_reject_kyc{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = reqLong(req.p.Regno, 'Regno');
  const allKyc = reqInt(req.p.allKyc, 'allKyc');
  const kyc_id = reqInt(req.p.kyc_id, 'kyc_id');
  const status = reqInt(req.p.status, 'status');
  await fun_accept_reject_kyc(Regno, allKyc, kyc_id, status, nStr(req.p.Remarks));
  res.send('');
}));

/** shared tail of btnforverify / btnforrejetc */
async function kycTail(id, RegNumber, isaprove, wanted, notify) {
  const ObjDut = new DataUtility();
  // SELECT ISNULL(DTM_APROVE,'') AS DTM_APROVE FROM KYC WHERE ID='<id>'  (result unused; parameterised)
  await ObjDut.GetDataTable([SP('@id', id === null ? '' : String(id))], 'select dtm_aprove from kyc where id::text = @id');
  if (RegNumber !== 0) {
    // PORT-NOTE: @INT_TOTAL_COUNT was added without a value (SqlParameter(name, SqlDbType.Int)); it is treated as an output here (not sent).
    const Datatbl = await ObjDut.GetDataTableSP([SP('@REGNO', RegNumber), SP('@INT_TOTAL_COUNT', null, 'Output')], 'USP_GET_KYCSTATUSBYREGNO');
    const Status = cell(at(Datatbl, 0), 'KycStatus'); void Status;
    // SELECT COUNT(1) AS COUNT FROM KYC WHERE ISAPROVE=<n> AND REGNO='<RegNumber>'
    const Dt1 = await ObjDut.GetDataTable([SP('@RegNumber', String(RegNumber))],
      `select count(1) as count from kyc where isaprove = ${isaprove} and regno::text = @RegNumber`);
    const count = cell(at(Dt1, 0), 'count');
    if (count === wanted) await notify(RegNumber);
  }
}

// ---------------------------------------------------------------- JsonResult btnforrejetc(string id, string remarks, Int32 RegNumber)
// auth (PORT-NOTE: legacy had no session check on this KYC reject - protected)
router.all(`/admin/${C}/btnforrejetc{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RegNumber = reqInt(req.p.RegNumber, 'RegNumber');
  const id = nStr(req.p.id);
  const Get_RegNo = RegNumber;
  const Get_ID = cvtInt(id);
  const status = 2;
  const all_ = 0;
  await fun_accept_reject_kyc(Get_RegNo, all_, Get_ID, status, nStr(req.p.remarks));
  await kycTail(id, RegNumber, 2, '1', NotifyToMemberAboutRejectKYC);
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult Updateprofileapprove(string loginid)
// auth (PORT-NOTE: legacy had no session check on this member-profile write - protected)
router.all(`/admin/${C}/Updateprofileapprove{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let OutputResult = '';
  const ObjDut = new DataUtility();
  // UPDATE MEMBER_MASTER SET ISPROFILESELFVERIFIED=1,ISEMAILSELFVERIFIED=1,ISMOBILESELFVERIFIED=1,IS_PROFILE_STATUS=1 WHERE LOGINID = '<loginid>'
  const result = await ObjDut.ExecuteSql([SP('@loginid', nStr(req.p.loginid))],
    'update member_master set isprofileselfverified = 1, isemailselfverified = 1, ismobileselfverified = 1, is_profile_status = 1 where loginid = @loginid');
  if (result === 1) OutputResult = 'Approved Successfully !';
  else OutputResult = 'Some Error Occured!';
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult Updateprofilereject(string loginid)
// auth (PORT-NOTE: legacy had no session check on this member-profile write - protected)
router.all(`/admin/${C}/Updateprofilereject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = nStr(req.p.loginid);
  let result1 = 0; void result1;
  let regno = 0;
  let OutputResult = '';
  const ObjDut1 = new DataUtility();
  const result = await ObjDut1.ExecuteSql([SP('@loginid', loginid)], 'update member_master set is_profile_status = 2 where loginid = @loginid');
  if (result === 1) {
    const ml = await db.queryOne(DB, 'select regno from member_master where loginid = @loginid limit 1', { loginid });
    if (!ml) throw nullRef();
    regno = col(ml, 'regno');
    const Type = 'Profile';
    const ObjDut = new DataUtility();
    const Param = [
      SP('@MODE', 1), SP('@STARTROWINDEX', 1), SP('@MAXROWS', 100), SP('@REGNO', regno), SP('@TYPE', Type), SP('@DESCRIPTION', ''),
      SP('@INTRESULT', 0, 'InputOutput'), SP('@USERID', loginid),
    ];
    result1 = await ObjDut.ExecuteSqlSP(Param, 'USP_PROFILEKYCREJECTIONDETAILS');
    OutputResult = 'Reject Successfully !';
  } else {
    OutputResult = 'Some Error Occured!';
  }
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult btnforverify(int id, string remarks, Int64 RegNumber)
// auth (PORT-NOTE: legacy had no session check on this KYC approve - protected)
router.all(`/admin/${C}/btnforverify{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const id = reqInt(req.p.id, 'id');
  const RegNumber = reqLong(req.p.RegNumber, 'RegNumber');
  const Get_RegNo = RegNumber;
  const Get_ID = id;
  const status = 1;
  const all_ = 0;
  await fun_accept_reject_kyc(Get_RegNo, all_, Get_ID, status, nStr(req.p.remarks));
  await kycTail(id, RegNumber, 1, '4', NotifyToMemberAboutKYC);
  return res.json('');
}));

module.exports = router;
Object.assign(module.exports, {
  NotifyToMemberAboutKYC, NotifyToMemberAboutRejectKYC, GetHtmlBodyForKyc, GetHtmlBodyRejectForKyc, fun_accept_reject_kyc, ThumbnailCallback,
});
