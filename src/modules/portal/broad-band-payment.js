'use strict';
// Ported from ClusterofferShopingPortal\Controllers\BroadBand_Payment.cs (class BroadBand_PaymentController => /portal/BroadBand_Payment/...)
// Database: shopping (Db_Shopping; portal DataBaseContext).
// Procs: USP_JewriaCashPointDetails, USP_SUCCESSORFAILEDRECHARGE, Usp_MaintainRechargeHistory. Table: Tbl_RechargeHistory.
// External: ApiService (TopUpServices SOAP: GetOperator, Recharge). Config: Mobile_Api_Token.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const config = require('../../config');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ApiService = require('../../lib/portal/ApiService');
const ps = require('./_shared/portal-session');
const { DB, cvtInt32, argNull, nre, content, masterpageshow } = require('./_shared/batch-01-common');

const router = express.Router();
const C = '/portal/BroadBand_Payment';

/** class GetWalletDiscount (Controllers/Proceed_To_CheckOutController.cs) */
const WALLET_DISCOUNT_DATA = ['ewalletconsumeper', 'coinwalletconsumeper', 'commissionwalletconsumeper', 'pointredeempercent'];

const pv = (req, k) => (req.p[k] === undefined || req.p[k] === null ? null : String(req.p[k]));
const colOf = (row, name) => {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name);
  return k === undefined ? null : row[k];
};
/** SqlParameter OUT .Value.ToString() (DBNull => "") */
const outStr = (row, name) => { const v = colOf(row, name); return v === null || v === undefined ? '' : String(v); };
/** Convert.ToString(decimal) */
const decStr = (v) => (v === null || v === undefined ? '' : String(v));

/** private bool ValidateMobile(string mobileNumber): Regex.IsMatch(null) => ArgumentNullException */
function ValidateMobile(mobileNumber) {
  if (mobileNumber === null || mobileNumber === undefined) throw argNull('input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(mobileNumber);
}

/** public bool isUniqueId(string GeneratedId): Tbl_RechargeHistory.Where(Api_REQID == GeneratedId).FirstOrDefault() */
async function isUniqueId(GeneratedId) {
  let Result = true;
  const Row = await db.queryOne(DB, 'select api_reqid from tbl_rechargehistory where api_reqid = @id limit 1', { id: GeneratedId });
  if (Row !== null && Row !== undefined) {
    if (Row.api_reqid === GeneratedId) Result = false;
  } else {
    Result = true;
  }
  return Result;
}

/** public string GenerateUniqueReqId(): regenerate until unique */
async function GenerateUniqueReqId() {
  let GeneratedId = '';
  for (;;) {
    GeneratedId = UtilityClass.RandomStringByLength(20);
    const Check = await isUniqueId(GeneratedId);
    if (Check) break;
  }
  return GeneratedId;
}

/** private string GetResponseMeaning(string ResponseCode) - not called by any action in legacy (kept for parity). */
// eslint-disable-next-line no-unused-vars
function GetResponseMeaning(ResponseCode) {
  const M = {
    1000: 'Success', 1002: 'Login Failed', 1003: 'Access Denied', 1004: 'API Not Assigned', 1005: 'Invalid Mobile Number', 1006: 'Invalid Amount',
    1007: 'Duplicate Reqid', 1008: 'Network Error', 1009: 'Frequent Recharge', 1010: 'Recharge Pending', 1011: 'Internal Error',
    1013: 'Operator Down', 1014: 'Refund', 1015: 'Insufficient Balance', 1016: 'Insufficient Minimum Balance', 1017: 'Refund Declined',
  };
  return Object.prototype.hasOwnProperty.call(M, String(ResponseCode)) ? M[String(ResponseCode)] : 'Error';
}

/** shared "validate given input by user" block of Proceed / MakePostpaidRecharge; returns the error JSON string or null */
function validateInput(Mobile, Amount, OpCode, OperatorName) {
  if (Mobile === '') return 'Invalid^Entered mobile number is invalid.';
  if (!ValidateMobile(Mobile)) return 'Invalid^Entered mobile number is invalid.';
  if (Amount === '') return 'Invalid^Amount is required.';
  if (OpCode === '') return 'Invalid^Operator name required.';
  if (OperatorName === '') return 'Invalid^Operator name required.';
  if (cvtInt32(Amount) < 0) return 'Invalid^Entered mobile number is invalid.';
  return null;
}

// ---------------------------------------------------------------- Index()
// public ([DistributerSessionExpireCheck] is a no-op)
// route-config: "Broadband-Payment" -> BroadBand_Payment/Index
router.all([`${C}/Index{/:id}`, '/portal/Broadband-Payment'], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
  const ViewBag = { masterpageshow: masterpageshow(req) };
  return res.json({ view: '~/Views/BroadBand_Payment/Index.cshtml', ViewBag });
}));

