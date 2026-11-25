'use strict';
/**
 * Port of Payment Gateway Controllers/HomeController.cs  (DB: Web.config initial catalog=Db_Shopping => 'shopping').
 * Explicit cross-database queries: [Db_Mlmkabila_Live].[DBO].TBL_MEMBER_KYC_DETAILS and [db_affiliate].[DBO].MEMBER_MASTER /
 * TBL_SMSACTION / USP_CHECKDYNMIC_MOBILEEMAILPAN => 'affiliate' (TBL_MEMBER_KYC_DETAILS only exists in the affiliate schema dump).
 *
 * C# members: Index, GetMaxUserPer, GetKYCSTATUS, GetAffiliateUserDetail, CheckBalance, SendVerificationMessage, GenerateOTP,
 * CheckOTPandReturn, ConfirmWalletReturn, OrderConfirm, About, Contact; model classes UserDetailsData, TBL_SMSACTION (property bags,
 * not ported as classes).
 *
 * Callers: Index is reached by the shopping portal redirecting the customer's browser (encrypted query string); every other
 * action is an AJAX call from the gateway page (Views/Home/index.cshtml). No action had a login/session check => all public.
 * ASP.NET Session values (RefrenceId, SuccessURL, Source, FailURL, Response, UserName, SMSAPI, APIURL, PMID, Mobilevcode,
 * SessionOTP) are kept in src/utils/sessionStore keyed by the gateway session token issued by Index (see _shared/gatewayCommon.js).
 */
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const G = require('./_shared/gateway-common');
const UC = require('../../lib/gateway/UtilityClass');

const UtilityClass = UC.UtilityClass || UC;
const DB = 'shopping';
const AFF = 'affiliate'; // explicit [db_affiliate] / [Db_Mlmkabila_Live] queries
const P = '/gateway/Home';
const { str, nn, toDec, toInt32, decStr, sget, sset, sendJson } = G;

