'use strict';
/**
 * Port of Controllers/WebPanelCntrl/PaymentController.cs (7 routed actions).
 * The non-routed public helpers of the legacy controller (PaymentSuccess, PaymentFailed, SaveData, ...) live in ./_payment/helpers.js
 * The legacy PaymentOption / GetAffiliateUserDetail / PaymentSuccess[HttpPost] actions were commented out in C# and are not ported.
 */
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { scalar, proc, procOne } = require('../db');
const { mapRow } = require('../utils/shape');
const { Encryptword } = require('../utils/crypto');
const config = require('../config');
const UtilityClass = require('../lib/UtilityClass');
const H = require('./_payment/helpers');

const router = express.Router();

const OnlinePaymentUserDetailsProps = ['ORDER_BV', 'ORDER_PV', 'ORDER_CASHBACK', 'USERNAME', 'NAME', 'PHONE', 'EMAILID', 'AMOUNT', 'JPPOINTS', 'SUCCESSURL', 'FAILUREURL', 'INPROCESSURL', 'CANCELLEDURL', 'COMPANYNAME', 'COMPANYLOGO', 'SHOPPINGWALLET', 'RESELLERWALLET', 'APIURL', 'SMSAPI', 'COMPANYPGMERCHANTKEY', 'COMPANYPGSALT', 'RazorPayDataKey', 'PMID', 'COMPNAYNAME', 'TRANSATIONPAYUMONEYRATE', 'TRANSATIONRAZORPAYRATE'];

const isNull = (v) => v === undefined || v === null;

/** Random.Next(min, max) */
const randNext = (min, max) => Math.floor(Math.random() * (max - min)) + min;

/** Fetches wallet info via POST {baseUrl}/api/MemberWallet and returns the parsed JObject */
const memberWallet = (baseUrl, memberId, walletId) =>
  H.walletApiPost(baseUrl, '/api/MemberWallet', H.resellerApi({ MemberID: memberId, WalletID: walletId }));

// auth
router.post('/api/SendVerificationMessage', auth, asyncHandler(async (req, res) => {
  const Mobile = req.p.Mobile;
  const Username = req.p.Username;
  if (isNull(Mobile)) throw new TypeError('Object reference not set to an instance of an object.');
  if (String(Mobile) !== '') {
    const vcode = String(randNext(1000, 9999));
    // legacy: SELECT FNAME FROM [db_affiliate].[DBO].MEMBER_MASTER WHERE USERNAME='...'
    const nameRow = await scalar('affiliate', 'select fname from member_master where username=@username limit 1', { username: isNull(Username) ? null : String(Username) });
    const Name = isNull(nameRow) ? '' : String(nameRow);
    const Msg = 'Dear ' + Name + ',Use this One Time Password ' + vcode + ' Verify your Mobile. Regards, CLUSTER LEVEL MARKETING';
    await UtilityClass.SendSMSWithAPI(Mobile, Msg, '1');
    await UtilityClass.GridNumbersPerPage();
    return res.json([{ status: 'true', message: 'success', data: Msg, OTP: vcode }]);
  }
  await UtilityClass.GridNumbersPerPage();
  return res.json([{ status: 'true', message: 'success', data: 'error' }]);
}));

// auth
router.post('/api/CheckOTPandReturn', auth, asyncHandler(async (req, res) => {
  const Vcode = req.p.Vcode;
  const Vno = req.p.Vno;
  let StatusReturn = '1';
  await UtilityClass.GridNumbersPerPage();
  // C# string != : null and "" are different strings
  if (Vno !== Vcode && !(isNull(Vno) && isNull(Vcode))) {
    StatusReturn = 'Wrong Verification Code';
    return res.json([{ status: 'true', message: 'success', data: StatusReturn }]);
  }
  return res.json([{ status: 'true', message: 'success', data: StatusReturn }]);
}));

