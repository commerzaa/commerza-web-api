'use strict';
/**
 * Ported from Member\Common\Controllers\CustomerPanel\SubscribeUs.cs (SubscribeUsController)
 * 8 actions: Index, GenerateOTP, PurchaseKitOrPackage, MultiplePurchaseKitOrPackage, GenrateAddress, GetINRToATC, PayByPayYouMoney (public string => action), SaveChallanImage (public string => action)
 * (public static PoundToBitcoinConvertor and private ThumbnailCallback are not actions; ported as internal functions / dropped)
 * PORT-NOTE: stored procs with OUT params (@IntResult, @TranIds, @StrOutPut) return them as columns "intresult"/"tranids"/"stroutput" of the first row.
 * PORT-NOTE: ExecuteSqlCommand "rows affected > 0" checks are approximated by "the procedure returned a row".
 * PORT-NOTE: System.Drawing re-encoding of the challan image is not available; decoded image bytes are written unchanged (empty/invalid payload => error as Image.FromStream).
 * PORT-NOTE: the big "Emailcont" agreement HTML template (built but only used by commented-out mail code) is not rebuilt; every lookup that could throw before it
 *            (Session packname/Amount, member_master / portal_login rows) is still performed so the failure behaviour is unchanged.
 * PORT-NOTE: legacy queries/values that were only assigned and never used (membersmsactive/memberemailactive/msg/emailmsg in the OTP-validation block, IsVerify check, WebClient,
 *            LevelNameForGenerate) are not executed; they had no observable effect.
 * PORT-NOTE: legacy new Thread(...) SMS/e-mail sends are fire-and-forget.
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const config = require('../../config');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const Security_Key = require('../../lib/member/Security_Key');
const BlockChainAPI = require('../../lib/member/BlockChainAPI');
const CoinPaymentAPI = require('../../lib/member/CoinPaymentAPI');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/SubscribeUs';

const s = (v) => (v === undefined || v === null ? '' : String(v));
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const nre = () => new TypeError('Object reference not set to an instance of an object.');
const outv = (row, name) => { if (!row) return undefined; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : row[k]; };
// Convert.ToDecimal(string)
const dec = (v) => {
  if (v === undefined || v === null) return 0;
  const t = String(v).trim();
  if (t === '' || Number.isNaN(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
};
// MVC model binding of a non-nullable parameter
const reqDec = (v, name) => {
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(String(v).trim()))) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Decimal'.`);
  return Number(String(v).trim());
};
const reqInt = (v, name) => {
  const n = Number(v);
  if (v === undefined || v === null || String(v).trim() === '' || !Number.isInteger(n)) throw new Error(`The parameters dictionary contains a null or invalid entry for parameter '${name}' of non-nullable type 'System.Int32'.`);
  return n;
};
const at = (arr, i) => { if (i >= arr.length) throw new RangeError('Index was outside the bounds of the array.'); return arr[i]; };
const jstr = (v) => (v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v))); // JToken.ToString()
async function ErrorInsert(ExpObj, name, req) {
  try { await new DataUtility().ErrorInsert(0, ExpObj && ExpObj.message, name, 0, req.path); } catch (_) { /* ignore */ }
}

const KitMaster = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME', 'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const EmailPackMaster = ['TEPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'ST', 'TotalAmount', 'NoOfEmail', 'NoOfDaysValidity'];
const SmsPackMaster = ['TSPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfSMS', 'NoOfDaysValidity'];
const SubscriptionMaster = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail', 'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price', 'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT', 'MAXINVESTMENT', 'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];
const WhatsUpPackMaster = ['TWUPMID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfMessages', 'NoOfDaysValidity'];
const TrafficBoosterPackMaster = ['TTBID', 'PackageName', 'PackageFeatureDescription', 'IsActive', 'Amount', 'TotalAmount', 'ST', 'NoOfHits', 'NoOfDaysValidity'];
const GetBTCDetails = ['BtcAddress', 'UserId', 'Level', 'BTC', 'Id', 'BTC_RATE', 'COINCODE', 'BTCAMOUNT', 'TXN_ID', 'CONFIRMS_NEEDED', 'TIMEOUT', 'STATUS_URL', 'QRCODE_URL'];

