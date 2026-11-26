'use strict';
/**
 * Shared helpers for portal batch 10 (Insurance_Payment, Landline_Payment, OnlineDTHRechargeResponse, Login_as_*, Home, ...).
 * Not a router (lives in _shared/). Ported from:
 *   Controllers/Insurance_Payment.cs + Controllers/Landline_Payment.cs (identical recharge helpers: ValidateMobile, GetOperator,
 *     GenerateUniqueReqId, isUniqueId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, GetResponseMeaning, Get*OperatorsList),
 *   Controllers/Dth_Payment.cs MakeDTHRecharge / UpdateDTHRechargeStatus (used by OnlineDTHRechargeResponse; Dth_Payment is ported
 *     by another batch, its logic is re-implemented here so this batch does not depend on a sibling module),
 *   Controllers/OnlineDTHRechargeResponseController.cs SendConfirmationMailAndMessages (static helper).
 * Plus .NET semantics helpers (MVC string binding, Convert.ToInt32/ToDecimal, decimal ToString, JToken.ToString).
 */
const axios = require('axios');
const config = require('../../../config');
const db = require('../../../db');
const { mapRow, mapRows } = require('../../../utils/shape');
const ps = require('./portal-session');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const ApiService = require('../../../lib/portal/ApiService');
const CompanySettings = require('../../../lib/portal/CompanySettings');
const SendMail = require('../../../lib/portal/SendMail');

const DB = 'shopping';

// ------------------------------------------------------------------ .NET semantics

const NRE_MSG = 'Object reference not set to an instance of an object.';
const FORMAT_MSG = 'Input string was not in a correct format.';
const nre = () => new Error(NRE_MSG);

/** MVC string action parameter: absent => default value, "" => null (ConvertEmptyStringToNull), otherwise the string. */
function mvcStr(v, def = null) {
  if (v === undefined) return def;
  if (v === null) return null;
  if (Array.isArray(v)) v = v.join(',');
  const s = String(v);
  return s === '' ? null : s;
}

