'use strict';
// Ported from ClusterofferShopingPortal\Controllers\servicejewaria_MobileController.cs (class servicejewaria_MobileController,
// [CheckResellerTimeout] = no check). Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ApiService = require('../../lib/portal/ApiService');
const ps = require('./_shared/portal-session');
const { DB, str, NRE, toInt32, outOf } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'servicejewaria_Mobile';

/** private bool ValidateMobile(string mobileNumber) (Regex.IsMatch(null) => ArgumentNullException) */
function ValidateMobile(mobileNumber) {
  if (mobileNumber === null || mobileNumber === undefined) throw new Error('Value cannot be null.\r\nParameter name: input');
  return /^[-+]?[0-9]*\.?[0-9]+$/.test(String(mobileNumber));
}

/** public bool isUniqueId(string GeneratedId) (EF: _Tbl_RechargeHistory.Where(Api_REQID == GeneratedId).FirstOrDefault()) */
async function isUniqueId(GeneratedId) {
  let Result = true;
  const Row = await db.queryOne(DB, 'select api_reqid from tbl_rechargehistory where api_reqid = @id limit 1', { id: GeneratedId ?? null });
  if (Row != null) {
    if (Row.api_reqid === GeneratedId) Result = false;
  } else {
    Result = true;
  }
  return Result;
}

/** public string GenerateUniqueReqId() */
async function GenerateUniqueReqId() {
  let GeneratedId = '';
  for (;;) { // Regenerate: ... goto Regenerate
    GeneratedId = await UtilityClass.RandomStringByLength(20);
    const Check = await isUniqueId(GeneratedId);
    if (Check) break;
  }
  return GeneratedId;
}

/** private string GetResponseMeaning(string ResponseCode) - unused in legacy, kept as internal helper. */
// eslint-disable-next-line no-unused-vars
function GetResponseMeaning(ResponseCode) {
  const m = {
    1000: 'Success', 1002: 'Login Failed', 1003: 'Access Denied', 1004: 'API Not Assigned', 1005: 'Invalid Mobile Number', 1006: 'Invalid Amount',
    1007: 'Duplicate Reqid', 1008: 'Network Error', 1009: 'Frequent Recharge', 1010: 'Recharge Pending', 1011: 'Internal Error',
    1013: 'Operator Down', 1014: 'Refund', 1015: 'Insufficient Balance', 1016: 'Insufficient Minimum Balance', 1017: 'Refund Declined',
  };
  return Object.prototype.hasOwnProperty.call(m, String(ResponseCode)) ? m[String(ResponseCode)] : 'Error';
}

/** Shared input validation of Proceed / MakePostpaidRecharge; returns the error JSON string or null. */
function validateInput(Mobile, Amount, OpCode, OperatorName) {
  if (Mobile === '') return 'Invalid^Entered mobile number is invalid.';
  if (!ValidateMobile(Mobile)) return 'Invalid^Entered mobile number is invalid.';
  if (Amount === '') return 'Invalid^Amount is required.';
  if (OpCode === '') return 'Invalid^Operator name required.';
  if (OperatorName === '') return 'Invalid^Operator name required.';
  if (toInt32(Amount) < 0) return 'Invalid^Entered mobile number is invalid.';
  return null;
}

// ---------------------------------------------------------------- Index()
// public (outer page)
// route-config: "service-eblaa-Mobile" -> servicejewaria_Mobile/Index
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/service-eblaa-Mobile'], ps.CheckResellerTimeout,
  asyncHandler(async (req, res) => res.json({ view: '~/Views/servicejewaria_Mobile/Index.cshtml' })));

// ---------------------------------------------------------------- GetOperator(string MobileNo)
// public (no session check in legacy; operator lookup)
router.all(`/portal/${C}/GetOperator{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const MobileNo = req.p.MobileNo ?? null;
  if (!ValidateMobile(MobileNo)) {
    return res.json('Invalid^Entered mobile number is invalid.');
  }
  let OperatorInformation = '';
  const OBjApiServices = new ApiService();
  const MpObj = await OBjApiServices.GetOperator(MobileNo);
  if (MpObj == null) throw NRE(); // legacy MpObj.cid on a null result
  if (MpObj.cid != null) {
    OperatorInformation = 'Valid' + '^' + str(MpObj.cid) + '^' + str(MpObj.code) + '^' + str(MpObj.opid) + '^' + str(MpObj.provider) + '^' + str(MpObj.state);
  } else {
    return res.json('Invalid^Entered mobile number is invalid.');
  }
  return res.json(OperatorInformation);
}));

// ---------------------------------------------------------------- GenerateUniqueReqId() (public method => MVC action returning string content)
// public (no session check in legacy; read-only)
router.all(`/portal/${C}/GenerateUniqueReqId{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  res.type('text/html').send(await GenerateUniqueReqId());
}));