// ---------------------------------------------------------------- GetOperator(string MobileNo) : JsonResult
// public (no session check in legacy; operator lookup only)
router.all(`${C}/GetOperator{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const MobileNo = pv(req, 'MobileNo');
  if (!ValidateMobile(MobileNo)) return res.json('Invalid^Entered mobile number is invalid.');
  let OperatorInformation = '';
  const OBjApiServices = new ApiService();
  const MpObj = await OBjApiServices.GetOperator(MobileNo);
  if (MpObj === null || MpObj === undefined) throw nre();
  if (MpObj.cid !== null && MpObj.cid !== undefined) {
    const s = (v) => (v === null || v === undefined ? '' : String(v));
    OperatorInformation = 'Valid' + '^' + s(MpObj.cid) + '^' + s(MpObj.code) + '^' + s(MpObj.opid) + '^' + s(MpObj.provider) + '^' + s(MpObj.state);
  } else {
    return res.json('Invalid^Entered mobile number is invalid.');
  }
  return res.json(OperatorInformation);
}));

// ---------------------------------------------------------------- GenerateUniqueReqId() : string
// public (public controller method => MVC action in legacy; returns a fresh unique id as content)
router.all(`${C}/GenerateUniqueReqId{/:id}`, ps.portalSession, asyncHandler(async (req, res) => content(res, await GenerateUniqueReqId())));

// ---------------------------------------------------------------- isUniqueId(string GeneratedId) : bool
// public (public controller method => MVC action; bool rendered as "True"/"False")
router.all(`${C}/isUniqueId{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const r = await isUniqueId(pv(req, 'GeneratedId'));
  return content(res, r ? 'True' : 'False');
}));

// ---------------------------------------------------------------- GetJewriaCashPoints(string UserName, string TransactionPassword, string JP)
// auth (Session["plid"] == null => Json("error^loginrequired"))
router.all(`${C}/GetJewriaCashPoints{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
  const UserName = pv(req, 'UserName');
  const TransactionPassword = pv(req, 'TransactionPassword');
  const JP = pv(req, 'JP');
  let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
  // PORT-NOTE: legacy called "USP_JewriaCashPointDetails @DISTRIBUTORID,@MODE,@USERNAME,@TRANSACTIONPASSWORD,@JP" - POSITIONAL
  // binding against (@DISTRIBUTORID,@MODE,@JP,@USERNAMEJC,@TRANSACTIONPASSWORDJC,...): UserName lands in @JP (decimal),
  // the encrypted password in @USERNAMEJC and JP in @TRANSACTIONPASSWORDJC. Reproduced as-is (non-numeric UserName => conversion error).
  const rows = await db.proc(DB, 'usp_jewriacashpointdetails', {
    distributorid: '1',
    mode: '2',
    jp: UserName,
    usernamejc: UtilityClass.Encryptword(TransactionPassword),
    transactionpasswordjc: JP,
  });
  for (const Items of rows.filter((r) => WALLET_DISCOUNT_DATA.some((c) => colOf(r, c) !== null && colOf(r, c) !== undefined))) {
    Ewallet = decStr(colOf(Items, 'ewalletconsumeper'));
    Coinwallet = decStr(colOf(Items, 'coinwalletconsumeper'));
    Commition = decStr(colOf(Items, 'commissionwalletconsumeper'));
    PointWallet = decStr(colOf(Items, 'pointredeempercent'));
  }
  const FinalResult = 'success^' + Ewallet + '^' + Coinwallet + '^' + Commition + '^' + PointWallet;
  return res.json(FinalResult);
}));

// ---------------------------------------------------------------- Proceed(string Mobile, string Amount, string OpCode, string OperatorName)
// auth (Session["plid"] == null => Json("error^loginrequired"))
router.all(`${C}/Proceed{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
  // string Loginid = Login.LoginID; Int64 PLID = Login.Plid;  (read but not used: the fund check is commented out in legacy)
  try {
    const err = validateInput(pv(req, 'Mobile'), pv(req, 'Amount'), pv(req, 'OpCode'), pv(req, 'OperatorName'));
    if (err !== null) return res.json(err);
    return res.json('success^0.00000000^0.00000000');
  } catch (Ex) {
    return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
  }
}));