/* =============================================================================================================== Index */
// public (shopping portal browser redirect; this action fills the gateway Session => issues the gateway session token)
// route-config: Default route "{controller}/{action}/{id}" defaults Home/Index => /gateway, /gateway/, /gateway/Home
router.all(['/gateway', '/gateway/', '/gateway/Home', `${P}/Index{/:id}`], optionalAuth, asyncHandler(async (req, res) => {
  const token = G.ensureGatewaySession(req);
  const ViewBag = {};
  let redirect = null;
  const { refrenceid, successurl, failureurl, inprocessurl, canceledurl, source, PMID, plid } = req.p;
  try {
    ViewBag.Plid = await UtilityClass.Decryptword(plid);
    ViewBag.RefrenceId = await UtilityClass.Decryptword(refrenceid);
    sset(req, 'RefrenceId', await UtilityClass.Decryptword(refrenceid));
    ViewBag.SuccessUrl = await UtilityClass.Decryptword(successurl);
    ViewBag.FailureUrl = await UtilityClass.Decryptword(failureurl);
    ViewBag.InprocessUrl = await UtilityClass.Decryptword(inprocessurl);
    ViewBag.CanceledUrl = await UtilityClass.Decryptword(canceledurl);
    ViewBag.Source = await UtilityClass.Decryptword(source);
    let TempPMID = 0;
    {
      const PMID11 = await UtilityClass.Decryptword(PMID); // Convert.ToString(PMID) - unused in legacy
      void PMID11;
      if (PMID !== '0') {
        // legacy: "SELECT PMID FROM TBL_DISTRIBUTOR WHERE DID=" + Decryptword(PMID) (concatenated; bound here, non-numeric => SQL error)
        const did = G.sqlNumberLiteral(await UtilityClass.Decryptword(PMID));
        const row = await db.queryOne(DB, 'select pmid from tbl_distributor where did = @did limit 1', { did });
        if (row && row.pmid === null) throw G.NRE(); // SqlQuery<Int32> cannot materialise NULL
        TempPMID = row ? Number(row.pmid) : 0;
      } else {
        TempPMID = toInt32(await UtilityClass.Decryptword(plid));
      }
    }
    void TempPMID; // ViewBag.PMID assignment is commented out in legacy
    ViewBag.RefrenceId_EN = nn(refrenceid);
    sset(req, 'SuccessURL', await UtilityClass.Decryptword(successurl));
    sset(req, 'Source', await UtilityClass.Decryptword(source));
    sset(req, 'FailURL', await UtilityClass.Decryptword(canceledurl)); // legacy: FailURL is the CANCELED url
    sset(req, 'Response', refrenceid);

    let obj = {}; // new OnlinePaymentUserDetails() (all properties null) when Source matches none of the branches
    const Mode = { Recharge: '4', 'Reseller Package': '5', 'Merchant Package': '5', 'Add Money': '2', Checkout: '2', EVoucher: '2' };
    if (Object.prototype.hasOwnProperty.call(Mode, ViewBag.Source)) {
      obj = await G.Usp_PaymentGatewayMaster(Mode[ViewBag.Source], str(ViewBag.RefrenceId), str(ViewBag.Source), str(ViewBag.SuccessUrl),
        str(ViewBag.FailureUrl), str(ViewBag.InprocessUrl), str(ViewBag.CanceledUrl));
    }
    if (obj === null) {
      redirect = '/invalid-attempt'; // Response.Redirect ends the request (ThreadAbortException passes through catch)
    } else {
      // (#region Create Order At Razor Pay Here is commented out in legacy)
      ViewBag.COMPANYLOGO = nn(obj.COMPANYLOGO);
      ViewBag.COMPANYNAME = nn(obj.COMPANYNAME);
      ViewBag.AMOUNT = nn(obj.AMOUNT);
      ViewBag.NAME = nn(obj.NAME);
      ViewBag.EMAILID = nn(obj.EMAILID);
      ViewBag.PHONE = nn(obj.PHONE);
      ViewBag.USERNAME = nn(obj.USERNAME);
      sset(req, 'UserName', ViewBag.USERNAME);
      ViewBag.APIURL = nn(obj.APIURL);
      ViewBag.SMSAPI = nn(obj.SMSAPI);
      sset(req, 'SMSAPI', nn(obj.SMSAPI));
      sset(req, 'APIURL', nn(obj.APIURL));
      sset(req, 'PMID', nn(obj.PMID));
      ViewBag.SHOPPINGWALLET = G.fixed2(nn(obj.SHOPPINGWALLET));
      // PORT-NOTE: legacy exposes the company PayU salt/merchant key to the view; kept for zero logic loss.
      ViewBag.COMPANYPGSALT = nn(obj.COMPANYPGSALT);
      ViewBag.COMPANYPGMERCHANTKEY = nn(obj.COMPANYPGMERCHANTKEY);
      ViewBag.PayURate = nn(obj.TRANSATIONPAYUMONEYRATE);
      ViewBag.RazorPayRate = nn(obj.TRANSATIONRAZORPAYRATE);
      ViewBag.ORDER_CASHBACK = nn(obj.ORDER_CASHBACK);
      ViewBag.ORDER_PV = nn(obj.ORDER_PV);
      ViewBag.ORDER_BV = nn(obj.ORDER_BV);
    }
  } catch (ex) {
    // legacy: catch (Exception ex) { } - swallowed, view rendered with whatever ViewBag holds
  }
  const extra = token ? { token } : {};
  if (redirect !== null) return res.json({ redirect, ...extra });
  // TempData written by PaymentOnline/MakeOnlinePaymentRazorPay is read by Views/Home/index.cshtml (read-once)
  const TempData = sget(req, 'TempData') || {};
  sset(req, 'TempData', null);
  return res.json({ view: '~/Views/Home/Index.cshtml', ViewBag, TempData, ...extra });
}));

