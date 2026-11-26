'use strict';
/**
 * Shared helpers for portal batch 17 (servicejewaria, Insurance_Payment, Landline_Payment, DataCard_Payment,
 * OnlineDTHRechargeResponse). Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 * Exports:
 *   DB, NRE, str, csInt32, csDecimal, validateMobile, col, jtok, outOf, masterpageshow
 *   GetOperatorsList(service, clid, removeAircelExpress)      -> List<ProviderLists> | null   (static Get<X>OperatorsList())
 *   isUniqueId(id), GenerateUniqueReqId()
 *   RECHARGE_KINDS, updateRechargeStatus(kind, ...), makeRecharge(kind, ..., reqDOB) -> { rechargeStatus, APITransactionId }
 *   getCustomerPreviousRecharges(req, type)                   -> static getCustomerPrevious<X>Recharges()
 *   buildPaymentVariantRouter(cfg)                            -> router for servicejewaria / Insurance_Payment / Landline_Payment / DataCard_Payment
 *   buildDthResponseRouter()                                  -> router for OnlineDTHRechargeResponse
 *
 * Why not _shared/batch-09-common.js buildRechargePaymentRouter(): these four controllers share the first ~560 C# lines with
 * Dth_Payment.cs (Index/GetOperator/GenerateUniqueReqId/isUniqueId/GetJewriaCashPoints/Proceed/MakePostpaidRecharge) but differ in
 * the recharge part (DataCard: none; Landline: no reseller check, electricity URLs, PMID=1, no Make/Update; Insurance: reqDOB;
 * servicejewaria: two services + history + ambiguous MakePostpaidRecharge). Also batch-09's GetJewriaCashPoints binds the proc by
 * name (@USERNAME/@TRANSACTIONPASSWORD do not exist in USP_JewriaCashPointDetails); the C# binds POSITIONALLY, reproduced here
 * exactly like servicejewaria-mobile.js.
 * Why not _shared/batch-11-common.js buildRechargeResponseRouter() for OnlineDTHRechargeResponse: kind DTH is not configurable there,
 * and the DTH controller decrypts refrenceid in RechargeFailed (not in RechargeCancel), the opposite of the builder.
 */
const express = require('express');
const axios = require('axios');
const db = require('../../../db');
const config = require('../../../config');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const ps = require('./portal-session');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const ApiService = require('../../../lib/portal/ApiService');
const CutomerWalletProcess = require('../../../lib/portal/CustomerWalletProcess');
const CompanySettingsMod = require('../../../lib/portal/CompanySettings');
const { outVal, SendConfirmationMailAndMessages } = require('./batch-11-common');

const DB = 'shopping';
const CompanySettings = CompanySettingsMod.CompanySettings || CompanySettingsMod;

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const FORMAT_ERR = () => new Error('Input string was not in a correct format.');
const isNull = (v) => v === undefined || v === null;
const str = (v) => (isNull(v) ? '' : String(v));

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

/** private bool ValidateMobile(string): Regex.IsMatch(null) => ArgumentNullException. */
function validateMobile(mobileNumber) {
  if (isNull(mobileNumber)) throw new Error('Value cannot be null.\r\nParameter name: input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(String(mobileNumber));
}

/** case-insensitive column read. */
function col(row, name) {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? undefined : row[k];
}

/** OUTPUT parameter of a proc = column of the first result row (null when absent). */
function outOf(rows, name) {
  const r = Array.isArray(rows) ? rows[0] : rows;
  const v = col(r, name);
  return v === undefined ? null : v;
}

/** JObject["X"].ToString(): missing key => NullReferenceException; objects/arrays => indented JSON. */
function jtok(obj, key) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) throw NRE();
  const v = obj[key];
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin" else "" */
function masterpageshow(req) {
  return ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
}

const RechargeAPIURL = () => (config.app.RechargeAPIURL || '');
const postJsonText = async (url, body) => {
  const resp = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' }, transformResponse: [(d) => d], responseType: 'text',
  });
  return String(resp.data);
};

const PROVIDER_LISTS = ['SNO', 'ProductName', 'Code', 'Service', 'MinAmount', 'Status', 'BaseUrl', 'ImageName'];
/** JArray.ToObject<List<ProviderLists>>() (case-insensitive property binding). */
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

/**
 * public static List<ProviderLists> Get<X>OperatorsList()
 * removeAircelExpress: GetPrepaidOperatorsList() does lstProviderLists.Remove(lstProviderLists.Single(d => d.ProductName == "Aircel Express"))
 * (Single throws when there is not exactly one match => catch => null).
 */