// auth
router.post('/api/ConfirmWalletReturn', auth, asyncHandler(async (req, res) => {
  const { Vcode, Vno, ApiURL, USERNAME, Amount, Maximumuse } = req.p;
  const walletid = isNull(req.p.walletid) ? req.p.walletid : String(req.p.walletid);
  // Int64 regno is a required value-type parameter: Web API answers 404 when it cannot be bound
  if (isNull(req.p.regno) || !/^[+-]?\d+$/.test(String(req.p.regno).trim())) return res.sendStatus(404);
  await UtilityClass.GridNumbersPerPage();
  const responseData = [];
  let StatusReturn = '1';
  if (Vno !== Vcode && !(isNull(Vno) && isNull(Vcode))) {
    StatusReturn = 'Wrong Verification Code';
    responseData.push({ status: 'true', message: 'success', data: StatusReturn });
    return res.json(responseData);
  } else if (H.toDecimal(Amount) <= 0) {
    StatusReturn = 'Amount should be greater than 0';
    responseData.push({ status: 'true', message: 'success', data: StatusReturn + (isNull(Maximumuse) ? '' : Maximumuse) });
    return res.json(responseData);
  } else if (H.toDecimal(Amount) > H.toDecimal(Maximumuse)) {
    StatusReturn = 'You Can Use Maximum ' + (isNull(Maximumuse) ? '' : Maximumuse);
    responseData.push({ status: 'true', message: 'success', data: StatusReturn });
    return res.json(responseData);
  }

  let WalletBalance = '';
  const ObjProductDetails = await memberWallet(String(ApiURL), USERNAME, H.toInt(walletid));
  const Flag = H.jstr(ObjProductDetails, 'Flag');
  if (Flag === 'success') {
    const obj = H.detailsArr(ObjProductDetails);
    if (obj !== null) {
      WalletBalance = H.req(obj[0].MLMWALLET);
      if (WalletBalance !== '') {
        if (H.toDecimal(WalletBalance) < H.toDecimal(Amount)) {
          if (walletid !== '5') StatusReturn = 'You Have Insufficient Balance !';
          else StatusReturn = 'You Have Insufficient Voucher !';
          responseData.push({ status: 'true', message: 'success', data: StatusReturn });
          return res.json(responseData);
        }
      } else {
        responseData.push({ status: 'true', message: 'success', data: obj });
        return res.json(responseData);
      }
    }
  }

  responseData.push({ status: 'true', message: 'success', data: StatusReturn });
  return res.json(responseData);
}));

