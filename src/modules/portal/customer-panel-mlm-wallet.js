'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MLMWallet.cs
// (class MLMWalletController => /portal/MLMWallet/...). Database: shopping (Db_Shopping).
// [CheckResellerTimeout] / [DistributerSessionExpireCheck]: bodies commented out in legacy => no check.
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const { CompanySettings, CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, firstCol, str, masterpageshow, toInt32, background, nStr } = require('./_shared/batch-06-common');

const router = express.Router();

/** decimal parameter with a default (MVC binding: missing/invalid => default) */
function decParam(v, def) {
  if (v === null || v === undefined || String(v).trim() === '' || Number.isNaN(Number(v))) return def;
  return Number(v);
}
/** class GetResponse (JavaScriptSerializer output order) */
function newGetResponse() {
  return {
    TransactionID: null, USERNAME: null, Remarks: null, Remark: null, Balance: 0, Message: null,
    MobileNo: null, EmailID: null, MLMWallet: null, DOJ: null, DOA: null, UniqueID: null,
  };
}
/** new Random().Next(999999) */
const nextRandom = () => Math.floor(Math.random() * 999999);
/** Newtonsoft JToken.ToString() */
function jTokenToString(t) {
  if (t === null || t === undefined) throw new Error('Object reference not set to an instance of an object.');
  if (typeof t === 'object') return Array.isArray(t) && t.length === 0 ? '[]' : JSON.stringify(t, null, 2);
  return String(t);
}

// ---------------------------------------------------------------- Index()
// auth ([SessionExpireCheck])
// route-config: "customer/MLM-Wallet" -> MLMWallet/Index
router.all(['/portal/MLMWallet/Index{/:id}', '/portal/MLMWallet', '/portal/customer/MLM-Wallet{/:id}'], ps.SessionExpireCheck,
  asyncHandler(async (req, res) => {
    if (ps.isCustomer(req)) {
      const Plid = Number(req.user.plid);
      const ViewBag = { masterpageshow: masterpageshow(req) };
      if (Plid !== 0) {
        const end = UtilityClass.Encryptword('Checkout'); // eslint-disable-line no-unused-vars
        let UserWallet = 0;
        const row = await db.queryOne(DB, 'SELECT availablebalance FROM tbl_customermlmwallet WHERE clid = @Plid LIMIT 1', { Plid });
        const v = firstCol(row);
        UserWallet = v === null || v === undefined ? 0 : Number(v);
        if (UserWallet > 0) ViewBag.UserWallet = UserWallet;
      }
      return view(res, '~/Views/CustomerPanel/MLMWallet/Index.cshtml', undefined, ViewBag);
    }
    await UtilityClass.TrackError('From MLMWallet->Index');
    return view(res, '~/');
  }));

// ---------------------------------------------------------------- Sendotp() : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all('/portal/MLMWallet/Sendotp{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = toInt32(req.user.plid);
  let Mobile = '';
  await CompanyMasterSettings.GetResellerData();
  const row = await db.queryOne(DB, 'SELECT phone FROM tbl_customerlogin WHERE clid = @Plid LIMIT 1', { Plid });
  Mobile = row ? row.phone : null;
  const random = nextRandom();
  ps.sessionSet(req, 'OTP', random);
  const msg = 'Dear Sir/ Ma’am \r\n Your Verification Code:' + random + ' Please Use This Verification Code For Verify Your Mobile No.\r\n  '
    + CompanySettings.CompanyName + ' Team';
  background(() => UtilityClass.SendMsgOnMobile(Mobile, msg));
  res.json('Verification Code has been sent to your Mobile No.please verify your Mobile No.' + (Mobile == null ? '' : Mobile) + '');
}));

// ---------------------------------------------------------------- Submitotp(string OTP) : JsonResult
// public session route: compares Session["OTP"] (null => NullReferenceException as legacy)
router.all('/portal/MLMWallet/Submitotp{/:id}', ps.portalSession, asyncHandler(async (req, res) => {
  const OTP = nStr(req.p.OTP);
  if (str(ps.sessionGet(req, 'OTP')) === OTP) {
    return res.json('Successfully.');
  }
  return res.json('Invalid OTP.Please Try Again.');
}));