async function GetOperatorsList(service, clid, removeAircelExpress) {
  let lstProviderLists = [];
  try {
    const objectOperatiorLists = { uidno: '', clid, service, serviceCode: '' };
    const Return = await postJsonText(RechargeAPIURL() + '/api/Get-ProvideList', JSON.stringify(objectOperatiorLists));
    const ObjOperatorDetails = JSON.parse(Return);
    const Flag = jtok(ObjOperatorDetails, 'Flag');
    jtok(ObjOperatorDetails, 'Message');
    if (Flag === 'success') {
      const Details = jtok(ObjOperatorDetails, 'providelist');
      if (Details !== '[]') {
        const det = ObjOperatorDetails.providelist;
        if (!Array.isArray(det)) throw new Error('Error reading JArray from JsonReader.');
        lstProviderLists = toProviderLists(det);
        if (removeAircelExpress) {
          const matches = lstProviderLists.filter((d) => d.ProductName === 'Aircel Express');
          if (matches.length === 0) throw new Error('Sequence contains no matching element');
          if (matches.length > 1) throw new Error('Sequence contains more than one matching element');
          lstProviderLists.splice(lstProviderLists.indexOf(matches[0]), 1);
        }
      } else {
        lstProviderLists = null;
      }
    } else {
      lstProviderLists = null;
    }
  } catch (ex) {
    lstProviderLists = null;
  }
  return lstProviderLists;
}

/** public bool isUniqueId(string GeneratedId) (EF _Tbl_RechargeHistory.Where(Api_REQID == id).FirstOrDefault()) */
async function isUniqueId(GeneratedId) {
  let Result = true;
  const Row = await db.queryOne(DB, 'select api_reqid from tbl_rechargehistory where api_reqid = @id limit 1', { id: isNull(GeneratedId) ? null : GeneratedId });
  if (Row !== null && Row !== undefined) {
    if (Row.api_reqid === GeneratedId) Result = false;
  } else {
    Result = true;
  }
  return Result;
}

/** public string GenerateUniqueReqId() (goto Regenerate loop) */
async function GenerateUniqueReqId() {
  let GeneratedId = '';
  for (;;) {
    GeneratedId = await UtilityClass.RandomStringByLength(20);
    const Check = await isUniqueId(GeneratedId);
    if (Check) break;
  }
  return GeneratedId;
}

/** Make<X>Recharge / Update<X>RechargeStatus variants (service, API path, details key, update proc, ERROR||FAILURE branch). */
const RECHARGE_KINDS = {
  POSTPAID: { service: 'POSTPAID', apiPath: '/api/Get-RechargeMobile', detailsKey: 'RechargeMobileDetail', updateProc: 'usp_update_customer_postpaid_recharge_response', failureIsError: false },
  PREPAID: { service: 'MOBILE', apiPath: '/api/Prepaid-Recharge-Mobile', detailsKey: 'PrepaidMobileDetail', updateProc: 'usp_update_customer_prepaid_recharge_response', failureIsError: true },
  INSURANCE: { service: 'INSURANCE', apiPath: '/api/customer-INSURANCE', detailsKey: 'INSURANCEBillDetail', updateProc: 'usp_update_customer_insurance_recharge_response', failureIsError: false, dob: true },
  DTH: { service: 'DTH', apiPath: '/api/Get-DTHRecharge', detailsKey: 'DTHRechargeDetails', updateProc: 'usp_update_customer_dth_recharge_response', failureIsError: false },
};

/** public string Update<X>RechargeStatus(custTranid, APITranId, rechstatus, rechRemarks): errors swallowed, always "". */
async function updateRechargeStatus(kind, custTranid, APITranId, rechstatus, rechRemarks) {
  let updateResponse = '';
  try {
    const row = await db.procOne(DB, RECHARGE_KINDS[kind].updateProc, {
      custtransactionid: custTranid, apitransactionid: APITranId, rechargeresponsestatus: rechstatus, rechargeresponseremarks: rechRemarks,
    });
    // eslint-disable-next-line no-unused-vars
    const responseAPI = str(col(row, 'stroutput'));
  } catch (ex) {
    updateResponse = '';
  }
  return updateResponse;
}

/** JavaScriptSerializer DateTime => "\/Date(ms)\/" */
function serializeWithMsDate(obj, dateKey) {
  const marker = '__MSDATE__';
  const copy = { ...obj };
  let ms = null;
  if (copy[dateKey] instanceof Date) { ms = copy[dateKey].getTime(); copy[dateKey] = marker; }
  let s = JSON.stringify(copy);
  if (ms !== null) s = s.replace(`"${marker}"`, `"\\/Date(${ms})\\/"`);
  return s;
}