// auth
router.post('/api/OrderConfirm', auth, asyncHandler(async (req, res) => {
  let { RefrenceId, wproceed, cproceed, vproceed, eproceed } = req.p;
  const Walletid = isNull(req.p.Walletid) ? req.p.Walletid : String(req.p.Walletid);
  const Username = req.p.Username;
  let result = 'success';
  let Balance = '0';
  let MLMTRanID = '';
  let URLCON = '';
  if (wproceed === '') wproceed = '0';
  if (cproceed === '') cproceed = '0';
  if (vproceed === '') vproceed = '0';
  if (eproceed === '') eproceed = '0';
  const APIURL = 'https://api.clusteroffer.com';
  const BASEURL = H.companyRedirect();
  const failureurl = BASEURL + '/secure-order-payment/payment-failed';
  const Response = Encryptword(H.req(RefrenceId));
  const mlmwalletamount = H.toDecimal(wproceed) + H.toDecimal(cproceed) + H.toDecimal(eproceed);
  void mlmwalletamount;
  const tranid = H.tranIdNow();

  if (H.req(Username).trim() !== '' && H.toDecimal(wproceed) > 0 && (Walletid === '4' || Walletid === '1' || Walletid === '9')) {
    const url = APIURL;
    const ObjProductDetails = await memberWallet(url, Username, H.toInt(Walletid));
    let Flag = H.jstr(ObjProductDetails, 'Flag');
    let Message = H.jstr(ObjProductDetails, 'Message');
    if (Flag === 'success') {
      const obj = H.detailsArr(ObjProductDetails);
      if (obj !== null) {
        Balance = H.req(obj[0].MLMWALLET);
        if (H.toDecimal(Balance) < H.toDecimal(wproceed)) {
          result = 'You Have Insufficient Balance !';
          return res.json(result);
        }
        const dr = await H.walletApiPost(url, '/api/AmountTransaction', H.resellerApi({
          MemberID: Username, WalletID: H.toInt(Walletid), Amount: H.toDecimal(wproceed), Type: 'Dr', TransactionID: tranid,
        }));
        Flag = H.jstr(dr, 'Flag');
        Message = H.jstr(dr, 'Message');
        if (Flag === 'success') {
          const objDR = H.detailsArr(dr);
          if (objDR !== null) MLMTRanID = H.req(objDR[0].TransactionID);
        } else {
          return res.json(Message);
        }
      }
    } else {
      return res.json(Message);
    }
  }

  if (H.req(Username).trim() !== '' && H.toDecimal(vproceed) > 0 && Walletid === '5') {
    const url = APIURL;
    const ObjProductDetails = await memberWallet(url, Username, 5);
    let Flag = H.jstr(ObjProductDetails, 'Flag');
    let Message = H.jstr(ObjProductDetails, 'Message');
    if (Flag === 'success') {
      const obj = H.detailsArr(ObjProductDetails);
      if (obj !== null) {
        Balance = H.req(obj[0].MLMWALLET);
        if (H.toDecimal(Balance) < H.toDecimal(vproceed)) {
          result = 'You Have Insufficient Voucher !';
          return res.json(result);
        }
        // TransactionID = RefrenceId (we need OrderId in case of Voucher!)
        const dr = await H.walletApiPost(url, '/api/AmountTransaction', H.resellerApi({
          MemberID: Username, WalletID: 5, Amount: H.toDecimal(vproceed), Type: 'Dr', TransactionID: String(RefrenceId),
        }));
        Flag = H.jstr(dr, 'Flag');
        Message = H.jstr(dr, 'Message');
        if (Flag === 'success') {
          const objDR = H.detailsArr(dr);
          if (objDR !== null) MLMTRanID = H.req(objDR[0].TransactionID);
        } else {
          return res.json(Message);
        }
      }
    } else {
      return res.json(Message);
    }
  }

  const spRow = await procOne('shopping', 'usp_userresellerwallet', {
    ordernumber: String(RefrenceId), usedamount: H.toDecimal(cproceed), tranid,
    mlmwalletusedamount: H.toDecimal(wproceed), voucherqty: H.toDecimal(vproceed), walletid: H.toInt(Walletid),
    beni_username: Username, mlmtranid: MLMTRanID,
  });
  const Result = H.req(spRow && spRow.strresult);
  if (Result.toUpperCase() !== 'SUCCESS') {
    result = Result;
    URLCON = failureurl + '?refrenceid=' + Response;
  } else {
    URLCON = '';
  }

  if (!isNull(RefrenceId)) {
    await proc('shopping', 'usp_customerwalletsused_track', {
      transid: String(RefrenceId), mlmwalletused: H.toDecimal(wproceed), customerwalletused: H.toDecimal(cproceed),
      voucherused: H.toDecimal(vproceed), onlineamount: 0,
    });
  }

  const OrderAmount = await H.getOrderAmount(RefrenceId);
  const ActualOrderId = await H.getActualOrderId(RefrenceId);
  const TotalOffLineAmount = await H.getOfflinePaid(ActualOrderId, 500, true);
  const Token = H.makeToken(Username, RefrenceId, Response);

  const RemainAmount = (OrderAmount - TotalOffLineAmount) < 0 ? 0 : OrderAmount - TotalOffLineAmount;

  if (H.roundEven(RemainAmount) === 0) {
    await H.PaymentSuccess(Response, Token);
  } else {
    await H.PaymentFailed(Response);
  }

  return res.json([{ status: 'true', message: 'success', data: result, URL: URLCON }]);
}));