// public static decimal PoundToBitcoinConvertor(decimal Amount) - static helper, not an action
async function PoundToBitcoinConvertor(Amount) {
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=' + config.app.Currency + '&value=' + Amount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (d) => d });
    const str = String(r.data).split(/\r?\n/)[0];
    const n = Number(str);
    if (str.trim() === '' || Number.isNaN(n)) throw new Error('format');
    return n;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'PoundToBitcoinConvertor', 0, ''); } catch (_) { /* ignore */ }
    return 0;
  }
}
router.PoundToBitcoinConvertor = PoundToBitcoinConvertor;

// public string SaveChallanImage(string ChallanImage, string ReferenceNumber, int RegNo, string loginid, Int64 RandomNo)
async function SaveChallanImage(ChallanImage, ReferenceNumber, RegNo, loginid, RandomNo) {
  let Imgchallen = '';
  if (ChallanImage.trim() !== '') { // null => TypeError (legacy NullReferenceException)
    let base64String = '';
    const SavePaths = config.app.ChallenImagePath;
    if (ChallanImage !== '') {
      base64String = ChallanImage;
      let ChallenImage = s(loginid) + '&' + RegNo + '&' + s(ReferenceNumber) + '&' + RandomNo;
      ChallenImage = ChallenImage.trim();
      ChallenImage = ChallenImage.split('&amp;').join('And');
      ChallenImage = ChallenImage.split('&').join(' And ');
      ChallenImage = ChallenImage.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, '');
      ChallenImage = ChallenImage.split(' ').join('-');
      Imgchallen = ChallenImage + '-' + RegNo + s(ReferenceNumber) + RandomNo + '.jpg';
    } else {
      Imgchallen = ' ';
    }
    const dir = path.join(config.uploadDir, s(SavePaths).replace(/^[~/\\]+/, ''));
    const StrValidFullName = path.join(dir, Imgchallen);
    if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
    const b = Buffer.from(base64String, 'base64');
    if (b.length === 0) throw new Error('Parameter is not valid.');
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(StrValidFullName)) fs.unlinkSync(StrValidFullName);
    fs.writeFileSync(StrValidFullName, b);
  }
  return Imgchallen;
}

