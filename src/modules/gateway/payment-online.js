'use strict';
/**
 * Port of Payment Gateway Controllers/PaymentOnlineController.cs  (DB: Web.config initial catalog=Db_Shopping => 'shopping').
 *
 * C# members: Index, MakeOnlinePayment, MakeOnlinePaymentRazorPay, Sha512 (private static), Resellerwalletdeduction (public void),
 * PaymentSuccess, PaymentCancel, PaymentFailure, PaymentInprocess, ProceedToPayment (public void), RemotePost (nested class),
 * Generatehash512 (public string), SaveData (public string), GetMaxUserPer. Model classes ProcessResult, OnlinePaymentModeList,
 * OnlinePaymentUserDetails, _MakePayment, GetWallets, ResellerApi are property bags (not ported as classes).
 *
 * Callers:
 *  - Index: shopping portal browser redirect (friendly URL /gateway/secure-payment-gateway).
 *  - MakeOnlinePayment (form post) / MakeOnlinePaymentRazorPay (AJAX) / GetMaxUserPer: the gateway page (Views/Home/index.cshtml),
 *    session-based (Session values filled by Home/Index, OTP from Home/GenerateOTP).
 *  - PaymentSuccess / PaymentFailure / PaymentCancel / PaymentInprocess: PayU browser callbacks (surl/furl built in
 *    ProceedToPayment / MakeOnlinePaymentRazorPay with ?orderId=&refrenceid=&Token=) => public, no session.
 * Response.Redirect(...) => res.json({ redirect }) (porting guide), RemotePost.Post() => auto-submit HTML form.
 */
const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const G = require('./_shared/gateway-common');
const UC = require('../../lib/gateway/UtilityClass');
const RC = require('../../lib/gateway/RazorCoreAPI');

const UtilityClass = UC.UtilityClass || UC;
const RazorCoreAPI = RC.RazorCoreAPI || RC;
const DB = 'shopping';
const P = '/gateway/PaymentOnline';
const STORES = 'http://stores.clusteroffers.com'; // hard-coded legacy redirect target
const { str, nn, sget, sset, sendJson, decStr, toDec } = G;

/** AppSettings["X"].ToString() (missing key => NRE in legacy; '' here per porting rules) */
const appSetting = (k) => String((config.app && config.app[k]) || '');

/** Session["Source"]-dependent Usp_PaymentGatewayMaster call used by MakeOnlinePayment / MakeOnlinePaymentRazorPay */
async function getDetailsBySessionSource(req) {
  const Source = sget(req, 'Source');
  let Mode = '2';
  if (Source !== null && String(Source) === 'Recharge') Mode = '4';
  else if (Source !== null && String(Source) === 'Reseller Package') Mode = '5';
  return G.Usp_PaymentGatewayMaster(Mode, str(sget(req, 'RefrenceId')), str(Source), '', '', '', '');
}

/* ================================================================================================================ SaveData */
/**
 * public string SaveData(Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, ReferenceId)
 * [DBO].[USP_PAYMENTMANAGEMENT_PAYMENT_GATEWAY] ... @STRRESULT OUT,@SUCCESSURL OUT,@FAILUREURL OUT,@INPROCESSURL OUT,@CANCELEDURL OUT
 * PaymentStatus: 0 user returned from page, 1 done, 2 failure, 3 cancel, 4 in process.
 */
async function SaveData(Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, ReferenceId) {
  try {
    const args = { name: Name, address: Address, contactno: ContactNo, cityname: CityName, emailid: EmailId, state: State, amount: Amount,
      country: Country, remark: Remark, pincode: Pincode, orderid: OrderId, paymentstatus: PaymentStatus, referenceid: ReferenceId };
    for (const k of Object.keys(args)) G.sp(args[k], '@' + k.toUpperCase()); // null SqlParameter value => "not supplied" => catch
    const r = await db.procOne(DB, 'usp_paymentmanagement_payment_gateway', args);
    const o = r || {};
    return '' + str(o.strresult) + '^' + str(o.successurl) + '^' + str(o.failureurl) + '^' + str(o.inprocessurl) + '^' + str(o.canceledurl) + '';
  } catch (e) {
    return 'error^/page-not-found^/page-not-found^/page-not-found^/page-not-found';
  }
}

