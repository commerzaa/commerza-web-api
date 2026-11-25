'use strict';
/**
 * Shared helpers for portal batch 11 (Online*RechargeResponse controllers). Not a router.
 * Exports:
 *   outVal(row, name)                         -> value of a proc OUTPUT column ('' when null), like SqlParameter.Value.ToString()
 *   jtok(obj, key)                            -> JObject[key].ToString() (throws when the key is missing, like the C# NullReferenceException)
 *   makeUtilityRecharge(kind, MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId, reqDOB)
 *                                             -> { rechargeStatus, APITransactionId }   (Electricity/Gas/Insurance/Prepaid/Postpaid Make*Recharge)
 *   SendConfirmationMailAndMessages(TransId, Status)  (static method duplicated in every Online*RechargeResponse controller)
 *   buildRechargeResponseRouter(opts)         -> express.Router for one Online*RechargeResponse controller
 * PORT-NOTE: Make*Recharge / Update*RechargeStatus are public non-action methods of other controllers
 *   (Electricity_Payment, Gas_Payment, Insurance_Payment, servicejewariaController); they are re-implemented here because a
 *   sibling module only exports a router.
 */
const express = require('express');
const axios = require('axios');
const db = require('../../../db');
const config = require('../../../config');
const asyncHandler = require('../../../middleware/asyncHandler');
const ps = require('./portal-session');
const UtilityClass = require('../../../lib/portal/UtilityClass');
const SendMail = require('../../../lib/portal/SendMail');
const { CompanySettings } = require('../../../lib/portal/CompanySettings');

const DB = 'shopping';

function outVal(row, name) {
  if (!row) return '';
  const v = row[name.toLowerCase()];
  return v === null || v === undefined ? '' : String(v);
}

