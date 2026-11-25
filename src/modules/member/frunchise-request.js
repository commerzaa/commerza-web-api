'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\FrunchiseRequest.cs (FrunchiseRequestController) */
const express = require('express');
const os = require('os');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/FrunchiseRequest';

const str = (v) => (v === null || v === undefined ? '' : String(v));
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: legacy used Dns.GetHostEntry(hostName).AddressList[1] (server address); mapped to the 2nd server IP address.
function serverIp() {
  const addr = [];
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) addr.push(a.address);
  return addr.length > 1 ? addr[1] : '';
}

const FP_PROPS = ['FPMID', 'FIMID', 'MINAMOUNT', 'MAXAMOUNT', 'COMMSSIONPERCENTAGE', 'DESCRIPTION', 'TITLE'];

// route-config: referral/xRJId8N3iO9BRJId8N3iO9BD8sdfg3221vgM2K8xOQR==
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/xRJId8N3iO9BRJId8N3iO9BD8sdfg3221vgM2K8xOQR=='], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const SystemAgreement = req.p.SystemAgreement;
  let name = ''; let email = '';
  let TempPlid = Number(req.user.plid);
  const Balance = await scalar(DB, 'SELECT coalesce(AVAILABLE_FUND,0) FROM MEMBER_PERFORMANCE WHERE REGNO = @p', { p: TempPlid });
  ViewBag.Balance = Balance === null ? 0 : Balance;
  const row = await queryOne(DB, 'select * from member_master where regno = @p limit 1', { p: TempPlid });
  if (row) {
    TempPlid = row.regno;
    name = str(row.fname) + str(row.lname);
    const BA = await queryOne(DB, `select coalesce(ACCOUNTHOLDERNAME,'') as ACCOUNTHOLDERNAME, coalesce(ACCOUNTNO,'') as ACCOUNTNO,
      coalesce(BANKNAME,'') as BANKNAME, coalesce(BRANCHNAME,'') as BRANCHNAME, coalesce(IFSCCODE,'') as IFSCCODE, coalesce(PancardNo,'') as PancardNo
      from Bank_Accounts where regno=@p and active=true limit 1`, { p: Number(TempPlid) });
    email = row.emailid;
    ViewBag.FNAME = row.fname;
    ViewBag.MNAME = row.mname;
    ViewBag.LNAME = row.lname;
    ViewBag.state = row.statename;
    ViewBag.CITYNAME = row.cityname;
    ViewBag.ADDRESS = row.address;
    ViewBag.DOC = row.doc;
    ViewBag.PINCODE = row.pincode;
    const dobIs1900 = row.dob && new Date(row.dob).getUTCFullYear() === 1900 && new Date(row.dob).getUTCMonth() === 0 && new Date(row.dob).getUTCDate() === 1;
    ViewBag.DOB = dobIs1900 ? 'N/A' : row.dob;
    if (BA) {
      ViewBag.ACCOUNTHOLDERNAME = BA.accountholdername;
      ViewBag.ACCOUNTNO = BA.accountno;
      ViewBag.BANKNAME = BA.bankname;
      ViewBag.BRANCHNAME = BA.branchname;
      ViewBag.IFSCCODE = BA.ifsccode;
      ViewBag.PancardNo = BA.pancardno;
    } else {
      ViewBag.ACCOUNTHOLDERNAME = ''; ViewBag.ACCOUNTNO = ''; ViewBag.BANKNAME = '';
      ViewBag.BRANCHNAME = ''; ViewBag.IFSCCODE = ''; ViewBag.PancardNo = '';
    }
  }
  ViewBag.email = email;
  ViewBag.username = req.user.userName || req.user.username;
  // USP_FRANCHISEREQUEST @MODE=1 returns the package list
  const rows = await require('../../db').proc(DB, 'usp_franchiserequest', { mode: 1 });
  const franchisepackage = mapRows(rows, FP_PROPS);
  const memdetails = await procOne(DB, 'usp_getcontactdetails', { plid: req.user.plid });
  if (memdetails) ViewBag.memdetails = memdetails;
  res.json({ Model: franchisepackage, ViewBag, SystemAgreement });
}));