/** public string Make<X>Recharge(..., [DateTime reqDOB,] out string APITransactionId) => { rechargeStatus, APITransactionId } */
async function makeRecharge(kind, MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId, reqDOB) {
  const K = RECHARGE_KINDS[kind];
  let rechargeStatus = '';
  let APITransactionId = '';
  try {
    const rechargeReq = { uidno: '', clid: CLID, service: K.service, serviceCode: RechOpCode, number: MobileNo, amount: RechAmount, CustomerTransID: TransactionId };
    let body;
    if (K.dob) {
      rechargeReq.DOB = isNull(reqDOB) ? null : (reqDOB instanceof Date ? reqDOB : new Date(reqDOB));
      body = serializeWithMsDate(rechargeReq, 'DOB');
    } else {
      body = JSON.stringify(rechargeReq);
    }
    const ObjRechargeResponse = JSON.parse(await postJsonText(RechargeAPIURL() + K.apiPath, body));
    const Flag = jtok(ObjRechargeResponse, 'Flag');
    const Message = jtok(ObjRechargeResponse, 'Message');
    const F = Flag.toUpperCase();
    if (F === 'SUCCESS' || F === 'PENDING') {
      const responseAPITransactionId = jtok(ObjRechargeResponse, 'APITransID');
      jtok(ObjRechargeResponse, 'CustomerTransID'); // responseCustomerId (unused; throws like the C# when missing)
      const responseRechargeDetails = jtok(ObjRechargeResponse, K.detailsKey);
      rechargeStatus = F;
      APITransactionId = responseAPITransactionId;
      await updateRechargeStatus(kind, TransactionId, responseAPITransactionId, F, responseRechargeDetails);
    } else if (F === 'ERROR' || (K.failureIsError && F === 'FAILURE')) {
      rechargeStatus = F;
      APITransactionId = '';
      await updateRechargeStatus(kind, TransactionId, '', 'ERROR', Message);
    } else {
      rechargeStatus = 'ERROR';
      APITransactionId = '';
      await updateRechargeStatus(kind, TransactionId, '', 'FAILED', Message);
    }
  } catch (ex) {
    rechargeStatus = '';
    APITransactionId = '';
  }
  return { rechargeStatus, APITransactionId };
}

const HISTORY_PROPS = ['CLID', 'MOBILENO', 'OPERATORTYPE', 'OPERATORNAME', 'OPERATORCODE', 'OPERATORSERVICE', 'RECHARGEAMOUNT',
  'RECHARGEDATE', 'RECHARGESTATUS', 'RESPONSEREMARKS', 'TRANSACTIONID', 'APITRANSACTIONID'];

/** public static List<CustomerPreviousRechargeHistory> getCustomerPrevious<X>Recharges() (HttpContext.Current.Session["Plid"]) */
async function getCustomerPreviousRecharges(req, OPERATORSERVICETYPE) {
  let customerPreviousRechargeHistory = [];
  try {
    if (!ps.isCustomer(req)) {
      customerPreviousRechargeHistory = null;
    } else {
      const Plid = Number(req.user.plid);
      const rows = await db.proc(DB, 'usp_getcustomerpreviousrecharges', { clid: csInt32(Plid), operatorservicetype: OPERATORSERVICETYPE });
      customerPreviousRechargeHistory = mapRows(rows, HISTORY_PROPS).map((r) => ({
        ...r,
        CLID: isNull(r.CLID) ? 0 : Number(r.CLID),
        RECHARGEAMOUNT: isNull(r.RECHARGEAMOUNT) ? 0 : Number(r.RECHARGEAMOUNT),
      }));
    }
  } catch (ex) {
    customerPreviousRechargeHistory = null;
  }
  return customerPreviousRechargeHistory;
}

const outParam500 = (C, action) => (req, res) => {
  res.status(500).json({
    error: `Cannot call action method 'System.String ${action}(...)' on controller '${C}Controller' because the parameter 'System.String& APITransactionId' is passed by reference.`,
  });
};

/**
 * cfg: {
 *   prefix: 'Landline_Payment', view: '~/Views/Landline_Payment/Index.cshtml', friendly: ['Landline-Payment'],
 *   indexMasterpage: true,                       Index sets ViewBag.masterpageshow
 *   indexData: async (req) => ({ ... }),         values the view computes by calling static controller methods
 *   ambiguousMakePostpaid: false,                servicejewaria: a second public MakePostpaidRecharge(..., out string) overload exists
 *   requests: [{ action, kind, operatorType, proc, slug, resellerCheck, walletCheck, dob, fixedPmid }],
 *   makeActions: [{ action, kind }],  updateActions: [{ action, kind }]
 * }
 */