/* ======================================================================================================= GetMaxUserPer */
// public (gateway page AJAX; reads Session["APIURL"])
router.post(`${P}/GetMaxUserPer{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { PMID, walletid, username } = req.p;
  let MAXUSEPER = '0';
  let Balance = '0';
  // legacy: "SELECT MAXUSEPER FROM TBL_RESELLER_WALLETTYPE WHERE PMID=" + PMID + " AND WALLETID=" + walletid (concatenated; bound here)
  const pm = G.sqlNumberLiteral(PMID);
  const wid = G.sqlNumberLiteral(walletid);
  const m = await db.scalar(DB, 'select maxuseper from tbl_reseller_wallettype where pmid = @pm and walletid = @wid limit 1', { pm, wid });
  if (m !== null) MAXUSEPER = String(m);
  const url = nn(sget(req, 'APIURL'));
  let StrPostData = G.serializeResellerApi({ MemberID: username, WalletID: toInt32(walletid) });
  StrPostData = await G.webPostJson(url + '/api/MemberWallet', StrPostData);
  const ObjProductDetails = G.jObjectParse(StrPostData);
  const Flag = G.jTok(ObjProductDetails, 'Flag');
  const Message = G.jTok(ObjProductDetails, 'Message');
  if (Flag === 'success') {
    const Details = G.jTok(ObjProductDetails, 'Details');
    if (Details !== '[]') {
      const obj = G.jArrayFrom(ObjProductDetails, 'Details');
      Balance = G.jTok(G.jAt(obj, 0), 'MLMWALLET');
    }
  } else {
    return sendJson(res, 'Error' + '^' + Message);
  }
  return sendJson(res, 'Success' + '^' + MAXUSEPER + '^' + Balance);
}));

/* ======================================================================================================== GetKYCSTATUS */
// public (gateway page AJAX; no session check in legacy)
router.post(`${P}/GetKYCSTATUS{/:id}`, asyncHandler(async (req, res) => {
  const regno = G.bindInt64(req.p.regno, 'regno', 'System.Web.Mvc.JsonResult GetKYCSTATUS(Int64)');
  // [Db_Mlmkabila_Live].[DBO].[TBL_MEMBER_KYC_DETAILS] => affiliate DB
  const v = await db.scalar(AFF, 'select coalesce(allstatus,0) as kycstatus from tbl_member_kyc_details where regno = @regno limit 1', { regno });
  const KYCSTATUS = v === null ? 0 : Number(v);
  return sendJson(res, KYCSTATUS);
}));

/* ============================================================================================== SendVerificationMessage */
// public JsonResult SendVerificationMessage(string Mobile, string SMSAPI, string Username) - also called internally
async function SendVerificationMessage(req, Mobile, SMSAPI, Username) {
  void SMSAPI; // only used by the commented-out UtilityClass.SendMsgOnMobile call
  if (nn(Mobile) !== '') {
    let Name = '';
    sset(req, 'Mobilevcode', null);
    const vcode = String(1000 + Math.floor(Math.random() * 8999)); // new Random().Next(1000, 9999)
    // legacy: "SELECT FNAME FROM [db_affiliate].[DBO].MEMBER_MASTER WHERE USERNAME='" + Username + "'" (concatenated; bound here)
    Name = await db.scalar(AFF, 'select fname from member_master where username = @u limit 1', { u: str(Username) });
    const Msg = 'Dear ' + str(Name) + ',Use this One Time Password ' + vcode + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING';
    sset(req, 'Mobilevcode', vcode);
    await UtilityClass.SendSMSWithAPI(Mobile, Msg, '1');
    return 'success';
  }
  return 'error';
}
// public (no verb attribute; no session check)
router.all(`${P}/SendVerificationMessage{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const r = await SendVerificationMessage(req, req.p.Mobile, req.p.SMSAPI, req.p.Username);
  return sendJson(res, r);
}));

