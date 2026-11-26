'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Sms_ApiSetting.cs (Sms_ApiSettingController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const SmsApiSetting = require('../../lib/portal/SmsApiSetting');
const ps = require('./_shared/portal-session');
const { csBool, csReplace } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const BASE = '/portal/Sms_ApiSetting';

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/smsapi-settings -> Sms_ApiSetting/Index
router.all([`${BASE}/Index{/:id}`, BASE, '/portal/merchant/smsapi-settings'], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/Sms_ApiSetting/Index.cshtml', IsPopUpCheck: 1 });
});

// auth (unguarded session cast)
router.all(`${BASE}/GetSmsApi{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'sms_api_setting_details', { plid: Plid });
  res.json(mapRows(rows, ['API_ID', 'SMS_API', 'API_TYPE', 'STATUS']));
}));

// auth
router.all(`${BASE}/sendsmsonmobile{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let result = 0;
  const Plid = Math.round(Number(req.user.plid));
  if (req.p.type === '1') {
    result = await SmsApiSetting.SMSSend(req.p.api, '', 'Api Check', Plid, 0);
  } else {
    result = await SmsApiSetting.SMSSend(req.p.api, '', 'Api Check', Plid, 1);
  }
  res.json(result);
}));

// auth
router.all(`${BASE}/Save{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const { smsapi, prosmsapi } = req.p;
  if (req.p.active === undefined || req.p.proactive === undefined) {
    throw new Error("The parameters dictionary contains a null entry for parameter of non-nullable type 'System.Boolean'.");
  }
  let actives = '0'; let proactives = '0';
  // legacy: null smsapi / prosmsapi -> NullReferenceException
  let smsapis = csReplace(smsapi.toString(), '1111111111', '~');
  smsapis = csReplace(smsapis, 'Dummy Text', '~');
  let prosmsapis = csReplace(prosmsapi.toString(), '1111111111', '~');
  prosmsapis = csReplace(prosmsapis, 'Dummy Text', '~');
  if (csBool(req.p.active) === true) actives = '1';
  if (csBool(req.p.proactive) === true) proactives = '1';
  const obj = new SmsApiSetting();
  const Plid = Math.round(Number(req.user.plid));
  const result = await obj.updatesmsapi(smsapis, actives, prosmsapis, proactives, Plid);
  res.json(result);
}));

module.exports = router;
