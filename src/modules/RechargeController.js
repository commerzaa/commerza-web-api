'use strict';
/**
 * Port of Controllers/MemberPanelCntrl/RechargeController.cs
 * Routes: recharge, rechargebygateway, GenerateOrderID, serviceProviderList, rechargereport,
 *         FetchElictricityBill (GET), checkstatus (GET)  (7)
 */
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const Helper = require('../lib/Helper');
const DAL_Common = require('../lib/DAL_Common');
const RechargeRepository = require('../lib/RechargeRepository');

const router = express.Router();

// ---------------------------------------------------------------- helpers
class BadParam extends Error {}
const isBlank = (v) => v === undefined || v === null;
function reqFloat(v) {
  if (isBlank(v) || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(String(v).trim())) throw new BadParam('bad float');
  return Number(String(v).trim());
}
/** Convert.ToDecimal(string) (null => 0, bad format => throws) */
function convDecimal(v) {
  if (isBlank(v)) return 0;
  const s = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
/** Convert.ToDouble(object) */
function convDouble(v) {
  if (isBlank(v)) return 0;
  const n = Number(typeof v === 'string' ? v.trim() : v);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
/** dynamic Dictionary indexer: missing key / non-dictionary => throws (KeyNotFound / RuntimeBinder) */
function dget(o, k) {
  if (o === null || o === undefined || typeof o !== 'object' || !(k in o)) throw new Error(`The given key was not present: ${k}`);
  return o[k];
}
/** assignment of a dynamic value to a C# `string` variable: only string/null convert implicitly */
function toStringVar(v) {
  if (v !== null && v !== undefined && typeof v !== 'string') throw new Error('Cannot implicitly convert type');
  return v;
}
const h = (fn) => asyncHandler(async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof BadParam) return res.status(400).json({ Message: 'The request is invalid.' });
    throw e;
  }
});

/**
 * Shared body of the three identical "sp_RechargeCondition -> rechargeapi" blocks.
 * Returns { statusstr, messagestr }.
 */
async function submitRecharge(trackid, number, amount, opname, client_id, RechargeType, provider_id, paymentID, gatewayamt) {
  let messagestr = '';
  let statusstr = '';
  const rechargeStatus = await RechargeRepository.sp_RechargeCondition(trackid, number, amount, opname, client_id, 1, RechargeType,
    provider_id, paymentID, gatewayamt);
  if (rechargeStatus !== null && rechargeStatus !== undefined) {
    if (rechargeStatus.status === 'true') {
      const jsonObject = await Helper.rechargeapi(number, provider_id, amount, client_id);
      let x = null;
      try {
        x = dget(jsonObject, 'txstatus_desc');
        toStringVar(dget(jsonObject, 'txstatus_desc'));
      } catch (e) {
        x = dget(jsonObject, 'message');
      }
      if (x === null || x === undefined) throw new TypeError('Object reference not set to an instance of an object.'); // x.ToString()
      dget(jsonObject, 'message'); // dynamic y = jsonObject["message"]
      messagestr = 'Requested submited successfully! check recharge report for status';
      statusstr = 'true';
    } else {
      messagestr = rechargeStatus.message;
    }
    statusstr = rechargeStatus.status;
  } else {
    messagestr = 'Something went wrong';
    statusstr = 'false';
  }
  return { statusstr, messagestr };
}

// ---------------------------------------------------------------- recharge
// auth
router.post('/api/recharge', auth, h(async (req, res) => {
  const { plid, number, provider_id, client_id, opname, RechargeType } = req.p;
  const amount = reqFloat(req.p.amount);
  // paymentID, gatewayAmount accepted but unused here
  const user = await DAL_Common.ValidateUser(plid);
  if (user === null || user === undefined) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  const trackid = plid;
  const response = await Helper.MTBalance();
  const balance = dget(response, 'balance');
  if (convDouble(Math.fround(amount)) > convDouble(balance)) {
    return res.json({ status: 'false', message: 'Network Problem' });
  }
  const r = await submitRecharge(trackid, number, amount, opname, client_id, RechargeType, provider_id, '0', 0);
  return res.json({ status: r.statusstr, message: r.messagestr });
}));

