'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\APISettings.cs (APISettingsController) */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const ApiSetting = require('../../lib/franchise/ApiSetting');

const router = express.Router();
const P = '/franchise/APISettings';
const PROPS = ['API_ID', 'EMAILID', 'HOSTNAME', 'PORT', 'PASSWORD', 'TITLE', 'ISACTIVE', 'SenderID', 'SenderName', 'TEMID'];
const bool = (v) => v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'on' || v === '1';
// NOTE: legacy route config for APISettings (merchant/...) is commented out in RouteConfig.cs

// auth (null session => RedirectToAction("Index","Home"))
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const rows = await proc('shopping', 'DETAILS_MAIL_SETTING', { plid: Plid });
  res.json({ Model: mapRows(rows, PROPS), IsPopUpCheck: 1 });
}));

// public (no session check in legacy)
router.all(`${P}/ADDAPISETTING{/:id}`, asyncHandler(async (req, res) => {
  res.json({ RURL: req.p.rurl === undefined ? null : req.p.rurl });
}));

// auth
router.all(`${P}/SAVE{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let RESPONSE = '';
  const APISET = new ApiSetting();
  const Plid = Number(req.user.did);
  if (Plid > 0) {
    RESPONSE = await APISET.Create(p.TITLE, p.EMAIL, p.HOSTNAME, p.PORT, p.PASSWORD, bool(p.CHECK), Plid, p.SenderID, p.SenderName);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

// auth
router.all(`${P}/UPDATE{/:id}`, auth, asyncHandler(async (req, res) => {
  const temid = parseInt(req.p.temid, 10);
  const row = await queryOne('shopping', 'select * from TBL_EMAILMEMBERMASTER where TEMID=@t limit 1', { t: temid });
  res.json({ TEMID: temid, Rowvalue: mapRow(row, PROPS) });
}));

// auth
router.all(`${P}/MODIFY{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let RESPONSE = '';
  const APISET = new ApiSetting();
  const Plid = Number(req.user.did);
  if (Plid > 0) {
    RESPONSE = await APISET.Modify(parseInt(p.TEMID, 10), p.TITLE, p.EMAIL, p.HOSTNAME, p.PORT, p.PASSWORD, bool(p.CHECK), Plid, p.SenderID, p.SenderName);
    if (RESPONSE === 'Success') return res.json(RESPONSE);
  }
  res.json(RESPONSE);
}));

module.exports = router;
