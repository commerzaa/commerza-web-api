'use strict';
// Ported from Member\Controllers\CustomerPanel\Transfer_To_Bank.cs (5 actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const Centralize_OTP = require('../../lib/member/Centralize_OTP');
const Security_Key = require('../../lib/member/Security_Key');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const DMTCoreAPI = require('../../lib/member/DMTCoreAPI');
const DB = 'affiliate';
const P = '/member/Transfer_To_Bank';
const SecKeyClass = Security_Key.Security_Key || Security_Key;
const col = (row, name) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k !== undefined ? row[k] : undefined; };
// PORT-NOTE: stored procs with only OUT params return them as same-named columns of the single result row.
const outStr = (row, name) => { const v = col(row, name); return v === undefined || v === null ? '' : String(v); };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}
const reverse = (Db_unused, PaymentMode, Plid, Amount, Remark) => db.proc(DB, 'Usp_ReverseTransferFundToBank', { PaymentMode, PLID: Plid, Amount, Remark });

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'SessionOTP', null);
  const Plid = parseInt(req.user.plid, 10);
  const v = await db.scalar(DB, 'SELECT ISVERIFY FROM MEMBER_LOGIN WHERE REGNO=@plid limit 1', { plid: Plid });
  res.json({ status: 0, IsActive: v === null || v === undefined ? false : !!v });
}));

// auth (uses the logged-in member session inside Centralize_OTP)
router.all(P + '/GetOTPDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const smsId = parseInt(req.p.smsId, 10); const emailEId = parseInt(req.p.emailEId, 10);
  if (Number.isNaN(smsId) || Number.isNaN(emailEId)) return res.status(400).json({ message: 'The parameters dictionary contains a null entry for a non-nullable parameter.' });
  const returnmessage = await Centralize_OTP.GenrateOTP(smsId, emailEId, req.p.TransPass, req);
  res.json(returnmessage);
}));