// public string PayByPayYouMoney(OnlinePaymentForPackage ObjParam)
function PayByPayYouMoney(req, ObjParam) {
  let ReturnOutput = 'PayYouMoney';
  try {
    sessionStore.set(req, 'PaymentForOrder', ObjParam);
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return ReturnOutput;
}

function buildOnlinePayment(RegNo, p, InvestMentInINR, TotalPayableAmount) {
  return {
    Regno: RegNo,
    TotalPayableAmount,
    PaymentMode: p.PaymentMode,
    ModeName: p.ModeName,
    CommentORRemark: p.CommentORRemark,
    ChallanImage: p.ChallanImage,
    BankName: p.BankName,
    BranchName: p.BranchName,
    ReferenceDate: p.ReferenceDate,
    ReferenceNumber: p.ReferenceNumber,
    TransactionPassword: p.TransactionPassword,
    GoogleAuthenticationCode: p.GoogleAuthenticationCode,
    WalletId: p.WalletId,
    AllPackageId: p.AllPackageId,
    AllPackageType: p.AllPackageType,
    AllPackageAmount: p.AllPackageAmount,
    AllPackageName: p.AllPackageName,
    NOOFATCCOIN: String(TotalPayableAmount),
    InvestMentInINR: String(InvestMentInINR),
    UserName: s(p.UserName),
  };
}

// BTC (PaymentMode 11) verification shared by both purchase actions; returns an error string or null
async function verifyBtc(TotalPayableAmount, BTCTransactionId) {
  const CompanyWalletAddress = await scalar(DB, "select clubcond from settings where caption = 'BTCAddress' limit 1");
  const BitCoinAmount = await PoundToBitcoinConvertor(dec(TotalPayableAmount));
  const obj_APIStatus = await BlockChainAPI.GetTransactionStatus(BTCTransactionId, CompanyWalletAddress);
  if (obj_APIStatus == null) {
    return '9^Invalid Transaction ID or Hash Code.';
  } else if (String(obj_APIStatus.Status).toLowerCase() !== 'success') {
    return '8^Invalid Transaction ID or Hash Code.';
  } else if (obj_APIStatus.Toaddress !== CompanyWalletAddress) {
    return '7^You have deposit BTC in wrong wallet address.';
  } else if (Number(obj_APIStatus.Value) !== BitCoinAmount) {
    return '6^You did not deposit ' + BitCoinAmount + ' Bitcoin Sorry.';
  }
  return null;
}

// Google-authenticator check shared by both purchase actions; returns an error string or null
async function checkGaKey(req, GAKEY) {
  const plid = Math.trunc(Number(req.user.plid));
  const objs = await new Security_Key().Get_Security_Key(plid);
  if (objs != null) {
    const ActiveKey = objs.Status;
    const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(plid);
    if (ActiveKey === 1) {
      if (!(await objs.Check_GaKey(plid, ValidRandomNo, GAKEY))) {
        return 'Error^Please enter valid GA key !';
      }
    }
  }
  return null;
}

// saves ChallanImage..ChallanImage3 like the legacy code and returns the comma separated names
async function saveChallanImages(p, ReferenceNumber, RegNo, loginid) {
  let AllImageName = '';
  const rnd = () => Math.floor(Math.random() * 999999);
  if (p.ChallanImage !== '') AllImageName = await SaveChallanImage(p.ChallanImage, ReferenceNumber, RegNo, loginid, rnd());
  if (p.ChallanImage1 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(p.ChallanImage1, ReferenceNumber, RegNo, loginid, rnd());
  if (p.ChallanImage2 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(p.ChallanImage2, ReferenceNumber, RegNo, loginid, rnd());
  if (p.ChallanImage3 !== '') AllImageName = AllImageName + ',' + await SaveChallanImage(p.ChallanImage3, ReferenceNumber, RegNo, loginid, rnd());
  return AllImageName;
}

const COMMON_FIELDS = ['TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'ChallanImage', 'ChallanImage1', 'ChallanImage2', 'ChallanImage3', 'BankName', 'BranchName',
  'ReferenceDate', 'ReferenceNumber', 'TransactionPassword', 'GoogleAuthenticationCode', 'WalletId', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'AllPackageName',
  'BTCTransactionId', 'UserName', 'GAKEY', 'OTPCODE', 'CoinRate'];

// route-config: referral/subscribe-us (id optional)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${P}/Index{/:id}`, '/member/referral/subscribe-us{/:id}'], auth, asyncHandler(async (req, res) => {
  const TempPlid = Math.trunc(Number(req.user.plid));
  const ObjGetAllData = {};
  ObjGetAllData.LiKitMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '1', plid: TempPlid }), KitMaster);
  ObjGetAllData.LiEmailPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '2', plid: TempPlid }), EmailPackMaster);
  ObjGetAllData.LiSmsPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '3', plid: TempPlid }), SmsPackMaster);
  ObjGetAllData.LiSubscriptionMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '4', plid: TempPlid }), SubscriptionMaster);
  ObjGetAllData.LiWhatsUpPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '5', plid: TempPlid }), WhatsUpPackMaster);
  ObjGetAllData.LiTrafficBoosterPackMaster = mapRows(await proc(DB, 'usp_managesubscription', { mode: '6', plid: TempPlid }), TrafficBoosterPackMaster);
  ObjGetAllData.BankListadmin = null;
  res.json({ Model: ObjGetAllData });
}));

// auth (uses Session["plid"])
router.all(`${P}/GenerateOTP{/:id}`, auth, asyncHandler(async (req, res) => {
  // TransPass is bound but the legacy check was `TransPass == TransPass` (always true)
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let Mobilestatus = 0;
  let Emailstatus = 0;
  sessionStore.set(req, 'SessionOTP', OTP);
  const Plid = Number(req.user.plid);
  const membersmsactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS = 1 AND STATUS = 1 AND REGNO = @r limit 1', { r: Plid })) || 0;
  const memberemailactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL = 1 AND STATUS = 1 AND REGNO = @r limit 1', { r: Plid })) || 0;
  const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 6 limit 1');
  Mobilestatus = msg.sms_send_status; // null => TypeError (legacy NullReferenceException)
  const emailmsg = await queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 6 limit 1');
  Emailstatus = emailmsg.email_send_status;
  const PLDetails = await queryOne(DB, 'select mobile, emailid, username from member_master where regno = @r limit 1', { r: Plid });
  if (PLDetails != null) {
    // legacy condition (MOBILE != null || MOBILE != "") is always true
    const Userid = '';
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(PLDetails.username, msg.sms_content, Userid, OTP, 2);
    const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(PLDetails.username, emailmsg.email_content, '', OTP, 2, '');
    if (Mobilestatus === 1 && membersmsactive === 1) {
      bg(() => UtilityClass.SendSMSWithAPI(PLDetails.mobile, messg, '1'));
    }
    if (Emailstatus === 1 && memberemailactive === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(PLDetails.username, '', '', '', '', '', PLDetails.emailid, emailmsg.email_subject, Emailmsg, null, '', ''));
    }
    returnmessage = 'OTP SENT';
  }
  if (Mobilestatus === 0 && Emailstatus === 0) {
    returnmessage = 'OTP BYPASS';
  }
  res.json(returnmessage);
}));

