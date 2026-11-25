'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Upgrade_package_member.cs (Upgrade_package_memberController)
 *  NOTE: static helper IsValidImage(byte[]) is not an MVC action (never routed); it is not used by any action in this controller.
 */
const express = require('express');
const { query, queryOne, scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Upgrade_package_member';
const UPGRADE_PROPS = ['AllPackageName', 'TotalPayableAmount', 'PuchaseDate', 'TASMID'];
const BEFORE_PROPS = ['AllPackageName', 'AllPackageAmount', 'PuchaseDate'];
const PKG_PROPS = ['KID', 'TITLE', 'PAMOUNT'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/fWkrH5a1KDqS_plus_Ak9T8r_slash_phRCYHkO7NJ6" -> Upgrade_package_member/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/fWkrH5a1KDqS_plus_Ak9T8r_slash_phRCYHkO7NJ6'], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, SearchField, SearchValue } = req.p;
  let page = toInt(req.p.page);
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  // LoginId = ((Login)Session["Plid"]).LoginID (assigned but never used in legacy)
  const PLID = Math.trunc(Number(req.user.plid));
  const ViewBag = { PLID };
  // @strResult is an OUTPUT parameter (not sent)
  const Obj = mapRows(await proc(DB, 'usp_package_upgrade', { regno: PLID, loginid: '' }), UPGRADE_PROPS);

  const BeforePackage = mapRows(await query(DB,
    'select AllPackageName, AllPackageAmount, PuchaseDate from Tbl_AllSubscriptionMaster_history where RegNo = @plid', { plid: PLID }), BEFORE_PROPS);
  if (BeforePackage != null) ViewBag.BeforePackage = BeforePackage;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  // Allpackage_requestList is loaded by the legacy code but never passed to the view (only @TotalCount was read)
  const reqRows = await proc(DB, 'usp_upgrade_package_list', {
    regno: 0, startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate, todate, status: '',
  });
  if (!reqRows.length || reqRows[0].totalcount === null || reqRows[0].totalcount === undefined) {
    // PORT-NOTE: legacy int.Parse(spOutput.Value) would only fail if the OUT value were NULL; with no rows the OUT value is unreadable here, treated as 0
  }
  res.json({ Model: Obj, ViewBag });
}));

// auth ([HttpPost])
router.post(`${P}/purchaseEpin{/:id}`, auth, asyncHandler(async (req, res) => {
  const getepinType = req.p.getepinType;
  const paymode = toInt(req.p.paymode);
  const tasmid = toInt(req.p.tasmid);
  const Regno = Math.trunc(Number(req.user.plid));
  const r = await queryOne(DB,
    'select coalesce(k.kid, 0) as kid from kit_master k left join member_master mm on mm.kid = k.kid where mm.regno = @regno limit 1', { regno: Regno });
  const oldkid = r ? Number(r.kid) : 0;
  const rows = await proc(DB, 'usp_upgrade_requests', {
    regno: Regno, oldkid, newkid: toInt(getepinType), paymode, tasmid,
  });
  // @Result is an OUTPUT parameter: read from the first result row
  const first = rows.length ? rows[0] : null;
  if (!first || first.result === null || first.result === undefined) throw new Error('Object reference not set to an instance of an object.');
  res.json(String(first.result));
}));

// auth (legacy had no session check; returns the package detail of a member's subscription)
router.all(`${P}/getpackagelist{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc(DB, 'usp_getpackagewisedetail', { tasmid: Number(req.p.urid) });
  res.json(mapRows(rows, PKG_PROPS));
}));

// public (no session check in legacy; kit price lookup)
router.all(`${P}/GetKitList{/:id}`, asyncHandler(async (req, res) => {
  const ID = toInt(req.p.ID);
  const v = await scalar(DB, 'select coalesce(amount, 0) from kit_master where kid = @id limit 1', { id: ID });
  res.json(v === null || v === undefined ? 0 : v);
}));

module.exports = router;
