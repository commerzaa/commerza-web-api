'use strict';
// Ported from ClusterofferShopingPortal\Controllers\UserPanel\Member_Profile.cs (class Member_ProfileController => /portal/Member_Profile/...)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const fs = require('fs');
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CustomerAddressDal = require('../../lib/portal/AddressDAL');
const CustomerAddressModel = require('../../lib/portal/CustomerAddress');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const {
  DB, s, nz, NRE, outStr, toInt32, requiredInt, strParam, mapPath, randomNext,
} = require('./_shared/batch-14-common');

const CompanySettings = CS.CompanySettings || CS;
const CompanyMasterSettings = CS.CompanyMasterSettings;

const router = express.Router();
const C = 'Member_Profile';

/** class MemberProfile (Controllers/CustomerPanel/My_Profile.cs) */
const MEMBER_PROFILE = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName',
  'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification'];

/** C# bool? .ToString(): True / False / "" */
const boolStr = (b) => (b === true ? 'True' : b === false ? 'False' : '');

/** Convert.ToInt64(string): null => 0, strict otherwise */
function toInt64(v) {
  if (v === null || v === undefined) return 0;
  const t = String(v).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
/** Convert.ToByte(string) */
function toByte(v) {
  const n = toInt32(v);
  if (n < 0 || n > 255) throw new Error('Value was either too large or too small for an unsigned byte.');
  return n;
}

/** EF row of IMS_CustomerAddress by Id (PascalCase CustomerAddress) or null */
async function findAddress(id) {
  const row = await db.queryOne(DB, 'select * from ims_customeraddress where id = @id limit 1', { id });
  return row ? mapRow(row, CustomerAddressModel.PROPS.filter((p) => !CustomerAddressModel.NOT_MAPPED.includes(p))) : null;
}

/** "\/Date(ms)\/" (JavaScriptSerializer DateTime format) */
const jsDate = (d) => {
  if (d === null || d === undefined) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : `/Date(${x.getTime()})/`;
};

/** new JavaScriptSerializer().Serialize(CustomerAddress): public fields first, then properties (incl. [NotMapped] enum ones) */
function serializeCustomerAddress(a) {
  if (a === null || a === undefined) return 'null';
  const o = { addresstype: 0, tousertype: 0 };
  for (const p of CustomerAddressModel.PROPS) {
    if (p === 'AddressTypes') o[p] = o.addresstype;
    else if (p === 'ToUserTypes') o[p] = o.tousertype;
    else if (p === 'CreatedDate') o[p] = jsDate(a[p]);
    else o[p] = nz(a[p]);
  }
  return JSON.stringify(o);
}

// ---------------------------------------------------------------- JsonResult AddMemberAddress(string AddressId, string StreetAddress, string LandMark, string CityName, string StateName, string MobileNo, Int32 CountryId, string Pincode, string AddressType, string Alternate_phone, string Name, string adrestype)
// auth ([SessionExpireCheck]; [DistributerSessionExpireCheck]/[CheckResellerTimeout] = no check)
router.all(`/portal/${C}/AddMemberAddress{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const p = req.p;
  const CountryId = requiredInt(p.CountryId, 'CountryId', 'System.Web.Mvc.JsonResult AddMemberAddress(...)');
  const Regno = req.user.plid;
  const dal = new CustomerAddressDal();
  const adrs = {};
  adrs.Id = toInt32(strParam(p.AddressId));
  adrs.CountryId = CountryId;
  adrs.PhoneNo1 = strParam(p.MobileNo);
  adrs.CityName = strParam(p.CityName);
  adrs.StateName = strParam(p.StateName);
  adrs.ShortAddress = strParam(p.StreetAddress);
  adrs.PinCode = strParam(p.Pincode);
  adrs.LandMark = strParam(p.LandMark);
  adrs.AddressType = strParam(p.AddressType);
  adrs.ToUserId = Regno;
  adrs.PhoneNo2 = strParam(p.Alternate_phone);
  adrs.ToUserType = 'Customer'; // UtilityClass.SeclectUserType.Customer.ToString()
  adrs.ADDRESSTYPE1 = toByte(strParam(p.adrestype));
  adrs.CNAME = strParam(p.Name);
  const pb = await dal.CreateAddress(adrs, '101.102.103.1');
  return res.json(boolStr(pb.Success) + '^' + s(pb.Message));
}));

// ---------------------------------------------------------------- JsonResult GetAddressDetails(string Id)
// auth ([SessionExpireCheck])
// PORT-NOTE: legacy reads any address by Id (no ownership check) - kept.
router.all(`/portal/${C}/GetAddressDetails{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let Result = '';
  const ID = toInt64(strParam(req.p.Id));
  const Row = await findAddress(ID);
  if (Row !== null) {
    Result = s(Row.Id) + '^' + s(Row.ShortAddress) + '^' + s(Row.CityName) + '^' + s(Row.PinCode) + '^' + s(Row.CountryName) + '^' + s(Row.PhoneNo1);
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult DeleteMemberAddress(string AddressId)
// auth ([SessionExpireCheck])
// PORT-NOTE: legacy deletes any address by Id (no ownership check) - kept.
router.all(`/portal/${C}/DeleteMemberAddress{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const adid = toInt64(strParam(req.p.AddressId));
  const row = await findAddress(adid);
  // db._CustomerAddress.Remove(null) => ArgumentNullException
  if (row === null) throw new Error('Value cannot be null.\r\nParameter name: entity');
  await db.exec(DB, 'delete from ims_customeraddress where id = @id', { id: adid });
  return res.json(true);
}));

// ---------------------------------------------------------------- JsonResult GetAddressDetail(string AddressId)
// auth ([SessionExpireCheck])
router.all(`/portal/${C}/GetAddressDetail{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const adid = toInt64(strParam(req.p.AddressId));
  const adrs = await findAddress(adid);
  const json = serializeCustomerAddress(adrs);
  return res.json(json);
}));

// ---------------------------------------------------------------- JsonResult IsDefaultAddress(string AddressId)
// auth ([SessionExpireCheck])
router.all(`/portal/${C}/IsDefaultAddress{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const dal = new CustomerAddressDal();
  const adid = toInt64(strParam(req.p.AddressId));
  const adrs = await findAddress(adid);
  if (adrs === null) throw NRE();
  adrs.ToUserType = 'Customer';
  const pb = await dal.IsDefault_Address(adrs, '101,102.1.1');
  return res.json(pb.Success === undefined ? null : pb.Success);
}));

/** shared body of Index / security: Usp_check_kyc + USP_GETCONTACTDETAILS */
async function kycStatus(Plid) {
  const row = await db.procOne(DB, 'Usp_check_kyc', { plid: Plid });
  return outStr(row, 'strResult');
}
async function contactDetails(Plid) {
  const rows = await db.proc(DB, 'USP_GETCONTACTDETAILS', { PLID: Plid });
  return rows && rows[0] ? mapRow(rows[0], MEMBER_PROFILE) : null;
}

// ---------------------------------------------------------------- ActionResult Index(string Id)
// auth ([SessionExpireCheck])
// route-config: "customer/my-profile" -> Member_Profile/Index
// PORT-NOTE: the MemberProfile model (sent to the Razor view in legacy) includes the Password column; it is returned as-is.
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/customer/my-profile'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const Id = strParam(req.p.Id);
  const ViewBag = {};
  ViewBag.JumpTo = (Id === null ? '' : Id);
  const Plid = req.user.plid;
  ViewBag.status = await kycStatus(Plid);
  // legacy concatenated clid='" + Plid + "' (parameterised here)
  const MobileNo = await db.queryOne(DB, "select coalesce(mobileno, '') as v from tbl_referenceusername where clid = @Plid and status = 1 limit 1", { Plid });
  const usernameR = await db.queryOne(DB, "select coalesce(username, '') as v from tbl_referenceusername where clid = @Plid and status = 1 limit 1", { Plid });
  ViewBag.usernameRef = usernameR ? usernameR.v : null;
  ViewBag.MobileNoRef = MobileNo ? MobileNo.v : null;
  const memdetails = await contactDetails(Plid);
  return res.json({ view: '~/Views/UserPanel/Member_Profile/Index.cshtml', Model: memdetails, ...ViewBag });
}));

// ---------------------------------------------------------------- ActionResult security(string Id)
// auth ([SessionExpireCheck]; [DistributerSessionExpireCheck] = no check)
// route-config: "customer/security" -> Member_Profile/security
router.all([`/portal/${C}/security{/:id}`, '/portal/customer/security'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const Id = strParam(req.p.Id);
  const ViewBag = {};
  ViewBag.JumpTo = (Id === null ? '' : Id);
  const Plid = req.user.plid;
  ViewBag.masterpageshow = ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
  ViewBag.status = await kycStatus(Plid);
  const memdetails = await contactDetails(Plid);
  return res.json({ view: '~/Views/UserPanel/Member_Profile/security.cshtml', Model: memdetails, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult SendVerificationMail(string getloginid, string Subject, string Message)
// auth ([SessionExpireCheck]; writes Session["Emailvcode"])
router.all(`/portal/${C}/SendVerificationMail{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const getloginid = strParam(req.p.getloginid);
  const Message = strParam(req.p.Message);
  if (s(getloginid) !== '') {
    const vcode = String(randomNext(100000, 9999999));
    // string Msg = Message + " " + vcode.Trim();  (unused in legacy)
    void Message;
    ps.sessionSet(req, 'Emailvcode', vcode);
    const subject = 'One Time Password for ' + s(CompanySettings.CompanyName) + '';
    // PORT-NOTE: Server.MapPath("~/OTP_Email.html") => config.uploadDir/OTP_Email.html
    const readFile = fs.readFileSync(mapPath('~/OTP_Email.html'), 'utf8');
    let myString = readFile;
    // PORT-NOTE: DateTime.Now.ToShortDateString() rendered as M/d/yyyy (en-US server culture assumed)
    const now = new Date();
    myString = myString.split('$$date$$').join(`${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}`);
    myString = myString.split('$$Name$$').join(getloginid);
    myString = myString.split('$$OTP$$').join(vcode);
    await UtilityClass.CheckAndSendMsgOnEmail('', getloginid, '', '', subject, myString);
    return res.json('success');
  }
  return res.json('error');
}));

/** JsonResult SendVerificationMessage(string Mobile) body (also called internally by GetAffiliateUserDetail) */
async function SendVerificationMessage(req, Mobile) {
  if (s(Mobile) !== '') {
    ps.sessionSet(req, 'Mobilevcode', null);
    const vcode = String(randomNext(100000, 9999999));
    const Msg = 'Your OTP Code : ' + vcode.trim();
    ps.sessionSet(req, 'Mobilevcode', vcode);
    await UtilityClass.SendMsgOnMobile(Mobile, Msg);
    return 'success';
  }
  return 'error';
}

// ---------------------------------------------------------------- JsonResult GetAffiliateUserDetail(string UserNamer)
// auth ([SessionExpireCheck])
router.all(`/portal/${C}/GetAffiliateUserDetail{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const UserNamer = strParam(req.p.UserNamer);
  let getmobile = '';
  let message = '';
  let Pmid = CompanySettings.PMID;
  if (Number(Pmid) === 0) {
    await CompanyMasterSettings.GetResellerData();
  }
  Pmid = CompanySettings.PMID;
  // legacy concatenated PMID=" + Pmid (parameterised here)
  const urlRow = await db.queryOne(DB, 'select apiurl from tbl_companysettings where pmid = @Pmid limit 1', { Pmid });
  const url = urlRow ? urlRow.apiurl : null;
  if (url === '' || url === null || url === undefined) {
    return res.json('Please contact to reseller for MemberID.');
  }
  const StrPostData = JSON.stringify({ MemberID: UserNamer });
  const resp = await axios.post(url + '/api/GetuserInformation', StrPostData, {
    headers: { 'Content-Type': 'application/json' }, timeout: 100000, responseType: 'text', transformResponse: [(d) => d],
  });
  const ObjProductDetails = JSON.parse(String(resp.data));
  const jstr = (v) => {
    if (v === undefined) throw NRE();
    if (v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  };
  const Flag = jstr(ObjProductDetails.Flag);
  if (Flag === 'success') {
    const DetailsTok = ObjProductDetails.Details;
    if (DetailsTok === undefined) throw NRE();
    if (!(Array.isArray(DetailsTok) && DetailsTok.length === 0)) {
      if (!Array.isArray(DetailsTok)) throw new Error('Error reading JArray from JsonReader.');
      const obj = DetailsTok;
      getmobile = jstr(obj[0] && obj[0].MobileNo);
      if (getmobile !== '') {
        await SendVerificationMessage(req, getmobile);
        return res.json(getmobile);
      }
      return res.json(obj);
    }
  } else {
    message = jstr(ObjProductDetails.Message);
  }
  return res.json(message);
}));

// ---------------------------------------------------------------- JsonResult Insert_refferuserName(string username, string mobile, string Vcode)
// auth (no attribute, but the unguarded (Login)Session["Plid"] cast threw NullReferenceException without a session)
router.all(`/portal/${C}/Insert_refferuserName{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const username = strParam(req.p.username);
  const mobile = strParam(req.p.mobile);
  const Vcode = strParam(req.p.Vcode);
  const Plid = req.user.plid;
  const mv = ps.sessionGet(req, 'Mobilevcode');
  if (mv === null) throw NRE(); // Session["Mobilevcode"].ToString()
  const Vno = String(mv);
  if (Vno !== Vcode) {
    return res.json('Wrong Verification Code');
  }
  const row = await db.procOne(DB, 'USP_insertrefferUserName', { CLID: Plid, username, mobile, Ipaddress: '' });
  const ResValue = outStr(row, 'INTRESULT');
  void ResValue;
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult SendVerificationMessage(string Mobile)
// auth ([SessionExpireCheck]; writes Session["Mobilevcode"])
router.all(`/portal/${C}/SendVerificationMessage{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  return res.json(await SendVerificationMessage(req, strParam(req.p.Mobile)));
}));

module.exports = router;