// ---------------------------------------------------------------- AddMoneyToWallet(decimal addedMoney = 0, int WalletID = 0, string Username = "")
// auth: a missing session threw NullReferenceException inside the try => catch => Json("/page-not-found")
router.all('/portal/MLMWallet/AddMoneyToWallet{/:id}', ...ps.customerOr('/page-not-found'), asyncHandler(async (req, res) => {
  try {
    const addedMoney = decParam(req.p.addedMoney, 0);
    const Username = req.p.Username === undefined ? '' : nStr(req.p.Username);
    const Plid = Number(req.user.plid);
    const BAL = Number(await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid)));
    if (addedMoney <= 0) {
      return res.json('Amount should be positive');
    } else if (BAL <= addedMoney) {
      return res.json('Insufficient Amount.Please Try Again.');
    }
    const DID = toInt32(req.user.did || 0);
    let url = '';
    const Loginid = Username;
    const userinfo = newGetResponse();
    // db.Database.CommandTimeout = 1000
    if (DID !== 0) {
      const r = await db.queryOne(DB, `SELECT apiurl FROM tbl_companysettings AS cs INNER JOIN tbl_distributor AS d ON d.pmid = cs.pmid
        WHERE did = @DID LIMIT 1`, { DID });
      url = r ? r.apiurl : null;
      // Loginid = select USERID from TBL_DISTRIBUTOR (commented out in legacy)
    }
    if (url === '' || url === null || url === undefined) {
      userinfo.Remarks = "APIURL doesn't found.";
      return res.json(userinfo);
    }
    const random = nextRandom();
    // SearchParaList_transaction serialised by JavaScriptSerializer (all properties, declaration order)
    const OBjSendReceive = {
      Username: null, Type: 'Cr', TransactionID: String(random), Amount: addedMoney, ResellerID: null, MemberID: Loginid, WalletID: '1',
      APIKEY: null, APIKey: null, FROMDATE: null, TODATE: null,
    };
    let StrPostData = JSON.stringify(OBjSendReceive);
    const resp = await axios.post(url + '/api/AmountTransaction', StrPostData, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
      transformResponse: [(d) => d],
      timeout: 100000,
    });
    StrPostData = String(resp.data);
    const Return = StrPostData;
    const ObjProductDetails = JSON.parse(Return); // JObject.Parse
    if (ObjProductDetails === null || typeof ObjProductDetails !== 'object' || Array.isArray(ObjProductDetails)) {
      throw new Error('Error reading JObject from JsonReader.');
    }
    const Flag = jTokenToString(ObjProductDetails.Flag);
    if (Flag === 'success') {
      const Details = jTokenToString(ObjProductDetails.Details);
      if (Details !== '[]') {
        const obj = typeof ObjProductDetails.Details === 'string' ? JSON.parse(Details) : ObjProductDetails.Details; // JArray.Parse
        if (!Array.isArray(obj)) throw new Error('Error reading JArray from JsonReader.');
        userinfo.TransactionID = jTokenToString(obj[0].TransactionID);
        const TRANSID = jTokenToString(obj[0].TransactionID);
        userinfo.USERNAME = jTokenToString(obj[0].USERNAME);
        userinfo.Remarks = jTokenToString(obj[0].Remarks);
        const CLID = Number(req.user.plid);
        if (TRANSID !== '') {
          // PORT-NOTE: USP_CUSTOMERMLMWALLETINSERT is not in the Db_Shopping schema dump; called as usp_customermlmwalletinsert(...).
          const out = await db.procOne(DB, 'usp_customermlmwalletinsert', {
            AMOUNT: addedMoney, CLID, TRACENO: String(random), ReferenceUsername: Loginid, ReferenceTransactionID: TRANSID,
          });
          userinfo.Remarks = str(outVal(out, 'output'));
        } else {
          userinfo.Remarks = jTokenToString(ObjProductDetails.Message);
        }
      }
    } else {
      userinfo.Remarks = jTokenToString(ObjProductDetails.Message);
    }
    return res.json(userinfo.Remarks);
  } catch (ex) {
    const Url = '/page-not-found';
    return res.json(Url);
  }
}));

module.exports = router;
