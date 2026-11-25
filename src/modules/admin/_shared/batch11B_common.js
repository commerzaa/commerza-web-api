'use strict';
/**
 * Helpers private to admin port batch11 part B (PayoutReport / Pending_Payout / Payit_Forword_List / Paymode_Setting ...)
 * Not a router (lives in _shared/).
 * Exports: PAYOUT_REPORT_PROPS, ATC_DETAILS_PROPS, SHOW_CHART_PROPS, ATC_WALLET_DETAILS_PROPS, apiMid(s), jTok(arr, i, key),
 *          strictOutInt(rows, name), toDecimalOut(rows, name), atcBlock(req, rows, ViewBag, innerProc, outerProc),
 *          Approve_WithdrawalInBulk(req, wdid, status, remarks), activityBy(req), tabN(v, n)
 */
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const ATCAPI = require('../../../lib/admin/ATCAPI');
const { errorInsert } = require('./adminSession');
const { DB, col, str, dec2, nullRef } = require('./batch11_common');

/** class PayoutReport (PayoutReportController.cs) - has both TransactionId and transactionid */
const PAYOUT_REPORT_PROPS = ['RowNumber', 'Date', 'EmailId', 'FULLEmailId', 'UserName', 'FullName', 'PHONE', 'WITHDRAWAMOUNT', 'PayableAmount',
  'AccountNo', 'AccountHolderName', 'BankName', 'BranchName', 'IFSCCODE', 'WDID', 'Status', 'TransactionId', 'ADMIN_REMARK', 'ATC_WalletAddress',
  'ATCUserId', 'ActivityByUserId', 'TDS', 'ADMINCHARGE', 'transactionid', 'Processing_Fee', 'INCOMETYPENAME', 'Repurchase'];
/** class ATCDatails */
const ATC_DETAILS_PROPS = ['INR', 'Atc_WalletAddress', 'ATCUserId'];
/** class ShowChart */
const SHOW_CHART_PROPS = ['DATE', 'USERNAME', 'PHONE', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'WithDrawlPoints',
  'Atc_WalletAddress', 'STATUS'];
/** class ATCWalletDetails */
const ATC_WALLET_DETAILS_PROPS = ['FromUserid', 'ToUserId', 'ToWalletAddress', 'NoOfCoin'];

/** APIResponse.Substring(2, APIResponse.Length - 4).Replace("\\", "") (ArgumentOutOfRangeException / NRE like .NET) */
function apiMid(s) {
  if (s === null || s === undefined) throw nullRef();
  const t = String(s);
  const len = t.length - 4;
  if (len < 0 || 2 + len > t.length) throw new Error('Length cannot be less than zero.\r\nParameter name: length');
  return t.substr(2, len).split('\\').join('');
}
/** JArray.Parse(json)[i][key].ToString() */
function jTok(json, i, key) {
  const arr = JSON.parse(json);
  if (!Array.isArray(arr)) throw new Error('Error reading JArray from JsonReader.');
  if (i >= arr.length) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
  const v = arr[i] === null || typeof arr[i] !== 'object' ? undefined : arr[i][key];
  if (v === undefined) throw nullRef();
  if (v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v === true ? 'True' : v === false ? 'False' : v);
}

