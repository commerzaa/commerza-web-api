'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\AmountTransaction.cs (AmountTransactionController) */
const express = require('express');
const axios = require('axios');
const { scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/franchise/AmountTransaction';

const newGetResponse = () => ({
  TransactionID: null, USERNAME: null, Remarks: null, Remark: null, Balance: 0, Message: null, MobileNo: null, EmailID: null,
  MLMWallet: null, DOJ: null, DOA: null, UniqueID: null,
});
const newSearchPara = (o) => ({
  Username: null, Type: null, TransactionID: null, Amount: 0, ResellerID: null, MemberID: null, WalletID: null, APIKEY: null, APIKey: null,
  FROMDATE: null, TODATE: null, ...o,
});
const str = (v) => (v === undefined || v === null ? '' : String(v));
const getApiUrl = (pmid) => scalar('shopping', 'select APIURL from TBL_COMPANYSETTINGS where PMID=@pmid limit 1', { pmid });

// auth // route-config: franchisee/AmountTransaction
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/AmountTransaction'], auth, asyncHandler(async (req, res) => {
  res.json({ view: 'AmountTransaction/Index' });
}));

// auth
router.all(`${P}/UserTransaction{/:id}`, auth, asyncHandler(async (req, res) => {
  let MemberID = req.p.MemberID == null ? '' : req.p.MemberID;
  const Amount = req.p.Amount === undefined || req.p.Amount === null || req.p.Amount === '' ? 0 : Number(req.p.Amount);
  const type = req.p.type == null ? '' : req.p.type;
  const TransactionID = req.p.TransactionID == null ? '' : req.p.TransactionID;
  const walletid = req.p.walletid;
  const DID = Number(req.user.pmid);
  let url = '';
  const userinfo = newGetResponse();
  if (DID !== 0) url = await getApiUrl(DID);
  if (url === '' || url === null || url === undefined) {
    userinfo.Remarks = "APIURL doesn't found.";
    return res.json(userinfo);
  }
  const OBjSendReceive = newSearchPara({ MemberID, Type: type, Amount, TransactionID, WalletID: walletid === undefined ? null : walletid });
  const r = await axios.post(url + '/api/AmountTransaction', JSON.stringify(OBjSendReceive), {
    headers: { 'Content-Type': 'application/json' }, transformResponse: (d) => d,
  });
  const ObjProductDetails = JSON.parse(r.data);
  const Flag = str(ObjProductDetails.Flag);
  if (Flag === 'success') {
    const d = ObjProductDetails.Details;
    const Details = typeof d === 'string' ? d : JSON.stringify(d);
    if (Details !== '[]') {
      const obj = typeof d === 'string' ? JSON.parse(d) : d;
      userinfo.TransactionID = str(obj[0].TransactionID);
      userinfo.USERNAME = str(obj[0].USERNAME);
      userinfo.Remarks = str(obj[0].Remarks);
    }
  } else {
    userinfo.Remarks = str(ObjProductDetails.Message);
  }
  res.json(userinfo);
}));

// auth
router.all(`${P}/CheckBalance{/:id}`, auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  const Amount = req.p.Amount === undefined || req.p.Amount === null || req.p.Amount === '' ? 0 : Number(req.p.Amount);
  const DID = Number(req.user.did);
  let url = '';
  if (DID !== 0) url = await getApiUrl(DID);
  const OBjSendReceive = newSearchPara({ Username: Username === undefined ? null : Username, Amount });
  const userinfo = newGetResponse();
  const r = await axios.post(url + '/api/CheckBalance', JSON.stringify(OBjSendReceive), {
    headers: { 'Content-Type': 'application/json' }, transformResponse: (d) => d,
  });
  const ObjProductDetails = JSON.parse(r.data);
  const Flag = str(ObjProductDetails.Flag);
  if (Flag === 'success') {
    const d = ObjProductDetails.Details;
    const Details = typeof d === 'string' ? d : JSON.stringify(d);
    if (Details !== '[]') {
      const obj = typeof d === 'string' ? JSON.parse(d) : d;
      userinfo.Balance = Number(str(obj[0].Balance));
      userinfo.Remarks = str(obj[0].Remark);
    }
  } else {
    userinfo.Remarks = str(ObjProductDetails.Message);
  }
  res.json(userinfo);
}));

module.exports = router;
