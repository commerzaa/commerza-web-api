'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ResellerProductDetails.cs
// (class ResellerProductDetailsController => /admin/ResellerProductDetails/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nstr, view, nre } = require('./_shared/batch13-04-common');

const router = express.Router();
const C = 'ResellerProductDetails';

// PORT-NOTE: the legacy URL was hard-coded; it can be overridden with config.app.ResellerDetailByUserNameUrl.
const RESELLER_URL = () => (config.app && config.app.ResellerDetailByUserNameUrl) || 'http://localhost:61509/api/DetailBy_UserName';

/** Newtonsoft JToken.ToString() of obj[i]["X"] (missing key => NullReferenceException) */
function jtStr(v) {
  if (v === undefined) throw nre();
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
}

// ---------------------------------------------------------------- Index(string UserName)
// auth (legacy had no session check; admin page calling the reseller API with the company ResellerKey => adminAuth)
// route-config: "AdminPanel/Reseller-Product-Details" -> ResellerProductDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Reseller-Product-Details'], adminAuth, asyncHandler(async (req, res) => {
  const UserName = nstr(req.p.UserName);
  const obj1 = [];
  // (no try/catch in legacy: errors are unhandled => 500)
  const r = await db.queryOne(DB, "select clubdesc from settings where caption = 'ResellerKey' limit 1", {});
  const RellerID = r ? r.clubdesc : null;
  const OBjSendReceive = { UserName, RellerID };
  if (UserName !== '') { // (null UserName also posts, like legacy)
    const StrPostData = JSON.stringify(OBjSendReceive); // JavaScriptSerializer
    const resp = await axios.post(RESELLER_URL(), StrPostData, {
      headers: { 'Content-Type': 'application/json' },
      responseType: 'text',
      transformResponse: [(d) => d],
    });
    const Return = String(resp.data);
    const ObjProductDetails = JSON.parse(Return); // JObject.Parse
    if (ObjProductDetails === null || typeof ObjProductDetails !== 'object' || Array.isArray(ObjProductDetails)) {
      throw new Error('Error reading JObject from JsonReader.');
    }
    const Flag = jtStr(ObjProductDetails.Flag);
    if (Flag === 'success') {
      const DetailsTok = ObjProductDetails.Details;
      if (DetailsTok === undefined) throw nre();
      const Details = typeof DetailsTok === 'string' ? DetailsTok : jtStr(DetailsTok);
      if (Details !== '[]') {
        const obj = JSON.parse(Details); // JArray.Parse
        if (!Array.isArray(obj)) throw new Error('Error reading JArray from JsonReader.');
        const count = obj.length;
        for (let i = 0; i < count; i++) {
          const o = obj[i] || {};
          const userinfo = {
            ProductName: null, GST: null, Amount: null, OrderDate: '0001-01-01T00:00:00', Quantity: null, ResellerKey: null, ResellerID: null,
            OrderID: null, BV: null,
          };
          userinfo.ProductName = jtStr(o.Name);
          userinfo.Quantity = jtStr(o.Quantity);
          userinfo.BV = jtStr(o.BV);
          userinfo.Amount = jtStr(o.Amount);
          userinfo.GST = jtStr(o.GST);
          userinfo.OrderID = jtStr(o.OrderID);
          userinfo.ResellerID = jtStr(o.ResellerID);
          obj1.push(userinfo);
        }
      }
    }
  }
  return view(res, '~/Views/AdminPanel/ResellerProductDetails/Index.cshtml', obj1, {});
}));

module.exports = router;
