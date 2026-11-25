'use strict';
const express = require('express');
const axios = require('axios');
const config = require('../config');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { query, queryOne, scalar, proc } = require('../db');
const { mapRows, netDate } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');
const DAL_RegistrationOrLogin = require('../lib/DAL_RegistrationOrLogin');
const BlockChainAPI = require('../lib/BlockChainAPI');
const Security_Key = require('../lib/Security_Key');

const router = express.Router();

// ---- helpers (C# Convert.* semantics) ----
function toInt64(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
const toInt32 = toInt64;
function toDecimal(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '' || Number.isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
const str = (v) => (v === undefined ? null : v);
const optInt = (v) => ((v === undefined || v === null || v === '') ? null : Number(v));
const badRequest = (res) => res.status(400).json({ Message: 'The request is invalid.' });
// fire-and-forget (C# new Thread(...).Start())
function background(fn) {
  Promise.resolve().then(fn).catch((e) => console.error(e));
}

const KIT_PROPS = ['KID', 'PCODE', 'TITLE', 'IMAGE', 'TYPE', 'AMOUNT', 'DAP', 'PV', 'BV', 'DISTAMOUNT', 'VATINPER', 'CMGAMOUNT', 'DIRECTINCOME',
  'BINARYINCOME', 'EPIN_COMMISSION', 'STATUS', 'ROI', 'NOOFMONTH', 'NoOfCities', 'NoOfKeywords'];
const SUBSCRIPTION_PROPS = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits',
  'NoOfEmail', 'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage',
  'Price', 'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT',
  'MAXINVESTMENT', 'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];
const PAID_PROPS = ['TFLID', 'rownumber', 'PURCHASEDATE', 'USERNAME', 'ALLPACKAGENAME', 'TOTALPAIDINCURRENCY', 'MODENAME', 'REFNUM', 'STATUS', 'REMARK',
  'TotalPayableAmount', 'TASMID', 'IsOrderCanCancel', 'CoinRate', 'PAIDFROM', 'Quitdate', 'quittsmid', 'COURIERSTATUS', 'DIRECTMEMBER'];
const UPGRADE_PROPS = ['AllPackageName', 'TotalPayableAmount', 'PuchaseDate', 'TASMID'];
const BEFORE_PROPS = ['AllPackageName', 'AllPackageAmount', 'PuchaseDate'];
const UPGRADE_LIST_PROPS = ['rownumber', 'URID', 'OldTitle', 'OldPrice', 'NewTitle', 'NewPrice', 'TotalPayble', 'Status', 'Paymode', 'username', 'Date'];

// buyclusterpackage
// auth
router.post('/api/buyclusterpackage', auth, asyncHandler(async (req, res) => {
  const { plid, mname } = req.p;
  if (plid == null) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  let username = mname;
  if (username == null) username = '';
  const ObjGetAllData = {
    LiKitMaster: null, LiEmailPackMaster: null, LiSmsPackMaster: null, LiSubscriptionMaster: null,
    LiWhatsUpPackMaster: null, LiTrafficBoosterPackMaster: null, BankListadmin: null,
  };

  let sponserid = '';
  let rootid = '';
  const Plid = toInt32(plid);
  let TempPlid = toInt32(plid);
  const mem = await queryOne('affiliate', 'select * from member_master where regno = @regno limit 1', { regno: Plid });
  sponserid = mem.sponserid; // (null mem => TypeError => 500, same as the NullReferenceException)
  rootid = mem.rootid;
  if (username !== '') {
    username = await UtilityClass.Decryptword(username);
    const Downline_Member = await queryOne('affiliate', 'select * from member_master where username = @u limit 1', { u: username });
    if (Downline_Member != null) {
      sponserid = Downline_Member.sponserid;
      rootid = Downline_Member.rootid;
      TempPlid = toInt32(Downline_Member.regno);
    }
  }

  await queryOne('affiliate', 'select * from member_master where loginid = @l limit 1', { l: sponserid });
  await queryOne('affiliate', 'select * from member_master where loginid = @l limit 1', { l: rootid });

  await scalar('affiliate', "select active from settings where active = true and caption = 'PackagewiseGST' limit 1");

  const kitRows = await proc('affiliate', 'Usp_ManageSubscription', { mode: '1', plid: TempPlid });
  ObjGetAllData.LiKitMaster = mapRows(kitRows, KIT_PROPS);

  const subRows = await proc('affiliate', 'Usp_ManageSubscription', { mode: '4', plid: Plid, tempplid: TempPlid });
  ObjGetAllData.LiSubscriptionMaster = mapRows(subRows, SUBSCRIPTION_PROPS);

  res.json([{ status: 'true', message: 'success', data: ObjGetAllData }]);
}));

// Purchase history
// auth
router.post('/api/Purchasehistory', auth, asyncHandler(async (req, res) => {
  let { plid, fromdate, todate, Username, PaymentMode, page, ddlcustpage } = req.p;
  page = optInt(page);
  ddlcustpage = optInt(ddlcustpage);
  if (plid == null) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  if (ddlcustpage == null) ddlcustpage = 100;
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (Username == null) Username = '';
  if (PaymentMode == null) PaymentMode = '0';

  const responseData = [];
  // HttpContext.Current.Request.QueryString.ToString()
  let regno = (req.originalUrl.indexOf('?') >= 0) ? req.originalUrl.slice(req.originalUrl.indexOf('?') + 1) : '';
  if (regno != null && regno !== '') {
    regno = await UtilityClass.Decryptword(regno);
    if (regno != null && regno !== '' && regno === plid) {
      // Username = ((Login)Session["Plid"]).UserName;  (commented-out in legacy: empty body)
    }
  }

  const Plid = toInt64(plid);
  const MaxRows = ddlcustpage;
  if (page == null) page = 1;

  const rows = await proc('affiliate', 'USP_PAID_FORWORDLIST', {
    plid: Plid,
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: '',
    searchvalue: '',
    fromdate: String(fromdate).trim(),
    todate: String(todate).trim(),
    username: Username,
    paymentmode: PaymentMode,
  });
  // PORT-NOTE: @TotalCount OUT was only parsed into an unused local; not re-parsed here.
  const LRMember = mapRows(rows, PAID_PROPS);
  await UtilityClass.GridNumbersPerPage();
  responseData.push({ status: 'true', message: 'success', data: LRMember });
  res.json(responseData);
}));

// updgrade package
// PORT-NOTE: in the legacy app this action has no [Route]/[HttpXxx] and the only conventional route is
// "api/{controller}/{id}" (no {action}), so it was not actually reachable. Ported (logic intact) under
// /api/ClusterPackage/updgradepackage for completeness.
// auth
router.all('/api/ClusterPackage/updgradepackage', auth, asyncHandler(async (req, res) => {
  let { plid, fromdate, todate, SearchField, SearchValue, page } = req.p;
  page = optInt(page);
  if (plid == null) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';

  const PLID = toInt64(plid);
  const objRows = await proc('affiliate', 'usp_Package_Upgrade', { regno: toInt32(plid), loginid: '' });
  const Obj = mapRows(objRows, UPGRADE_PROPS).map((r) => ({ ...r, PuchaseDate: netDate(r.PuchaseDate) }));

  const bpRows = await query('affiliate',
    'select AllPackageName,AllPackageAmount,PuchaseDate from Tbl_AllSubscriptionMaster_history where RegNo = @plid', { plid: PLID });
  const BeforePackage = mapRows(bpRows, BEFORE_PROPS).map((r) => ({ ...r, PuchaseDate: netDate(r.PuchaseDate) }));

  const MaxRows = 1000; // UtilityClass.GridPageSize();
  if (page == null) page = 1;

  const listRows = await proc('affiliate', 'Usp_Upgrade_package_list', {
    regno: 0,
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: SearchField,
    searchvalue: SearchValue,
    fromdate,
    todate,
    status: '',
  });
  mapRows(listRows, UPGRADE_LIST_PROPS); // Allpackage_requestList (not returned by legacy code)
  // PORT-NOTE: @strResult / @TotalCount OUT values were only parsed into unused locals; not re-parsed here.
  res.json([{ status: 'true', message: 'success', data: Obj, beforePackage: BeforePackage }]);
}));

async function PoundToBitcoinConvertor(Amount) {
  try {
    const BaseUrl = 'https://blockchain.info/tobtc?currency=' + (config.app.Currency || '') + '&value=' + Amount;
    const r = await axios.get(BaseUrl, { responseType: 'text', transformResponse: (d) => d });
    const line = String(r.data).split(/\r?\n/)[0];
    return toDecimal(line);
  } catch (ExpObj) {
    return 0;
  }
}

function PayByPayYouMoney(ObjParam) {
  const ReturnOutput = 'PayYouMoney';
  return ReturnOutput;
}

// auth
router.post('/api/PurchaseKitOrPackage', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  // non-nullable C# parameters: Plid (long), joining (int), side (int)
  if (p.Plid === undefined || p.Plid === '' || p.joining === undefined || p.joining === '' || p.side === undefined || p.side === '') {
    return badRequest(res);
  }
  let Plid;
  let joining;
  let side;
  try { Plid = toInt64(p.Plid); joining = toInt32(p.joining); side = toInt32(p.side); } catch (e) { return badRequest(res); }
  const LoginID = str(p.LoginID);
  const TotalPayableAmount = str(p.TotalPayableAmount);
  const PaymentMode = str(p.PaymentMode);
  const ModeName = str(p.ModeName);
  let CommentORRemark = str(p.CommentORRemark);
  let BankName = str(p.BankName);
  let BranchName = str(p.BranchName);
  let ReferenceDate = str(p.ReferenceDate);
  let ReferenceNumber = str(p.ReferenceNumber);
  let TransactionPassword = str(p.TransactionPassword);
  let GoogleAuthenticationCode = str(p.GoogleAuthenticationCode);
  let WalletId = str(p.WalletId);
  const AllPackageId = str(p.AllPackageId);
  const AllPackageType = str(p.AllPackageType);
  const AllPackageAmount = str(p.AllPackageAmount);
  const AllPackageName = str(p.AllPackageName);
  const BTCTransactionId = str(p.BTCTransactionId);
  const UserName = str(p.UserName);
  const GAKEY = str(p.GAKEY);
  let memberofdirectincome = str(p.memberofdirectincome);

  let memberusername = UserName;
  const memberofparent = '';

  {
    const mem = await queryOne('affiliate', 'select * from member_master where regno = @regno limit 1', { regno: Plid });
    let memberofparentt = mem.rootid; // null mem => TypeError (NullReferenceException)
    const memm = await queryOne('affiliate', 'select * from member_master where loginid = @l limit 1', { l: memberofparentt });
    memberofparentt = memm.username;
  }

  {
    if (PaymentMode === '14') {
      const v = await scalar('affiliate', 'select coalesce(Available_Fund,0) as availbleewallet from MEMBER_PERFORMANCE where Regno = @regno', { regno: Plid });
      const availbleewallet = v == null ? 0 : Number(v);
      if (availbleewallet < (toDecimal(TotalPayableAmount) * toDecimal(joining))) {
        return res.json('INSUFUND');
      }
    }
    if (PaymentMode === '12') {
      const c = await scalar('affiliate', 'select coalesce(INR,0) as coinrate from Tbl_Atc_INR_Ratio_Master limit 1');
      const coinrate = c == null ? 0 : Number(c);
      const a = await scalar('affiliate', 'select coalesce(AvailableCoinWallet,0) as availblecoin from MEMBER_PERFORMANCE where Regno = @regno', { regno: Plid });
      const availblecoin = a == null ? 0 : Number(a);
      if (coinrate === 0) throw new Error('Attempted to divide by zero.');
      if (availblecoin < ((toDecimal(TotalPayableAmount) * toDecimal(joining))) / coinrate) {
        return res.json('INSUFUND');
      }
    }
    // CheckPasswordActive (value unused in legacy)
    await scalar('affiliate', 'select coalesce(IsVerify,false) from MEMBER_LOGIN where REGNO = @regno', { regno: Plid });
  }

  {
    // legacy loaded these but only used them in commented-out OTP code
    await scalar('affiliate', 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS = true AND STATUS = true AND REGNO = @regno limit 1', { regno: Plid });
    await scalar('affiliate', 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL = true AND STATUS = true AND REGNO = @regno limit 1', { regno: Plid });
    await queryOne('affiliate', 'select * from TBL_SMSACTION where id = 6 limit 1');
    await queryOne('affiliate', 'select * from tbl_emailaction where eid = 6 limit 1');
  }

  if (joining > 1) {
    let email = '';
    let password = '';
    let ip_address = '';
    let MobileNo = '';
    let FullName = '';
    let Country = 0;
    const State = 0;
    const row = await queryOne('affiliate', 'select * from member_master where username = @u limit 1', { u: UserName });
    email = row.emailid;
    ip_address = row.ipadd;
    MobileNo = row.mobile;
    FullName = row.fname;
    Country = row.cid;
    for (let i = 1; i < joining; i++) {
      const AutoUserName = await DAL_RegistrationOrLogin.Registration(UserName, email, password, '', '', '', ip_address, MobileNo, 'login',
        Country, State, '', FullName, '', 1, '', 1, '', '', 0, '', '', '', '1', '', '', '', '', 1, 2);
      memberusername = memberusername + '~' + AutoUserName;
    }
  }

  const Rate = 1;
  const InvestMentInINR = toDecimal(TotalPayableAmount) / Rate;

  let ReturnOutput = 'success';
  let RegNo = 0;
  if (UserName === '') {
    RegNo = Number(Plid);
  } else {
    const RowSp = await queryOne('affiliate', 'select regno from member_master where username = @u and status = true limit 1', { u: UserName });
    if (RowSp != null) {
      RegNo = toInt32(RowSp.regno);
    } else {
      return res.json('6^Invalid User Name Sorry.');
    }
  }
  if (PaymentMode === '1' || PaymentMode === '2') {
    const Obj = {
      Regno: RegNo, TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, BankName, BranchName, ReferenceDate, ReferenceNumber,
      TransactionPassword, GoogleAuthenticationCode, WalletId, AllPackageId, AllPackageType, AllPackageAmount, AllPackageName,
      NOOFATCCOIN: String(TotalPayableAmount), InvestMentInINR: String(InvestMentInINR), UserName: String(UserName),
    };
    ReturnOutput = PayByPayYouMoney(Obj);
    return res.json(ReturnOutput);
  } else if (PaymentMode === '11') {
    const CompanyWalletAddress = await scalar('affiliate', "Select CLUBCOND From SETTINGS WHERE CAPTION='BTCAddress' limit 1");
    const BitCoinAmount = await PoundToBitcoinConvertor(toDecimal(TotalPayableAmount));
    const obj_APIStatus = await BlockChainAPI.GetTransactionStatus(BTCTransactionId, CompanyWalletAddress);
    if (obj_APIStatus == null) {
      return res.json('9^Invalid Transaction ID or Hash Code.');
    } else if (String(obj_APIStatus.Status).toLowerCase() !== 'success') {
      return res.json('8^Invalid Transaction ID or Hash Code.');
    } else if (obj_APIStatus.Toaddress !== CompanyWalletAddress) {
      return res.json('7^You have deposit BTC in wrong wallet address.');
    } else if (Number(obj_APIStatus.Value) !== BitCoinAmount) {
      return res.json('6^You did not deposit ' + BitCoinAmount + ' Bitcoin Sorry.');
    }
    ReferenceNumber = BTCTransactionId;
  }
  // `if (Plid != null)` is always true for a long
  {
    const objs = await new Security_Key().Get_Security_Key(Number(Plid));
    let ActiveKey = 0;
    if (objs != null) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(Number(Plid));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Number(Plid), ValidRandomNo, GAKEY))) {
          return res.json('Error^Please enter valid GA key !');
        }
      }
    }
  }
  try {
    const loginid = String(LoginID);
    const AllImageName = '';
    Plid = RegNo;

    const memusername = memberusername.split('~');

    for (let i = 0; i < memusername.length; i++) {
      const memuser = memusername[i];
      const row3 = await queryOne('affiliate', 'select regno from member_master where username = @u limit 1', { u: memuser });
      if (row3 != null) {
        RegNo = toInt32(row3.regno);
        Plid = RegNo;
      }
      if (TransactionPassword == null) TransactionPassword = '';
      if (ReferenceDate == null) ReferenceDate = '';
      if (ReferenceNumber == null) ReferenceNumber = '';
      if (GoogleAuthenticationCode == null) GoogleAuthenticationCode = '';
      if (CommentORRemark == null) CommentORRemark = '';
      if (BankName == null) BankName = '';
      if (BranchName == null) BranchName = '';
      if (WalletId == null) WalletId = '';
      if (memberofdirectincome == null) memberofdirectincome = '';

      const spRow = await proc('affiliate', 'Usp_AllSubscriptionMaster', {
        totalpayableamount: TotalPayableAmount,
        paymentmode: PaymentMode,
        modename: ModeName,
        commentorremark: CommentORRemark,
        regno: RegNo,
        imagename: AllImageName,
        bankname: BankName,
        branchname: BranchName,
        referencedate: ReferenceDate,
        referencenumber: ReferenceNumber,
        walletid: WalletId,
        transactionpassword: TransactionPassword,
        googleauthenticationcode: GoogleAuthenticationCode,
        allpackageid: AllPackageId,
        allpackagetype: AllPackageType,
        allpackageamount: AllPackageAmount,
        plid: Plid,
        allpackagename: AllPackageName,
        processingfee: '0.00',
        noofatccoin: TotalPayableAmount,
        investmentinr: InvestMentInINR,
        fromregno: toInt32(Plid),
        incometype: 0,
        memberofdirectincome,
        sides: side,
        memberofparent,
      });
      const out1 = spRow[0] || {};
      // PORT-NOTE: ExecuteSqlCommand returned the affected-row count; here Output = 1 when the procedure returned a row, else 0.
      let Output = spRow.length > 0 ? 1 : 0;
      ReturnOutput = out1.intresult == null ? '' : String(out1.intresult);

      const Orderid = out1.tranids == null ? '' : String(out1.tranids);
      if (Orderid !== '' && UserName !== '') {
        const pf = await proc('affiliate', 'USP_MANAGEPAYITFORWARD', {
          fromregno: toInt32(Plid),
          toregno: RegNo,
          transaction_id: Orderid,
        });
        Output = pf.length > 0 ? 1 : 0;
      }
      if (Number(Output) > 0) {
        try {
          const AllPackageNames = AllPackageName.replace(/~/g, ',');
          const Obj = await queryOne('affiliate',
            "Select coalesce(Phone,'') As Phone,EmailID,UserName,Regno,coalesce(FNAME,'')||''||coalesce(LNAME,'') AS NAME From Portal_Login where plid = @plid",
            { plid: String(Plid) });
          const objM = Obj == null ? null : { Phone: Obj.phone, EmailID: Obj.emailid, UserName: Obj.username, REGNO: Obj.regno, NAME: Obj.name };
          const sdRows = await query('affiliate',
            "select coalesce(USERNAME,'') USERNAME,coalesce(MOBILE,'') as MOBILE,coalesce(EMAILID,'') as EMAILID from MEMBER_MASTER where REGNO = @regno",
            { regno: String(toInt32(Plid)) });
          const SponsorDetails = sdRows.map((r) => ({ USERNAME: r.username, MOBILE: r.mobile, EMAILID: r.emailid }));
          if (objM != null && (objM.EmailID !== '' || objM.EmailID != null)) {
            const membersmsactive = await scalar('affiliate', 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISSMS = true AND STATUS = true AND REGNO = @regno limit 1', { regno: Plid });
            const memberemailactive = await scalar('affiliate', 'SELECT 1 FROM TBL_MEMBERAUTHENTICATION WHERE ISEMAIL = true AND STATUS = true AND REGNO = @regno limit 1', { regno: Plid });
            const msgR = await queryOne('affiliate', 'select * from TBL_SMSACTION where id = 16 limit 1');
            const topupR = await queryOne('affiliate', 'select * from TBL_SMSACTION where id = 22 limit 1');
            const SponsoremailR = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 18 limit 1');
            const msg = msgR && { Sms_Content: msgR.sms_content, Sms_Send_Status: msgR.sms_send_status };
            const topupMsg = topupR && { Sms_Content: topupR.sms_content, Sms_Send_Status: topupR.sms_send_status };
            const Sponsoremailmsg = SponsoremailR && { Email_Content: SponsoremailR.email_content, Email_Subject: SponsoremailR.email_subject, Email_Send_Status: SponsoremailR.email_send_status };
            const TopupMessageForSponsor = topupMsg.Sms_Content;
            const emailR = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 13 limit 1');
            const emailmsg = emailR && { Email_Content: emailR.email_content, Email_Subject: emailR.email_subject, Email_Send_Status: emailR.email_send_status };
            const emailmessage = await UtilityClass.FindingEmailContentWithUserIdPassword(objM.UserName, emailmsg.Email_Content, AllPackageNames, Orderid, 5, '');
            // ------------ send agreement mail (legacy: subject/CompanyName unused, body commented out)
            const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(objM.UserName, msg.Sms_Content, '', Orderid, 11, AllPackageNames, objM.NAME);
            const DynamicSponsorMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(objM.UserName, topupMsg.Sms_Content, '', '', 10, SponsorDetails[0].USERNAME);
            const DynamicEmailMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(objM.UserName, Sponsoremailmsg.Email_Content, '', '', 10, '', SponsorDetails[0].USERNAME);

            if (objM.Phone != null && objM.Phone !== '') {
              if (topupMsg.Sms_Send_Status === 1) {
                background(() => UtilityClass.SendSMSWithAPI(objM.Phone, DynamicSponsorMsg, ''));
              }
              if (Sponsoremailmsg.Email_Send_Status === 1) {
                const sd0 = SponsorDetails[0];
                background(() => UtilityClass.SendEmailByApiSetting(sd0.USERNAME, '', '', '', '', '', sd0.EMAILID, Sponsoremailmsg.Email_Subject, DynamicEmailMsg, null, '', ''));
              }
              if (msg.Sms_Send_Status === 1 && membersmsactive === 1) {
                background(() => UtilityClass.SendSMSWithAPI(objM.Phone, messg, ''));
              }
              if (emailmsg.Email_Send_Status === 1 && memberemailactive === 1) {
                background(() => UtilityClass.SendEmailByApiSetting(objM.UserName, '', '', '', '', '', objM.EmailID, emailmsg.Email_Subject, emailmessage, null, '', ''));
              }
              // EmailConfirmation thread body is commented out in legacy (SendConfirmationEmail)
            }
          }
        } catch (ExpObj) {
          // legacy swallowed the exception (var Message = ExpObj.Message)
        }
      }
    }
  } catch (ExpObj) {
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  res.json([{ status: 'true', message: 'success', data: ReturnOutput }]);
}));

module.exports = router;