// ---------------------------------------------------------------- isUniqueId(string GeneratedId) (public method => MVC action, bool => "True"/"False")
// public (no session check in legacy; read-only)
router.all(`/portal/${C}/isUniqueId{/:id}`, ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  const r = await isUniqueId(req.p.GeneratedId ?? null);
  res.type('text/html').send(r ? 'True' : 'False');
}));

// ---------------------------------------------------------------- GetJewriaCashPoints(string UserName, string TransactionPassword, string JP)
// auth (Session["plid"] == null => Json("error^loginrequired"))
router.all(`/portal/${C}/GetJewriaCashPoints{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
  const { UserName, TransactionPassword, JP } = req.p;
  let Ewallet = '0.00'; let Coinwallet = '0.00'; let Commition = '0.00'; let PointWallet = '0.00';
  // PORT-NOTE (legacy bug reproduced): the C# passed its arguments POSITIONALLY ("USP_JewriaCashPointDetails @DISTRIBUTORID,@MODE,@USERNAME,
  // @TRANSACTIONPASSWORD,@JP") to a proc declared (@DISTRIBUTORID,@MODE,@JP,@USERNAMEJC,@TRANSACTIONPASSWORDJC,...), so UserName went into @JP,
  // the encrypted password into @USERNAMEJC and JP into @TRANSACTIONPASSWORDJC. Same binding kept here.
  const Getwalletdiscount = await db.proc(DB, 'USP_JewriaCashPointDetails', {
    DISTRIBUTORID: 1, MODE: 2, JP: UserName ?? null,
    USERNAMEJC: await UtilityClass.Encryptword(TransactionPassword ?? null), TRANSACTIONPASSWORDJC: JP ?? null,
  });
  for (const Items of Getwalletdiscount) {
    Ewallet = str(Items.ewalletconsumeper);
    Coinwallet = str(Items.coinwalletconsumeper);
    Commition = str(Items.commissionwalletconsumeper);
    PointWallet = str(Items.pointredeempercent);
  }
  const FinalResult = 'success^' + Ewallet + '^' + Coinwallet + '^' + Commition + '^' + PointWallet;
  return res.json(FinalResult);
}));

// ---------------------------------------------------------------- Proceed(string Mobile, string Amount, string OpCode, string OperatorName)
// auth (Session["plid"] == null => Json("error^loginrequired"))
router.all(`/portal/${C}/Proceed{/:id}`, ...ps.customerOr('error^loginrequired'), asyncHandler(async (req, res) => {
  const p = (k) => (req.p[k] === undefined ? null : req.p[k]);
  const Mobile = p('Mobile'); const Amount = p('Amount'); const OpCode = p('OpCode'); const OperatorName = p('OperatorName');
  // eslint-disable-next-line no-unused-vars
  const Loginid = req.user.loginid; const PLID = req.user.plid;
  try {
    const err = validateInput(Mobile, Amount, OpCode, OperatorName);
    if (err) return res.json(err);
    // fund check (USP_SUCCESSORFAILEDRECHARGE mode 3) is commented out in legacy
    return res.json('success^0.00000000^0.00000000');
  } catch (Ex) {
    return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
  }
}));

// ---------------------------------------------------------------- MakePostpaidRecharge(...)
// auth (Session["plid"] == null => Json("error^loginrequired"))
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
    const err = validateInput(Mobile, Amount, OpCode, OperatorName);
    if (err) return res.json(err);

    // for check fund available or not
    const fundRows = await db.proc(DB, 'USP_SUCCESSORFAILEDRECHARGE', {
      MODE: 1, LOGINID: Loginid ?? null, AMOUNT: NetPayableAmount,
      USERNAMEEWALLET: UserNameWallet, TRANSACTIONPASSWORDEWALLET: TransactionPasswordWallet, PLID,
    });
    const StrResult = outOf(fundRows, 'STRRESULT');
    // StrResult.Value.ToString(): DBNull => ""
    if (str(StrResult).toLowerCase() !== 'success') {
      return res.json('Invalid^' + str(StrResult) + '');
    }

    // check JC Point Available Or Not
    if (IsDiscounTApplicabale === '1') {
      const Getwalletdiscount = await db.proc(DB, 'USP_JewriaCashPointDetails', {
        DISTRIBUTORID: 1, MODE: 2, JP: Discount, USERNAMEJC: UserName, TRANSACTIONPASSWORDJC: TransactionPassword, PLID,
      });
      const StrResultJc = outOf(Getwalletdiscount, 'STRRESULT');
      if (str(StrResultJc).toLowerCase() !== 'success') {
        // legacy bug reproduced: returns the FUND check result (StrResult), not StrResultJc
        return res.json('Invalid^' + str(StrResult) + '');
      } else if (Getwalletdiscount.length === 0) {
        // PORT-NOTE: SqlQuery<GetWalletDiscount>().Count; the PG function returns its OUT value as a column, so an empty result set is 0 rows.
        return res.json('Invalid^Insufficient JC Point in your JC Point Wallet');
      }
    }

    // fund / JC point deduction (USP_SUCCESSORFAILEDRECHARGE modes 2 and 4) is commented out in legacy

    // code start for actual recharge
    const UniqueReqId = await GenerateUniqueReqId();
    const ApiToken = config.app.Mobile_Api_Token || '';
    const OBjApiServices = new ApiService();
    const GetResult = await OBjApiServices.Recharge(ApiToken, Mobile, OpCode, Amount, UniqueReqId, '', '');
    if (GetResult == null) throw NRE();
    const reqid = GetResult.reqid == null ? '0' : GetResult.reqid;
    const status = GetResult.status == null ? '' : GetResult.status;
    const remark = GetResult.remark == null ? '' : GetResult.remark;
    const balance = GetResult.balance == null ? '0.00000000' : GetResult.balance;
    const mn = GetResult.mn == null ? '' : GetResult.mn;
    // eslint-disable-next-line no-unused-vars
    const field1 = GetResult.field1 == null ? '' : GetResult.field1;
    const ec = GetResult.ec == null ? '' : GetResult.ec;
    const apirefid = GetResult.apirefid == null ? '' : GetResult.apirefid;
    // eslint-disable-next-line no-unused-vars
    const amt = GetResult.amt == null ? '0.00000000' : GetResult.amt;

    // save recharge history
    const hRows = await db.proc(DB, 'Usp_MaintainRechargeHistory', {
      Mode: 1, PLID, Mobile: mn, Operator: String(OperatorName).trim(), Amount, Api_REFID: apirefid, Api_Balance: balance,
      Api_ErrorCode: ec, Api_Remark: remark, Api_REQID: reqid, Api_Status: status, OpCode,
      JPPOINTREDEEMPERCENTAGE: JpPointRedeemPercentage, EWALLETREDEEMPERCENTAGE: EWalletRedeemPercentage, BVPERCENTAGE: BvPercentage,
      DISCOUNT: Discount, NETPAYABLEAMOUNT: NetPayableAmount, ISDISCOUNTAPPLICABALE: IsDiscounTApplicabale, USERNAMEJC: UserName,
      TRANSACTIONPASSWORDJC: TransactionPassword, USERNAMEEWALLET: UserNameWallet, TRANSACTIONPASSWORDEWALLET: TransactionPasswordWallet,
      Paymode, OrderNumber: UniqueReqId,
    });
    const StrResultOutputHistory = outOf(hRows, 'StrResult');
    if (str(StrResultOutputHistory).toLowerCase() === 'success') {
      return res.json('success^Your mobile recharge done successfully.Your order number is ' + reqid);
    }
    return res.json('Invalid^' + str(StrResultOutputHistory));
  } catch (Ex) {
    return res.json('Invalid^Some error occured. Please try again.' + Ex.message);
  }
}));

module.exports = router;
