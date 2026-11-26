// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OnlinePaymentResponseController.cs
'use strict';
const DB = 'shopping';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const SendMail = require('../../lib/portal/SendMail');
const { CompanySettings } = require('../../lib/portal/CompanySettings');
const { outVal } = require('./_shared/batch-11-common');

const router = express.Router();
const P = '/portal/OnlinePaymentResponse';
const ref = (req) => (req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : String(req.p.refrenceid));
const send = (res, ViewBag) => res.json({ ViewBag, ...ViewBag });

/** class CustomerDetails from USP_GETCUSTOMERDETAILS_BY_TRANSID */
async function getCustomerDetails(TransId) {
  const r = await db.procOne(DB, 'usp_getcustomerdetails_by_transid', { TRANSID: TransId });
  return r ? { Name: r.name, EmailId: r.emailid, CLID: r.clid, MobileNo: r.mobileno, Amount: r.amount } : null;
}
// PORT-NOTE: System.Threading.Thread -> fire-and-forget promise.
const background = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[OnlinePaymentResponse thread]', e && e.message)); };

// public (gateway return URL)
// route-config: secure-jewria-payment-gateway/payment-success
router.all([P + '/PaymentSuccess{/:id}', '/portal/secure-jewria-payment-gateway/payment-success'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let refrenceid = ref(req);
  try {
    let strOutput = '';
    if (refrenceid !== '') {
      refrenceid = await UtilityClass.Decryptword(refrenceid);
      const row = await db.procOne(DB, 'usp_update_customerpaymentsstatus', { MODE: 1, TRANSID: refrenceid });
      strOutput = outVal(row, 'STROUTPUT');
      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
        ViewBag.PaymentStatus = 'SUCCESS';
        ViewBag.TransactionId = refrenceid;
        const custDetails = await getCustomerDetails(refrenceid);
        background(async () => {
          if (custDetails != null) {
            const team = CompanySettings.CompanyName + '';
            if (custDetails.Name !== '' && custDetails.EmailId === '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.Name + ', \r\n You have successfully added Rs.' + custDetails.Amount + ' to your wallet.\r\n Team ' + team);
            }
            if (custDetails.Name === '' && custDetails.EmailId !== '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.EmailId + ', \r\n You have successfully added Rs.' + custDetails.Amount + ' to your wallet.\r\n Team ' + team);
            }
            if (custDetails.Name !== '' && custDetails.EmailId !== '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.Name + ', \r\n You have successfully added Rs.' + custDetails.Amount + ' to your wallet.\r\n Team ' + team);
            }
          }
        });
      }
    } else {
      ViewBag.PaymentStatus = 'Error';
    }
    return send(res, ViewBag);
  } catch (ex) {
    await UtilityClass.TrackError(ex.message);
    ViewBag.PaymentStatus = 'Something went wrong please try again!';
    ViewBag.TransactionId = 'XXXXXXXXX';
    return send(res, ViewBag);
  }
}));

// public (gateway return URL)
// route-config: secure-jewria-payment-gateway/payment-failed
router.all([P + '/PaymentFailed{/:id}', '/portal/secure-jewria-payment-gateway/payment-failed'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const refrenceid = ref(req);
  try {
    let strOutput = '';
    if (refrenceid !== '') {
      const row = await db.procOne(DB, 'usp_update_customerpaymentsstatus', { MODE: 2, TRANSID: refrenceid });
      strOutput = outVal(row, 'STROUTPUT');
      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
        ViewBag.PaymentStatus = 'FAILED';
        ViewBag.TransactionId = refrenceid;
        const custDetails = await getCustomerDetails(refrenceid);
        background(async () => {
          if (custDetails != null && custDetails.MobileNo !== '') {
            const team = CompanySettings.CompanyName + '';
            if (custDetails.Name !== '' && custDetails.EmailId === '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.Name + ', \r\n your request for adding ₹' + custDetails.Amount + ' to your wallet has been failed Please try again.\r\n Team ' + team);
            }
            if (custDetails.Name === '' && custDetails.EmailId !== '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.EmailId + ', \r\n your request for adding ₹' + custDetails.Amount + ' to your wallet has been failed Please try again.\r\n Team ' + team);
              await SendMail.Send1('', custDetails.EmailId, '', '', 'Transaction Failed', 'Dear ' + custDetails.EmailId + ', <br/> your request for adding ₹' + custDetails.Amount + ' to your wallet has been failed <br/> Please try again.<br/> Team ' + team);
            }
            if (custDetails.Name !== '' && custDetails.EmailId !== '') {
              await UtilityClass.SendMsgOnMobile(custDetails.MobileNo, 'Dear ' + custDetails.Name + ', \r\n your request for adding ₹' + custDetails.Amount + ' to your wallet has been failed Please try again.\r\n Team ' + team);
              await SendMail.Send1('', custDetails.EmailId, '', '', 'Transaction Failed', 'Dear ' + custDetails.Name + ', <br/> your request for adding ₹' + custDetails.Amount + ' to your wallet has been failed <br/> Please try again.<br/> Team ' + team);
            }
          }
        });
      }
    } else {
      ViewBag.PaymentStatus = 'Error';
    }
    return send(res, ViewBag);
  } catch (ex) {
    ViewBag.PaymentStatus = 'Something went wrong please try again!';
    ViewBag.TransactionId = 'XXXXXXXXX';
    return send(res, ViewBag);
  }
}));

// public (gateway return URL)
// route-config: secure-jewria-payment-gateway/payment-inprocess
router.all([P + '/PaymentInProcess{/:id}', '/portal/secure-jewria-payment-gateway/payment-inprocess'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  if (ref(req) !== '') ViewBag.PaymentInProcess = 'Success';
  else ViewBag.PaymentInProcess = 'Error';
  return send(res, ViewBag);
}));

// public (gateway return URL)
// route-config: secure-jewria-payment-gateway/payment-cancel
router.all([P + '/PaymentCancel{/:id}', '/portal/secure-jewria-payment-gateway/payment-cancel'], ps.callbackSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const refrenceid = ref(req);
  try {
    let strOutput = '';
    if (refrenceid !== '') {
      const row = await db.procOne(DB, 'usp_update_customerpaymentsstatus', { MODE: 3, TRANSID: refrenceid });
      strOutput = outVal(row, 'STROUTPUT');
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
    ViewBag.TransactionId = 'XXXXXXXXX';
    return send(res, ViewBag);
  }
}));

module.exports = router;