/** Newtonsoft JToken.ToString(): strings raw, null -> "", objects/arrays indented JSON. Missing key -> throws. */
function jtok(obj, key) {
  if (!obj || !Object.prototype.hasOwnProperty.call(obj, key)) throw new Error('Object reference not set to an instance of an object.');
  const v = obj[key];
  if (v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

/** JavaScriptSerializer DateTime: "\/Date(ms)\/" */
const msDate = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return `/Date(${x.getTime()})/`;
};

const KINDS = {
  ELECTRICITY: { service: 'ELECTRICITY', url: '/api/Get-ELECTRICITYBill', detail: 'ELECTRICITYBillDetail', proc: 'usp_update_customer_electricity_recharge_response', failureIsError: false },
  GAS: { service: 'GAS', url: '/api/Get-GasBill', detail: 'GASBillDetail', proc: 'usp_update_customer_gas_recharge_response', failureIsError: false },
  INSURANCE: { service: 'INSURANCE', url: '/api/customer-INSURANCE', detail: 'INSURANCEBillDetail', proc: 'usp_update_customer_insurance_recharge_response', failureIsError: false, dob: true },
  PREPAID: { service: 'MOBILE', url: '/api/Prepaid-Recharge-Mobile', detail: 'PrepaidMobileDetail', proc: 'usp_update_customer_prepaid_recharge_response', failureIsError: true },
  POSTPAID: { service: 'POSTPAID', url: '/api/Get-RechargeMobile', detail: 'RechargeMobileDetail', proc: 'usp_update_customer_postpaid_recharge_response', failureIsError: false },
};

/** Update<Kind>RechargeStatus: errors swallowed, returns "" */
async function updateRechargeStatus(kind, custTranid, APITranId, rechstatus, rechRemarks) {
  try {
    await db.proc(DB, KINDS[kind].proc, {
      CUSTTRANSACTIONID: custTranid, APITRANSACTIONID: APITranId, RECHARGERESPONSESTATUS: rechstatus, RECHARGERESPONSEREMARKS: rechRemarks,
    });
  } catch (e) { /* updateResponse = "" */ }
  return '';
}

async function makeUtilityRecharge(kind, MobileNo, CLID, RechOpCode, RechOpName, RechOpService, RechAmount, TransactionId, reqDOB) {
  const K = KINDS[kind];
  let rechargeStatus = '';
  let APITransactionId = '';
  try {
    const rechargeReq = {
      uidno: '', clid: CLID, service: K.service, serviceCode: RechOpCode, number: MobileNo, amount: RechAmount, CustomerTransID: TransactionId,
    };
    if (K.dob) rechargeReq.DOB = reqDOB === null || reqDOB === undefined ? null : msDate(reqDOB);
    const RechargeAPIURL = config.app.RechargeAPIURL || '';
    const resp = await axios.post(RechargeAPIURL + K.url, JSON.stringify(rechargeReq), {
      headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: [(d) => d],
    });
    const ObjRechargeResponse = JSON.parse(String(resp.data));
    const Flag = jtok(ObjRechargeResponse, 'Flag');
    const Message = jtok(ObjRechargeResponse, 'Message');
    const F = Flag.toUpperCase();
    if (F === 'SUCCESS' || F === 'PENDING') {
      const responseAPITransactionId = jtok(ObjRechargeResponse, 'APITransID');
      jtok(ObjRechargeResponse, 'CustomerTransID'); // responseCustomerId (unused, may throw like C#)
      const responseRechargeDetails = jtok(ObjRechargeResponse, K.detail);
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
  } catch (e) {
    rechargeStatus = '';
    APITransactionId = '';
  }
  return { rechargeStatus, APITransactionId };
}

const NOTE = '. \r\nNote: Please remember system will be check every transaction after 2 hours. So if the transaction will be failed then your amount will be auto refunded to your wallet. \r\n Team ';

/** static SendConfirmationMailAndMessages(TransId, Status): DB read synchronously, messages in a background thread. */
async function SendConfirmationMailAndMessages(TransId, Status) {
  const rows = await db.proc(DB, 'usp_getcustomerdetails_by_rech_transid', { TRANSID: TransId });
  const r = rows[0] || null;
  const custDetails = r ? {
    Name: r.name, EmailId: r.emailid, CLID: r.clid, MobileNo: r.mobileno, Amount: r.amount, OperatorCode: r.operatorcode,
  } : null;
  if (String(Status).toUpperCase() !== 'SUCCESS' && String(Status).toUpperCase() !== 'PENDING') Status = 'Failed';
  // PORT-NOTE: System.Threading.Thread -> fire-and-forget promise (exceptions only logged, the C# thread died silently).
  (async () => {
    if (custDetails === null) return;
    const S = String(Status).toUpperCase();
    let rechargeEmailStatus;
    if (S === 'SUCCESS') rechargeEmailStatus = 'processed';
    else if (S === 'PENDING') rechargeEmailStatus = 'in pending stage';
    else rechargeEmailStatus = 'failed';
    const op = () => String(custDetails.OperatorCode).toLowerCase(); // .ToLower() on null threw in C#
    const amt = custDetails.Amount;
    const team = CompanySettings.CompanyName + '';
    const isFail = S === 'ERROR' || S === 'FAILURE' || S === 'FAILED';
    const mailBody = (sep) => 'Your ' + op() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + sep + ' Note: Please remember system will be check every transaction after 2 hours. So if the transaction will be failed then your amount will be auto refunded to your wallet.' + (sep === '. <br/><br/>' ? '<br/> Team ' : ' <br/> Team ') + team;
    if (custDetails.Name !== '' && custDetails.EmailId === '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + NOTE + team);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + NOTE + team);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been ' + rechargeEmailStatus + NOTE + team);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('. <br/><br/>'));
    }
    if (custDetails.Name === '' && custDetails.EmailId !== '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been successfully done' + NOTE + team);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been in pending stage' + NOTE + team);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been failed' + NOTE + team);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('.<br/><br/>'));
    }
    if (custDetails.Name !== '' && custDetails.EmailId !== '') {
      if (S === 'SUCCESS') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been successfully done' + NOTE + team);
      if (S === 'PENDING') await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been in pending stage' + NOTE + team);
      if (isFail) await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt + ' has been failed' + NOTE + team);
      await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + String(Status).toLowerCase() + '', mailBody('.<br/><br/>'));
    }
  })().catch((e) => console.error('SendConfirmationMailAndMessages', e && e.message));
}