// auth
router.all(`${P}/PurchaseKitOrPackage{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = {};
  for (const k of [...COMMON_FIELDS, 'memberofdirectincome', 'memberofparent']) p[k] = req.p[k];
  const joining = reqInt(req.p.joining, 'joining');
  const side = reqInt(req.p.side, 'side');
  const { TotalPayableAmount, PaymentMode, UserName, GAKEY, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName, BTCTransactionId, memberofdirectincome, memberofparent } = p;
  const { ModeName, CommentORRemark, BankName, BranchName, ReferenceDate, GoogleAuthenticationCode, WalletId } = p;
  let { TransactionPassword, ReferenceNumber } = p;
  let memberusername = UserName;
  const sessionPlid = Math.trunc(Number(req.user.plid));

  if (PaymentMode === '14') {
    const v = await scalar(DB, 'select coalesce(available_fund, 0) from member_performance where regno = @r limit 1', { r: sessionPlid });
    const availbleewallet = v === null || v === undefined ? 0 : Number(v);
    if (availbleewallet < (dec(TotalPayableAmount) * dec(joining))) {
      return res.json('INSUFUND');
    }
  }
  if (PaymentMode === '12') {
    const c = await scalar(DB, 'select coalesce(inr, 0) from tbl_atc_inr_ratio_master limit 1');
    const coinrate = c === null || c === undefined ? 0 : Number(c);
    const a = await scalar(DB, 'select coalesce(availablecoinwallet, 0) from member_performance where regno = @r limit 1', { r: sessionPlid });
    const availblecoin = a === null || a === undefined ? 0 : Number(a);
    const needed = dec(TotalPayableAmount) * dec(joining);
    if (coinrate === 0) throw new RangeError('Attempted to divide by zero.');
    if (availblecoin < needed / coinrate) {
      return res.json('INSUFUND');
    }
  }
  // OTP validation (Session["SessionOTP"]) is commented out in the legacy code

  if (joining > 1) {
    const row = await queryOne(DB, 'select emailid, ipadd, mobile, fname, cid from member_master where username = @u limit 1', { u: UserName });
    if (row == null) throw nre();
    const email = row.emailid;
    const ip_address = row.ipadd;
    const MobileNo = row.mobile;
    const FullName = row.fname;
    const Country = row.cid;
    const password = '';
    const State = 0;
    for (let i = 1; i < joining; i++) {
      const AutoUserName = await DAL_RegistrationOrLogin.Registration(UserName, email, password, '', '', '', ip_address, MobileNo, 'login', Country, State, '', FullName, '', 1, '', 1, '', '', 0, '', '', '', '1', '', '', '', '', 1, 2);
      memberusername = memberusername + '~' + AutoUserName;
    }
  }
  const Rate = 1;
  const InvestMentInINR = dec(TotalPayableAmount) / Rate;
  let ReturnOutput = 'success';
  let RegNo = 0;
  if (UserName === '') {
    RegNo = sessionPlid;
  } else {
    const RowSp = await queryOne(DB, 'select regno from member_master where username = @u and coalesce(status::int, 0) = 1 limit 1', { u: UserName });
    if (RowSp != null) {
      RegNo = Math.trunc(Number(RowSp.regno));
    } else {
      return res.json('6^Invalid User Name Sorry.');
    }
  }
  if (PaymentMode === '1' || PaymentMode === '2') {
    const Obj = buildOnlinePayment(RegNo, p, InvestMentInINR, TotalPayableAmount);
    ReturnOutput = PayByPayYouMoney(req, Obj);
    return res.json(ReturnOutput);
  } else if (PaymentMode === '11') {
    const err = await verifyBtc(TotalPayableAmount, BTCTransactionId);
    if (err !== null) return res.json(err);
    ReferenceNumber = BTCTransactionId;
  }
  {
    const err = await checkGaKey(req, GAKEY);
    if (err !== null) return res.json(err);
  }
  try {
    const loginid = s(req.user.loginid);
    const AllImageName = await saveChallanImages(p, ReferenceNumber, RegNo, loginid);
    let Plid = RegNo;
    const memusername = s(memberusername).split('~');
    for (let i = 0; i < memusername.length; i++) {
      const memuser = memusername[i];
      const row3 = await queryOne(DB, 'select regno from member_master where username = @u limit 1', { u: memuser });
      if (row3 != null) {
        RegNo = Math.trunc(Number(row3.regno));
        Plid = RegNo;
      }
      if (TransactionPassword === null || TransactionPassword === undefined) {
        TransactionPassword = '';
      }
      const o1 = await procOne(DB, 'usp_allsubscriptionmaster', {
        totalpayableamount: TotalPayableAmount, paymentmode: PaymentMode, modename: ModeName, commentorremark: CommentORRemark, regno: RegNo, imagename: AllImageName,
        bankname: BankName, branchname: BranchName, referencedate: ReferenceDate, referencenumber: ReferenceNumber, walletid: WalletId,
        transactionpassword: TransactionPassword, googleauthenticationcode: GoogleAuthenticationCode, allpackageid: AllPackageId, allpackagetype: AllPackageType,
        allpackageamount: AllPackageAmount, plid: Plid, allpackagename: AllPackageName, processingfee: '0.00', noofatccoin: TotalPayableAmount,
        investmentinINR: InvestMentInINR, fromregno: sessionPlid, incometype: 0, memberofdirectincome, sides: side, memberofparent,
      });
      let Output = o1 ? 1 : 0;
      const r1 = outv(o1, 'intresult');
      if (r1 === undefined || r1 === null) throw nre();
      ReturnOutput = String(r1);
      const t1 = outv(o1, 'tranids');
      if (t1 === undefined || t1 === null) throw nre();
      const Orderid = String(t1);
      if (Orderid !== '' && UserName !== '') {
        const o2 = await procOne(DB, 'usp_managepayitforward', { fromregno: sessionPlid, toregno: RegNo, transaction_id: Orderid });
        Output = o2 ? 1 : 0;
      }
      if (Output > 0) {
        try {
          const AllPackageNames = s(AllPackageName).split('~').join(',');
          const Obj = await queryOne(DB, "Select coalesce(Phone,'') As Phone, EmailID, UserName, Regno, coalesce(FNAME,'')||''||coalesce(LNAME,'') AS NAME From Portal_Login where plid = @p limit 1", { p: Plid });
          const SponsorDetails = await query(DB, "select coalesce(USERNAME,'') as USERNAME, coalesce(MOBILE,'') as MOBILE, coalesce(EMAILID,'') as EMAILID from MEMBER_MASTER where REGNO = @r", { r: sessionPlid });
          if (Obj != null) { // legacy: (Obj.EmailID != "" || Obj.EmailID != null) is always true
            const membersmsactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS = 1 AND STATUS = 1 AND REGNO = @r limit 1', { r: sessionPlid })) || 0;
            const memberemailactive = Number(await scalar(DB, 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL = 1 AND STATUS = 1 AND REGNO = @r limit 1', { r: sessionPlid })) || 0;
            const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 16 limit 1');
            const topupMsg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 22 limit 1');
            const Sponsoremailmsg = await queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 18 limit 1');
            void topupMsg.sms_content; // TopupMessageForSponsor (NullReference if topupMsg is null)
            const emailmsg = await queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 13 limit 1');
            const emailmessage = await UtilityClass.FindingEmailContentWithUserIdPassword(Obj.username, emailmsg.email_content, AllPackageNames, Orderid, 5, '');
            // agreement e-mail ("Agreement Detail") is built but its sending is commented out in the legacy code
            const packName = sessionStore.get(req, 'packname').toString(); // null => TypeError (legacy NullReferenceException)
            const AmountPack = sessionStore.get(req, 'Amount').toString();
            void packName; void AmountPack;
            const mem = await queryOne(DB, 'select username, address, fname, lname, fath_hus_name from member_master where regno = @p limit 1', { p: Plid });
            const por = await queryOne(DB, 'select fatherormothername from portal_login where plid = @p limit 1', { p: Plid });
            void mem.username; void por.fatherormothername;
            const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(Obj.username, msg.sms_content, '', Orderid, 11, AllPackageNames, Obj.name);
            const DynamicSponsorMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(Obj.username, topupMsg.sms_content, '', '', 10, SponsorDetails[0].username);
            const DynamicEmailMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Obj.username, Sponsoremailmsg.email_content, '', '', 10, '', SponsorDetails[0].username);
            if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
              if (topupMsg.sms_send_status === 1) {
                bg(() => UtilityClass.SendSMSWithAPI(Obj.phone, DynamicSponsorMsg, ''));
              }
              if (Sponsoremailmsg.email_send_status === 1) {
                bg(() => UtilityClass.SendEmailByApiSetting(SponsorDetails[0].username, '', '', '', '', '', SponsorDetails[0].emailid, Sponsoremailmsg.email_subject, DynamicEmailMsg, null, '', ''));
              }
              if (msg.sms_send_status === 1 && membersmsactive === 1) {
                bg(() => UtilityClass.SendSMSWithAPI(Obj.phone, messg, ''));
              }
              if (emailmsg.email_send_status === 1 && memberemailactive === 1) {
                bg(() => UtilityClass.SendEmailByApiSetting(Obj.username, '', '', '', '', '', Obj.emailid, emailmsg.email_subject, emailmessage, null, '', ''));
              }
              // legacy EmailConfirmation thread had an empty (commented) body
            }
          }
          sessionStore.set(req, 'packname', null);
          sessionStore.set(req, 'SessionOTP', null);
          sessionStore.set(req, 'Amount', null);
        } catch (ExpObj) {
          await ErrorInsert(ExpObj, 'USP_MANAGEPAYITFORWARD', req);
        }
      }
    }
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'Usp_AllSubscriptionMaster', req);
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

// auth
router.all(`${P}/MultiplePurchaseKitOrPackage{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = {};
  for (const k of COMMON_FIELDS) p[k] = req.p[k];
  let { TotalPayableAmount, TransactionPassword, ReferenceNumber } = p;
  const { PaymentMode, UserName, GAKEY, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName, BTCTransactionId, OTPCODE } = p;
  const { ModeName, CommentORRemark, BankName, BranchName, ReferenceDate, GoogleAuthenticationCode, WalletId } = p;
  const sessionPlid = Math.trunc(Number(req.user.plid));

  {
    let CheckPasswordActive = await scalar(DB, "select showactive from tbl_detailspagemasterforregistration where fid = 'TranPwd' limit 1");
    CheckPasswordActive = CheckPasswordActive === null || CheckPasswordActive === undefined ? 0 : Number(CheckPasswordActive);
    if (CheckPasswordActive === 0) {
      const t = await scalar(DB, 'Select TPASSWORD From Portal_Login Where PLID = @p limit 1', { p: sessionPlid });
      TransactionPassword = t === undefined ? null : t;
    } else {
      TransactionPassword = await UtilityClass.Encryptword(TransactionPassword);
    }
  }
  {
    const msg = await queryOne(DB, 'select sms_send_status from tbl_smsaction where id = 6 limit 1');
    const emailmsg = await queryOne(DB, 'select email_send_status from tbl_emailaction where eid = 6 limit 1');
    if (msg.sms_send_status === 0 && emailmsg.email_send_status === 0) {
      if (config.app.MasterCode === OTPCODE) {
        sessionStore.set(req, 'SessionOTP', OTPCODE);
      }
    }
  }
  // OTP validation (Session["SessionOTP"]) is commented out in the legacy code
  const Rate = 1;
  const InvestMentInINR = dec(TotalPayableAmount) / Rate;
  TotalPayableAmount = AllPackageAmount;
  let ReturnOutput = 'success';
  let RegNo = 0;
  if (UserName === '') {
    RegNo = sessionPlid;
  } else {
    const RowSp = await queryOne(DB, 'select plid from portal_login where username = @u and coalesce(active::int, 0) = 1 limit 1', { u: UserName });
    if (RowSp != null) {
      RegNo = Math.trunc(Number(RowSp.plid));
    } else {
      return res.json('6^Invalid User Name Sorry.');
    }
  }
  if (PaymentMode === '1' || PaymentMode === '2') {
    const Obj = buildOnlinePayment(RegNo, { ...p, TransactionPassword }, InvestMentInINR, TotalPayableAmount);
    ReturnOutput = PayByPayYouMoney(req, Obj);
    return res.json(ReturnOutput);
  } else if (PaymentMode === '11') {
    const err = await verifyBtc(TotalPayableAmount, BTCTransactionId);
    if (err !== null) return res.json(err);
    ReferenceNumber = BTCTransactionId;
  }
  {
    const err = await checkGaKey(req, GAKEY);
    if (err !== null) return res.json(err);
  }
  try {
    const loginid = s(req.user.loginid);
    const AllImageName = await saveChallanImages(p, ReferenceNumber, RegNo, loginid);
    const Plid = RegNo;
    const TotalPayableAmounts = s(TotalPayableAmount).split('~');
    const AllPackageIds = s(AllPackageId).split('~');
    const AllPackageTypes = s(AllPackageType).split('~');
    const AllPackageAmounts = s(AllPackageAmount).split('~');
    const AllPackageNamess = s(AllPackageName).split('~');
    let Output = 0;
    let Orderids = '';
    for (let i = 0; i < AllPackageIds.length; i++) {
      const o1 = await procOne(DB, 'usp_allsubscriptionmaster', {
        totalpayableamount: at(TotalPayableAmounts, i), paymentmode: PaymentMode, modename: ModeName, commentorremark: CommentORRemark, regno: RegNo, imagename: AllImageName,
        bankname: BankName, branchname: BranchName, referencedate: ReferenceDate, referencenumber: ReferenceNumber, walletid: WalletId,
        transactionpassword: TransactionPassword, googleauthenticationcode: GoogleAuthenticationCode, allpackageid: AllPackageIds[i],
        allpackagetype: at(AllPackageTypes, i), allpackageamount: at(AllPackageAmounts, i), plid: Plid, allpackagename: at(AllPackageNamess, i), processingfee: '0.00',
        noofatccoin: at(TotalPayableAmounts, i), investmentinINR: at(TotalPayableAmounts, i), fromregno: sessionPlid,
      });
      Output = o1 ? 1 : 0;
      const r1 = outv(o1, 'intresult');
      if (r1 === undefined || r1 === null) throw nre();
      ReturnOutput = String(r1);
      const t1 = outv(o1, 'tranids');
      if (t1 === undefined || t1 === null) throw nre();
      const Orderid = String(t1);
      if (Orderid !== '') {
        Orderids += Orderid;
        Orderids = Orderids + ',';
      }
      if (Orderid !== '' && UserName !== '') {
        const o2 = await procOne(DB, 'usp_managepayitforward', { fromregno: sessionPlid, toregno: RegNo, transaction_id: Orderid });
        Output = o2 ? 1 : 0;
      }
    }
    if (Output > 0) {
      try {
        const AllPackageNames = s(AllPackageName).split('~').join(',');
        const Obj = await queryOne(DB, "Select coalesce(Phone,'') As Phone, EmailID, UserName From Portal_Login where plid = @p limit 1", { p: Plid });
        if (Obj != null) { // legacy: (Obj.EmailID != "" || Obj.EmailID != null) is always true
          const msg = await queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 16 limit 1');
          const emailmsg = await queryOne(DB, 'select email_content, email_send_status, email_subject from tbl_emailaction where eid = 13 limit 1');
          const OrderidsTrim = Orderids.replace(/,+$/, '');
          const emailmessage = await UtilityClass.FindingEmailContentWithUserIdPassword(Obj.username, emailmsg.email_content, AllPackageNames, OrderidsTrim, 5, '');
          const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(Obj.username, msg.sms_content, AllPackageNames, OrderidsTrim, 8);
          if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
            if (msg.sms_send_status === 1) {
              bg(() => UtilityClass.SendSMSWithAPI(Obj.phone, messg, ''));
            }
            if (emailmsg.email_send_status === 1) {
              bg(() => UtilityClass.SendEmailByApiSetting(Obj.username, '', '', '', '', '', Obj.emailid, emailmsg.email_subject, emailmessage, null, '', ''));
            }
            // legacy EmailConfirmation thread had an empty (commented) body
          }
        }
        sessionStore.set(req, 'SessionOTP', null);
      } catch (ExpObj) {
        await ErrorInsert(ExpObj, 'USP_MANAGEPAYITFORWARD', req);
      }
    }
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'Usp_AllSubscriptionMaster', req);
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

// auth (uses Session["Plid"])
router.all(`${P}/GenrateAddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const { CoinCode, CoinName, TotalPayableAmount, FromCurrency } = req.p;
  try {
    let GeneratedBtcAddress = ''; let UserId = ''; let Level = ''; let Amount = ''; let Txn_Id = ''; let Confirms_Needed = ''; let Timeout = ''; let Status_Url = ''; let Qrcode_Url = '';
    const UrlForHitforrate = 'https://api.coinmarketcap.com/v1/ticker/' + CoinName + '/?convert=' + config.app.CurrencySymbol;
    const rr = await axios.get(UrlForHitforrate, { responseType: 'text', transformResponse: (d) => d });
    const ObjRateManagement = JSON.parse(rr.data);
    const pu = jstr(ObjRateManagement[0].price_usd);
    if (pu === 'null' || pu === '') {
      return res.json('error');
    }
    const btcrate = pu;
    try {
      const Response = await CoinPaymentAPI.CreateTranstion(CoinCode, FromCurrency, CoinCode, TotalPayableAmount);
      const ObjWalletManagement = JSON.parse(Response);
      if (jstr(ObjWalletManagement.Flag) !== 'success') {
        return res.json('error');
      }
      const ObjWalletManagementNew = JSON.parse(jstr(ObjWalletManagement.Message));
      const ObjWalletManagementResult = JSON.parse(jstr(ObjWalletManagementNew.result));
      GeneratedBtcAddress = jstr(ObjWalletManagementResult.address);
      UserId = jstr(ObjWalletManagementResult.address);
      Level = jstr(ObjWalletManagementResult.address);
      Amount = jstr(ObjWalletManagementResult.amount);
      Txn_Id = jstr(ObjWalletManagementResult.txn_id);
      Confirms_Needed = jstr(ObjWalletManagementResult.confirms_needed);
      Timeout = jstr(ObjWalletManagementResult.timeout);
      Status_Url = jstr(ObjWalletManagementResult.status_url);
      Qrcode_Url = jstr(ObjWalletManagementResult.qrcode_url);
    } catch (ExpObj) {
      return res.json('error');
    }
    const Plid = Number(req.user.plid);
    const rate = dec(btcrate);
    await proc(DB, 'usp_adminbtcaddressmanagements', {
      btcaddress: GeneratedBtcAddress, userid: UserId, level: Level, mode: '1', plid: Plid, amount: TotalPayableAmount, btcrate: rate, coincode: CoinCode,
      btcamount: Amount, txn_id: Txn_Id, confirms_needed: Confirms_Needed, timeout: Timeout, status_url: Status_Url, qrcode_url: Qrcode_Url,
    });
    const rows = await proc(DB, 'usp_adminbtcaddressmanagements', {
      btcaddress: '', userid: '', level: '', mode: '2', plid: Plid, amount: TotalPayableAmount, btcrate: rate, coincode: CoinCode,
      btcamount: Amount, txn_id: Txn_Id, confirms_needed: Confirms_Needed, timeout: Timeout, status_url: Status_Url, qrcode_url: Qrcode_Url,
    });
    const ObjGetBTCDetails = mapRows(rows, GetBTCDetails)[0] || null;
    return res.json(ObjGetBTCDetails);
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'GenrateAddress', req);
    return res.json(ExpObj.message);
  }
}));

// public (no session access; returns a constant)
router.all(`${P}/GetINRToATC{/:id}`, asyncHandler(async (req, res) => {
  reqDec(req.p.TotalPayableAmount, 'TotalPayableAmount');
  res.json('0.00000000');
}));

// auth (public string action; stores the payment request in the session)
router.all(`${P}/PayByPayYouMoney{/:id}`, auth, asyncHandler(async (req, res) => {
  const Obj = req.body && Object.keys(req.body).length ? req.body : req.p.all();
  res.send(PayByPayYouMoney(req, Obj));
}));

// auth (public string action that writes a file; protected although the legacy code had no session check)
router.all(`${P}/SaveChallanImage{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const RegNo = reqInt(p.RegNo, 'RegNo');
  const RandomNo = Number(p.RandomNo);
  if (p.RandomNo === undefined || p.RandomNo === null || p.RandomNo === '' || Number.isNaN(RandomNo)) throw new Error("The parameters dictionary contains a null or invalid entry for parameter 'RandomNo' of non-nullable type 'System.Int64'.");
  res.send(await SaveChallanImage(p.ChallanImage, p.ReferenceNumber, RegNo, p.loginid, RandomNo));
}));

module.exports = router;
