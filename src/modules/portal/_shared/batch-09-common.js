'use strict';
/**
 * Shared helpers for portal batch 09 (not a router; lives in _shared/ so it is not mounted).
 * Exports: DB, NRE, pageUrl(req), col(row, name), isNull(v), csInt32(v), csDecimal(v), validateMobile(s),
 *          seoViewBag(WID), masterpageshow(req), buildRechargePaymentRouter(cfg)
 * buildRechargePaymentRouter ports the three near-identical controllers Dth_Payment.cs / Electricity_Payment.cs /
 * Gas_Payment.cs (only the differences listed in cfg vary; everything else is line-for-line identical C#).
 */
const express = require('express');
const axios = require('axios');
const db = require('../../../db');
const config = require('../../../config');
const asyncHandler = require('../../../middleware/asyncHandler');
const ps = require('./portal-session');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');
const ApiService = require('../../../lib/portal/ApiService');
const CutomerWalletProcess = require('../../../lib/portal/CustomerWalletProcess');
const CompanySettingsMod = require('../../../lib/portal/CompanySettings');

const DB = 'shopping';
const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FORMAT_ERR = () => new Error('Input string was not in a correct format.');

/** HttpContext.Request.Url.ToString() */
function pageUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/** case-insensitive column read (PostgreSQL lower-cases column names). */
function col(row, name) {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
}

const isNull = (v) => v === undefined || v === null;

/** Convert.ToInt32(string): null -> 0, bad format -> FormatException. */
function csInt32(v) {
  if (isNull(v)) return 0;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw FORMAT_ERR();
    return Math.round(v);
  }
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw FORMAT_ERR();
  const n = parseInt(s, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
}

/** Convert.ToDecimal(string): null -> 0, bad format -> FormatException. */
function csDecimal(v) {
  if (isNull(v)) return 0;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw FORMAT_ERR();
  return Number(s);
}

