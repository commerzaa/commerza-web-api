'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\Sms_ApiSetting.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const router = express.Router();
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const SmsApiSetting = require('../../lib/merchant/SmsApiSetting');

const DB = 'shopping';
const BASE = '/merchant/Sms_ApiSetting';

// auth
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/Sms_ApiSetting/Index.cshtml', ViewBag: { IsPopUpCheck: 1 } });
}));

// auth
router.all(`${BASE}/GetSmsApi{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'sms_api_setting_details', { plid: Plid });
  res.json(mapRows(rows, ['API_ID', 'SMS_API', 'API_TYPE', 'STATUS']));
}));

// auth
router.all(`${BASE}/sendsmsonmobile{/:id}`, auth, asyncHandler(async (req, res) => {
  let result = 0;
  const Plid = Math.trunc(Number(req.user.plid));
  if (req.p.type === '1') {
    result = await SmsApiSetting.SMSSend(req.p.api, '', 'Api Check', Plid, 0);
  } else {
    result = await SmsApiSetting.SMSSend(req.p.api, '', 'Api Check', Plid, 1);
  }
  res.json(result);
}));

// auth
router.all(`${BASE}/Save{/:id}`, auth, asyncHandler(async (req, res) => {
  const toBool = (v) => String(v).toLowerCase() === 'true';
  let actives = '0', proactives = '0';
  const smsapi = String(req.p.smsapi == null ? '' : req.p.smsapi);
  const prosmsapi = String(req.p.prosmsapi == null ? '' : req.p.prosmsapi);
  let smsapis = smsapi.split('1111111111').join('~');
  smsapis = smsapis.split('Dummy Text').join('~');
  let prosmsapis = prosmsapi.split('1111111111').join('~');
  prosmsapis = prosmsapis.split('Dummy Text').join('~');
  if (toBool(req.p.active) === true) actives = '1';
  if (toBool(req.p.proactive) === true) proactives = '1';
  const obj = new SmsApiSetting();
  const Plid = Math.trunc(Number(req.user.plid));
  const result = await obj.updatesmsapi(smsapis, actives, prosmsapis, proactives, Plid);
  res.json(result);
}));

module.exports = router;
