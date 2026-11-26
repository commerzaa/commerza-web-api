/** Exports (C# static class RechargeAutoProcess, namespace Eblaa_Web.Models) + property-bag descriptors:
 *   async AutoRechargeProcess() : void   (DBO.USP_GETALLCUSTOMERRECHAREGES; for each row POST {uidno:"",clid:1,TransactionID} to
 *                                          <RechargeAPIURL>/api/Get-Transaction-status; Flag SUCCESS => UpdateRechargeStatus(..,"SUCCESS",..);
 *                                          ERROR/FAILURE/REFUNDED => "FAILED"; any exception => UtilityClass.TrackError("Recharge Auto Process" + msg))
 *   async UpdateRechargeStatus(custTransId="", apiTransactionId="", serviceType="", rechargeResponseStatus="", rechargeResponseRemarks="") : void
 *                                         ([DBO].[USP_AUTOUPDATE_RECHARGE_RESPONSE] ..., @STROUTPUT out; errors => TrackError("AutoRechargeStatus" + msg))
 *   async SendConfirmationMailAndMessages(string TransId, string Status) : void
 *                                         ([DBO].[USP_GETCUSTOMERDETAILS_BY_RECH_TRANSID] @TRANSID, then SMS + mail in a background task)
 *   AllCustomerRecharges / RechargeTransactionRequest / RechargeTransactionResponse / CustomerRechargeDetails = { PROPS }
 * Config keys: RechargeAPIURL (+ CompanyName via ./CompanySettings).
 * Depends on (by contract): ./UtilityClass.TrackError(string), ./UtilityClass.SendMsgOnMobile(mobile, message), ./SendMail.Send1, ./CompanySettings.CompanyName.
 */