/** int.Parse(OUT.Value.ToString()) (DBNull => FormatException). PORT-NOTE: no rows => PG cannot return the OUT value => 0. */
function strictOutInt(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = str(col(rows[0], name));
  if (!/^[-+]?\d+$/.test(s.trim())) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** Convert.ToDecimal(OUT.Value) (DBNull => InvalidCastException). PORT-NOTE: no rows => 0. */
function toDecimalOut(rows, name) {
  if (!rows || !rows[0]) return 0;
  const v = col(rows[0], name);
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return Number(v);
}

/** The "[Get_AdminATCDetails]" + ATCAPI.GetATCWalletBalance block of PayoutReport.Index / Pending_Payout.Index */
async function atcBlock(req, ViewBag, innerProc, outerProc) {
  try {
    const r = await db.proc(DB, 'Get_AdminATCDetails', {});
    const ObjSATCDatails = r && r[0] ? mapRows([r[0]], ATC_DETAILS_PROPS)[0] : null;
    if (!ObjSATCDatails) throw nullRef();
    const { ATCUserId, Atc_WalletAddress } = ObjSATCDatails;
    ViewBag.Atc_WalletAddress = Atc_WalletAddress;
    ViewBag.Atc_Rate = dec2(ObjSATCDatails.INR);
    if (ATCUserId !== '' && Atc_WalletAddress !== '' && ATCUserId !== null && Atc_WalletAddress !== null) {
      try {
        const APIResponse = await ATCAPI.GetATCWalletBalance(ATCUserId, Atc_WalletAddress);
        const RegistrationResponse = apiMid(APIResponse);
        ViewBag.ATCCoin = jTok(RegistrationResponse, 0, 'Response');
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, innerProc);
        ViewBag.ATCCoin = '0.00000000';
        ViewBag.Message = ExpObj.message;
      }
    } else {
      ViewBag.ATCCoin = '0.00000000';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, outerProc);
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.ATCCoin = '0.00000000';
  }
}

/** Emp_Master.Emp_Code.ToString() + " " + "(" + Emp_Master.Emp_Name + ")" */
function activityBy(req) {
  const code = req.user.emp_code;
  if (code === null || code === undefined) throw nullRef();
  const name = req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name;
  return `${code} (${name})`;
}

/** PayoutReportController.Approve_WithdrawalInBulk(int wdid, int status, string remarks) : string */
async function Approve_WithdrawalInBulk(req, wdid, status, remarks) {
  let ret = '';
  let TransactionId = '';
  try {
    let Obj = null;
    if (status === 1) {
      const r = await db.proc(DB, 'Usp_ATCTransfer', { Wdid: wdid });
      Obj = r && r[0] ? mapRows([r[0]], ATC_WALLET_DETAILS_PROPS)[0] : null;
      try {
        // #region For Check Receiver Atc Wallet Address Exists Or Not
        if (!Obj) throw nullRef();
        const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(Obj.ToWalletAddress);
        const ATCWalletValidate = apiMid(APIResponseValidate);
        const ResponseValidate = jTok(ATCWalletValidate, 0, 'Response');
        const IsSuccessValidate = jTok(ATCWalletValidate, 0, 'IsSuccess');
        if (IsSuccessValidate.trim() !== '1') return ResponseValidate;
        // #endregion
        const NoOfCoin = Obj.NoOfCoin === null || Obj.NoOfCoin === undefined ? '' : String(Obj.NoOfCoin);
        const APIResponse = await ATCAPI.ATCSendReceived(Obj.FromUserid, Obj.ToWalletAddress, NoOfCoin);
        const RegistrationResponse = apiMid(APIResponse);
        const ResponseMessage = jTok(RegistrationResponse, 0, 'Response');
        TransactionId = jTok(RegistrationResponse, 0, 'TxID');
        if (ResponseMessage.trim().toLowerCase() !== 'true') return ResponseMessage;
        if (TransactionId === '') return ResponseMessage;
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, 'Approve_WithdrawalInBulk');
        return ExpObj.message;
      }
    }
    const ActivityByUserId = activityBy(req);
    const row = await db.procOne(DB, 'USP_WITHDRAWAL_APPROVEORREJECT', {
      WDID: wdid, MODE: status, STRRESULT: remarks, ActivityByUserId, TransactionId,
    });
    ret = str(col(row, 'strresult'));
    return ret;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_WITHDRAWAL_APPROVEORREJECT');
    ret = String(ExpObj.message);
    return ret;
  }
}

/** Regex.Replace(v.ToString(), "\t", <n spaces>) */
const tabN = (v, n) => String(v).replace(/\t/g, ' '.repeat(n));

module.exports = {
  PAYOUT_REPORT_PROPS, ATC_DETAILS_PROPS, SHOW_CHART_PROPS, ATC_WALLET_DETAILS_PROPS, apiMid, jTok, strictOutInt, toDecimalOut, atcBlock,
  Approve_WithdrawalInBulk, activityBy, tabN,
};
