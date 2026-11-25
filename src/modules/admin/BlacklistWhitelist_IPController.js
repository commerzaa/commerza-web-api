'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BlacklistWhitelist_IPController.cs
// (class BlacklistWhitelist_IPController => /admin/BlacklistWhitelist_IP/...). Database: affiliate (Db_Affiliate).
// Model class IP_Lit (same file) => IP_LIT_PROPS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { outVal, str, sp, toInt32 } = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BlacklistWhitelist_IP';

const IP_LIT_PROPS = ['ROWNUMBER', 'TIPID', 'IP_ADDRESS', 'REMARK', 'CREATEDDATE', 'ACTIVE'];

/** [Dbo].[USP_BlacklistWhitelist_IP] @MODE,@TIPID,@IP_ADDRESS,@REMARK,@CREATEDDATE,@OUTRETURN OUT */
async function blacklistProc(MODE, TIPID, IP_ADDRESS, REMARK) {
  const CurrentDate = new Date(); // DateTime.Now
  const rows = await db.proc(DB, 'USP_BlacklistWhitelist_IP', { MODE, TIPID, IP_ADDRESS, REMARK, CREATEDDATE: CurrentDate });
  return { rows, responce: str(outVal(rows, 'OUTRETURN')) }; // OutRet.Value.ToString() (DBNull => "")
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (PORT-NOTE: legacy had no session check; it manages the admin IP black/white list => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  const { rows } = await blacklistProc(2, 0, '', '');
  const lst_Ip = mapRows(rows, IP_LIT_PROPS);
  res.json({ view: '~/Views/AdminPanel/BlacklistWhitelist_IP/Index.cshtml', Model: lst_Ip });
}));

// ---------------------------------------------------------------- JsonResult AddIP(string IPAddress, string IpRemark)
// auth (see Index)
router.all(`/admin/${C}/AddIP{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IPAddress = sp(req, 'IPAddress');
  const IpRemark = sp(req, 'IpRemark');
  if (IPAddress !== null) {
    // PORT-NOTE: a null IpRemark was an unsupplied SqlParameter in legacy (SqlException); NULL is passed here.
    const { responce } = await blacklistProc(1, 0, IPAddress, IpRemark);
    if (responce === 'success') return res.json('success');
    return res.json('Some Error Occurred Please Try Later');
  }
  return res.json('Please Enter IP Address !');
}));

// ---------------------------------------------------------------- JsonResult DeleteIPAddress(string ID)
// auth (see Index)
router.all(`/admin/${C}/DeleteIPAddress{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ID = sp(req, 'ID');
  if (ID !== null) {
    const ConvertedId = toInt32(ID); // Convert.ToInt32(ID) (FormatException => 500)
    const { responce } = await blacklistProc(3, ConvertedId, '', '');
    if (responce === 'success') return res.json('success');
    return res.json('Some Error Occurred Please Try Later');
  }
  return res.json('Some Error Occurred Please Try Later');
}));

module.exports = router;