/* ================================================================================================= Resellerwalletdeduction */
/** public void Resellerwalletdeduction(decimal? grosspayble); grosspayble = canonical decimal string or null */
async function Resellerwalletdeduction(req, grosspayble) {
  let result = '';
  let URLCON = '';
  const tranid = G.tranIdNow();
  const Source = sget(req, 'Source');
  if (Source !== null && String(Source) === 'Recharge') {
    // [DBO].[USP_USERRESELLERWALLET_RECHARGE] @ORDERNUMBER,@USEDAMOUNT,@TRANID,@MLMWALLETUSEDAMOUNT,@WALLETID,@BENI_USERNAME,@MLMTRanID,@STRRESULT Out,@ONLINEPAYMENT
    const r = await db.procOne(DB, 'usp_userresellerwallet_recharge', {
      ordernumber: nn(sget(req, 'RefrenceId')), usedamount: 0, tranid, mlmwalletusedamount: 0, walletid: 0, beni_username: '', mlmtranid: '',
      onlinepayment: G.sp(grosspayble, '@ONLINEPAYMENT'),
    });
    const Result = str(r && r.strresult);
    if (Result.toUpperCase() !== 'SUCCESS') {
      result = 'rechargefailed';
      URLCON = str(sget(req, 'FailURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
    } else {
      result = 'rechargesuccess';
      URLCON = str(sget(req, 'SuccessURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
    }
  } else {
    // [DBO].[USP_USERRESELLERWALLET] @ORDERNUMBER,@USEDAMOUNT,@TRANID,@MLMWALLETUSEDAMOUNT,@VOUCHERQTY,@WALLETID,@BENI_USERNAME,@MLMTRanID,@STRRESULT Out,@ONLINEPAYMENT
    const r = await db.procOne(DB, 'usp_userresellerwallet', {
      ordernumber: nn(sget(req, 'RefrenceId')), usedamount: 0, tranid, mlmwalletusedamount: 0, voucherqty: 0, walletid: 0, beni_username: '',
      mlmtranid: '', onlinepayment: G.sp(grosspayble, '@ONLINEPAYMENT'),
    });
    const Result = str(r && r.strresult);
    if (Result.toUpperCase() !== 'SUCCESS') {
      result = Result;
      URLCON = str(sget(req, 'FailURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
    } else {
      URLCON = str(sget(req, 'SuccessURL')) + '?refrenceid=' + nn(sget(req, 'Response'));
    }
  }
  void result; void URLCON; // computed but unused in legacy
}

/* ======================================================================================================== ProceedToPayment */
/**
 * public void ProceedToPayment(UserName, Amount, ProductInfo, Email, Phone, OrderId, RefrenceId, Key, Salt, SuccessURL, FailURL)
 * Returns true when the PayU auto-submit form was written (Response.End), false otherwise.
 */
async function ProceedToPayment(req, res, UserName, Amount, ProductInfo, Email, Phone, OrderId, RefrenceId, Key, Salt, SuccessURL, FailURL) {
  // #region Get Token
  let RemainAmount = 0;
  const OrderAmount = await G.getOrderAmount(str(sget(req, 'RefrenceId')));
  const ActualOrderId = await G.getActualOrderId(str(sget(req, 'RefrenceId')));
  // ... +(VOUCHERWALLETUSED*1000), no CODPAYMENT
  const TotalOffLineAmount = await G.getPaidAmount(ActualOrderId, 1000, false);
  const OnlinePayments = toDec(Amount);
  const Token = G.makeToken(req);
  RemainAmount = (OrderAmount - (TotalOffLineAmount + OnlinePayments)) < 0 ? 0 : (OrderAmount - (TotalOffLineAmount + OnlinePayments));
  if (G.bankers(RemainAmount) === 0) {
    const MyRemotePost = new G.RemotePost();
    // Key/Salt are the company PayU credentials passed in (AppSettings MERCHANT_KEY/SALT lines are commented out in legacy)
    MyRemotePost.Url = appSetting('PAYU_URL');
    MyRemotePost.Add('key', Key);
    const TxnId = OrderId;
    MyRemotePost.Add('txnid', TxnId);
    MyRemotePost.Add('amount', Amount);
    MyRemotePost.Add('productinfo', ProductInfo);
    MyRemotePost.Add('firstname', UserName);
    MyRemotePost.Add('phone', Phone);
    MyRemotePost.Add('email', Email);
    // For Local Host
    MyRemotePost.Add('surl', '' + str(SuccessURL) + '?orderId=' + str(OrderId) + '&refrenceid=' + str(RefrenceId) + '&Token=' + Token);
    MyRemotePost.Add('furl', '' + str(FailURL) + '?orderId=' + str(OrderId) + '&refrenceid=' + str(RefrenceId) + '&Token=' + Token);
    MyRemotePost.Add('service_provider', 'payu_paisa');
    // PayU request hash: key|txnid|amount|productinfo|firstname|email|udf1..udf5 (empty)|||||salt
    const hashString = str(Key) + '|' + str(TxnId) + '|' + str(Amount) + '|' + str(ProductInfo) + '|' + str(UserName) + '|' + str(Email) + '|||||||||||' + str(Salt);
    const hash = G.Generatehash512(hashString);
    MyRemotePost.Add('hash', hash);
    MyRemotePost.Post(res);
    return true;
  }
  // #endregion Get Token
  return false;
}

/* =================================================================================================================== Index */
// public (shopping portal browser redirect)
// route-config: secure-payment-gateway => PaymentOnline/Index ; Default route => /gateway/PaymentOnline
router.all(['/gateway/secure-payment-gateway', '/gateway/PaymentOnline', `${P}/Index{/:id}`], optionalAuth, asyncHandler(async (req, res) => {
  const token = G.ensureGatewaySession(req);
  void token;
  const { refrenceid, successurl, failureurl, inprocessurl, canceledurl, source, PMID } = req.p;
  const ViewBag = {};
  ViewBag.RefrenceId = await UtilityClass.Decryptword(refrenceid);
  sset(req, 'RefrenceId', await UtilityClass.Decryptword(refrenceid));
  ViewBag.SuccessUrl = await UtilityClass.Decryptword(successurl);
  ViewBag.FailureUrl = await UtilityClass.Decryptword(failureurl);
  ViewBag.InprocessUrl = await UtilityClass.Decryptword(inprocessurl);
  ViewBag.CanceledUrl = await UtilityClass.Decryptword(canceledurl);
  ViewBag.Source = await UtilityClass.Decryptword(source);

  // legacy: Int32 RealPMID = ViewBag.PMID = UtilityClass.Decryptword(Convert.ToString(PMID));
  // PORT-NOTE: the dynamic assignment yields a string and the implicit dynamic string->Int32 conversion throws
  // RuntimeBinderException at run time, so the legacy action ALWAYS failed here (HTTP 500) after Session["RefrenceId"]
  // was stored and before Session["Source"]. Reproduced as-is.
  ViewBag.PMID = await UtilityClass.Decryptword(PMID);
  const RealPMID = (() => { throw new Error("Cannot implicitly convert type 'string' to 'int'"); })();
  void RealPMID;
  sset(req, 'Source', await UtilityClass.Decryptword(source));
  return res.json({ view: '~/Views/PaymentOnline/Index.cshtml', ViewBag, ...(token ? { token } : {}) });
}));

/* ======================================================================================================= MakeOnlinePayment */
// public (gateway page form post; session-based: Mobilevcode, RefrenceId, Source, UserName, Response, FailURL, SuccessURL; writes OrderId)
router.post(`${P}/MakeOnlinePayment{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  // _MakePayment u (Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode) - bound but unused
  const grosspayble = G.bindNullableDecimal(req.p.grosspayble);
  const hdnMLMWalletAmount = G.bindNullableDecimal(req.p.hdnMLMWalletAmount); void hdnMLMWalletAmount;
  const hdnCustomerWalletAmount = G.bindNullableDecimal(req.p.hdnCustomerWalletAmount); void hdnCustomerWalletAmount;
  const onlinepaymentotp = req.p.onlinepaymentotp === undefined ? null : req.p.onlinepaymentotp;
  let paybleUMONEYAMOUNT = 0;
  if (grosspayble !== null) paybleUMONEYAMOUNT = Number(grosspayble);
  void paybleUMONEYAMOUNT;
  const Vno = nn(sget(req, 'Mobilevcode'));
  if (Vno !== onlinepaymentotp) {
    return res.json({ redirect: '/invalid-attempt' });
  }

  // #region For Get Details
  const OrderAmount = await G.getOrderAmount(str(sget(req, 'RefrenceId'))); void OrderAmount;
  const ActualOrderId = await G.getActualOrderId(str(sget(req, 'RefrenceId')));
  // ... +(VOUCHERWALLETUSED*500), no CODPAYMENT (result unused in legacy)
  const TotalPaidAmount = await G.getPaidAmount(ActualOrderId, 500, false); void TotalPaidAmount;
  const obj = await getDetailsBySessionSource(req);
  if (sget(req, 'RefrenceId') !== null) {
    await G.USP_CUSTOMERWALLETSUSED_TRACK(nn(sget(req, 'RefrenceId')), '0', '0', '0', grosspayble);
  }
  if (obj === null) {
    return res.json({ redirect: '/invalid-attempt' });
  }
  // #endregion For Get Details

  const OrderId = G.newOrderId();
  sset(req, 'OrderId', OrderId);

  await Resellerwalletdeduction(req, grosspayble);

  const SaveLogResponse = await SaveData(nn(obj.NAME), '', nn(obj.PHONE), '', nn(obj.EMAILID), '', str(grosspayble), 'India', 'Remark', '', OrderId, '0', nn(sget(req, 'RefrenceId')));
  const list_SaveLogResponse = SaveLogResponse.split('^');
  if (list_SaveLogResponse[0] === 'AlreadyDone' || list_SaveLogResponse[0] === 'error' || list_SaveLogResponse[0] === 'updated') {
    return res.json({ redirect: STORES });
  }
  if (list_SaveLogResponse[0] === 'inserted') {
    const posted = await ProceedToPayment(req, res, nn(obj.NAME), str(grosspayble), 'OnlinePayment', nn(obj.EMAILID), nn(obj.PHONE), OrderId,
      nn(sget(req, 'RefrenceId')), nn(obj.COMPANYPGMERCHANTKEY), nn(obj.COMPANYPGSALT), appSetting('PaymentGatewaySuccessURL'), appSetting('PaymentGatewayFailURL'));
    if (posted) return undefined;
  }
  // PORT-NOTE: legacy "return View()" -> Views/PaymentOnline/MakeOnlinePayment.cshtml, which does not exist in the legacy project.
  return res.json({ view: '~/Views/PaymentOnline/MakeOnlinePayment.cshtml' });
}));

/* =============================================================================================== MakeOnlinePaymentRazorPay */
// public (gateway page AJAX; session-based; writes Session OrderId/APIResponse and TempData read by Home/Index)
router.post(`${P}/MakeOnlinePaymentRazorPay{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const grosspayble = G.bindNullableDecimal(req.p.grosspayble);
  const onlinepaymentotp = req.p.onlinepaymentotp === undefined ? null : req.p.onlinepaymentotp;
  let SuccessURLReturnParam = '';
  const Vno = nn(sget(req, 'Mobilevcode'));
  if (Vno !== onlinepaymentotp) {
    return res.json({ redirect: '/invalid-attempt' });
  }

  // #region For Get Details
  const obj = await getDetailsBySessionSource(req);
  if (sget(req, 'RefrenceId') !== null) {
    await G.USP_CUSTOMERWALLETSUSED_TRACK(nn(sget(req, 'RefrenceId')), '0', '0', '0', grosspayble);
  }
  if (obj === null) {
    return res.json({ redirect: '/invalid-attempt' });
  }
  // #endregion For Get Details

  const OrderId = G.newOrderId();
  sset(req, 'OrderId', OrderId);

  await Resellerwalletdeduction(req, grosspayble);

  const SaveLogResponse = await SaveData(nn(obj.NAME), '', nn(obj.PHONE), '', nn(obj.EMAILID), '', str(grosspayble), 'India', 'Remark', '', OrderId, '0', nn(sget(req, 'RefrenceId')));
  const list_SaveLogResponse = SaveLogResponse.split('^');
  if (list_SaveLogResponse[0] === 'AlreadyDone' || list_SaveLogResponse[0] === 'error' || list_SaveLogResponse[0] === 'updated') {
    return sendJson(res, 'Pay With Other Payment Mode !');
  }

  const TempData = {};
  const ViewBag = {};
  if (list_SaveLogResponse[0] === 'inserted') {
    // #region Get Token
    let RemainAmount = 0;
    const OrderAmount = await G.getOrderAmount(str(sget(req, 'RefrenceId')));
    const ActualOrderId = await G.getActualOrderId(str(sget(req, 'RefrenceId')));
    // ... +(VOUCHERWALLETUSED*1000), no CODPAYMENT
    const TotalOffLineAmount = await G.getPaidAmount(ActualOrderId, 1000, false);
    const Amount = toDec(grosspayble); // Convert.ToDecimal(decimal?) - null => 0
    const OnlinePayments = Amount;
    const Token = G.makeToken(req);
    RemainAmount = (OrderAmount - (TotalOffLineAmount + OnlinePayments)) < 0 ? 0 : (OrderAmount - (TotalOffLineAmount + OnlinePayments));

    if (G.bankers(RemainAmount) === 0) {
      SuccessURLReturnParam = appSetting('PaymentGatewaySuccessURL') + '?orderId=' + OrderId + '&refrenceid=' + nn(sget(req, 'RefrenceId')) + '&Token=' + Token;
      const FailURLReturnParam = appSetting('PaymentGatewayFailURL') + '?orderId=' + OrderId + '&refrenceid=' + nn(sget(req, 'RefrenceId')) + '&Token=' + Token;

      // #region Create Order At Razor Pay Here
      const failTempData = () => {
        TempData.DataKey = nn(obj.RazorPayDataKey);
        TempData.OrderId = '';
        TempData.OrderAmount = '0';
        TempData.Name = '';
        TempData.Email = '';
        TempData.Contact = '';
        TempData.PostUrl = FailURLReturnParam;
      };
      let caught = false;
      try {
        // Convert.ToString(Convert.ToInt32(Amount)) + "00"  (amount in paise)
        let RazorPayPayableAmount = String(G.bankers(Amount));
        RazorPayPayableAmount = RazorPayPayableAmount + '00';
        const createOrder = async () => String(await RazorCoreAPI.CreateOrder(G.toInt32(RazorPayPayableAmount), str(sget(req, 'RefrenceId'))));

        const APIResponse = await createOrder();
        sset(req, 'APIResponse', APIResponse);
        ViewBag.APIResponse = APIResponse;
        let ObjResponseDetails = G.jObjectParse(APIResponse);
        let hasError = Object.prototype.hasOwnProperty.call(ObjResponseDetails, 'error'); // JObject.Property("error") != null
        // legacy retries CreateOrder up to 4 more times while the response carries an "error" property
        for (let attempt = 0; attempt < 4; attempt++) {
          if (hasError) {
            const APIResponsNew = await createOrder();
            sset(req, 'APIResponse', APIResponsNew);
            ViewBag.APIResponse = APIResponsNew;
            ObjResponseDetails = G.jObjectParse(APIResponsNew);
            hasError = Object.prototype.hasOwnProperty.call(ObjResponseDetails, 'error');
          }
        }

        if (!hasError) {
          TempData.DataFlag = 1;
          TempData.HideAll = 1;
          TempData.DataKey = nn(obj.RazorPayDataKey);
          TempData.payUkey = nn(obj.PAYU_DATAKEY);
          TempData.saltKey = nn(obj.PAYU_SALTKEY);
          TempData.OrderId = G.jTok(ObjResponseDetails, 'id');
          TempData.OrderAmount = G.fixed2(toDec(RazorPayPayableAmount)); // ToString("f2")
          TempData.Name = nn(obj.NAME);
          TempData.Email = nn(obj.EMAILID);
          TempData.Contact = nn(obj.PHONE);
          TempData.PostUrl = SuccessURLReturnParam;
          TempData.surl = SuccessURLReturnParam;
          TempData.furl = FailURLReturnParam;

          // PayU hash for the view's payuForm: PAYU_DATAKEY|<razorpay order id>|<paise amount "F2">|shirt|NAME|EMAILID|||||||||||PAYU_SALTKEY
          // PORT-NOTE: legacy quirks kept - txnid is the Razorpay order id, amount is the PAISE value (x100) formatted F2,
          // productinfo is the literal "shirt"; NAME is not trimmed, key/id/email/salt are.
          const hashString = nn(obj.PAYU_DATAKEY).trim() + '|' + G.jTok(ObjResponseDetails, 'id').trim() + '|' + G.fixed2(toDec(RazorPayPayableAmount)) + '|'
            + 'shirt' + '|' + nn(obj.NAME) + '|' + nn(obj.EMAILID).trim() + '|||||||||||' + nn(obj.PAYU_SALTKEY).trim();
          const hash = G.Sha512(hashString);
          TempData.hash = hash;
        } else {
          failTempData();
        }
      } catch (e) {
        caught = true;
      }
      if (caught) failTempData(); // legacy catch block (an NRE inside it propagates => 500)
      // #endregion Create Order At Razor Pay Here
    }
    // #endregion Get Token
  }
  // TempData survives to the next request (Views/Home/index.cshtml) => stored in the gateway session for Home/Index
  if (Object.keys(TempData).length) sset(req, 'TempData', TempData);
  return sendJson(res, SuccessURLReturnParam);
}));

/* ========================================================================================== PayU callbacks (surl / furl) */
/** Shared body of PaymentCancel / PaymentFailure / PaymentInprocess: SaveData(status) then redirect to the url at partIndex */
async function statusCallback(req, res, PaymentStatus, partIndex, view) {
  const { OrderId, RefrenceId, Token } = req.p;
  if (OrderId !== undefined && OrderId !== null) {
    const SaveLogResponse = await SaveData('', '', '', '', '', '', '', '', '', '', str(OrderId), PaymentStatus, str(RefrenceId));
    const list_SaveLogResponse = SaveLogResponse.split('^');
    if (list_SaveLogResponse[0] === 'AlreadyDone' || list_SaveLogResponse[0] === 'error' || list_SaveLogResponse[0] === 'inserted') {
      return res.json({ redirect: STORES });
    }
    if (list_SaveLogResponse[0] === 'updated') {
      if (list_SaveLogResponse[partIndex] === undefined) throw new RangeError('Index was outside the bounds of the array.');
      return res.json({ redirect: list_SaveLogResponse[partIndex] + '?refrenceid=' + await UtilityClass.Encryptword(str(RefrenceId)) + '&Token=' + str(Token) });
    }
  }
  return res.json({ view });
}

// public (PayU surl callback - browser POST from PayU; token verified below)
// route-config: secure-payment-gateway/payment-success => PaymentOnline/PaymentSuccess
router.all(['/gateway/secure-payment-gateway/payment-success', `${P}/PaymentSuccess{/:id}`], asyncHandler(async (req, res) => {
  const { OrderId, RefrenceId, Token } = req.p;
  if (OrderId !== undefined && OrderId !== null) {
    // legacy: SELECT USERNAME+''+TRANSACTIONID FROM TBL_ORDERONLINEREQUESTS INNER JOIN TBL_CUSTOMERLOGIN ON ...CLID WHERE TRANSACTIONID='<RefrenceId>'
    const k = await db.scalar(DB,
      "select username||''||transactionid from tbl_orderonlinerequests inner join tbl_customerlogin on tbl_customerlogin.clid = tbl_orderonlinerequests.clid where transactionid = @t limit 1",
      { t: str(RefrenceId) });
    const Key = k === null ? null : String(k);

    // legacy: SELECT CONVERT(VARCHAR(MAX),DECRYPTBYPASSPHRASE('<Key>',CAST(<Token> AS VARBINARY(2000)))) inside try/catch => redirect on SQL error
    let DecryptedToken = '';
    try {
      DecryptedToken = G.decryptTokenSql(Key, Token);
    } catch (e) {
      return res.json({ redirect: STORES });
    }
    // Token must decrypt (passphrase USERNAME+TRANSACTIONID) to Encryptword(RefrenceId) (Session["Response"] at mint time)
    if (await UtilityClass.Decryptword(DecryptedToken) !== (RefrenceId === undefined ? null : RefrenceId)) {
      return res.json({ redirect: STORES });
    }

    const SaveLogResponse = await SaveData('', '', '', '', '', '', '', '', '', '', str(OrderId), '1', str(RefrenceId));
    const list_SaveLogResponse = SaveLogResponse.split('^');
    if (list_SaveLogResponse[0] === 'AlreadyDone' || list_SaveLogResponse[0] === 'error' || list_SaveLogResponse[0] === 'inserted') {
      return res.json({ redirect: STORES });
    }
    if (list_SaveLogResponse[0] === 'updated') {
      return res.json({ redirect: list_SaveLogResponse[1] + '?refrenceid=' + await UtilityClass.Encryptword(str(RefrenceId)) + '&Token=' + str(Token) });
    }
  }
  // PORT-NOTE: legacy View() (PaymentSuccess.cshtml) does not exist in the legacy project.
  return res.json({ view: '~/Views/PaymentOnline/PaymentSuccess.cshtml' });
}));

// public (callback - cancel; no token check in legacy)
// route-config: secure-gateway/payment-cancel => PaymentOnline/PaymentCancel
router.all(['/gateway/secure-gateway/payment-cancel', `${P}/PaymentCancel{/:id}`], asyncHandler(async (req, res) =>
  statusCallback(req, res, '3', 4, '~/Views/PaymentOnline/PaymentCancel.cshtml')));

// public (PayU furl callback; no token check in legacy)
// route-config: secure-payment-gateway/payment-failed => PaymentOnline/PaymentFailure
router.all(['/gateway/secure-payment-gateway/payment-failed', `${P}/PaymentFailure{/:id}`], asyncHandler(async (req, res) =>
  statusCallback(req, res, '2', 2, '~/Views/PaymentOnline/PaymentFailure.cshtml')));

// public (callback - in process; no token check in legacy)
// route-config: secure-gateway/payment-inprocess => PaymentOnline/PaymentInProcess (action is PaymentInprocess; MVC names are case-insensitive)
router.all(['/gateway/secure-gateway/payment-inprocess', `${P}/PaymentInprocess{/:id}`], asyncHandler(async (req, res) =>
  statusCallback(req, res, '4', 3, '~/Views/PaymentOnline/PaymentInprocess.cshtml')));

/* ======================================================================== public non-action helpers exposed by MVC routing */
// These C# methods are public controller methods without [NonAction], so legacy MVC routed them too.
// PORT-NOTE: they were anonymously reachable in legacy (SaveData can mark a payment as done!). Ported behind `auth`
// (any valid JWT, incl. the gateway session token) - coordinator should decide whether to drop them entirely.

// auth (public void Resellerwalletdeduction(decimal? grosspayble) - session-based)
router.all(`${P}/Resellerwalletdeduction{/:id}`, auth, asyncHandler(async (req, res) => {
  await Resellerwalletdeduction(req, G.bindNullableDecimal(req.p.grosspayble));
  return res.status(200).end(); // void action => EmptyResult
}));

// auth (public void ProceedToPayment(...))
router.all(`${P}/ProceedToPayment{/:id}`, auth, asyncHandler(async (req, res) => {
  const q = req.p;
  const posted = await ProceedToPayment(req, res, q.UserName, q.Amount, q.ProductInfo, q.Email, q.Phone, q.OrderId, q.RefrenceId, q.Key, q.Salt, q.SuccessURL, q.FailURL);
  if (!posted) return res.status(200).end();
  return undefined;
}));

// auth (public string Generatehash512(string text) => ContentResult)
router.all(`${P}/Generatehash512{/:id}`, auth, asyncHandler(async (req, res) => {
  return res.status(200).type('html').send(G.Generatehash512(req.p.text === undefined ? null : req.p.text));
}));

// auth (public string SaveData(...) => ContentResult)
router.all(`${P}/SaveData{/:id}`, auth, asyncHandler(async (req, res) => {
  const q = req.p;
  const nz = (v) => (v === undefined ? null : v);
  const r = await SaveData(nz(q.Name), nz(q.Address), nz(q.ContactNo), nz(q.CityName), nz(q.EmailId), nz(q.State), nz(q.Amount), nz(q.Country),
    nz(q.Remark), nz(q.Pincode), nz(q.OrderId), nz(q.PaymentStatus), nz(q.ReferenceId));
  return res.status(200).type('html').send(r);
}));

/* =========================================================================================================== GetMaxUserPer */
// public (gateway page AJAX; no session check)
router.post(`${P}/GetMaxUserPer{/:id}`, asyncHandler(async (req, res) => {
  const { PMID, walletid } = req.p;
  let MAXUSEPER = '0';
  // legacy: "select MAXUSEPER from TBL_RESELLER_WALLETTYPE where PMID=" + PMID + " and WALLETID=" + walletid (concatenated; bound here)
  const m = await db.scalar(DB, 'select maxuseper from tbl_reseller_wallettype where pmid = @pm and walletid = @wid limit 1',
    { pm: G.sqlNumberLiteral(PMID), wid: G.sqlNumberLiteral(walletid) });
  if (m !== null) MAXUSEPER = decStr(m);
  const ViewBag = { MAXUSEPER }; void ViewBag;
  return sendJson(res, G.dec(MAXUSEPER)); // Json(decimal) keeps the scale (e.g. 10.00)
}));

module.exports = router;