// auth
router.all(`${P}/OrderFranchise{/:id}`, auth, asyncHandler(async (req, res) => {
  const { TotalPayableAmount, ALLPackageId, ALLPRODUCTNAME, DESCRIPTION, ADDRESS, COUNTRY, STATES, CITYS, PINCODE, MOBILE, EMAILID, TOTALCOMMISSION, taluk, district, circle, region } = req.p;
  const IpAddress = serverIp();
  const RegNo = parseInt(req.user.plid, 10);
  const availbleewallet = await scalar(DB, 'select coalesce(Available_Fund,0) as availbleewallet from MEMBER_PERFORMANCE WHERE Regno=@r', { r: RegNo });
  if ((availbleewallet || 0) < Number(TotalPayableAmount)) return res.json('E-WALLET');
  let ReturnOutput = 'success';
  try {
    // PORT-NOTE: legacy SQL text referenced @SystemAgreement without supplying it (EF would throw); parameter omitted here, proc default applies.
    const out = await procOne(DB, 'usp_franchiserequest', {
      plid: RegNo, fimid: ALLPackageId, name: ALLPRODUCTNAME, mrp: Number(TotalPayableAmount), country: COUNTRY, state: STATES,
      city: CITYS, address: ADDRESS, pincode: PINCODE, ipaddress: IpAddress, description: DESCRIPTION, mode: '2',
      totalcommission: TOTALCOMMISSION, taluk, district, circle, region, emailid: EMAILID, mobile: MOBILE,
    });
    ReturnOutput = str(out && out.strresult);
    // PORT-NOTE: ExecuteSqlCommand affected-rows (>0) is approximated by "procedure returned a row".
    if (out) {
      try {
        sessionStore.set(req, 'SessionOTP', null);
      } catch (ExpObj) {
        await ErrorInsert(ExpObj, 'USP_FRANCHISEREQUEST', req);
      }
    }
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'USP_FRANCHISEREQUEST', req);
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

// auth
router.all(`${P}/CheckPinCode{/:id}`, auth, asyncHandler(async (req, res) => {
  const PinCode = req.p.PinCode;
  try {
    const baseurl = 'http://postalpincode.in/api/pincode/' + PinCode;
    const r = await axios.get(baseurl, { transformResponse: [(d) => d], responseType: 'text' });
    const Result = r.data;
    const Obj = JSON.parse(Result);
    for (const k of Object.keys(Obj)) {
      if (k === 'PostOffice') {
        const v = Obj[k];
        if (v === null) return res.json(null);
        const props = ['Name', 'Description', 'BranchType', 'DeliveryStatus', 'Taluk', 'Circle', 'District', 'Division', 'Region', 'State', 'Country'];
        return res.json(mapRows(v, props));
      }
    }
    return res.json(Result);
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'checkPinCode function error.', req);
    return res.json(' Not Found');
  }
}));

// auth
router.all(`${P}/OrderPostPaymentFranchise{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const { cusname, email, category, mobile, postpaymentpincode, postpaymentaddress, postpaymentcountry, postpaymentcity, postpaymentstate,
    postpaymenttaluk, postpaymentdistrict, postpaymentcircle, postpaymentregion, Referencename, IFSC, Branch, BankName, Referance,
    PaymentDate, Paymode, ChallanImage } = p;
  let SystemAgreement = p.SystemAgreement;
  const IpAddress = serverIp();
  let SPONSORID = 0;
  if (SystemAgreement === null || SystemAgreement === undefined) {
    SystemAgreement = '';
  } else {
    SystemAgreement = String(SystemAgreement);
    SystemAgreement = SystemAgreement.split('EqalsToo').join('=');
    SystemAgreement = SystemAgreement.split('InviatedComma').join("'");
    SystemAgreement = SystemAgreement.split('Comma').join(',');
    SystemAgreement = SystemAgreement.split('SemiCollon').join(';');
    SystemAgreement = SystemAgreement.split('Collon').join(':');
    SystemAgreement = SystemAgreement.split('Percent').join('%');
    SystemAgreement = SystemAgreement.split('Multiply').join('*');
    SystemAgreement = SystemAgreement.split('Hash').join('#');
    SystemAgreement = SystemAgreement.split('TagOpen').join('<');
    SystemAgreement = SystemAgreement.split('TagClose').join('>');
  }
  // legacy condition (Referencename != "" || Referencename != null) is always true
  SPONSORID = Number(await scalar(DB, 'SELECT REGNO FROM MEMBER_MASTER where USERNAME=@u limit 1', { u: Referencename === undefined ? null : Referencename })) || 0;
  const RegNo = parseInt(req.user.plid, 10);
  let ImageName = ''; let FullUrlWithFolder = '';
  if (ChallanImage !== '') {
    FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
    ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
    FullUrlWithFolder += ImageName;
  }
  let ReturnOutput = 'success';
  try {
    const Plid = RegNo;
    const out = await procOne(DB, 'usp_franchiserequest', {
      plid: RegNo, fpmid: category, name: cusname, mrp: '0', country: postpaymentcountry, state: postpaymentstate, city: postpaymentcity,
      address: postpaymentaddress, pincode: postpaymentpincode, ipaddress: IpAddress, description: '', mode: '3', totalcommission: '0',
      taluk: postpaymenttaluk, district: postpaymentdistrict, circle: postpaymentcircle, region: postpaymentregion, sponsorid: SPONSORID,
      emailid: email, mobile, systemagreement: SystemAgreement, paymode: Paymode, bank: BankName, branch: Branch, ifsc: IFSC,
      refrence: Referance, attachment: FullUrlWithFolder, date: PaymentDate,
    });
    ReturnOutput = str(out && out.strresult);
    // PORT-NOTE: ExecuteSqlCommand affected-rows (>0) is approximated by "procedure returned a row".
    if (out) {
      try {
        const Orderid = '';
        const Franchise_Email = Number(await scalar(DB, "select coalesce(ACTIVE,0) from settings where CAPTION='Franchise Email' limit 1")) || 0;
        if (Franchise_Email === 1) {
          const AllPackageNames = await scalar(DB, 'Select TITLE FROM TBL_FRANCHISEPACKAGEMASTER WHERE FPMID = @c limit 1', { c: category });
          await scalar(DB, 'Select coalesce(MAXAMOUNT,0) FROM TBL_FRANCHISEPACKAGEMASTER WHERE FPMID = @c limit 1', { c: category }); // AmountPack (only used by the unused agreement template)
          const Obj = await queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,UserName,Regno,coalesce(FNAME,'')||''||coalesce(LNAME,'') AS NAME From Portal_Login where plid = @pl limit 1", { pl: Plid });
          if (Obj) {
            await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS=true AND STATUS=true AND REGNO=@r limit 1', { r: req.user.plid });
            await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL=true AND STATUS=true AND REGNO=@r limit 1', { r: req.user.plid });
            await queryOne(DB, 'select * from TBL_SMSACTION where ID = 16 limit 1');
            const topupMsg = await queryOne(DB, 'select * from TBL_SMSACTION where ID = 22 limit 1');
            if (!topupMsg) throw new TypeError('Object reference not set to an instance of an object.');
            const emailmsg = await queryOne(DB, 'select * from tbl_emailaction where EID = 13 limit 1');
            if (!emailmsg) throw new TypeError('Object reference not set to an instance of an object.');
            await UtilityClass.FindingEmailContentWithUserIdPassword(Obj.username, emailmsg.email_content, AllPackageNames, Orderid, 5, '');
            const subject = 'Agreement Detail';
            // PORT-NOTE: the large unused "Emailcont" agreement HTML template (never sent; mail body is SystemAgreement) is not rebuilt.
            const mem = await queryOne(DB, 'select * from member_master where regno = @pl limit 1', { pl: Plid });
            await queryOne(DB, 'select * from portal_login where plid = @pl limit 1', { pl: Plid });
            if (!mem) throw new TypeError('Object reference not set to an instance of an object.');
            UtilityClass.SendEmailByApiSetting(Obj.username, '', '', '', '', '', Obj.emailid, subject, SystemAgreement, null, '', '').catch(() => {});
          }
        }
        sessionStore.set(req, 'packname', null);
        sessionStore.set(req, 'SessionOTP', null);
        sessionStore.set(req, 'Amount', null);
      } catch (ExpObj) {
        await ErrorInsert(ExpObj, 'USP_FRANCHISEREQUEST', req);
      }
    }
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'USP_FRANCHISEREQUEST', req);
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

// auth
router.all(`${P}/CheckFranchiseExistsOnBlur{/:id}`, auth, asyncHandler(async (req, res) => {
  const UserName = req.p.UserName;
  let RowSp = 0;
  const ROW_Check_Alreadyuser = Number(await scalar(DB, 'SELECT 1 FROM MEMBER_MASTER where ACTIVE=true and USERNAME=@u limit 1', { u: UserName })) || 0;
  const checkref = Number(await scalar(DB, 'select regno from member_master where username = @u limit 1', { u: UserName })) || 0;
  const RegNo = parseInt(req.user.plid, 10);
  if (checkref === RegNo) return res.json('2');
  if (ROW_Check_Alreadyuser !== 0) return res.json('1');
  RowSp = 0;
  res.json(RowSp);
}));

// auth
router.all(`${P}/CheckFranchisestatus{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const plid = req.user.plid;
    let ROW_Check_Alreadyuser = Number(await scalar(DB, 'select STATUS from TBL_FRANCHISEREQUEST where PLID=@p order by FRID desc limit 1', { p: plid })) || 0;
    const BANKSTATUS = Number(await scalar(DB, 'SELECT COUNT(1) FROM Bank_Accounts WHERE ACTIVE=true AND REGNO=@p', { p: plid })) || 0;
    if (BANKSTATUS === 0) ROW_Check_Alreadyuser = 6;
    // PORT-NOTE: SQL Server "DOB!=''" (date compared with 1900-01-01) expressed as a date comparison.
    const PROFILESTATUS = Number(await scalar(DB, "SELECT COUNT(1) FROM MEMBER_MASTER WHERE DOB<>date '1900-01-01' AND MOBILE<>'' AND ADDRESS<>'' AND SID<>0 AND PINCODE<>'' AND REGNO=@p", { p: plid })) || 0;
    if (PROFILESTATUS === 0) ROW_Check_Alreadyuser = 5;
    const KYCSTATUS = Number(await scalar(DB, 'select coalesce(KYCSTATUS::int,0) from member_master where REGNO=@p', { p: plid })) || 0;
    if (KYCSTATUS === 0) ROW_Check_Alreadyuser = 4;
    return res.json(ROW_Check_Alreadyuser);
  } catch (ex) {
    return res.json(0);
  }
}));

module.exports = router;