function buildPaymentVariantRouter(cfg) {
  const router = express.Router();
  const C = cfg.prefix;

  // ---------------------------------------------------------------- Index()  ([DistributerSessionExpireCheck] = no check)
  // route-config: friendly URLs -> <prefix>/Index
  // public
  router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, ...(cfg.friendly || []).map((f) => `/portal/${f}`)], ps.DistributerSessionExpireCheck,
    asyncHandler(async (req, res) => {
      const ViewBag = {};
      if (cfg.indexMasterpage) ViewBag.masterpageshow = masterpageshow(req);
      const extra = cfg.indexData ? await cfg.indexData(req) : {};
      return res.json({ view: cfg.view, ...ViewBag, ...extra });
    }));

  // ---------------------------------------------------------------- GetOperator(string MobileNo)
  // public (no session check in legacy)
  router.all(`/portal/${C}/GetOperator{/:id}`, asyncHandler(async (req, res) => {
    const MobileNo = isNull(req.p.MobileNo) ? null : req.p.MobileNo;
    if (!validateMobile(MobileNo)) return res.json('Invalid^Entered mobile number is invalid.');
    let OperatorInformation = '';
    const OBjApiServices = new ApiService();
    const MpObj = await OBjApiServices.GetOperator(MobileNo);
    if (isNull(MpObj)) throw NRE();
    if (!isNull(MpObj.cid)) {
      OperatorInformation = 'Valid' + '^' + MpObj.cid + '^' + str(MpObj.code) + '^' + str(MpObj.opid) + '^' + str(MpObj.provider) + '^' + str(MpObj.state);
    } else {
      return res.json('Invalid^Entered mobile number is invalid.');
    }
    return res.json(OperatorInformation);
  }));

  // ---------------------------------------------------------------- GenerateUniqueReqId()  (public string => content)
  // public (no session check in legacy)
  router.all(`/portal/${C}/GenerateUniqueReqId{/:id}`, asyncHandler(async (req, res) => {
    res.type('text/html').send(await GenerateUniqueReqId());
  }));

  // ---------------------------------------------------------------- isUniqueId(string GeneratedId)  (public bool => "True"/"False")
  // public (no session check in legacy)
  router.all(`/portal/${C}/isUniqueId{/:id}`, asyncHandler(async (req, res) => {
    const r = await isUniqueId(isNull(req.p.GeneratedId) ? null : req.p.GeneratedId);
    res.type('text/html').send(r ? 'True' : 'False');
  }));

  // ---------------------------------------------------------------- GetJewriaCashPoints(string UserName, string TransactionPassword, string JP)
  // auth (Session["plid"] == null => Json("error^loginrequired"))
  router.all(`/portal/${C}/GetJewriaCashPoints{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
    const g = (k) => (isNull(req.p[k]) ? null : req.p[k]);
    const UserName = g('UserName'); const TransactionPassword = g('TransactionPassword'); const JP = g('JP');
    let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
    // PORT-NOTE (legacy bug reproduced): "USP_JewriaCashPointDetails @DISTRIBUTORID,@MODE,@USERNAME,@TRANSACTIONPASSWORD,@JP" binds
    // POSITIONALLY against (@DISTRIBUTORID,@MODE,@JP,@USERNAMEJC,@TRANSACTIONPASSWORDJC,...): UserName -> @JP,
    // encrypted password -> @USERNAMEJC, JP -> @TRANSACTIONPASSWORDJC. Same binding kept.
    const Getwalletdiscount = await db.proc(DB, 'usp_jewriacashpointdetails', {
      distributorid: '1', mode: '2', jp: UserName, usernamejc: await UtilityClass.Encryptword(TransactionPassword), transactionpasswordjc: JP,
    });
    for (const Items of Getwalletdiscount) {
      Ewallet = str(col(Items, 'EWALLETCONSUMEPER'));
      Coinwallet = str(col(Items, 'COINWALLETCONSUMEPER'));
      Commition = str(col(Items, 'COMMISSIONWALLETCONSUMEPER'));
      PointWallet = str(col(Items, 'POINTREDEEMPERCENT'));
    }
    const FinalResult = 'success^' + Ewallet + '^' + Coinwallet + '^' + Commition + '^' + PointWallet;
    return res.json(FinalResult);
  }));

  /** validation block shared by Proceed / MakePostpaidRecharge (Convert.ToInt32 may throw => action catch). */
  function validateInput(Mobile, Amount, OpCode, OperatorName) {
    if (Mobile === '') return 'Invalid^Entered mobile number is invalid.';
    if (!validateMobile(Mobile)) return 'Invalid^Entered mobile number is invalid.';
    if (Amount === '') return 'Invalid^Amount is required.';
    if (OpCode === '') return 'Invalid^Operator name required.';
    if (OperatorName === '') return 'Invalid^Operator name required.';
    if (csInt32(Amount) < 0) return 'Invalid^Entered mobile number is invalid.';
    return null;
  }

  // ---------------------------------------------------------------- Proceed(string Mobile, string Amount, string OpCode, string OperatorName)
  // auth (Session["plid"] == null => Json("error^loginrequired"))
  router.all(`/portal/${C}/Proceed{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
    const g = (k) => (isNull(req.p[k]) ? null : req.p[k]);
    // eslint-disable-next-line no-unused-vars
    const Loginid = req.user.loginid; const PLID = req.user.plid;
    try {
      const err = validateInput(g('Mobile'), g('Amount'), g('OpCode'), g('OperatorName'));
      if (err) return res.json(err);
      // fund check (USP_SUCCESSORFAILEDRECHARGE mode 3) is commented out in the C#
      return res.json('success^0.00000000^0.00000000');
    } catch (Ex) {
      return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
    }
  }));

  // ---------------------------------------------------------------- MakePostpaidRecharge(Mobile, Amount, OpCode, OperatorName, ... 15 strings)  (JsonResult)
  async function MakePostpaidRechargeJsonAction(req, res) {
    const g = (k) => (isNull(req.p[k]) ? null : req.p[k]);
    const Mobile = g('Mobile'); const Amount = g('Amount'); const OpCode = g('OpCode'); const OperatorName = g('OperatorName');
    const JpPointRedeemPercentage = g('JpPointRedeemPercentage'); const EWalletRedeemPercentage = g('EWalletRedeemPercentage');
    const BvPercentage = g('BvPercentage'); const Discount = g('Discount'); const NetPayableAmount = g('NetPayableAmount');
    const IsDiscounTApplicabale = g('IsDiscounTApplicabale'); const UserName = g('UserName'); const TransactionPassword = g('TransactionPassword');
    const UserNameWallet = g('UserNameWallet'); const TransactionPasswordWallet = g('TransactionPasswordWallet'); const Paymode = g('Paymode');
    const Loginid = req.user.loginid;
    const PLID = req.user.plid;
    try {
      const err = validateInput(Mobile, Amount, OpCode, OperatorName);
      if (err) return res.json(err);

      // for check fund available or not
      const fundRows = await db.proc(DB, 'usp_successorfailedrecharge', {
        mode: '1', loginid: isNull(Loginid) ? null : Loginid, amount: NetPayableAmount,
        usernameewallet: UserNameWallet, transactionpasswordewallet: TransactionPasswordWallet, plid: PLID,
      });
      const StrResult = str(outOf(fundRows, 'STRRESULT'));
      if (StrResult.toLowerCase() !== 'success') return res.json('Invalid^' + StrResult + '');

      // check JC Point Available Or Not
      if (IsDiscounTApplicabale === '1') {
        const Getwalletdiscount = await db.proc(DB, 'usp_jewriacashpointdetails', {
          distributorid: '1', mode: '2', jp: Discount, usernamejc: UserName, transactionpasswordjc: TransactionPassword, plid: PLID,
        });
        const StrResultJc = str(outOf(Getwalletdiscount, 'STRRESULT'));
        if (StrResultJc.toLowerCase() !== 'success') {
          // legacy bug kept: message uses the FUND check StrResult, not StrResultJc
          return res.json('Invalid^' + StrResult + '');
        } else if (Getwalletdiscount.length === 0) {
          return res.json('Invalid^Insufficient JC Point in your JC Point Wallet');
        }
      }
      // fund / JC point deduction (USP_SUCCESSORFAILEDRECHARGE modes 2 and 4) is commented out in the C#

      // code start for actual recharge
      const UniqueReqId = await GenerateUniqueReqId();
      const ApiToken = config.app.Mobile_Api_Token || '';
      const OBjApiServices = new ApiService();
      const GetResult = await OBjApiServices.Recharge(ApiToken, Mobile, OpCode, Amount, UniqueReqId, '', '');
      if (isNull(GetResult)) throw NRE();
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
      if (isNull(OperatorName)) throw NRE(); // OperatorName.Trim()
      const hRows = await db.proc(DB, 'usp_maintainrechargehistory', {
        mode: '1', plid: PLID, mobile: mn, operator: String(OperatorName).trim(), amount: Amount, api_refid: apirefid, api_balance: balance,
        api_errorcode: ec, api_remark: remark, api_reqid: reqid, api_status: status, opcode: OpCode,
        jppointredeempercentage: JpPointRedeemPercentage, ewalletredeempercentage: EWalletRedeemPercentage, bvpercentage: BvPercentage,
        discount: Discount, netpayableamount: NetPayableAmount, isdiscountapplicabale: IsDiscounTApplicabale, usernamejc: UserName,
        transactionpasswordjc: TransactionPassword, usernameewallet: UserNameWallet, transactionpasswordewallet: TransactionPasswordWallet,
        paymode: Paymode, ordernumber: UniqueReqId,
      });
      const StrResultOutputHistory = str(outOf(hRows, 'StrResult'));
      if (StrResultOutputHistory.toLowerCase() === 'success') {
        return res.json('success^Your mobile recharge done successfully.Your order number is ' + reqid);
      }
      return res.json('Invalid^' + StrResultOutputHistory);
    } catch (Ex) {
      return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
    }
  }

  if (cfg.ambiguousMakePostpaid) {
    // PORT-NOTE: servicejewariaController declares TWO public methods named MakePostpaidRecharge (the JsonResult action and
    // `string MakePostpaidRecharge(..., out string APITransactionId)`) with no selector attributes, so MVC's ActionMethodSelector threw
    // AmbiguousMatchException (HTTP 500) for every /servicejewaria/MakePostpaidRecharge request. Reproduced. The JsonResult body is kept
    // as router.internals.MakePostpaidRechargeJsonAction(req, res) (identical to servicejewaria_Mobile/MakePostpaidRecharge).
    // auth (the JsonResult variant checks Session["plid"]; the ambiguity is raised before any action code runs)
    router.all(`/portal/${C}/MakePostpaidRecharge{/:id}`, (req, res) => {
      res.status(500).json({
        error: `The current request for action 'MakePostpaidRecharge' on controller type '${C}Controller' is ambiguous between the following action methods:\r\n`
          + `System.Web.Mvc.JsonResult MakePostpaidRecharge(System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String, System.String) on type ${C}Controller\r\n`
          + `System.String MakePostpaidRecharge(System.String, Int32, System.String, System.String, System.String, System.Decimal, System.String, System.String ByRef) on type ${C}Controller`,
      });
    });
  } else {
    // auth (Session["plid"] == null => Json("error^loginrequired"))
    router.all(`/portal/${C}/MakePostpaidRecharge{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(MakePostpaidRechargeJsonAction));
  }

  // ---------------------------------------------------------------- <X>RechargeRequests(MobileNo="", RechOpCode="", RechOpName="", RechOpService="", RechAmount="" [, reqDOB=""])
  for (const r of cfg.requests || []) {
    // auth (Session["Plid"] == null => Json("Error^Please login first"))
    router.all(`/portal/${C}/${r.action}{/:id}`, ...ps.customerOr('Error^Please login first'), asyncHandler(async (req, res) => {
      const d = (k) => (isNull(req.p[k]) ? '' : req.p[k]);
      const MobileNo = d('MobileNo'); const RechOpCode = d('RechOpCode'); const RechOpName = d('RechOpName');
      const RechOpService = d('RechOpService'); const RechAmount = d('RechAmount');
      const reqDOB = r.dob ? d('reqDOB') : undefined;
      let result = '';
      try {
        if (r.resellerCheck) {
          const ResellerId = Number(isNull(req.user.did) ? 0 : req.user.did); // Convert.ToInt64(Login.DID)
          const w = await db.scalar(DB, 'select coalesce(available_wallet, 0) as available_wallet from tbl_distributor_prepaid_setting where pmid = @pmid limit 1',
            { pmid: ResellerId });
          const ResellerWallet = isNull(w) ? 0 : Number(w);
          if (ResellerWallet < csDecimal(RechAmount)) return res.json('FAILED^Insufficient fund in reseller wallet');
        }
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
          if (r.walletCheck) {
            const walletAmount = await CutomerWalletProcess.GetUserWalletBalance(csInt32(Plid));
            if (walletAmount < reqAmount) {
              result = 'Error^Insufficient amount in wallet';
              return res.json(result);
            }
          }
          // payment gateway parameters
          const requestedURL = config.app.CompanyDomain;
          if (isNull(requestedURL)) throw NRE(); // AppSettings["CompanyDomain"].ToString()
          const successurl = requestedURL + `/secure-eblaa-payment-gateway/${r.slug}-success`;
          const failureurl = requestedURL + `/secure-eblaa-payment-gateway/${r.slug}-failed`;
          const inprocessurl = requestedURL + `/secure-eblaa-payment-gateway/${r.slug}-inprocess`;
          const canceledurl = requestedURL + `/secure-eblaa-payment-gateway/${r.slug}-cancel`;

          const params = {
            clid: Plid, mobileno: MobileNo, operatortype: r.operatorType, operatorname: RechOpName, operatorcode: RechOpCode,
            operatorservice: RechOpService, rechargeamount: reqAmount,
          };
          if (r.dob) params.customerdob = reqDOB;
          Object.assign(params, { successurl, failureurl, inprocessurl, cancelledurl: canceledurl });
          const out = await db.procOne(DB, r.proc, params);
          const StrOutput = str(col(out, 'stroutput'));
          const StrTransactionId = str(col(out, 'transactionid'));
          if (StrOutput.toLowerCase() === 'success' && StrTransactionId !== '') {
            ps.sessionSet(req, 'MobileNo', MobileNo);
            ps.sessionSet(req, 'RechOpCode', RechOpCode);
            ps.sessionSet(req, 'RechOpName', RechOpName);
            ps.sessionSet(req, 'RechOpService', RechOpService);
            ps.sessionSet(req, 'RechAmount', RechAmount);
            ps.sessionSet(req, 'StrTransactionId', StrTransactionId);
            if (r.dob) ps.sessionSet(req, 'RechDOB', reqDOB);
            const BaseURL = config.app.PaymentURL;
            if (isNull(BaseURL)) throw NRE(); // AppSettings["PaymentURL"].ToString()
            const PMID = isNull(r.fixedPmid) ? CompanySettings.PMID : r.fixedPmid;
            const E = (s) => UtilityClass.Encryptword(s);
            const Url = 'Ok^' + BaseURL + 'Home?refrenceid=' + await E(StrTransactionId) + '&successurl=' + await E(successurl)
              + '&failureurl=' + await E(failureurl) + '&inprocessurl=' + await E(inprocessurl) + '&canceledurl=' + await E(canceledurl)
              + '&source=' + await E('Recharge') + '&PMID=' + await E(str(PMID)) + '';
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
  }

  // ---------------------------------------------------------------- Make<X>Recharge(..., out string APITransactionId)
  // PORT-NOTE: MVC cannot invoke an action with an out parameter (InvalidOperationException, HTTP 500); reproduced. The logic is kept
  // as router.internals.Make<X>Recharge (used by the Online*RechargeResponse controllers).
  for (const m of cfg.makeActions || []) {
    // public (fails before any action code runs)
    router.all(`/portal/${C}/${m.action}{/:id}`, outParam500(C, m.action));
  }

  // ---------------------------------------------------------------- Update<X>RechargeStatus(custTranid, APITranId, rechstatus, rechRemarks)
  for (const u of cfg.updateActions || []) {
    // auth (legacy had no session check; it rewrites recharge status rows, so it is protected here - same choice as batch-09)
    router.all(`/portal/${C}/${u.action}{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
      const g = (k) => (isNull(req.p[k]) ? null : req.p[k]);
      const r = await updateRechargeStatus(u.kind, g('custTranid'), g('APITranId'), g('rechstatus'), g('rechRemarks'));
      res.type('text/html').send(r);
    }));
  }

  router.internals = { isUniqueId, GenerateUniqueReqId, MakePostpaidRechargeJsonAction };
  for (const m of cfg.makeActions || []) {
    router.internals[m.action] = (...a) => makeRecharge(m.kind, ...a);
  }
  for (const u of cfg.updateActions || []) {
    router.internals[u.action] = (...a) => updateRechargeStatus(u.kind, ...a);
  }
  return router;
}

