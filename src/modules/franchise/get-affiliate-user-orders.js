'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/GetAffiliateUserOrders.cs (GetAffiliateUserOrdersController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const axios = require('axios');
const { scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** JToken["key"].ToString(): missing property => NullReference, JSON null => "" */
function tok(o, k) {
  if (o === null || o === undefined || o[k] === undefined) throw NRE();
  const v = o[k];
  if (v === null) return '';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/Get-Affiliate-User-Orders
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/GetAffiliateUserOrders/Index{/:id}', '/franchise/franchisee/Get-Affiliate-User-Orders'], auth, asyncHandler(async (req, res) => {
  const obj1 = [];
  let SearchValue = req.p.SearchValue;
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  const OBjSendReceive = { USERNAME: SearchValue, ORDERID: '' };
  const DID = Number(req.user.did);
  let url = '';
  if (DID !== 0) {
    const v = await scalar(DB, 'select apiurl from tbl_companysettings where pmid = @pmid LIMIT 1', { pmid: req.user.pmid });
    url = v === undefined ? null : v;
  }
  const view = '~/Views/GetAffiliateUserOrders/Index.cshtml';
  if (url === '') return res.json({ view, Model: obj1 });
  const StrPostData = JSON.stringify(OBjSendReceive);
  const resp = await axios.post((url === null ? '' : url) + '/api/GETALLDetailBY_UserName', StrPostData, {
    headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (d) => d, timeout: 100000,
  });
  const ObjProductDetails = JSON.parse(resp.data);
  const Flag = tok(ObjProductDetails, 'Flag');
  if (Flag === 'success') {
    const dv = ObjProductDetails.Details;
    if (dv === undefined) throw NRE();
    let arr = null;
    if (Array.isArray(dv)) { if (dv.length > 0) arr = dv; } else {
      const Details = dv === null ? '' : String(dv);
      if (Details !== '[]') arr = JSON.parse(Details);
    }
    if (arr) {
      for (let i = 0; i < arr.length; i++) {
        const userinfo = {
          USERNAME: null, EMAILID: null, MOBILE: null, ORDERID: null, PRODUCTNAME: null, QUANTITY: null, Amount: null, GST: null, Status: null,
          BV: null, RBV: null, TotalAmount: null, Date: null, MemberID: null,
        };
        userinfo.QUANTITY = tok(arr[i], 'QUANTITY');
        userinfo.USERNAME = tok(arr[i], 'USERNAME');
        userinfo.MemberID = tok(arr[i], 'MemberID');
        userinfo.ORDERID = tok(arr[i], 'ORDERID');
        userinfo.BV = tok(arr[i], 'BV');
        userinfo.Amount = tok(arr[i], 'SellCost');
        userinfo.GST = tok(arr[i], 'GST');
        userinfo.Date = tok(arr[i], 'Date');
        userinfo.PRODUCTNAME = tok(arr[i], 'PRODUCTNAME');
        userinfo.TotalAmount = tok(arr[i], 'TotalAmount');
        obj1.push(userinfo);
      }
    }
  }
  return res.json({ view, Model: obj1 });
}));

module.exports = router;
