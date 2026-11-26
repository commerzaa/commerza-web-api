'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\EVouchers.cs (class EVouchersController => /portal/EVouchers/...)
// Database: shopping (Db_Shopping). Allvocher / AllvocherDenomination are property bags (ALLVOCHER_PROPS below is also used by EVouchersDetails).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, csInt32 } = require('./_shared/batch-09-common');

const router = express.Router();

const ALLVOCHER_PROPS = ['ROWNUMBER', 'VMID', 'VCTID', 'BRANDNAME', 'IMAGE', 'DESCRIPTION', 'TERMOFUSE', 'INSTRUCTION', 'ACTIVE', 'STATUS'];
const VCM_PROPS = ['VCMID', 'CATEGORYNAME', 'DATE', 'ACTIVE', 'STATUS'];

// ---------------------------------------------------------------- Index(string vcmid)
// route-config: "e-vouchers" -> EVouchers/Index
// public
router.all(['/portal/EVouchers/Index{/:id}', '/portal/EVouchers', '/portal/e-vouchers'], ps.portalSession, asyncHandler(async (req, res) => {
  let vcmid = req.p.vcmid === undefined ? null : req.p.vcmid;
  if (vcmid === null) vcmid = '0';
  else vcmid = await UtilityClass.Decryptword(vcmid);
  const ViewBag = {};
  const row = mapRows(await db.query(DB, 'SELECT vcmid, categoryname, date, active, status FROM tbl_voucher_category_master WHERE active = 1'), VCM_PROPS);
  if (row !== null) ViewBag.Category = row;
  const AllVOUCHERLIST = mapRows(await db.proc(DB, 'usp_allvochermaster', { vmid: csInt32('0'), vcmid: csInt32(vcmid) }), ALLVOCHER_PROPS);
  ViewBag.VCMID = vcmid;
  return res.json({ view: '~/Views/EVouchers/Index.cshtml', Model: AllVOUCHERLIST, ...ViewBag });
}));

router.ALLVOCHER_PROPS = ALLVOCHER_PROPS;
module.exports = router;