// auth
router.post('/api/GetMaxUserPer', auth, asyncHandler(async (req, res) => {
  const { PMID, walletid, username, APIURL } = req.p;
  let Balance = '0';
  const m = await scalar('shopping', 'select maxuseper from tbl_reseller_wallettype where pmid=@pmid and walletid=@walletid limit 1', { pmid: PMID, walletid });
  const MAXUSEPER = isNull(m) ? 0 : Number(m);
  const ObjProductDetails = await memberWallet(String(APIURL), username, H.toInt(walletid));
  const Flag = H.jstr(ObjProductDetails, 'Flag');
  const Message = H.jstr(ObjProductDetails, 'Message');
  if (Flag === 'success') {
    const obj = H.detailsArr(ObjProductDetails);
    if (obj !== null) Balance = H.req(obj[0].MLMWALLET);
  } else {
    return res.json('Error' + '^' + Message);
  }
  return res.json([{ status: 'true', message: 'success', MAXUSER: MAXUSEPER, data: Balance }]);
}));

// auth
router.post('/api/MakeOnlinePaymentRazorPay', auth, asyncHandler(async (req, res) => {
  const refrenceid = req.p.refrenceid;
  const username = req.p.username;
  // decimal? grosspayble (grossRaw keeps the textual scale, e.g. "100.00", as decimal.ToString() does)
  let grosspayble = null;
  let grossRaw = '';
  if (!isNull(req.p.grosspayble) && String(req.p.grosspayble).trim() !== '') {
    try { grosspayble = H.toDecimal(req.p.grosspayble); grossRaw = String(req.p.grosspayble).trim(); } catch (e) { grosspayble = null; }
  }
  let SuccessURLReturnParam = '';
  await UtilityClass.GridNumbersPerPage();
  const responseData = [];
  const source = 'Checkout';
  const BASEURL = H.companyRedirect();
  const successurl = BASEURL + '/secure-order-payment/payment-success';
  const failureurl = BASEURL + '/secure-order-payment/payment-failed';

  // source is the constant "Checkout" => legacy always took the MODE=2 branch (Recharge=4 / Reseller Package=5 branches were unreachable)
  const obj_li_OnlinePaymentUserDetails = mapRow(await procOne('shopping', 'usp_paymentgatewaymaster', {
    mode: '2', ordernumber: isNull(refrenceid) ? '' : String(refrenceid), source, successurl: '', failureurl: '', inprocessurl: '', canceledurl: '',
  }), OnlinePaymentUserDetailsProps);
  if (!isNull(refrenceid)) {
    await proc('shopping', 'usp_customerwalletsused_track', {
      transid: String(refrenceid), mlmwalletused: '0', customerwalletused: '0', voucherused: '0', onlineamount: grosspayble,
    });
  }

  // Random().ToString() is "System.Random"; DateTime.Now.ToString() is "M/d/yyyy h:mm:ss tt"
  const StrHash = H.Generatehash512('System.Random' + H.dateTimeNowString());
  const OrderId = StrHash.substring(0, 20);
  const Response = Encryptword(H.req(refrenceid));
  await H.Resellerwalletdeduction(grosspayble, source, refrenceid, failureurl, successurl, Response);

  const u = obj_li_OnlinePaymentUserDetails;
  if (!u) throw new TypeError('Object reference not set to an instance of an object.');
  let SaveLogResponse = await H.SaveData(H.req(u.NAME), '', H.req(u.PHONE), '', H.req(u.EMAILID), '', grossRaw, 'India', 'Remark', '', OrderId, '0', String(refrenceid));
  let list_SaveLogResponse = SaveLogResponse.split('^');

  if (list_SaveLogResponse[0] === 'AlreadyDone' || list_SaveLogResponse[0] === 'error' || list_SaveLogResponse[0] === 'updated') {
    return res.json('Pay With Other Payment Mode !');
  }

  if (list_SaveLogResponse[0] === 'inserted') {
    // ---- Get Token ----
    const OrderAmount = await H.getOrderAmount(refrenceid);
    const ActualOrderId = await H.getActualOrderId(refrenceid);
    const TotalOffLineAmount = await H.getOfflinePaid(ActualOrderId, 1000, false);
    const Amount = H.toDecimal(grosspayble);
    const OnlinePayments = Amount;
    const Token = H.makeToken(username, refrenceid, Response);

    if (OrderId !== null) {
      const Key = await H.tokenKey(refrenceid);
      try { H.decryptByPassphrase(Key, Token); } catch (e) { /* legacy: ignored */ }
      // legacy: if (Decryptword(DecryptedToken) != refrenceid) { /* redirect commented out */ }

      SaveLogResponse = await H.SaveData('', '', '', '', '', '', '', '', '', '', String(OrderId), '1', String(refrenceid));
      list_SaveLogResponse = SaveLogResponse.split('^');
      // legacy: outcome ignored (redirects commented out)
    }

    const RemainAmount = (OrderAmount - (TotalOffLineAmount + OnlinePayments)) < 0 ? 0 : (OrderAmount - (TotalOffLineAmount + OnlinePayments));

    if (H.roundEven(RemainAmount) === 0) {
      const cfg = config.app;
      SuccessURLReturnParam = H.req(cfg.PaymentGatewaySuccessURL) + '?orderId=' + OrderId + '&refrenceid=' + String(refrenceid) + '&Token=' + Token;
      const FailURLReturnParam = H.req(cfg.PaymentGatewayFailURL) + '?orderId=' + OrderId + '&refrenceid=' + String(refrenceid) + '&Token=' + Token;
      void SuccessURLReturnParam; void FailURLReturnParam;

      // ---- Create Order At Razor Pay Here ----
      try {
        let RazorPayPayableAmount = String(H.roundEven(Amount));
        RazorPayPayableAmount += '00';
        const amt = parseInt(RazorPayPayableAmount, 10);

        const parse = (text) => {
          const o = JSON.parse(text);
          if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Error reading JObject from JsonReader.');
          return o;
        };
        const hasError = (o) => Object.prototype.hasOwnProperty.call(o, 'error');

        let ObjResponseDetails = parse(await H.RazorCreateOrder(amt, String(refrenceid)));
        let Property = hasError(ObjResponseDetails);
        // legacy retries (up to 3 more with receipt=refrenceid, then one with receipt=source)
        for (let attempt = 0; attempt < 3; attempt++) {
          if (Property) {
            ObjResponseDetails = parse(await H.RazorCreateOrder(amt, String(refrenceid)));
          }
          Property = hasError(ObjResponseDetails);
        }
        if (Property) {
          ObjResponseDetails = parse(await H.RazorCreateOrder(amt, String(source)));
          Property = hasError(ObjResponseDetails);
        }

        if (H.roundEven(RemainAmount) === 0) {
          await H.PaymentSuccess(Response, Token);
        }

        responseData.push({ status: 'true', message: 'Success', data: 'Success' });
      } catch (e) {
        // legacy: empty catch (response stays an empty array)
      }
    }
  }

  return res.json(responseData);
}));

// auth
router.post('/api/CheckBalance', auth, asyncHandler(async (req, res) => {
  const result = 'Success';
  // PORT-NOTE: the legacy query was "... WHERE PMID IN =<pmid>" (invalid T-SQL) wrapped in an empty try/catch, so this
  // endpoint has always answered "Success". The intended check
  //   select coalesce(available_wallet,0) from tbl_distributor_prepaid_setting where pmid = @PMID  (balance < paybleamount => insufficient)
  // is intentionally NOT executed so the observable behaviour stays identical.
  return res.json(result);
}));

module.exports = router;