/** Non-nullable value-type action parameter (int / Int64): missing or not convertible => MVC throws before the action runs. */
function mvcInt(req, name) {
  const v = req.p[name];
  const s = v === undefined || v === null ? '' : String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type. An optional parameter must be a reference type, a nullable type, or be declared as an optional parameter.`);
    e.status = 500;
    throw e;
  }
  return Number(s);
}

/** Convert.ToInt32(string): null => 0, invalid => FormatException. */
function toInt32(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v);
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error(FORMAT_MSG);
  return Number(s);
}

/** Convert.ToDecimal(string) => canonical C# decimal string (scale kept). null => "0", invalid => FormatException. */
function toDecimalStr(v) {
  if (v === null || v === undefined) return '0';
  if (typeof v === 'number') return String(v);
  const s = String(v).trim().replace(/,/g, '');
  const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(s);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) throw new Error(FORMAT_MSG);
  const ip = (m[2] || '0').replace(/^0+(?=\d)/, '');
  const fp = m[3] || '';
  const neg = m[1] === '-' && /[1-9]/.test(ip + fp);
  return (neg ? '-' : '') + ip + (fp ? '.' + fp : '');
}

function splitDec(d) {
  const s = toDecimalStr(d);
  const neg = s.startsWith('-');
  const [ip, fp = ''] = (neg ? s.slice(1) : s).split('.');
  return { neg, digits: BigInt(ip + fp), scale: fp.length };
}
function fmtBig(neg, big, scale) {
  let str = big.toString().padStart(scale + 1, '0');
  if (scale > 0) str = str.slice(0, str.length - scale) + '.' + str.slice(str.length - scale);
  return (neg && big !== 0n ? '-' : '') + str;
}

/** decimal * (decimal)int, C# keeps the scale of the decimal operand. */
function decMulInt(dec, n) {
  const a = splitDec(dec);
  const b = BigInt(Math.trunc(Number(n)));
  const neg = (a.neg ? -1n : 1n) * (b < 0n ? -1n : 1n) < 0n;
  const abs = a.digits * (b < 0n ? -b : b);
  return fmtBig(neg, abs, a.scale);
}

/** decimal.ToString("0.00") (MidpointRounding.AwayFromZero). */
function fmt00(dec) {
  const a = splitDec(dec);
  let big = a.digits; let scale = a.scale;
  if (scale > 2) {
    const div = 10n ** BigInt(scale - 2);
    const q = big / div; const r = big % div;
    big = q + (r * 2n >= div ? 1n : 0n);
    scale = 2;
  }
  while (scale < 2) { big *= 10n; scale += 1; }
  return fmtBig(a.neg, big, 2);
}

/** C# string concatenation of a value: null => "". */
const cat = (v) => (v === null || v === undefined ? '' : String(v));

/** SqlParameter OUT value .ToString(): DBNull => "". */
function outStr(row, name) {
  if (!row) return '';
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  const v = k === undefined ? null : row[k];
  return v === null || v === undefined ? '' : String(v);
}

/** JObject["key"].ToString(): missing => NullReferenceException; strings raw; objects/arrays indented (Json.NET). */
function jtok(obj, key) {
  if (!obj || typeof obj !== 'object' || !Object.prototype.hasOwnProperty.call(obj, key)) throw nre();
  const v = obj[key];
  if (v === null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'number') return String(v);
  return JSON.stringify(v, null, 2).replace(/\n/g, '\r\n');
}

/** HttpContext.Request.Url.ToString() / AbsoluteUri */
function fullUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin" else "" */
function masterpageshow(req) {
  return ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
}

// ------------------------------------------------------------------ recharge helpers (Insurance_Payment.cs / Landline_Payment.cs)

const RechargeAPIURL = () => (config.app.RechargeAPIURL || '');

/** private bool ValidateMobile(string) - Regex.IsMatch(null) throws ArgumentNullException. */
function ValidateMobile(mobileNumber) {
  if (mobileNumber === null || mobileNumber === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(String(mobileNumber));
}

/** JsonResult GetOperator(string MobileNo) */
async function GetOperator(MobileNo) {
  if (!ValidateMobile(MobileNo)) return 'Invalid^Entered mobile number is invalid.';
  const OBjApiServices = new ApiService();
  const MpObj = await OBjApiServices.GetOperator(MobileNo);
  if (!MpObj) throw nre(); // legacy: MpObj.cid on a null proxy result
  if (MpObj.cid !== null && MpObj.cid !== undefined) {
    return 'Valid' + '^' + cat(MpObj.cid) + '^' + cat(MpObj.code) + '^' + cat(MpObj.opid) + '^' + cat(MpObj.provider) + '^' + cat(MpObj.state);
  }
  return 'Invalid^Entered mobile number is invalid.';
}

/** public bool isUniqueId(string GeneratedId) - Db._Tbl_RechargeHistory.Where(Api_REQID == GeneratedId) */
async function isUniqueId(GeneratedId) {
  const Row = await db.queryOne(DB, 'select api_reqid from tbl_rechargehistory where api_reqid = @GeneratedId limit 1', { GeneratedId });
  if (Row !== null) {
    if (Row.api_reqid === GeneratedId) return false;
    return true;
  }
  return true;
}

/** public string GenerateUniqueReqId() */
async function GenerateUniqueReqId() {
  let GeneratedId = '';
  for (;;) {
    GeneratedId = await UtilityClass.RandomStringByLength(20);
    const Check = await isUniqueId(GeneratedId);
    if (Check) break;
  }
  return GeneratedId;
}

const GetWalletDiscount = ['EWALLETCONSUMEPER', 'COINWALLETCONSUMEPER', 'COMMISSIONWALLETCONSUMEPER', 'POINTREDEEMPERCENT', 'StrOutPut', 'Mobile', 'OTP'];

/** JsonResult GetJewriaCashPoints(string UserName, string TransactionPassword, string JP) (login checked by the route middleware) */
async function GetJewriaCashPoints(UserName, TransactionPassword, JP) {
  let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
  // PORT-NOTE: legacy command text "USP_JewriaCashPointDetails @DISTRIBUTORID,@MODE,@USERNAME,@TRANSACTIONPASSWORD,@JP" binds
  // POSITIONALLY to the procedure (@DISTRIBUTORID,@MODE,@JP,@USERNAMEJC,@TRANSACTIONPASSWORDJC,...): UserName lands in @JP,
  // the encrypted password in @USERNAMEJC and JP in @TRANSACTIONPASSWORDJC. Reproduced as-is (legacy bug).
  const rows = mapRows(await db.proc(DB, 'usp_jewriacashpointdetails', {
    distributorid: '1', mode: '2', jp: UserName, usernamejc: await UtilityClass.Encryptword(TransactionPassword), transactionpasswordjc: JP,
  }), GetWalletDiscount);
  for (const Items of rows) {
    Ewallet = cat(Items.EWALLETCONSUMEPER);
    Coinwallet = cat(Items.COINWALLETCONSUMEPER);
    Commition = cat(Items.COMMISSIONWALLETCONSUMEPER);
    PointWallet = cat(Items.POINTREDEEMPERCENT);
  }
  return 'success^' + Ewallet + '^' + Coinwallet + '^' + Commition + '^' + PointWallet;
}

/** Common input validation of Proceed / MakePostpaidRecharge. Returns the error string or null. Throws like C#. */
function validateRechargeInput(Mobile, Amount, OpCode, OperatorName) {
  if (Mobile === '') return 'Invalid^Entered mobile number is invalid.';
  if (!ValidateMobile(Mobile)) return 'Invalid^Entered mobile number is invalid.';
  if (Amount === '') return 'Invalid^Amount is required.';
  if (OpCode === '') return 'Invalid^Operator name required.';
  if (OperatorName === '') return 'Invalid^Operator name required.';
  if (toInt32(Amount) < 0) return 'Invalid^Entered mobile number is invalid.';
  return null;
}

/** JsonResult Proceed(string Mobile, string Amount, string OpCode, string OperatorName) (login checked by the route middleware) */
async function Proceed(req, Mobile, Amount, OpCode, OperatorName) {
  const Loginid = req.user.loginid; // eslint-disable-line no-unused-vars
  const PLID = req.user.plid; // eslint-disable-line no-unused-vars
  try {
    const err = validateRechargeInput(Mobile, Amount, OpCode, OperatorName);
    if (err) return err;
    return 'success^0.00000000^0.00000000';
  } catch (Ex) {
    return 'Invalid^Some error occured. Please try again.' + Ex.message;
  }
}

/** JsonResult MakePostpaidRecharge(...) (login checked by the route middleware) */
async function MakePostpaidRecharge(req, a) {
  const Loginid = req.user.loginid;
  const PLID = req.user.plid;
  try {
    const err = validateRechargeInput(a.Mobile, a.Amount, a.OpCode, a.OperatorName);
    if (err) return err;

    // check fund available or not
    const r1 = await db.procOne(DB, 'usp_successorfailedrecharge', {
      mode: '1', loginid: Loginid, amount: a.NetPayableAmount, usernameewallet: a.UserNameWallet,
      transactionpasswordewallet: a.TransactionPasswordWallet, plid: PLID,
    });
    const StrResult = outStr(r1, 'strresult');
    if (StrResult.toLowerCase() !== 'success') return 'Invalid^' + StrResult + '';

    // check JC Point available or not
    if (a.IsDiscounTApplicabale === '1') {
      const rows = await db.proc(DB, 'usp_jewriacashpointdetails', {
        distributorid: '1', mode: '2', jp: a.Discount, usernamejc: a.UserName, transactionpasswordjc: a.TransactionPassword, plid: PLID,
      });
      // PORT-NOTE: @STRRESULT OUT is read from the "strresult" (or "stroutput") column of the first row.
      const StrResultJc = rows.length ? (outStr(rows[0], 'strresult') || outStr(rows[0], 'stroutput')) : '';
      if (StrResultJc.toLowerCase() !== 'success') {
        return 'Invalid^' + StrResult + ''; // legacy bug kept: returns the first StrResult, not StrResultJc
      } else if (rows.length === 0) {
        return 'Invalid^Insufficient JC Point in your JC Point Wallet';
      }
    }

    // actual recharge
    const UniqueReqId = await GenerateUniqueReqId();
    const ApiToken = config.app.Mobile_Api_Token || '';
    const OBjApiServices = new ApiService();
    const GetResult = await OBjApiServices.Recharge(ApiToken, a.Mobile, a.OpCode, a.Amount, UniqueReqId, '', '');
    if (!GetResult) throw nre();
    const reqid = GetResult.reqid == null ? '0' : GetResult.reqid;
    const status = GetResult.status == null ? '' : GetResult.status;
    const remark = GetResult.remark == null ? '' : GetResult.remark;
    const balance = GetResult.balance == null ? '0.00000000' : GetResult.balance;
    const mn = GetResult.mn == null ? '' : GetResult.mn;
    const field1 = GetResult.field1 == null ? '' : GetResult.field1; // eslint-disable-line no-unused-vars
    const ec = GetResult.ec == null ? '' : GetResult.ec;
    const apirefid = GetResult.apirefid == null ? '' : GetResult.apirefid;
    const amt = GetResult.amt == null ? '0.00000000' : GetResult.amt; // eslint-disable-line no-unused-vars

    // save recharge history
    const h = await db.procOne(DB, 'usp_maintainrechargehistory', {
      mode: '1', plid: PLID, mobile: mn, operator: String(a.OperatorName).trim(), amount: a.Amount, api_refid: apirefid,
      api_balance: balance, api_errorcode: ec, api_remark: remark, api_reqid: reqid, api_status: status, opcode: a.OpCode,
      jppointredeempercentage: a.JpPointRedeemPercentage, ewalletredeempercentage: a.EWalletRedeemPercentage, bvpercentage: a.BvPercentage,
      discount: a.Discount, netpayableamount: a.NetPayableAmount, isdiscountapplicabale: a.IsDiscounTApplicabale, usernamejc: a.UserName,
      transactionpasswordjc: a.TransactionPassword, usernameewallet: a.UserNameWallet, transactionpasswordewallet: a.TransactionPasswordWallet,
      paymode: a.Paymode, ordernumber: UniqueReqId,
    });
    const StrResultOutputHistory = outStr(h, 'strresult');
    if (StrResultOutputHistory.toLowerCase() === 'success') {
      return 'success^Your mobile recharge done successfully.Your order number is ' + reqid;
    }
    return 'Invalid^' + StrResultOutputHistory;
  } catch (Ex) {
    return 'Invalid^Some error occured. Please try again.' + Ex.message;
  }
}

/** Reads the MakePostpaidRecharge action parameters (MVC string binding). */
function postpaidArgs(req) {
  const names = ['Mobile', 'Amount', 'OpCode', 'OperatorName', 'JpPointRedeemPercentage', 'EWalletRedeemPercentage', 'BvPercentage', 'Discount',
    'NetPayableAmount', 'IsDiscounTApplicabale', 'UserName', 'TransactionPassword', 'UserNameWallet', 'TransactionPasswordWallet', 'Paymode'];
  const a = {};
  for (const n of names) a[n] = mvcStr(req.p[n]);
  return a;
}

/** private string GetResponseMeaning(string ResponseCode) */
function GetResponseMeaning(ResponseCode) {
  const map = {
    1000: 'Success', 1002: 'Login Failed', 1003: 'Access Denied', 1004: 'API Not Assigned', 1005: 'Invalid Mobile Number', 1006: 'Invalid Amount',
    1007: 'Duplicate Reqid', 1008: 'Network Error', 1009: 'Frequent Recharge', 1010: 'Recharge Pending', 1011: 'Internal Error', 1013: 'Operator Down',
    1014: 'Refund', 1015: 'Insufficient Balance', 1016: 'Insufficient Minimum Balance', 1017: 'Refund Declined',
  };
  return Object.prototype.hasOwnProperty.call(map, String(ResponseCode)) ? map[String(ResponseCode)] : 'Error';
}

const ProviderLists = ['SNO', 'ProductName', 'Code', 'Service', 'MinAmount', 'Status', 'BaseUrl', 'ImageName'];

/** public static List<ProviderLists> Get<X>OperatorsList() - POST RechargeAPIURL/api/Get-ProvideList. null on any failure. */
async function GetOperatorsList(clid, service) {
  try {
    const StrPostData = JSON.stringify({ uidno: '', clid, service, serviceCode: '' });
    const resp = await axios.post(RechargeAPIURL() + '/api/Get-ProvideList', StrPostData, {
      headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: [(d) => d],
    });
    const ObjOperatorDetails = JSON.parse(String(resp.data));
    const Flag = jtok(ObjOperatorDetails, 'Flag');
    jtok(ObjOperatorDetails, 'Message');
    if (Flag === 'success') {
      const Details = jtok(ObjOperatorDetails, 'providelist');
      if (Details !== '[]') {
        const arr = JSON.parse(Details);
        if (!Array.isArray(arr)) throw new Error('Error reading JArray from JsonReader.');
        return arr.map((x) => (x === null ? null : mapRow(x, ProviderLists)));
      }
      return null;
    }
    return null;
  } catch (ex) {
    return null;
  }
}

/** JavaScriptSerializer for the recharge request: decimal written raw (scale kept), DateTime as "\/Date(ms)\/". */
function serializeRechargeRequest(o) {
  const parts = [];
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (k === 'amount') parts.push(`"amount":${toDecimalStr(v)}`);
    else if (v instanceof Date) parts.push(`"${k}":"\\/Date(${v.getTime()})\\/"`);
    else parts.push(`"${k}":${JSON.stringify(v === undefined ? null : v)}`);
  }
  return '{' + parts.join(',') + '}';
}

/** Update<X>RechargeStatus(custTranid, APITranId, rechstatus, rechRemarks) - always returns "". */
async function UpdateRechargeStatus(procName, custTranid, APITranId, rechstatus, rechRemarks) {
  const updateResponse = '';
  try {
    const r = await db.procOne(DB, procName, {
      custtransactionid: custTranid, apitransactionid: APITranId, rechargeresponsestatus: rechstatus, rechargeresponseremarks: rechRemarks,
    });
    outStr(r, 'stroutput');
  } catch (ex) { /* legacy: swallowed */ }
  return updateResponse;
}

/**
 * Make<X>Recharge(...) with the C# `out string APITransactionId` returned as a property.
 * opts: { service, endpoint, detailsKey, updateProc, MobileNo, CLID, RechOpCode, RechAmount, TransactionId, DOB? (Date, only Insurance) }
 * Returns { rechargeStatus, APITransactionId }.
 */
async function MakeBillRecharge(opts) {
  let rechargeStatus = ''; let APITransactionId = '';
  try {
    const rechargeReq = {
      uidno: '', clid: opts.CLID, service: opts.service, serviceCode: opts.RechOpCode, number: opts.MobileNo, amount: opts.RechAmount,
      CustomerTransID: opts.TransactionId,
    };
    if (Object.prototype.hasOwnProperty.call(opts, 'DOB')) rechargeReq.DOB = opts.DOB;
    const StrPostData = serializeRechargeRequest(rechargeReq);
    const resp = await axios.post(RechargeAPIURL() + opts.endpoint, StrPostData, {
      headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: [(d) => d],
    });
    const ObjRechargeResponse = JSON.parse(String(resp.data));
    const Flag = jtok(ObjRechargeResponse, 'Flag');
    const Message = jtok(ObjRechargeResponse, 'Message');
    if (Flag.toUpperCase() === 'SUCCESS' || Flag.toUpperCase() === 'PENDING') {
      const responseAPITransactionId = jtok(ObjRechargeResponse, 'APITransID');
      jtok(ObjRechargeResponse, 'CustomerTransID');
      const responseRechargeDetails = jtok(ObjRechargeResponse, opts.detailsKey);
      rechargeStatus = Flag.toUpperCase();
      APITransactionId = responseAPITransactionId;
      await UpdateRechargeStatus(opts.updateProc, opts.TransactionId, responseAPITransactionId, Flag.toUpperCase(), responseRechargeDetails);
    } else if (Flag.toUpperCase() === 'ERROR') {
      rechargeStatus = Flag.toUpperCase();
      APITransactionId = '';
      await UpdateRechargeStatus(opts.updateProc, opts.TransactionId, '', 'ERROR', Message);
    } else {
      rechargeStatus = 'ERROR';
      APITransactionId = '';
      await UpdateRechargeStatus(opts.updateProc, opts.TransactionId, '', 'FAILED', Message);
    }
  } catch (ex) {
    rechargeStatus = '';
    APITransactionId = '';
  }
  return { rechargeStatus, APITransactionId };
}

/** Dth_PaymentController.MakeDTHRecharge(MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId, out APITransactionId) */
function MakeDTHRecharge(MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId) {
  return MakeBillRecharge({
    service: 'DTH', endpoint: '/api/Get-DTHRecharge', detailsKey: 'DTHRechargeDetails', updateProc: 'usp_update_customer_dth_recharge_response',
    MobileNo, CLID, RechOpCode, RechAmount, TransactionId,
  });
}

// ------------------------------------------------------------------ OnlineDTHRechargeResponseController.SendConfirmationMailAndMessages

const CustomerRechargeDetails = ['Name', 'EmailId', 'CLID', 'MobileNo', 'Amount', 'OperatorCode'];

/** decimal(18,2) value from a procedure (pg returns a JS number) rendered as C# decimal.ToString() */
function dec2(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  return fmt00(String(v));
}

/** public static void SendConfirmationMailAndMessages(string TransId, string Status) - the send part runs in a background "thread". */
async function SendConfirmationMailAndMessages(TransId, Status) {
  const row = await db.procOne(DB, 'usp_getcustomerdetails_by_rech_transid', { transid: TransId });
  const custDetails = row ? mapRow(row, CustomerRechargeDetails) : null;
  if (String(Status).toUpperCase() !== 'SUCCESS' && String(Status).toUpperCase() !== 'PENDING') Status = 'Failed';
  (async () => {
    let rechargeEmailStatus = '';
    if (custDetails === null) return;
    const S = String(Status).toUpperCase();
    if (S === 'SUCCESS') rechargeEmailStatus = 'processed';
    else if (S === 'PENDING') rechargeEmailStatus = 'in pending stage';
    else rechargeEmailStatus = 'failed';
    const opc = () => { if (custDetails.OperatorCode === null) throw nre(); return String(custDetails.OperatorCode).toLowerCase(); };
    // PORT-NOTE: Amount (decimal(18,2) in the proc) is rendered with 2 decimals, like the C# decimal.
    const amt = dec2(custDetails.Amount);
    const note = '. \r\nNote: Please remember system will be check every transaction after 2 hours. So if the transaction will be failed then your amount will be auto refunded to your wallet. \r\n Team ' + cat(CompanySettings.CompanyName) + '';
    const isFail = S === 'ERROR' || S === 'FAILURE' || S === 'FAILED';
    const mailBody = (sep) => 'Your ' + opc() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + sep + ' Note: Please remember system will be check every transaction after 2 hours. So if the transaction will be failed then your amount will be auto refunded to your wallet.' + (sep === '. <br/><br/>' ? '<br/>' : ' <br/>') + ' Team ' + cat(CompanySettings.CompanyName) + '';
    if (custDetails.Name !== '' && custDetails.EmailId === '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + note);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + note);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + note);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('. <br/><br/>'));
    }
    if (custDetails.Name === '' && custDetails.EmailId !== '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been successfully done' + note);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been in pending stage' + note);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been failed' + note);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('.<br/><br/>'));
    }
    if (custDetails.Name !== '' && custDetails.EmailId !== '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been successfully done' + note);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been in pending stage' + note);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + opc() + ' recharge Rs.' + amt + ' has been failed' + note);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('.<br/><br/>'));
    }
  })().catch((e) => console.error(e));
}

module.exports = {
  DB, NRE_MSG, FORMAT_MSG, nre, mvcStr, mvcInt, toInt32, toDecimalStr, decMulInt, fmt00, cat, outStr, jtok, fullUrl, masterpageshow, dec2,
  ValidateMobile, GetOperator, isUniqueId, GenerateUniqueReqId, GetJewriaCashPoints, Proceed, MakePostpaidRecharge, postpaidArgs,
  GetResponseMeaning, GetOperatorsList, serializeRechargeRequest, UpdateRechargeStatus, MakeBillRecharge, MakeDTHRecharge,
  SendConfirmationMailAndMessages, ProviderLists, CustomerRechargeDetails,
};
