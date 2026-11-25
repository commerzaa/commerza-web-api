'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/APISettings.cs (APISettingsController, 5 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ApiSetting = require('../../lib/portal/ApiSetting');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcInt, mvcBool } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'APISettings';
const EXPIRED = 'error^This page has been expired, Please login again';

/** class APISETTING */
const APISETTING_PROPS = ['API_ID', 'EMAILID', 'HOSTNAME', 'PORT', 'PASSWORD', 'TITLE', 'ISACTIVE', 'SenderID', 'SenderName', 'TEMID'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/api-settings -> APISettings/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/api-settings'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = req.user.plid;
  const rows = await db.proc(DB, 'details_mail_setting', { plid: Plid });
  return res.json({ view: '~/Views/CustomerPanel/APISettings/Index.cshtml', Model: mapRows(rows, APISETTING_PROPS), IsPopUpCheck: 1 });
}));

// ---------------------------------------------------------------- ADDAPISETTING(string rurl)
// public (legacy had no session check; returns the empty Add form)
// route-config: "merchant/api-settings/ADDAPISETTING/{rurl}" points at action "ADDAPISETTING+" which does not exist (legacy 404) - not registered
router.all(`/portal/${C}/ADDAPISETTING{/:id}`, ps.portalSession, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/APISettings/Add_Apisetting.cshtml', RURL: mvcStr(req, 'rurl') });
});

// ---------------------------------------------------------------- JsonResult SAVE(TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, bool CHECK, SenderID, SenderName)
// auth (Session["Plid"] == null => Json("error^This page has been expired, Please login again"))
router.all(`/portal/${C}/SAVE{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const APISET = new ApiSetting();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await APISET.Create(mvcStr(req, 'TITLE'), mvcStr(req, 'EMAIL'), mvcStr(req, 'HOSTNAME'), mvcStr(req, 'PORT'), mvcStr(req, 'PASSWORD'),
      CHECK, Plid, mvcStr(req, 'SenderID'), mvcStr(req, 'SenderName'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- UPDATE(int temid)
// auth (Session["Plid"] == null => Json("error^This page has been expired, Please login again"))
// route-config: merchant/api-settings/{temid} -> APISettings/UPDATE
const updateHandler = asyncHandler(async (req, res, next) => {
  // "merchant/api-settings/ADDAPISETTING[/...]" matched the earlier (dead) ADDAPISETTING+ route in legacy => 404
  if (req.params.temid !== undefined && /^ADDAPISETTING$/i.test(req.params.temid)) return next();
  const temid = mvcInt(req, 'temid');
  const row = await db.queryOne(DB, 'select * from tbl_emailmembermaster where temid = @temid limit 1', { temid });
  return res.json({ view: '~/Views/CustomerPanel/APISettings/Add_Apisetting.cshtml', TEMID: temid, Rowvalue: mapRow(row, APISETTING_PROPS) });
});
router.all(`/portal/${C}/UPDATE{/:id}`, ...ps.customerOr(EXPIRED), updateHandler);
router.all('/portal/merchant/api-settings/:temid', ...ps.customerOr(EXPIRED), updateHandler);

// ---------------------------------------------------------------- JsonResult MODIFY(int TEMID, TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, bool CHECK, SenderID, SenderName)
// auth (Session["Plid"] == null => Json("error^This page has been expired, Please login again"))
router.all(`/portal/${C}/MODIFY{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const TEMID = mvcInt(req, 'TEMID');
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const APISET = new ApiSetting();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await APISET.Modify(TEMID, mvcStr(req, 'TITLE'), mvcStr(req, 'EMAIL'), mvcStr(req, 'HOSTNAME'), mvcStr(req, 'PORT'),
      mvcStr(req, 'PASSWORD'), CHECK, Plid, mvcStr(req, 'SenderID'), mvcStr(req, 'SenderName'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

module.exports = router;