const nullRef = () => { throw new Error('Object reference not set to an instance of an object.'); };
const toDecimal = (v) => {
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || !Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
};

/**
 * opts: {
 *   controller: 'OnlineElectricityRechargeResponse', kind: 'ELECTRICITY', validateProc: 'usp_validate_customer_electricity_recharge',
 *   masterpage: true (ViewBag.masterpageshow set by the actions), plidFirst: false (Prepaid/Postpaid read Plid before masterpageshow),
 *   insurance: false (RechDOB required, fixed "SUCCESS"/"ERROR" statuses),
 *   failedReturnWallet: true (RechargeFailed calls USP_RETURNRESELLERWALLET),
 *   cancelMode: 'paymentstatus' (USP_UPDATE_CUSTOMERPAYMENTSSTATUS @MODE=3) | 'prepaid' (USP_UPDATE_CUSTOMER_PREPAID_RECHARGE_RESPONSE),
 *   cancelReturnWallet: true, friendly: 'electricity-recharge', catchTransIdXXX: true (catch of Failed/Cancel sets TransactionId "XXXXXXXXX" instead of refrenceid)
 * }
 */
function buildRechargeResponseRouter(opts) {
  const router = express.Router();
  const P = `/portal/${opts.controller}`;
  const FR = (s) => `/portal/secure-eblaa-payment-gateway/${opts.friendly}-${s}`;
  const masterpage = (req, ViewBag) => {
    if (!opts.masterpage) return;
    if (ps.sessionGet(req, 'LoginwithMobile') !== null) ViewBag.masterpageshow = 'MobileLogin';
    else ViewBag.masterpageshow = '';
  };
  const send = (res, ViewBag) => res.json({ ViewBag, ...ViewBag });
  const refOf = (req) => (req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : String(req.p.refrenceid));

  // public (gateway return URL; identity from the session cookie snapshot, null session -> legacy NullReferenceException -> catch branch)
  // route-config: secure-eblaa-payment-gateway/<friendly>-success
  router.all([P + '/RechargeSuccess{/:id}', FR('success')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    let refrenceid = refOf(req);
    try {
      if (!opts.plidFirst) masterpage(req, ViewBag);
      const login = ps.getCustomerLogin(req);
      if (!login) nullRef();
      const Plid = Number(login.Plid);
      if (opts.plidFirst) masterpage(req, ViewBag);
      if (refrenceid !== '' && Plid !== 0) {
        const chkReferenceId = await UtilityClass.Decryptword(refrenceid);
        if (chkReferenceId !== '') refrenceid = chkReferenceId;
        const row = await db.procOne(DB, opts.validateProc, { TRANSACTIONID: refrenceid });
        if (outVal(row, 'STROUTPUT').toLowerCase() === 'success') {
          const g = (k) => ps.sessionGet(req, k);
          const ok = g('MobileNo') !== null && g('RechOpCode') !== null && g('RechOpName') !== null && g('RechOpService') !== null
            && g('RechAmount') !== null && g('StrTransactionId') !== null && (!opts.insurance || g('RechDOB') !== null);
          if (ok) {
            let dob;
            if (opts.insurance) {
              dob = new Date(String(g('RechDOB')));
              if (Number.isNaN(dob.getTime())) throw new Error('String was not recognized as a valid DateTime.');
            }
            const { rechargeStatus } = await makeUtilityRecharge(opts.kind, String(g('MobileNo')), Math.round(Plid), String(g('RechOpCode')),
              String(g('RechOpName')), String(g('RechOpService')), toDecimal(g('RechAmount')), String(g('StrTransactionId')), dob);
            const U = rechargeStatus.toUpperCase();
            if (U === 'SUCCESS' || U === 'PENDING') {
              ViewBag.PaymentStatus = opts.insurance ? 'SUCCESS' : U;
              ViewBag.TransactionId = refrenceid;
              await SendConfirmationMailAndMessages(refrenceid, opts.insurance ? 'SUCCESS' : U);
            }
            if (U === 'ERROR' || U === 'FAILURE') {
              ViewBag.PaymentStatus = 'ERROR';
              ViewBag.TransactionId = refrenceid;
              await SendConfirmationMailAndMessages(refrenceid, opts.insurance ? 'ERROR' : rechargeStatus.toLowerCase());
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
  // route-config: secure-eblaa-payment-gateway/<friendly>-failed
  router.all([P + '/RechargeFailed{/:id}', FR('failed')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    const refrenceid = refOf(req);
    try {
      masterpage(req, ViewBag);
      let strOutput = '';
      if (refrenceid !== '') {
        const row = await db.procOne(DB, 'usp_update_customer_payment_response', {
          CUSTTRANSACTIONID: refrenceid, APITRANSACTIONID: '', RECHARGERESPONSESTATUS: 'FAILED', RECHARGERESPONSEREMARKS: 'Cancelled by user',
        });
        strOutput = outVal(row, 'STROUTPUT');
        if (opts.failedReturnWallet) await db.proc(DB, 'usp_returnresellerwallet', { MODE: 2, ORDERNUMBER: refrenceid });
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
      ViewBag.TransactionId = opts.catchTransIdXXX ? 'XXXXXXXXX' : refrenceid;
      return send(res, ViewBag);
    }
  }));

  // public (gateway return URL)
  // route-config: secure-eblaa-payment-gateway/<friendly>-inprocess
  router.all([P + '/RechargeInProcess{/:id}', FR('inprocess')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    const refrenceid = refOf(req);
    if (refrenceid !== '') ViewBag.PaymentInProcess = 'Success';
    else ViewBag.PaymentInProcess = 'Error';
    masterpage(req, ViewBag);
    return send(res, ViewBag);
  }));

  // public (gateway return URL)
  // route-config: secure-eblaa-payment-gateway/<friendly>-cancel
  router.all([P + '/RechargeCancel{/:id}', FR('cancel')], ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    let refrenceid = refOf(req);
    try {
      masterpage(req, ViewBag);
      let strOutput = '';
      if (refrenceid !== '') {
        refrenceid = await UtilityClass.Decryptword(refrenceid);
        let row;
        if (opts.cancelMode === 'prepaid') {
          row = await db.procOne(DB, 'usp_update_customer_prepaid_recharge_response', {
            CUSTTRANSACTIONID: refrenceid, APITRANSACTIONID: '', RECHARGERESPONSESTATUS: 'FAILED', RECHARGERESPONSEREMARKS: 'Cancelled by user',
          });
        } else {
          row = await db.procOne(DB, 'usp_update_customerpaymentsstatus', { MODE: 3, TRANSID: refrenceid });
        }
        strOutput = outVal(row, 'STROUTPUT');
        if (opts.cancelReturnWallet) await db.proc(DB, 'usp_returnresellerwallet', { MODE: 2, ORDERNUMBER: refrenceid });
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
      ViewBag.TransactionId = opts.catchTransIdXXX ? 'XXXXXXXXX' : refrenceid;
      return send(res, ViewBag);
    }
  }));

  return router;
}

module.exports = { outVal, jtok, makeUtilityRecharge, updateRechargeStatus, SendConfirmationMailAndMessages, buildRechargeResponseRouter };
