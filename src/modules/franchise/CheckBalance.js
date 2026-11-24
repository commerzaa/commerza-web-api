'use strict';
// Ported from Franchise\Controllers\CustomerPanel\CheckBalance.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/franchise/CheckBalance';

// public (view only, no session check in legacy)
const Index = asyncHandler(async (req, res) => { res.json({}); });
router.all(P + '/Index{/:id}', Index);
// route-config: franchisee/Get-Info
router.all('/franchise/franchisee/Get-Info{/:id}', Index);

// auth (reads Session["Plid"].Pmid)
router.all(P + '/CheckBalance{/:id}', auth, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  const DID = Number(req.user.pmid);
  let url = '';
  const userinfo = { TransactionID: null, USERNAME: null, Remarks: null, Remark: null, Balance: 0, Message: null, MobileNo: null, EmailID: null, MLMWallet: null, DOJ: null, DOA: null, UniqueID: null };
  if (DID !== 0) {
    const r = await db.queryOne('shopping', 'select apiurl from tbl_companysettings where pmid = @pmid limit 1', { pmid: DID });
    url = r ? r.apiurl : null;
  }
  if (url === '' || url === null || url === undefined) {
    userinfo.Remarks = "APIURL doesn't found.";
    return res.json(userinfo);
  }
  // SearchParaList_transaction serialised by JavaScriptSerializer
  const OBjSendReceive = {
    Username: null, Type: null, TransactionID: null, Amount: 0, ResellerID: null, MemberID: Username,
    WalletID: null, APIKEY: null, APIKey: null, FROMDATE: null, TODATE: null,
  };
  const StrPostData = JSON.stringify(OBjSendReceive);
  const resp = await axios.post(url + '/api/GetuserInformation', StrPostData, {
    headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (x) => x,
  });
  const ObjProductDetails = JSON.parse(String(resp.data));
  const Flag = String(ObjProductDetails.Flag);
  if (Flag === 'success') {
    let Details = ObjProductDetails.Details;
    if (typeof Details === 'string') {
      try { Details = JSON.parse(Details); } catch (e) { /* keep string */ }
    }
    const isEmpty = Array.isArray(Details) && Details.length === 0;
    if (!isEmpty) {
      const obj = Details;
      userinfo.MobileNo = String(obj[0].MobileNo);
      userinfo.EmailID = String(obj[0].EmailID);
      userinfo.MLMWallet = String(obj[0].MLMWallet);
      userinfo.DOJ = String(obj[0].DOJ);
      userinfo.DOA = String(obj[0].DOA);
      userinfo.UniqueID = String(obj[0].UniqueID);
      userinfo.Remarks = 'OK';
    } else {
      userinfo.Remarks = 'Record Not Found.';
    }
  } else {
    userinfo.Remarks = String(ObjProductDetails.Message);
  }
  res.json(userinfo);
}));

module.exports = router;