/* ============================================================================================== GetAffiliateUserDetail */
// public (gateway page AJAX; reads Session["APIURL"], ["SMSAPI"], ["Mobilevcode"])
router.post(`${P}/GetAffiliateUserDetail{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { UserNamer } = req.p;
  let getmobile = '';
  let Balance = '';
  let Emailid = '';
  const url = nn(sget(req, 'APIURL'));
  let StrPostData = G.serializeResellerApi({ MemberID: UserNamer });
  StrPostData = await G.webPostJson(url + '/api/GetuserInformation', StrPostData);
  const ObjProductDetails = G.jObjectParse(StrPostData);
  const Flag = G.jTok(ObjProductDetails, 'Flag');
  const Message = G.jTok(ObjProductDetails, 'Message');
  if (Flag === 'success') {
    const Details = G.jTok(ObjProductDetails, 'Details');
    if (Details !== '[]') {
      const obj = G.jArrayFrom(ObjProductDetails, 'Details');
      getmobile = G.jTok(G.jAt(obj, 0), 'MobileNo');
      Balance = G.jTok(G.jAt(obj, 0), 'MLMWallet');
      Emailid = G.jTok(G.jAt(obj, 0), 'EmailID');
      if (getmobile !== '') {
        await SendVerificationMessage(req, getmobile, nn(sget(req, 'SMSAPI')), UserNamer);
        const Vno = nn(sget(req, 'Mobilevcode'));
        // PORT-NOTE: legacy returns the OTP (Vno) to the browser; kept for zero logic loss.
        return sendJson(res, Flag + '^' + getmobile + '^' + Balance + '^' + Emailid + '^' + Vno);
      }
      return sendJson(res, Message);
    }
  } else {
    return sendJson(res, Message);
  }
  return sendJson(res, '');
}));

/* ======================================================================================================== CheckBalance */
// public (gateway page AJAX)
router.post(`${P}/CheckBalance{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { PMID, paybleamount } = req.p;
  let balance = 0;
  let result = 'Success';
  try {
    if (PMID !== null && PMID !== undefined && PMID !== '') {
      result = 'Success';
      // PORT-NOTE: legacy SQL "SELECT ISNULL(AVAILABLE_WALLET,0) FROM TBL_DISTRIBUTOR_PREPAID_SETTING WHERE PMID IN =" + PMID
      // is invalid T-SQL ("IN =") so it ALWAYS threw and the empty catch returned "Success". Reproduced; the intended code is kept below.
      const LEGACY_SQL_IS_INVALID = true;
      if (LEGACY_SQL_IS_INVALID) throw new Error("Incorrect syntax near '='.");
      const v = await db.scalar(DB, 'select coalesce(available_wallet,0) from tbl_distributor_prepaid_setting where pmid = @pm limit 1', { pm: G.sqlNumberLiteral(PMID) });
      balance = v === null ? 0 : Number(v);
      if (balance < toDec(paybleamount)) {
        result = 'Insufficient Fund In Reseller Wallet !';
        result = result + '^' + str(sget(req, 'FailURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
      }
    }
  } catch (e) {
    // legacy: catch { }
  }
  return sendJson(res, result);
}));

/* ========================================================================================================= GenerateOTP */
// public (no verb attribute; gateway page AJAX; writes Session["SessionOTP"], ["Mobilevcode"])
router.all(`${P}/GenerateOTP{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { UserName, MobileNumber } = req.p;
  void UserName; // only used by commented-out legacy code
  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let returnmessage = 'OTP SENT';
  let OutResult = '';
  const OtpShowActive = '0';
  sset(req, 'SessionOTP', OTP);
  const ViewBag = { REGOTP: OTP }; void ViewBag;
  {
    // [db_affiliate].[DBO].[USP_CHECKDYNMIC_MOBILEEMAILPAN] @MODE,@MOBILE,@EMAIL,@PANNO,@RESULT OUT (result unused: check is commented out)
    const r = await db.procOne(AFF, 'usp_checkdynmic_mobileemailpan', { mode: 1, mobile: G.sp(MobileNumber, '@MOBILE'), email: '', panno: '' });
    OutResult = str(r && r.result);
    void OutResult;
    // SELECT Sms_Send_Status,Sms_Content from [db_affiliate].[DBO].TBL_SMSACTION (result unused)
    const msg = await db.query(AFF, 'select sms_send_status, sms_content from tbl_smsaction');
    void msg;
    sset(req, 'Mobilevcode', null);
    const Msg = 'Dear Customer,Your OTP is ' + OTP + '.Regards,CLUSTER LEVEL MARKETING';
    sset(req, 'Mobilevcode', OTP);
    if (OTP !== null) {
      // background System.Threading.Thread
      Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MobileNumber, Msg, '1')).catch((e) => console.error(e));
      returnmessage = 'OTP SENT';
    } else {
      returnmessage = 'Please Enable for Mobile Send Status';
    }
  }
  return sendJson(res, returnmessage + '^' + OtpShowActive);
}));

/* =================================================================================================== CheckOTPandReturn */
// public (gateway page AJAX; reads Session["Mobilevcode"])
router.post(`${P}/CheckOTPandReturn{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { Vcode } = req.p;
  let StatusReturn = '1';
  const Vno = nn(sget(req, 'Mobilevcode'));
  if (Vno !== (Vcode === undefined ? null : Vcode)) {
    StatusReturn = 'Wrong Verification Code';
    return sendJson(res, StatusReturn);
  }
  return sendJson(res, StatusReturn);
}));