// ---------------------------------------------------------------- MakePostpaidRecharge(...)
// auth (Session["plid"] == null => Json("error^loginrequired"))
router.all(`${C}/MakePostpaidRecharge{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
  const Mobile = pv(req, 'Mobile');
  const Amount = pv(req, 'Amount');
  const OpCode = pv(req, 'OpCode');
  const OperatorName = pv(req, 'OperatorName');
  const JpPointRedeemPercentage = pv(req, 'JpPointRedeemPercentage');
  const EWalletRedeemPercentage = pv(req, 'EWalletRedeemPercentage');
  const BvPercentage = pv(req, 'BvPercentage');
  const Discount = pv(req, 'Discount');
  const NetPayableAmount = pv(req, 'NetPayableAmount');
  const IsDiscounTApplicabale = pv(req, 'IsDiscounTApplicabale');
  const UserName = pv(req, 'UserName');
  const TransactionPassword = pv(req, 'TransactionPassword');
  const UserNameWallet = pv(req, 'UserNameWallet');
  const TransactionPasswordWallet = pv(req, 'TransactionPasswordWallet');
  const Paymode = pv(req, 'Paymode');

  const Loginid = req.user.loginid;
  const PLID = Number(req.user.plid);
  try {
    // validate given input by user
    const err = validateInput(Mobile, Amount, OpCode, OperatorName);
    if (err !== null) return res.json(err);

    // for check fund available or not
    const fund = await db.procOne(DB, 'usp_successorfailedrecharge', {
      mode: '1', loginid: Loginid, amount: NetPayableAmount, usernameewallet: UserNameWallet,
      transactionpasswordewallet: TransactionPasswordWallet, plid: PLID,
    });
    const StrResult = outStr(fund, 'strresult');
    if (StrResult.toLowerCase() !== 'success') return res.json('Invalid^' + StrResult + '');

    // check JC Point Available Or Not
    if (IsDiscounTApplicabale === '1') {
      const rows = await db.proc(DB, 'usp_jewriacashpointdetails', {
        distributorid: '1', mode: '2', jp: Discount, usernamejc: UserName, transactionpasswordjc: TransactionPassword, plid: PLID,
      });
      // PORT-NOTE: @STRRESULT OUT is read from the result rows (PG function repeats it per row). A row whose GetWalletDiscount
      // columns are all null is treated as "OUT values only" (no data row); with no row at all StrResult is "".
      const StrResultJc = outStr(rows[0], 'strresult');
      const Getwalletdiscount = rows.filter((r) => WALLET_DISCOUNT_DATA.some((c) => colOf(r, c) !== null && colOf(r, c) !== undefined));
      if (StrResultJc.toLowerCase() !== 'success') {
        // legacy bug kept: reports the FIRST proc's StrResult (always "success" here), not StrResultJc
        return res.json('Invalid^' + StrResult + '');
      } else if (Getwalletdiscount.length === 0) {
        return res.json('Invalid^Insufficient JC Point in your JC Point Wallet');
      }
    }

    // code start for actual recharge
    const UniqueReqId = await GenerateUniqueReqId();
    const ApiToken = (config.app.Mobile_Api_Token || '');
    const OBjApiServices = new ApiService();
    const GetResult = await OBjApiServices.Recharge(ApiToken, Mobile, OpCode, Amount, UniqueReqId, '', '');
    if (GetResult === null || GetResult === undefined) throw nre();
    const d = (v, def) => (v === null || v === undefined ? def : v);
    const reqid = d(GetResult.reqid, '0');
    const status = d(GetResult.status, '');
    const remark = d(GetResult.remark, '');
    const balance = d(GetResult.balance, '0.00000000');
    const mn = d(GetResult.mn, '');
    // field1 / amt are read but not stored by legacy
    const ec = d(GetResult.ec, '');
    const apirefid = d(GetResult.apirefid, '');

    // code start for the save recharge history
    const hist = await db.procOne(DB, 'usp_maintainrechargehistory', {
      mode: '1',
      plid: PLID,
      mobile: mn,
      operator: (() => { if (OperatorName === null) throw nre(); return OperatorName.trim(); })(),
      amount: Amount,
      api_refid: apirefid,
      api_balance: balance,
      api_errorcode: ec,
      api_remark: remark,
      api_reqid: reqid,
      api_status: status,
      opcode: OpCode,
      jppointredeempercentage: JpPointRedeemPercentage,
      ewalletredeempercentage: EWalletRedeemPercentage,
      bvpercentage: BvPercentage,
      discount: Discount,
      netpayableamount: NetPayableAmount,
      isdiscountapplicabale: IsDiscounTApplicabale,
      usernamejc: UserName,
      transactionpasswordjc: TransactionPassword,
      usernameewallet: UserNameWallet,
      transactionpasswordewallet: TransactionPasswordWallet,
      paymode: Paymode,
      ordernumber: UniqueReqId,
    });
    const StrResultOutputHistory = outStr(hist, 'strresult');
    if (StrResultOutputHistory.toLowerCase() === 'success') {
      return res.json('success^Your mobile recharge done successfully.Your order number is ' + reqid);
    }
    return res.json('Invalid^' + StrResultOutputHistory);
  } catch (Ex) {
    return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
  }
}));

module.exports = router;