'use strict';
const axios = require('axios');
const config = require('../../config');
const { proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { fire } = require('../_libhelpers');

const AllCustomerRecharges = { PROPS: ['CLID', 'TRANSACTIONID', 'RECHARGEAMOUNT', 'RECHARGEDATE', 'RECHARGESTATUS', 'OPERATORTYPE'] };
const RechargeTransactionRequest = { PROPS: ['uidno', 'clid', 'TransactionID'] };
const RechargeTransactionResponse = { PROPS: ['Flag', 'Message', 'ExceptionMessage', 'Our_txn_no', 'operatorcode', 'account', 'Operator_ref_no', 'User_txn_no', 'time', 'amount'] };
const CustomerRechargeDetails = { PROPS: ['Name', 'EmailId', 'CLID', 'MobileNo', 'Amount', 'OperatorCode'] };

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
// JObject["key"].ToString(): missing key => NullReferenceException; JSON null => ""; objects => JSON text
function jstr(obj, key) {
  if (!obj || typeof obj !== 'object' || !(key in obj)) throw NRE();
  const v = obj[key];
  if (v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
const upper = (s) => { if (s === null || s === undefined) throw NRE(); return String(s).toUpperCase(); };
const lower = (s) => { if (s === null || s === undefined) throw NRE(); return String(s).toLowerCase(); };
const cat = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concatenation of null => ""

async function trackError(msg) {
  const UtilityClass = require('./UtilityClass');
  await UtilityClass.TrackError(msg);
}

async function AutoRechargeProcess() {
  try {
    // GetRecharges
    const RechargeAPIURL = config.app.RechargeAPIURL === undefined ? null : config.app.RechargeAPIURL;
    const allCustomerRecharges = mapRows(await proc('shopping', 'usp_getallcustomerrechareges', {}), AllCustomerRecharges.PROPS);
    if (allCustomerRecharges != null && allCustomerRecharges.length > 0) {
      for (const data of allCustomerRecharges) {
        const rechargeReq = { uidno: '', clid: 1, TransactionID: data.TRANSACTIONID };
        let StrPostData = JSON.stringify(rechargeReq);
        const resp = await axios.post(cat(RechargeAPIURL) + '/api/Get-Transaction-status', StrPostData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 100000, // HttpWebRequest default
          responseType: 'text',
          transformResponse: [(d) => d],
        });
        StrPostData = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
        const Return = StrPostData.toString();
        const ObjRechargeResponse = JSON.parse(Return);
        if (!ObjRechargeResponse || typeof ObjRechargeResponse !== 'object' || Array.isArray(ObjRechargeResponse)) {
          throw new Error('Error reading JObject from JsonReader.');
        }
        const Flag = jstr(ObjRechargeResponse, 'Flag');
        const Message = jstr(ObjRechargeResponse, 'Message');
        void Message;
        if (Flag.toUpperCase() === 'SUCCESS') {
          await UpdateRechargeStatus(data.TRANSACTIONID, jstr(ObjRechargeResponse, 'Our_txn_no'), data.OPERATORTYPE, 'SUCCESS', jstr(ObjRechargeResponse, 'Message'));
          // SendConfirmationMailAndMessages(data.TRANSACTIONID, "SUCCESS");  (commented out in C#)
        } else if (Flag.toUpperCase() === 'ERROR' || Flag.toUpperCase() === 'FAILURE' || Flag.toUpperCase() === 'REFUNDED') {
          await UpdateRechargeStatus(data.TRANSACTIONID, jstr(ObjRechargeResponse, 'Our_txn_no'), data.OPERATORTYPE, 'FAILED', jstr(ObjRechargeResponse, 'Message'));
          // SendConfirmationMailAndMessages(data.TRANSACTIONID, "FAILED");  (commented out in C#)
        }
      }
    }
  } catch (ex) {
    await trackError('Recharge Auto Process' + (ex && ex.message !== undefined ? ex.message : String(ex)));
  }
}

async function UpdateRechargeStatus(custTransId = '', apiTransactionId = '', serviceType = '', rechargeResponseStatus = '', rechargeResponseRemarks = '') {
  try {
    const row = await procOne('shopping', 'usp_autoupdate_recharge_response', {
      custtransactionid: custTransId,
      apitransactionid: apiTransactionId,
      servicetype: serviceType,
      rechargeresponsestatus: rechargeResponseStatus,
      rechargeresponseremarks: rechargeResponseRemarks,
    });
    const responseAPI = row ? row[Object.keys(row).find((k) => k.toLowerCase() === 'stroutput') || Object.keys(row)[0]] : null;
    void responseAPI; // legacy reads @STROUTPUT and ignores it
  } catch (ex) {
    await trackError('AutoRechargeStatus' + (ex && ex.message !== undefined ? ex.message : String(ex)));
  }
}

async function SendConfirmationMailAndMessages(TransId, Status) {
  // start Send Confirmation Message To User
  let rechargeEmailStatus = '';
  const custDetails = mapRow(await procOne('shopping', 'usp_getcustomerdetails_by_rech_transid', { transid: TransId }), CustomerRechargeDetails.PROPS);
  if (upper(Status) !== 'SUCCESS' && upper(Status) !== 'PENDING') {
    Status = 'Failed';
  }

  // Send Confirmation Message To User (legacy: background thread)
  fire(async () => {
    if (custDetails != null) {
      const UtilityClass = require('./UtilityClass');
      const SendMail = require('./SendMail');
      const CompanySettings = require('./CompanySettings');
      const S = upper(Status);
      if (S === 'SUCCESS') {
        rechargeEmailStatus = 'processed';
      } else if (S === 'PENDING') {
        rechargeEmailStatus = 'in pending stage';
      } else {
        rechargeEmailStatus = 'failed';
      }
      const team = ' Team ' + cat(CompanySettings.CompanyName) + '';
      const note = 'Note: Please remember system will be check every transaction after 2 hours. So if the transaction will be failed then your amount will be auto refunded to your wallet.';
      const isFail = S === 'ERROR' || S === 'FAILURE' || S === 'FAILED';
      const op = () => lower(custDetails.OperatorCode);
      const amt = () => cat(custDetails.Amount);

      if (custDetails.Name !== '' && custDetails.EmailId === '') {
        if (S === 'SUCCESS') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '. \r\n' + note + ' \r\n' + team);
        }
        if (S === 'PENDING') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '. \r\n' + note + ' \r\n' + team);
        }
        if (isFail) {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '. \r\n' + note + ' \r\n' + team);
        }
        await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + lower(Status) + '', 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '. <br/><br/> ' + note + '<br/>' + team);
      }
      if (custDetails.Name === '' && custDetails.EmailId !== '') {
        if (S === 'SUCCESS') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been successfully done. \r\n' + note + ' \r\n' + team);
        }
        if (S === 'PENDING') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been in pending stage. \r\n' + note + ' \r\n' + team);
        }
        if (isFail) {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been failed. \r\n' + note + ' \r\n' + team);
        }
        await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + lower(Status) + '', 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '.<br/><br/> ' + note + ' <br/>' + team);
      }
      if (custDetails.Name !== '' && custDetails.EmailId !== '') {
        if (S === 'SUCCESS') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been successfully done. \r\n' + note + ' \r\n' + team);
        }
        if (S === 'PENDING') {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been in pending stage. \r\n' + note + ' \r\n' + team);
        }
        if (isFail) {
          await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Your ' + op() + ' recharge Rs.' + amt() + ' has been failed. \r\n' + note + ' \r\n' + team);
        }
        await SendMail.Send1('', custDetails.EmailId, '', '', 'Recharge ' + lower(Status) + '', 'Your ' + op() + ' recharge Rs.' + amt() + ' has been ' + rechargeEmailStatus + '.<br/><br/> ' + note + ' <br/>' + team);
      }
    }
  });
}

module.exports = {
  AutoRechargeProcess,
  UpdateRechargeStatus,
  SendConfirmationMailAndMessages,
  AllCustomerRecharges,
  RechargeTransactionRequest,
  RechargeTransactionResponse,
  CustomerRechargeDetails,
};