// ---------------------------------------------------------------- rechargebygateway
// auth
router.post('/api/rechargebygateway', auth, h(async (req, res) => {
  const { plid, number, provider_id, client_id, opname, RechargeType, paymentID } = req.p;
  let { gatewayAmount } = req.p;
  const amount = reqFloat(req.p.amount);
  let messagestr = '';
  let statusstr = '';
  const user = await DAL_Common.ValidateUser(plid);
  if (user === null || user === undefined) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  const trackid = plid;
  const response = await Helper.MTBalance();
  const balance = dget(response, 'balance');
  if (convDouble(Math.fround(amount)) > convDouble(balance)) {
    return res.json({ status: 'false', message: 'Network Problem' });
  }

  const da = await Helper.checkPaymentRazor(paymentID);
  // Helper.OrderidResponse: "" on success, the exception message when checkPaymentRazor failed (da is then that message string)
  const OrderidResponse = typeof da === 'string' ? da : '';
  if (OrderidResponse !== 'The id provided does not exist' || paymentID === '0') {
    let gatewayamt = 0;
    if (paymentID.length > 10 && gatewayAmount !== '0') {
      try {
        gatewayamt = convDecimal(gatewayAmount);
      } catch (ex) {
        gatewayAmount = '-1';
        return res.json({ status: 'false', message: 'payment amount not correct fromat' });
      }
      if (gatewayAmount === '-1') {
        return res.json({ status: 'false', message: 'payment amount not correct fromat' });
      }

      if (typeof da === 'string') throw new Error(da); // da["amount"] on a string result => runtime binder exception (500)
      if (Math.abs(convDecimal(dget(da, 'amount')) / 100 - gatewayamt) < 1e-9) {
        const status = dget(da, 'status');
        if (status.toLowerCase() === 'captured' || status.toLowerCase() === 'authorized') {
          const r = await submitRecharge(trackid, number, amount, opname, client_id, RechargeType, provider_id, paymentID, gatewayamt);
          statusstr = r.statusstr;
          messagestr = r.messagestr;
        } else {
          return res.json({ status: 'false', message: 'Payment not done' });
        }
      } else {
        statusstr = 'false';
        messagestr = 'payment not match';
      }
    } else if (paymentID === '0' && gatewayAmount === '0') {
      const r = await submitRecharge(trackid, number, amount, opname, client_id, RechargeType, provider_id, paymentID, gatewayamt);
      statusstr = r.statusstr;
      messagestr = r.messagestr;
    } else {
      statusstr = 'false';
      messagestr = 'Invalid PaymentID';
    }
  } else {
    statusstr = 'false';
    messagestr = 'The id provided does not exist';
  }
  return res.json({ status: statusstr, message: messagestr });
}));

// ---------------------------------------------------------------- GenerateOrderID
// auth
router.post('/api/GenerateOrderID', auth, h(async (req, res) => {
  const { plid, number, provider_id, opname, RechargeType } = req.p;
  const amount = reqFloat(req.p.amount);
  const user = await DAL_Common.ValidateUser(plid);
  if (user === null || user === undefined) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  const OrderID = await Helper.UniqueGenerate();
  const client_id = OrderID;
  const trackid = plid;
  const response = await Helper.MTBalance();
  const balance = dget(response, 'balance');
  if (convDouble(Math.fround(amount)) > convDouble(balance)) {
    return res.json({ status: 'false', message: 'Network Problem' });
  }
  const rechargeStatus = await RechargeRepository.sp_RechargeCondition(trackid, number, amount, opname, client_id, 1, RechargeType,
    provider_id, '0', 0);
  if (rechargeStatus.status === 'true') { // null => NullReferenceException, as legacy
    // (empty in legacy)
  } else {
    // (empty in legacy)
  }
  return res.json({});
}));

// ---------------------------------------------------------------- serviceProviderList
// public (master data, takes no member identity)
router.post('/api/serviceProviderList', asyncHandler(async (req, res) => {
  const data = await RechargeRepository.Serviceprovider(req.p.type);
  if (data.length > 0) return res.json({ status: 'true', data });
  return res.json({ status: 'false', data });
}));

// ---------------------------------------------------------------- rechargereport
// auth
router.post('/api/rechargereport', auth, asyncHandler(async (req, res) => {
  const { plid } = req.p; // UID accepted but unused
  const user = await DAL_Common.ValidateUser(plid);
  if (user === null || user === undefined) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  const trackid = plid;
  const pendingRecharge = Array.from(await RechargeRepository.GetPendingRecharge(trackid));
  for (const item of pendingRecharge) {
    const jsonObject = await Helper.RechargeApiStatus(item.referenceno);
    let x;
    let message = '';
    try {
      x = toStringVar(dget(jsonObject, 'status'));
      message = toStringVar(dget(jsonObject, 'message'));
    } catch (e) {
      x = '';
    }
    if (typeof x === 'string' && x.toLowerCase() === 'success') {
      await RechargeRepository.updateRechargeSatus(item.id, 'success', item.RechargeType);
    }
    if (typeof x === 'string' && x.toLowerCase() === 'recharge failed') {
      await RechargeRepository.updateRechargeSatus(item.id, 'Fail', item.RechargeType);
    }
    if (x === '0' && message === 'referenceno not exists') {
      await RechargeRepository.updateRechargeSatus(item.id, 'Fail', item.RechargeType);
    }
  }
  const report = Array.from(await RechargeRepository.GetRechargeReport(trackid));
  if (report.length > 0) return res.json({ status: 'true', message: 'success', data: report });
  return res.json({ status: 'false', message: 'No record found!!' });
}));

// ---------------------------------------------------------------- FetchElictricityBill
// auth
router.get('/api/FetchElictricityBill', auth, asyncHandler(async (req, res) => {
  const { plid, operaterid, customer } = req.p;
  const user = await DAL_Common.ValidateUser(plid);
  if (user === null || user === undefined) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  const jsonobject = await Helper.FetchElicricityBill(operaterid, customer);
  let x = null;
  let Customername = '';
  let billdate = '';
  try {
    x = dget(jsonobject, 'Amount');
    Customername = toStringVar(dget(jsonobject, 'name'));
    billdate = toStringVar(dget(jsonobject, 'Date'));
  } catch (e) {
    x = '0';
  }
  if (x === null || x === undefined) throw new TypeError('Object reference not set to an instance of an object.'); // x.ToString()
  const code = String(x);
  return res.json({ amount: code, customername: Customername, billdate });
}));

// ---------------------------------------------------------------- checkstatus
// auth
router.get('/api/checkstatus', auth, asyncHandler(async (req, res) => {
  const da = await Helper.checkPaymentRazor(req.p.orderid);
  return res.json({ d: da });
}));

module.exports = router;
