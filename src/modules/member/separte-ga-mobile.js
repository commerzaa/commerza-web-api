'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\separte_ga_mobile.cs (separte_ga_mobileController) - 3 actions: Index, CheckCheckboxOnTheBehalfOfPermission, MEMBERAUTHENTICATION */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/separte_ga_mobile';
const bool = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';
// Convert.ToInt32(decimal): round half to even
function toInt32(d) {
  const n = Number(d);
  const f = Math.floor(n);
  const diff = n - f;
  if (diff < 0.5) return f;
  if (diff > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
const PERMITTED_PROPS = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME', 'SHOWACTIVE'];

async function memberAuthentication(plid) {
  // legacy: SELECT ISSMS,ISEMAIL FROM TBL_MEMBERAUTHENTICATION WITH(ROWLOCK) WHERE REGNO=@plid AND STATUS=1
  const r = await queryOne(DB, 'select issms, isemail from tbl_memberauthentication where regno = @plid and status = 1 limit 1', { plid });
  return r ? { ISSMS: r.issms, ISEMAIL: r.isemail } : null;
}

// route-config: referral/separte_ga_mobile
// auth (uses ((Login)Session["Plid"]).Plid)
router.all([`${P}/Index{/:id}`, '/member/referral/separte_ga_mobile{/:id}'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const row = await queryOne(DB, "select active from settings where caption = 'Password Camplacity' limit 1");
  if (row != null) ViewBag.active = bool(row.active);
  const rows = await queryOne(DB, "select active, limits from settings where caption = 'Transaction Pin' limit 1");
  if (rows != null) {
    ViewBag.Transpin = bool(rows.active);
    ViewBag.Limit = toInt32(rows.limits);
  }
  const MEMBERAUTHENTICATION = await memberAuthentication(Number(req.user.plid));
  if (MEMBERAUTHENTICATION != null) ViewBag.MEMBERAUTHENTICATION = MEMBERAUTHENTICATION;
  res.json(ViewBag);
}));

// public (no session access)
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getdataforregistration', { mode: 1 });
  res.json(mapRows(rows, PERMITTED_PROPS));
}));

// auth (uses Session["Plid"])
router.all(`${P}/MEMBERAUTHENTICATION{/:id}`, auth, asyncHandler(async (req, res) => {
  await memberAuthentication(Number(req.user.plid)); // result only went to ViewBag in legacy
  res.json('');
}));

module.exports = router;