/** private bool ValidateMobile(string) : Regex.IsMatch(mobileNumber, @"^[-+]?[0-9]*\.?[0-9]+$") (null => ArgumentNullException). */
function validateMobile(mobileNumber) {
  if (isNull(mobileNumber)) throw new Error('Value cannot be null.\r\nParameter name: input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(String(mobileNumber));
}

/** ViewBag.Title/MetaDesc/MetaKeyword from WebsiteDetail.GetWebsiteInfo(WID) (shared by Deals / emailblasting). */
async function seoViewBag(WID) {
  const vb = { Title: '', MetaDesc: '', MetaKeyword: '' };
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(WID);
  if (ObjWebsiteDescription !== null && ObjWebsiteDescription !== undefined) {
    vb.Title = ObjWebsiteDescription.SeoTitle;
    vb.MetaDesc = ObjWebsiteDescription.SeoDescription;
    vb.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return vb;
}

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin" else "" */
function masterpageshow(req) {
  return ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
}

const PROVIDER_LISTS = ['SNO', 'ProductName', 'Code', 'Service', 'MinAmount', 'Status', 'BaseUrl', 'ImageName'];

/** JObject.ToObject<List<ProviderLists>>() : case-insensitive property binding. */
function toProviderLists(arr) {
  return arr.map((o) => {
    const out = {};
    for (const p of PROVIDER_LISTS) {
      const v = col(o, p);
      out[p] = v === undefined ? (p === 'SNO' || p === 'MinAmount' ? 0 : null) : v;
    }
    return out;
  });
}

/** JObject["X"].ToString() (missing key => NullReferenceException; objects/arrays => JSON text). */
function jtok(obj, key) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) throw NRE();
  const v = obj[key];
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

/**
 * cfg: { prefix: 'Dth_Payment', view, service: 'DTH'|'ELECTRICITY'|'GAS', friendly: 'Dth-Payment',
 *        requestsAction, walletCheck: bool, slug: 'dth'|'electricity'|'gas', requestsProc, makeAction, apiPath, detailsKey,
 *        updateAction, updateProc, operatorsListName }
 */
function buildRechargePaymentRouter(cfg) {
  const router = express.Router();
  const C = cfg.prefix;
  const RechargeAPIURL = () => (config.app.RechargeAPIURL || '');

  // public static List<ProviderLists> Get<X>OperatorsList()  (static: not an MVC action; called by the view => included in Index JSON)
  async function GetOperatorsList() {
    let lstProviderLists = [];
    try {
      const objectOperatiorLists = { uidno: '', clid: '7', service: cfg.service, serviceCode: '' };
      const resp = await axios.post(RechargeAPIURL() + '/api/Get-ProvideList', JSON.stringify(objectOperatiorLists), {
        headers: { 'Content-Type': 'application/json' }, transformResponse: [(d) => d], responseType: 'text',
      });
      const ObjOperatorDetails = JSON.parse(String(resp.data));
      const Flag = jtok(ObjOperatorDetails, 'Flag');
      jtok(ObjOperatorDetails, 'Message');
      if (Flag === 'success') {
        const det = ObjOperatorDetails.providelist;
        if (det === undefined) throw NRE();
        if (Array.isArray(det) && det.length > 0) {
          lstProviderLists = toProviderLists(det);
        } else if (Array.isArray(det)) {
          lstProviderLists = null;
        } else {
          throw new Error('Error reading JArray'); // JArray.Parse of a non-array
        }
      } else {
        lstProviderLists = null;
      }
    } catch (ex) {
      lstProviderLists = null;
    }
    return lstProviderLists;
  }

  // public bool isUniqueId(string GeneratedId)
  async function isUniqueId(GeneratedId) {
    let Result = true;
    const Row = await db.queryOne(DB, 'SELECT api_reqid FROM tbl_rechargehistory WHERE api_reqid = @id LIMIT 1', { id: GeneratedId });
    if (Row) {
      if (Row.api_reqid === GeneratedId) Result = false;
    } else {
      Result = true;
    }
    return Result;
  }

  // public string GenerateUniqueReqId()
  async function GenerateUniqueReqId() {
    let GeneratedId = '';
    for (;;) {
      GeneratedId = await UtilityClass.RandomStringByLength(20);
      const Check = await isUniqueId(GeneratedId);
      if (Check) break;
    }
    return GeneratedId;
  }

  // public string Update<X>RechargeStatus(string custTranid, string APITranId, string rechstatus, string rechRemarks)
  async function UpdateRechargeStatus(custTranid, APITranId, rechstatus, rechRemarks) {
    let updateResponse = '';
    try {
      const row = await db.procOne(DB, cfg.updateProc, {
        custtransactionid: custTranid, apitransactionid: APITranId, rechargeresponsestatus: rechstatus, rechargeresponseremarks: rechRemarks,
      });
      // eslint-disable-next-line no-unused-vars
      const responseAPI = String(col(row, 'stroutput') ?? '');
    } catch (ex) {
      updateResponse = '';
    }
    return updateResponse;
  }

  // public string Make<X>Recharge(..., out string APITransactionId)  -> returns { rechargeStatus, APITransactionId }
  async function MakeRecharge(MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId) {
    let rechargeStatus = '';
    let APITransactionId = '';
    try {
      const rechargeReq = { uidno: '', clid: CLID, service: cfg.service, serviceCode: RechOpCode, number: MobileNo, amount: RechAmount, CustomerTransID: TransactionId };
      const resp = await axios.post(RechargeAPIURL() + cfg.apiPath, JSON.stringify(rechargeReq), {
        headers: { 'Content-Type': 'application/json' }, transformResponse: [(d) => d], responseType: 'text',
      });
      const ObjRechargeResponse = JSON.parse(String(resp.data));
      const Flag = jtok(ObjRechargeResponse, 'Flag');
      const Message = jtok(ObjRechargeResponse, 'Message');
      if (Flag.toUpperCase() === 'SUCCESS' || Flag.toUpperCase() === 'PENDING') {
        const responseAPITransactionId = jtok(ObjRechargeResponse, 'APITransID');
        jtok(ObjRechargeResponse, 'CustomerTransID');
        const responseRechargeDetails = jtok(ObjRechargeResponse, cfg.detailsKey);
        rechargeStatus = Flag.toUpperCase();
        APITransactionId = responseAPITransactionId;
        await UpdateRechargeStatus(TransactionId, responseAPITransactionId, Flag.toUpperCase(), responseRechargeDetails);
      } else if (Flag.toUpperCase() === 'ERROR') {
        rechargeStatus = Flag.toUpperCase();
        APITransactionId = '';
        await UpdateRechargeStatus(TransactionId, '', 'ERROR', Message);
      } else {
        rechargeStatus = 'ERROR';
        APITransactionId = '';
        await UpdateRechargeStatus(TransactionId, '', 'FAILED', Message);
      }
    } catch (ex) {
      rechargeStatus = '';
      APITransactionId = '';
    }
    return { rechargeStatus, APITransactionId };
  }

  // ---------------------------------------------------------------- Index  ([DistributerSessionExpireCheck] = no check)
  // route-config: "<friendly>" -> <prefix>/Index
  // public
  router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, `/portal/${cfg.friendly}`], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
    const ViewBag = { masterpageshow: masterpageshow(req) };
    const OperatorsList = await GetOperatorsList(); // view: <prefix>Controller.<operatorsListName>()
    return res.json({ view: cfg.view, ...ViewBag, OperatorsList });
  }));

  // ---------------------------------------------------------------- GetOperator(string MobileNo)
  // public
  router.all(`/portal/${C}/GetOperator{/:id}`, asyncHandler(async (req, res) => {
    const { MobileNo } = req.p;
    if (!validateMobile(MobileNo)) return res.json('Invalid^Entered mobile number is invalid.');
    let OperatorInformation = '';
    const OBjApiServices = new ApiService();
    const MpObj = await OBjApiServices.GetOperator(MobileNo);
    if (!MpObj) throw NRE();
    if (MpObj.cid !== null && MpObj.cid !== undefined) {
      OperatorInformation = 'Valid' + '^' + MpObj.cid + '^' + (MpObj.code ?? '') + '^' + (MpObj.opid ?? '') + '^' + (MpObj.provider ?? '') + '^' + (MpObj.state ?? '');
    } else {
      return res.json('Invalid^Entered mobile number is invalid.');
    }
    return res.json(OperatorInformation);
  }));

  // ---------------------------------------------------------------- GenerateUniqueReqId()  (public string => ContentResult)
  // public
  router.all(`/portal/${C}/GenerateUniqueReqId{/:id}`, asyncHandler(async (req, res) => {
    res.type('text/html').send(await GenerateUniqueReqId());
  }));

  // ---------------------------------------------------------------- isUniqueId(string GeneratedId)  (public bool => "True"/"False")
  // public
  router.all(`/portal/${C}/isUniqueId{/:id}`, asyncHandler(async (req, res) => {
    const r = await isUniqueId(req.p.GeneratedId === undefined ? null : req.p.GeneratedId);
    res.type('text/html').send(r ? 'True' : 'False');
  }));

  // ---------------------------------------------------------------- GetJewriaCashPoints(string UserName, string TransactionPassword, string JP)
  // auth
  router.all(`/portal/${C}/GetJewriaCashPoints{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
    const { UserName, TransactionPassword, JP } = req.p;
    let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
    // PORT-NOTE (legacy bug reproduced): the C# passed its arguments POSITIONALLY ("USP_JewriaCashPointDetails @DISTRIBUTORID,@MODE,@USERNAME,
    // @TRANSACTIONPASSWORD,@JP") to a proc declared (@DISTRIBUTORID,@MODE,@JP,@USERNAMEJC,@TRANSACTIONPASSWORDJC,...), so UserName went into @JP,
    // the encrypted password into @USERNAMEJC and JP into @TRANSACTIONPASSWORDJC. Same binding as servicejewaria-mobile.js / batch-17.
    const Getwalletdiscount = await db.proc(DB, 'usp_jewriacashpointdetails', {
      distributorid: 1, mode: 2, jp: UserName ?? null,
      usernamejc: await UtilityClass.Encryptword(TransactionPassword ?? null), transactionpasswordjc: JP ?? null,
    });
    for (const Items of Getwalletdiscount) {
      Ewallet = String(col(Items, 'EWALLETCONSUMEPER') ?? '');
      Coinwallet = String(col(Items, 'COINWALLETCONSUMEPER') ?? '');
      Commition = String(col(Items, 'COMMISSIONWALLETCONSUMEPER') ?? '');
      PointWallet = String(col(Items, 'POINTREDEEMPERCENT') ?? '');
    }
    const FinalResult = 'success^' + Ewallet + '^' + Coinwallet + '^' + Commition + '^' + PointWallet;
    return res.json(FinalResult);
  }));

  // ---------------------------------------------------------------- Proceed(string Mobile, string Amount, string OpCode, string OperatorName)
  // auth
  router.all(`/portal/${C}/Proceed{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
    const { Mobile, Amount, OpCode, OperatorName } = req.p;
    // eslint-disable-next-line no-unused-vars
    const Loginid = req.user.loginid; const PLID = req.user.plid;
    try {
      if (Mobile === '') return res.json('Invalid^Entered mobile number is invalid.');
      else if (!validateMobile(Mobile)) return res.json('Invalid^Entered mobile number is invalid.');
      else if (Amount === '') return res.json('Invalid^Amount is required.');
      else if (OpCode === '') return res.json('Invalid^Operator name required.');
      else if (OperatorName === '') return res.json('Invalid^Operator name required.');
      else if (csInt32(Amount) < 0) return res.json('Invalid^Entered mobile number is invalid.');
      // fund check (USP_SUCCESSORFAILEDRECHARGE mode 3) is commented out in the C#
      return res.json('success^0.00000000^0.00000000');
    } catch (Ex) {
      return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
    }
  }));

  // ---------------------------------------------------------------- MakePostpaidRecharge(...)
  // auth
  router.all(`/portal/${C}/MakePostpaidRecharge{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
    const p = (k) => (req.p[k] === undefined ? null : req.p[k]);
    const Mobile = p('Mobile'); const Amount = p('Amount'); const OpCode = p('OpCode'); const OperatorName = p('OperatorName');
    const JpPointRedeemPercentage = p('JpPointRedeemPercentage'); const EWalletRedeemPercentage = p('EWalletRedeemPercentage');
    const BvPercentage = p('BvPercentage'); const Discount = p('Discount'); const NetPayableAmount = p('NetPayableAmount');
    const IsDiscounTApplicabale = p('IsDiscounTApplicabale'); const UserName = p('UserName'); const TransactionPassword = p('TransactionPassword');
    const UserNameWallet = p('UserNameWallet'); const TransactionPasswordWallet = p('TransactionPasswordWallet'); const Paymode = p('Paymode');
    const Loginid = req.user.loginid;
    const PLID = req.user.plid;
    try {
      if (Mobile === '') return res.json('Invalid^Entered mobile number is invalid.');
      else if (!validateMobile(Mobile)) return res.json('Invalid^Entered mobile number is invalid.');
      else if (Amount === '') return res.json('Invalid^Amount is required.');
      else if (OpCode === '') return res.json('Invalid^Operator name required.');
      else if (OperatorName === '') return res.json('Invalid^Operator name required.');
      else if (csInt32(Amount) < 0) return res.json('Invalid^Entered mobile number is invalid.');

      // check fund available or not
      const fund = await db.procOne(DB, 'usp_successorfailedrecharge', {
        mode: '1', loginid: Loginid, amount: NetPayableAmount, usernameewallet: UserNameWallet,
        transactionpasswordewallet: TransactionPasswordWallet, plid: PLID,
      });
      const StrResult = String(col(fund, 'strresult') ?? '');
      if (StrResult.toLowerCase() !== 'success') return res.json('Invalid^' + StrResult + '');

      // check JC Point available or not
      if (IsDiscounTApplicabale === '1') {
        const Getwalletdiscount = await db.proc(DB, 'usp_jewriacashpointdetails', {
          distributorid: '1', mode: '2', jp: Discount, usernamejc: UserName, transactionpasswordjc: TransactionPassword, plid: PLID,
        });
        // PORT-NOTE: @STRRESULT OUT is read from the first result row (no row => '').
        const StrResultJc = String(col(Getwalletdiscount[0], 'strresult') ?? '');
        if (StrResultJc.toLowerCase() !== 'success') {
          // legacy bug kept: the message uses the FUND check StrResult, not StrResultJc
          return res.json('Invalid^' + StrResult + '');
        } else if (Getwalletdiscount.length === 0) {
          return res.json('Invalid^Insufficient JC Point in your JC Point Wallet');
        }
      }
      // (deduct fund / deduct JC point blocks are commented out in the C#)

      // actual recharge
      const UniqueReqId = await GenerateUniqueReqId();
      const ApiToken = (config.app.Mobile_Api_Token || '');
      const OBjApiServices = new ApiService();
      const GetResult = await OBjApiServices.Recharge(ApiToken, Mobile, OpCode, Amount, UniqueReqId, '', '');
      if (!GetResult) throw NRE();
      const reqid = isNull(GetResult.reqid) ? '0' : GetResult.reqid;
      const status = isNull(GetResult.status) ? '' : GetResult.status;
      const remark = isNull(GetResult.remark) ? '' : GetResult.remark;
      const balance = isNull(GetResult.balance) ? '0.00000000' : GetResult.balance;
      const mn = isNull(GetResult.mn) ? '' : GetResult.mn;
      // eslint-disable-next-line no-unused-vars
      const field1 = isNull(GetResult.field1) ? '' : GetResult.field1;
      const ec = isNull(GetResult.ec) ? '' : GetResult.ec;
      const apirefid = isNull(GetResult.apirefid) ? '' : GetResult.apirefid;
      // eslint-disable-next-line no-unused-vars
      const amt = isNull(GetResult.amt) ? '0.00000000' : GetResult.amt;

      // save recharge history
      if (OperatorName === null) throw NRE(); // OperatorName.Trim()
      const hist = await db.procOne(DB, 'usp_maintainrechargehistory', {
        mode: '1', plid: PLID, mobile: mn, operator: OperatorName.trim(), amount: Amount, api_refid: apirefid, api_balance: balance,
        api_errorcode: ec, api_remark: remark, api_reqid: reqid, api_status: status, opcode: OpCode,
        jppointredeempercentage: JpPointRedeemPercentage, ewalletredeempercentage: EWalletRedeemPercentage, bvpercentage: BvPercentage,
        discount: Discount, netpayableamount: NetPayableAmount, isdiscountapplicabale: IsDiscounTApplicabale, usernamejc: UserName,
        transactionpasswordjc: TransactionPassword, usernameewallet: UserNameWallet, transactionpasswordewallet: TransactionPasswordWallet,
        paymode: Paymode, ordernumber: UniqueReqId,
      });
      const StrResultOutputHistory = String(col(hist, 'strresult') ?? '');
      if (StrResultOutputHistory.toLowerCase() === 'success') {
        return res.json('success^Your mobile recharge done successfully.Your order number is ' + reqid);
      }
      return res.json('Invalid^' + StrResultOutputHistory);
    } catch (Ex) {
      return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
    }
  }));

  // ---------------------------------------------------------------- <X>RechargeRequests(MobileNo="", RechOpCode="", RechOpName="", RechOpService="", RechAmount="")
  // auth
  router.all(`/portal/${C}/${cfg.requestsAction}{/:id}`, ...ps.customerOr('Error^Please login first'), asyncHandler(async (req, res) => {
    const d = (k) => (req.p[k] === undefined ? '' : req.p[k]);
    const MobileNo = d('MobileNo'); const RechOpCode = d('RechOpCode'); const RechOpName = d('RechOpName');
    const RechOpService = d('RechOpService'); const RechAmount = d('RechAmount');
    let result = '';
    try {
      const ResellerId = Number(req.user.did ?? 0);
      const w = await db.scalar(DB, 'SELECT coalesce(available_wallet, 0) AS available_wallet FROM tbl_distributor_prepaid_setting WHERE pmid = @pmid LIMIT 1',
        { pmid: ResellerId });
      const ResellerWallet = isNull(w) ? 0 : Number(w);
      if (ResellerWallet < csDecimal(RechAmount)) return res.json('FAILED^Insufficient fund in reseller wallet');
      const Plid = req.user.plid;
      const nz = (s) => !(isNull(s) || s === '');
      if (nz(MobileNo) && nz(RechOpCode) && nz(RechOpName) && nz(RechOpService) && nz(RechAmount)) {
        if (!validateMobile(MobileNo)) {
          result = 'Error^Invalid mobile no';
          return res.json(result);
        }
        const reqAmount = csDecimal(RechAmount);
        if (reqAmount <= 0) {
          result = 'Error^Invalid recharge amount';
          return res.json(result);
        }
        if (cfg.walletCheck) {
          const walletAmount = await CutomerWalletProcess.GetUserWalletBalance(csInt32(Plid));
          if (walletAmount < reqAmount) {
            result = 'Error^Insufficient amount in wallet';
            return res.json(result);
          }
        }
        // payment gateway parameters
        const requestedURL = config.app.CompanyDomain;
        if (isNull(requestedURL)) throw NRE(); // AppSettings["CompanyDomain"].ToString()
        const successurl = requestedURL + `/secure-eblaa-payment-gateway/${cfg.slug}-recharge-success`;
        const failureurl = requestedURL + `/secure-eblaa-payment-gateway/${cfg.slug}-recharge-failed`;
        const inprocessurl = requestedURL + `/secure-eblaa-payment-gateway/${cfg.slug}-recharge-inprocess`;
        const canceledurl = requestedURL + `/secure-eblaa-payment-gateway/${cfg.slug}-recharge-cancel`;

        const out = await db.procOne(DB, cfg.requestsProc, {
          clid: Plid, mobileno: MobileNo, operatortype: cfg.service, operatorname: RechOpName, operatorcode: RechOpCode,
          operatorservice: RechOpService, rechargeamount: reqAmount, successurl, failureurl, inprocessurl, cancelledurl: canceledurl,
        });
        const StrOutput = String(col(out, 'stroutput') ?? '');
        const StrTransactionId = String(col(out, 'transactionid') ?? '');
        if (StrOutput.toLowerCase() === 'success' && StrTransactionId !== '') {
          ps.sessionSet(req, 'MobileNo', MobileNo);
          ps.sessionSet(req, 'RechOpCode', RechOpCode);
          ps.sessionSet(req, 'RechOpName', RechOpName);
          ps.sessionSet(req, 'RechOpService', RechOpService);
          ps.sessionSet(req, 'RechAmount', RechAmount);
          ps.sessionSet(req, 'StrTransactionId', StrTransactionId);
          const BaseURL = config.app.PaymentURL;
          if (isNull(BaseURL)) throw NRE();
          const PMID = CompanySettings.PMID;
          const E = (s) => UtilityClass.Encryptword(s);
          const Url = 'Ok^' + BaseURL + 'Home?refrenceid=' + await E(StrTransactionId) + '&successurl=' + await E(successurl)
            + '&failureurl=' + await E(failureurl) + '&inprocessurl=' + await E(inprocessurl) + '&canceledurl=' + await E(canceledurl)
            + '&source=' + await E('Recharge') + '&PMID=' + await E(String(PMID)) + '';
          return res.json(Url);
        }
      } else {
        result = 'Error^Invalid Request';
        return res.json(result);
      }
    } catch (ex) {
      result = 'Error^Some error occured';
      return res.json(result);
    }
    return res.json(result);
  }));

  // ---------------------------------------------------------------- Make<X>Recharge(..., out string APITransactionId)
  // PORT-NOTE: MVC cannot invoke an action with an out parameter (InvalidOperationException, HTTP 500); reproduced. The logic is
  // kept as the internal MakeRecharge() (only referenced from commented-out C#).
  // public
  router.all(`/portal/${C}/${cfg.makeAction}{/:id}`, (req, res) => {
    res.status(500).json({
      error: `Cannot call action method 'System.String ${cfg.makeAction}(...)' on controller '${C}Controller' because the parameter 'System.String& APITransactionId' is passed by reference.`,
    });
  });

  // ---------------------------------------------------------------- Update<X>RechargeStatus(custTranid, APITranId, rechstatus, rechRemarks)
  // auth (legacy had no session check; it rewrites recharge status rows, so it is protected here)
  router.all(`/portal/${C}/${cfg.updateAction}{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
    const g = (k) => (req.p[k] === undefined ? null : req.p[k]);
    const r = await UpdateRechargeStatus(g('custTranid'), g('APITranId'), g('rechstatus'), g('rechRemarks'));
    res.type('text/html').send(r);
  }));

  router.internals = { GetOperatorsList, isUniqueId, GenerateUniqueReqId, UpdateRechargeStatus, MakeRecharge };
  router.internals[cfg.operatorsListName] = GetOperatorsList;
  return router;
}

module.exports = {
  DB, NRE, pageUrl, col, isNull, csInt32, csDecimal, validateMobile, seoViewBag, masterpageshow, buildRechargePaymentRouter,
};