/** OnlineDTHRechargeResponseController (RechargeSuccess / RechargeFailed / RechargeInProcess / RechargeCancel). */
function buildDthResponseRouter() {
  const router = express.Router();
  const P = '/portal/OnlineDTHRechargeResponse';
  const FR = (s) => `/portal/secure-eblaa-payment-gateway/dth-recharge-${s}`;
  const send = (res, ViewBag) => res.json({ ViewBag, ...ViewBag });
  const refOf = (req) => (isNull(req.p.refrenceid) ? '' : String(req.p.refrenceid));
  const toDecimal = (v) => {
    const s = String(v).trim();
    const n = Number(s);
    if (s === '' || !Number.isFinite(n)) throw FORMAT_ERR();
    return n;
  };

  // public (gateway return URL; identity from the session cookie snapshot; null session => NullReferenceException => catch branch)
  // route-config: secure-eblaa-payment-gateway/dth-recharge-success
  router.all([P + '/RechargeSuccess{/:id}', FR('success')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    let refrenceid = refOf(req);
    try {
      ViewBag.masterpageshow = masterpageshow(req);
      const login = ps.getCustomerLogin(req);
      if (!login) throw NRE(); // ((Login)Session["Plid"]).Plid
      const Plid = Number(login.Plid);
      if (refrenceid !== '' && Plid !== 0) {
        const chkReferenceId = await UtilityClass.Decryptword(refrenceid);
        if (chkReferenceId !== '') refrenceid = chkReferenceId;
        // Validate Transaction
        const row = await db.procOne(DB, 'usp_validate_customer_dth_recharge', { transactionid: refrenceid });
        if (outVal(row, 'STROUTPUT').toLowerCase() === 'success') {
          const g = (k) => ps.sessionGet(req, k);
          if (g('MobileNo') !== null && g('RechOpCode') !== null && g('RechOpName') !== null && g('RechOpService') !== null
            && g('RechAmount') !== null && g('StrTransactionId') !== null) {
            const { rechargeStatus } = await makeRecharge('DTH', String(g('MobileNo')), csInt32(Math.round(Plid)), String(g('RechOpCode')),
              String(g('RechOpName')), String(g('RechOpService')), toDecimal(String(g('RechAmount'))), String(g('StrTransactionId')));
            const U = rechargeStatus.toUpperCase();
            if (U === 'SUCCESS' || U === 'PENDING') {
              ViewBag.PaymentStatus = U;
              ViewBag.TransactionId = refrenceid;
              await SendConfirmationMailAndMessages(refrenceid, U);
            }
            if (U === 'ERROR' || U === 'FAILURE') {
              ViewBag.PaymentStatus = 'ERROR';
              ViewBag.TransactionId = refrenceid;
              await SendConfirmationMailAndMessages(refrenceid, rechargeStatus.toLowerCase());
            }
          } else {
            ViewBag.PaymentStatus = 'Error';
          }
        }
      } else {
        ViewBag.PaymentStatus = 'Error';
      }
      return send(res, ViewBag);
    } catch (ex) {
      await UtilityClass.TrackError(ex.message);
      ViewBag.PaymentStatus = 'Something went wrong please try again!';
      ViewBag.TransactionId = refrenceid;
      return send(res, ViewBag);
    }
  }));

  // public (gateway return URL)
  // route-config: secure-eblaa-payment-gateway/dth-recharge-failed
  router.all([P + '/RechargeFailed{/:id}', FR('failed')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    let refrenceid = refOf(req);
    try {
      ViewBag.masterpageshow = masterpageshow(req);
      let strOutput = '';
      if (refrenceid !== '') {
        refrenceid = await UtilityClass.Decryptword(refrenceid); // DTH decrypts here (Electricity/Gas do not)
        const row = await db.procOne(DB, 'usp_update_customer_payment_response', {
          custtransactionid: refrenceid, apitransactionid: '', rechargeresponsestatus: 'FAILED', rechargeresponseremarks: 'Cancelled by user',
        });
        strOutput = outVal(row, 'STROUTPUT');
        await db.proc(DB, 'usp_returnresellerwallet', { mode: 2, ordernumber: refrenceid });
        if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
          ViewBag.PaymentStatus = 'FAILED';
          ViewBag.TransactionId = refrenceid;
          await SendConfirmationMailAndMessages(refrenceid, 'FAILED');
        }
      } else {
        ViewBag.PaymentStatus = 'Error';
      }
      return send(res, ViewBag);
    } catch (ex) {
      ViewBag.PaymentStatus = 'Something went wrong please try again!';
      ViewBag.TransactionId = refrenceid;
      return send(res, ViewBag);
    }
  }));

  // public (gateway return URL)
  // route-config: secure-eblaa-payment-gateway/dth-recharge-inprocess
  router.all([P + '/RechargeInProcess{/:id}', FR('inprocess')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    const refrenceid = refOf(req);
    if (refrenceid !== '') ViewBag.PaymentInProcess = 'Success';
    else ViewBag.PaymentInProcess = 'Error';
    ViewBag.masterpageshow = masterpageshow(req);
    return send(res, ViewBag);
  }));

  // public (gateway return URL)
  // route-config: secure-eblaa-payment-gateway/dth-recharge-cancel
  router.all([P + '/RechargeCancel{/:id}', FR('cancel')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    const refrenceid = refOf(req);
    try {
      ViewBag.masterpageshow = masterpageshow(req);
      let strOutput = '';
      if (refrenceid !== '') {
        // refrenceid = UtilityClass.Decryptword(refrenceid);  (commented out in the DTH C#)
        const row = await db.procOne(DB, 'usp_update_customerpaymentsstatus', { mode: 3, transid: refrenceid });
        strOutput = outVal(row, 'STROUTPUT');
        await db.proc(DB, 'usp_returnresellerwallet', { mode: 2, ordernumber: refrenceid });
        if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
          ViewBag.PaymentStatus = 'CANCEL';
          ViewBag.TransactionId = refrenceid;
        }
      } else {
        ViewBag.PaymentStatus = 'Error';
      }
      return send(res, ViewBag);
    } catch (ex) {
      ViewBag.PaymentStatus = 'Something went wrong please try again!';
      ViewBag.TransactionId = refrenceid;
      return send(res, ViewBag);
    }
  }));

  return router;
}

module.exports = {
  DB, NRE, str, csInt32, csDecimal, validateMobile, col, jtok, outOf, masterpageshow,
  GetOperatorsList, isUniqueId, GenerateUniqueReqId, RECHARGE_KINDS, updateRechargeStatus, makeRecharge, getCustomerPreviousRecharges,
  buildPaymentVariantRouter, buildDthResponseRouter,
};
