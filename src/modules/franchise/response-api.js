'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/ResponseAPI.cs (ResponseAPIController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const axios = require('axios');
const { queryOne, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const C = 'ResponseAPI';

/** JToken indexer + ToString(): missing key => NullReferenceException, JSON null => "" */
function tok(o, k) {
  const v = o[k];
  if (v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  if (v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}
function toInt(v) { const n = Number(v); if (!/^\s*-?\d+\s*$/.test(v)) throw new Error('Input string was not in a correct format.'); return n; }
function toDec(v) { const n = Number(v); if (v.trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; }
const blankInfo = () => ({ Userid: null, Emailid: null, Phone: null, Orderid: null, Productname: null, Quantity: 0, Sellcost: 0, Gst: 0, Status1: null,
  Discount1: 0, BV1: 0, Totalamount: 0, Date1: null, Memberid: null, Remarks: null });
/** new SearchParaList_transaction (JavaScriptSerializer serialises every property) */
const payloadOf = (o) => ({ Username: null, Type: null, TransactionID: null, Amount: 0, ResellerID: null, MemberID: null, WalletID: null, APIKEY: null,
  APIKey: null, FROMDATE: null, TODATE: null, ...o });

async function runQuery(req, res, endpoint, payload, useridFn) {
  const DID = Number(req.user.pmid);
  let url = '';
  const userinfo0 = blankInfo();
  if (DID !== 0) {
    url = await scalar(DB, 'select apiurl from tbl_companysettings where pmid=@did LIMIT 1', { did: DID });
  }
  if (url === '' || url === null || url === undefined) {
    userinfo0.Remarks = "APIURL doesn't found.";
    return res.json(userinfo0);
  }
  const obj1 = [];
  let userinfo = userinfo0;
  const StrPostData = JSON.stringify(payloadOf(payload));
  const r = await axios.post('http://apishop.mlmkabila.com/api/' + endpoint, StrPostData, {
    headers: { 'Content-Type': 'application/json' }, transformResponse: (x) => x, timeout: 100000,
  });
  const ObjProductDetails = JSON.parse(String(r.data));
  const Flag = tok(ObjProductDetails, 'Flag');
  if (Flag === 'success') {
    const Details = tok(ObjProductDetails, 'Details');
    if (Details !== '[]') {
      const obj = JSON.parse(Details);
      for (let i = 0; i < obj.length; i++) {
        const o = obj[i];
        userinfo = blankInfo();
        userinfo.Userid = useridFn(o);
        userinfo.Emailid = tok(o, 'EMAILID') === '' ? '' : tok(o, 'EMAILID');
        userinfo.Phone = tok(o, 'PHONE') === '' ? '' : tok(o, 'PHONE');
        userinfo.Orderid = tok(o, 'ORDERID') === '' ? '' : tok(o, 'ORDERID');
        userinfo.Productname = tok(o, 'ProductName') === '' ? '' : tok(o, 'ProductName');
        userinfo.Quantity = toInt(tok(o, 'Quantity') === '' ? '0' : tok(o, 'Quantity'));
        userinfo.Sellcost = toDec(tok(o, 'SellCost') === '' ? '0' : tok(o, 'SellCost'));
        userinfo.Gst = toDec(tok(o, 'GST') === '' ? '0' : tok(o, 'GST'));
        userinfo.Status1 = tok(o, 'Status') === '' ? '' : tok(o, 'Status');
        userinfo.Discount1 = toDec(tok(o, 'Discount %') === '' ? '0' : tok(o, 'Discount %'));
        userinfo.BV1 = toDec(tok(o, 'BV') === '' ? '0' : tok(o, 'BV'));
        userinfo.Totalamount = toDec(tok(o, 'TotalAmount') === '' ? '0' : tok(o, 'TotalAmount'));
        userinfo.Date1 = tok(o, 'Date') === '' ? '0' : tok(o, 'Date');
        userinfo.Memberid = tok(o, 'MemberID') === '' ? '0' : tok(o, 'MemberID');
        userinfo.Remarks = 'OK';
        obj1.push(userinfo);
      }
    } else {
      userinfo.Remarks = 'Record Not Found.';
    }
  } else {
    userinfo.Remarks = tok(ObjProductDetails, 'Message');
  }
  return res.json(obj1);
}

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  const DID = Number(req.user.did);
  const APIKEY = await scalar(DB, 'select apikey from distributor_master where pmid=@did LIMIT 1', { did: DID });
  res.json({ ViewBag: { APIKEY } });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);
// route-config
router.all('/franchise/franchisee/Response-API', auth, indexHandler);
// route-config
router.all('/franchise/franchisee/Utilities-Response-API', auth, indexHandler);

// auth
router.all(`/franchise/${C}/GellAllDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Username, ResellerID } = req.p;
  return runQuery(req, res, 'GETALLRecord', { Username: Username === undefined ? null : Username, ResellerID: ResellerID === undefined ? null : ResellerID }, (o) => (tok(o, 'USERID') === '' ? '' : tok(o, 'USERID')));
}));

// auth
router.all(`/franchise/${C}/GellAllAPI_keyDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const API_Key = req.p.API_Key;
  return runQuery(req, res, 'ALLPRODUCTRECORD_BYAPIKEY', { APIKEY: API_Key === undefined ? null : API_Key }, (o) => (tok(o, 'Username') === '' ? '' : tok(o, 'Username')));
}));

// auth
router.all(`/franchise/${C}/GellDetailsByUser{/:id}`, auth, asyncHandler(async (req, res) => {
  const { Username, API_Key } = req.p;
  return runQuery(req, res, 'GETALLRecord', { Username: Username === undefined ? null : Username, APIKey: API_Key === undefined ? null : API_Key }, (o) => (tok(o, 'UserName') === '' ? '' : tok(o, 'UserName')));
}));

// auth
router.all(`/franchise/${C}/GellDetailsByDateWise{/:id}`, auth, asyncHandler(async (req, res) => {
  const { FromDate, ToDate, API_Key } = req.p;
  // legacy quirk: tests obj["Username"] but reads obj["USERID"]
  return runQuery(req, res, 'GETALLDetailBY_APIkey_Date', { FROMDATE: FromDate === undefined ? null : FromDate, TODATE: ToDate === undefined ? null : ToDate, APIKEY: API_Key === undefined ? null : API_Key },
    (o) => (tok(o, 'Username') === '' ? '' : tok(o, 'USERID')));
}));

module.exports = router;