/* ================================================================================================= ConfirmWalletReturn */
// public (gateway page AJAX; reads Session["Mobilevcode"])
router.post(`${P}/ConfirmWalletReturn{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const { Vcode, USERNAME, Amount, Maximumuse, walletid } = req.p;
  const regno = G.bindInt64(req.p.regno, 'regno', 'System.Web.Mvc.JsonResult ConfirmWalletReturn(System.String, System.String, System.String, System.String, System.String, System.String, Int64)');
  void regno; // only used by the commented-out KYC check
  let StatusReturn = '1';
  let ApiURL = req.p.ApiURL;
  ApiURL = nn(ApiURL).split('https').join('http');
  const Vno = nn(sget(req, 'Mobilevcode'));
  if (Vno !== (Vcode === undefined ? null : Vcode)) {
    StatusReturn = 'Wrong Verification Code';
    return sendJson(res, StatusReturn);
  } else if (toDec(Amount) <= 0) {
    StatusReturn = 'Amount should be greater than 0';
    return sendJson(res, StatusReturn + str(Maximumuse));
  } else if (toDec(Amount) > toDec(Maximumuse)) {
    StatusReturn = 'You Can Use Maximum ' + str(Maximumuse);
    return sendJson(res, StatusReturn);
  }
  let WalletBalance = '';
  // PORT-NOTE: ApiURL comes from the browser (legacy behaviour, server-side request to a client-supplied URL).
  let StrPostData = G.serializeResellerApi({ MemberID: USERNAME, WalletID: toInt32(walletid) });
  StrPostData = await G.webPostJson(ApiURL + '/api/MemberWallet', StrPostData);
  const ObjProductDetails = G.jObjectParse(StrPostData);
  const Flag = G.jTok(ObjProductDetails, 'Flag');
  if (Flag === 'success') {
    const Details = G.jTok(ObjProductDetails, 'Details');
    if (Details !== '[]') {
      const obj = G.jArrayFrom(ObjProductDetails, 'Details');
      WalletBalance = G.jTok(G.jAt(obj, 0), 'MLMWALLET');
      if (WalletBalance !== '') {
        if (toDec(WalletBalance) < toDec(Amount)) {
          if (walletid !== '5') {
            StatusReturn = 'You Have Insufficient Balance !';
          } else {
            StatusReturn = 'You Have Insufficient Voucher !';
          }
          return sendJson(res, StatusReturn);
        }
        return sendJson(res, StatusReturn);
      }
      // return Json(obj) - JArray through JavaScriptSerializer (scalar JValues serialise as [])
      return sendJson(res, G.jssJToken(obj));
    }
  }
  return sendJson(res, StatusReturn);
}));

/* ======================================================================================================== OrderConfirm */
/** MemberWallet balance check + AmountTransaction "Dr" call (blocks 1 and 2 of OrderConfirm). Returns { ret } to return Json(ret), else { MLMTRanID }. */
async function walletDebit(url, Username, WalletID, amountRaw, insufficientMsg, TransactionID, MLMTRanID) {
  let StrPostData = G.serializeResellerApi({ MemberID: Username, WalletID });
  StrPostData = await G.webPostJson(url + '/api/MemberWallet', StrPostData);
  const ObjProductDetails = G.jObjectParse(StrPostData);
  let Flag = G.jTok(ObjProductDetails, 'Flag');
  let Message = G.jTok(ObjProductDetails, 'Message');
  if (Flag === 'success') {
    let Details = G.jTok(ObjProductDetails, 'Details');
    if (Details !== '[]') {
      const obj = G.jArrayFrom(ObjProductDetails, 'Details');
      const Balance = G.jTok(G.jAt(obj, 0), 'MLMWALLET');
      if (toDec(Balance) < toDec(amountRaw)) {
        return { ret: insufficientMsg };
      }
      let stringDATA = G.serializeResellerApi({ MemberID: Username, WalletID, Amount: decStr(amountRaw), Type: 'Dr', TransactionID });
      stringDATA = await G.webPostJson(url + '/api/AmountTransaction', stringDATA);
      const ObjProductDetails_DR = G.jObjectParse(stringDATA);
      Flag = G.jTok(ObjProductDetails_DR, 'Flag');
      Message = G.jTok(ObjProductDetails_DR, 'Message');
      if (Flag === 'success') {
        Details = G.jTok(ObjProductDetails_DR, 'Details');
        if (Details !== '[]') {
          const obj_DR = G.jArrayFrom(ObjProductDetails_DR, 'Details');
          MLMTRanID = G.jTok(G.jAt(obj_DR, 0), 'TransactionID');
        }
      } else {
        return { ret: Message };
      }
    }
  } else {
    return { ret: Message };
  }
  return { MLMTRanID };
}

// public (gateway page AJAX; reads Session["APIURL"], ["RefrenceId"], ["FailURL"], ["Response"], ["UserName"], ["SuccessURL"])
router.post(`${P}/OrderConfirm{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  let { wproceed, cproceed, vproceed, eproceed } = req.p;
  const { Username, Walletid } = req.p;
  let result = 'success';
  let MLMTRanID = '';
  let URLCON = '';
  if (wproceed === '') wproceed = '0';
  if (cproceed === '') cproceed = '0';
  if (vproceed === '') vproceed = '0';
  if (eproceed === '') eproceed = '0';

  const mlmwalletamount = toDec(wproceed) + toDec(cproceed) + toDec(eproceed); // unused in legacy
  void mlmwalletamount;
  const tranid = G.tranIdNow();

  if (nn(Username).trim() !== '' && toDec(wproceed) > 0 && (Walletid === '4' || Walletid === '1' || Walletid === '9')) {
    const url = nn(sget(req, 'APIURL'));
    const r = await walletDebit(url, Username, toInt32(Walletid), wproceed, 'You Have Insufficient Balance !', tranid, MLMTRanID);
    if (r.ret !== undefined) return sendJson(res, r.ret);
    MLMTRanID = r.MLMTRanID;
  }

  if (nn(Username).trim() !== '' && toDec(vproceed) > 0 && Walletid === '5') {
    const url = nn(sget(req, 'APIURL'));
    // TransactionID = Session["RefrenceId"] (legacy comment: "we need OrderId In Case of Voucher")
    const r = await walletDebit(url, Username, 5, vproceed, 'You Have Insufficient Voucher !', nn(sget(req, 'RefrenceId')), MLMTRanID);
    if (r.ret !== undefined) return sendJson(res, r.ret);
    MLMTRanID = r.MLMTRanID;
  }
  // (Recharge-specific USP_USERRESELLERWALLET_RECHARGE branch is commented out in legacy)

  {
    // [DBO].[USP_USERRESELLERWALLET] @ORDERNUMBER,@USEDAMOUNT,@TRANID,@MLMWALLETUSEDAMOUNT,@VOUCHERQTY,@WALLETID,@BENI_USERNAME,@MLMTRanID,@STRRESULT Out
    const r = await db.procOne(DB, 'usp_userresellerwallet', {
      ordernumber: nn(sget(req, 'RefrenceId')), usedamount: decStr(cproceed), tranid, mlmwalletusedamount: decStr(wproceed),
      voucherqty: decStr(vproceed), walletid: toInt32(Walletid), beni_username: G.sp(Username, '@BENI_USERNAME'), mlmtranid: MLMTRanID,
    });
    const Result = str(r && r.strresult);
    if (Result.toUpperCase() !== 'SUCCESS') {
      result = Result;
      URLCON = str(sget(req, 'FailURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
    } else {
      URLCON = '';
    }
  }
  if (sget(req, 'RefrenceId') !== null) {
    await G.USP_CUSTOMERWALLETSUSED_TRACK(nn(sget(req, 'RefrenceId')), decStr(wproceed), decStr(cproceed), decStr(vproceed), '0');
  }
  let URLForRedirect = '';
  let RemainAmount = 0;
  const OrderAmount = await G.getOrderAmount(str(sget(req, 'RefrenceId')));
  const ActualOrderId = await G.getActualOrderId(str(sget(req, 'RefrenceId')));
  // ... +CODPAYMENT +(VOUCHERWALLETUSED*500)
  const TotalOffLineAmount = await G.getPaidAmount(ActualOrderId, 500, true);
  const Token = G.makeToken(req);

  RemainAmount = (OrderAmount - TotalOffLineAmount) < 0 ? 0 : OrderAmount - TotalOffLineAmount;
  if (G.bankers(RemainAmount) === 0) {
    URLForRedirect = str(sget(req, 'SuccessURL')) + '?refrenceid=' + nn(sget(req, 'Response')) + '&Token=' + Token;
    URLCON = URLForRedirect;
  }
  return sendJson(res, result + '^' + URLCON);
}));

/* ======================================================================================================= About / Contact */
// public
router.all(`${P}/About{/:id}`, asyncHandler(async (req, res) => {
  const ViewBag = { Message: 'Your application description page.' };
  return res.json({ view: '~/Views/Home/About.cshtml', ViewBag });
}));

// public
router.all(`${P}/Contact{/:id}`, asyncHandler(async (req, res) => {
  const ViewBag = { Message: 'Your contact page.' };
  return res.json({ view: '~/Views/Home/Contact.cshtml', ViewBag });
}));

module.exports = router;