// auth
router.all(P + '/TransferFundtoBank{/:id}', auth, asyncHandler(async (req, res) => {
  const PaymentMode = parseInt(req.p.PaymentMode, 10);
  const TransferType = req.p.TransferType;
  const Amount = Number(req.p.Amount);
  const Password = req.p.Password; const GAKEY = req.p.GAKEY; const Remark = req.p.Remark; const OTPCODE = req.p.OTPCODE; const HfAuthenticated = req.p.HfAuthenticated;
  if (Number.isNaN(PaymentMode) || Number.isNaN(Amount) || req.p.Amount === undefined || req.p.Amount === '') {
    return res.status(400).json({ message: 'The parameters dictionary contains a null or invalid entry for PaymentMode/Amount.' });
  }
  const IsSecuritySuccess = await Centralize_OTP.CheckSecurityForTransctiion(PaymentMode, '', Password, OTPCODE, HfAuthenticated, GAKEY, Amount, req);
  if (IsSecuritySuccess !== 'success') return res.json(IsSecuritySuccess);
  const Plid = Number(req.user.plid);
  let JsonReply = '';
  try {
    const objs = await new SecKeyClass().Get_Security_Key(Plid);
    let ActiveKey = 0;
    if (objs != null) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(parseInt(req.user.plid, 10));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          return res.json(JsonReply);
        }
      }
    }
    // Check API Balance Here
    const BalanceCheckAPIResponse = await DMTCoreAPI.GetBalance();
    const ObjWalletBalanceManagement = JSON.parse(BalanceCheckAPIResponse);
    if (String(ObjWalletBalanceManagement.status).toLowerCase() === '1') {
      if (Number(String(ObjWalletBalanceManagement.balance).toLowerCase()) < (Amount + ((Amount * 10) / 100))) {
        JsonReply = 'Error^Bank Server Under Maintenance !';
        return res.json(JsonReply);
      }
    } else {
      JsonReply = 'Error^Bank Server Under Maintenance !';
      return res.json(JsonReply);
    }
    const r = await db.procOne(DB, 'Usp_TransferFundToBank', { PaymentMode, PLID: Plid, Amount, Remark });
    const StrResult = outStr(r, 'StrResult');
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      return res.json(JsonReply);
    }
    // For Process Withdrawal By DMT (legacy wrapped this in an empty catch)
    try {
      const PayableAmount = Amount - ((Amount * 1) / 100);
      const obj = await db.procOne(DB, 'USP_GETDMTMONEYTRANSFER', { PLID: Plid, MODE: '1', ACID: PaymentMode, TYPE: TransferType });
      if (obj != null) {
        const Client_Trans_Id = String(Math.floor(Math.random() * 1000000)).padStart(10, '0');
        const APIResponse = await DMTCoreAPI.Transfer(col(obj, 'MSISDN'), Client_Trans_Id, String(PayableAmount), col(obj, 'TRANSFER_TYPE'), '',
          col(obj, 'BENEFICIARY_ACCOUNT_NO'), col(obj, 'BENEFICIARY_IFSC_CODE'), col(obj, 'BENEFICIARY_BANK_CODE'), col(obj, 'BENEFICIARY_NAME'));
        const W = JSON.parse(APIResponse);
        const ts = (k) => { if (W[k] === undefined || W[k] === null) throw new Error('Object reference not set to an instance of an object.'); return String(W[k]); };
        if (String(W.status).toLowerCase() === '1') {
          await db.proc(DB, 'USP_DMTMONEYTRANSFER', {
            PLID: Plid, MODE: '2', API_REFERENCE_ID: ts('api_reference_id'), OTP_STATUS: ts('otp_status'), TRANS_ID: ts('trans_id'),
            CLIENT_TRANS_ID: ts('client_trans_id'), BANK_TRANS_ID: ts('bank_trans_id'), MSISDN: ts('msisdn'), AMOUNT: ts('amount'), DATETIME: ts('datetime'),
            TRANSFER_TYPE: ts('transfer_type'), B_REQUEST_TYPE: ts('b_request_type'), TRANS_STATUS: ts('trans_status'), CHARGED_AMOUNT: ts('charged_amount'),
            CUSTOMER_FEE: ts('customer_fee'), COMMISSION: ts('commission'), SERVICE_CHARGE: ts('service_charge'), GST: ts('gst'),
            OPENING_BALANCE: ts('opening_balance'), BENEFICIARY_ID: ts('beneficiary_id'), BENEFICIARY_NAME: ts('beneficiary_name'),
            BENEFICIARY_ACCOUNT_NO: ts('beneficiary_account_no'), BENEFICIARY_BANK_NAME: ts('beneficiary_bank_name'),
            BENEFICIARY_BANK_CODE: ts('beneficiary_bank_code'), BENEFICIARY_IFSC_CODE: ts('beneficiary_ifsc_code'), TOTAL_LIMIT: ts('total_limit'),
            CONSUME_LIMIT: ts('consume_limit'), REMAINING_LIMIT: ts('remaining_limit'),
          });
        } else {
          // Auto Refund Here
          await reverse(null, PaymentMode, Plid, Amount, Remark);
          return res.json('Error^' + String(W.message));
        }
      } else {
        // Auto Refund Here
        await reverse(null, PaymentMode, Plid, Amount, Remark);
        return res.json('Error^Bank Server Under Maintenance !');
      }
    } catch (e) { /* legacy: empty catch, failure of the DMT leg is swallowed */ }
    JsonReply = StrResult + '^Fund transferred to bank successfully.';
    sessionStore.set(req, 'SessionOTP', null);
    return res.json(JsonReply);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'Usp_TransferFundToBank', req);
    return res.json('Error^Some error occured. Please try again.');
  }
}));

// public (legacy had no session check; registration master data)
router.all(P + '/CheckCheckboxOnTheBehalfOfPermission{/:id}', asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'USP_GETDATAFORREGISTRATION', { MODE: 1 });
  res.json(mapRows(rows, ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME']));
}));

// auth
router.all(P + '/CheckTranspasswordOnOrOff{/:id}', auth, asyncHandler(async (req, res) => {
  const v = await db.scalar(DB, 'SELECT ISVERIFY FROM MEMBER_LOGIN WHERE REGNO=@plid limit 1', { plid: Number(req.user.plid) });
  res.json(v === null || v === undefined ? false : !!v);
}));

module.exports = router;
