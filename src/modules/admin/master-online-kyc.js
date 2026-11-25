'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Master_OnlineKycController.cs (class Master_OnlineKycController => /Master_OnlineKyc/...)
// Database: affiliate (Db_Affiliate). Procs: USP_MASTER_ONLINEKYC, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const { DB, nInt, nStr, cvtInt, inlinePerms, excelLink, outStr, errorView } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Master_OnlineKyc';

/** class MasterOnlineKyc */
const PROPS = ['SRNO', 'MOKID', 'APIKEY', 'SECRETKEY', 'VERIFICATIONTYPE', 'STATUS', 'CREATEDDATE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? Mode, string btnExcel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Master-Online-kyc" -> Master_OnlineKyc/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Master-Online-kyc'], adminAuth, asyncHandler(async (req, res) => {
  const Mode = 1; // (the bound value is always overwritten)
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.IsActive = p.isactive; // (sic) casing differs from the other controllers
  ViewBag.IsEdit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  let btnExcel = nStr(req.p.btnExcel); if (btnExcel === null) btnExcel = '';
  try {
    // [DBO].[USP_MASTER_ONLINEKYC] @MODE,@MOKID,@APIKEY,@SECRETKEY,@VERIFICATIONTYPE,@STATUS,@OUTSTRRESULT OUT
    const Obj_MasterOnlineKyc = mapRows(await db.proc(DB, 'USP_MASTER_ONLINEKYC', {
      MODE: Mode, MOKID: 0, APIKEY: '', SECRETKEY: '', VERIFICATIONTYPE: '', STATUS: 0,
    }), PROPS);
    if (btnExcel === 'Export Excel') {
      // (empty in legacy)
    }
    return res.json({ view: '~/Views/AdminPanel/Master_OnlineKyc/Index.cshtml', Model: Obj_MasterOnlineKyc, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_MASTERKYC');
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateOnlineKyc(string Mode, int? MOID, string ApiKey, string ScretKey, string VarificationType, string status)
// auth (PORT-NOTE: legacy had no session check on this admin write of KYC API keys - protected)
router.all(`/admin/${C}/UpdateOnlineKyc{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mode = nStr(req.p.Mode);
  let MOID = nInt(req.p.MOID);
  let CovMode = 0;
  if (Mode !== null) CovMode = cvtInt(Mode);
  else return res.json('some error occurred');
  if (CovMode === 3) {
    if (MOID === null || MOID === 0) return res.json('some error occurred');
  } else {
    CovMode = 2;
    MOID = 0;
  }
  const row = await db.procOne(DB, 'USP_MASTER_ONLINEKYC', {
    MODE: CovMode, MOKID: MOID, APIKEY: nStr(req.p.ApiKey), SECRETKEY: nStr(req.p.ScretKey), VERIFICATIONTYPE: nStr(req.p.VarificationType),
    STATUS: cvtInt(nStr(req.p.status)),
  });
  const IntOutPutResult = outStr(row, 'outstrresult');
  if (IntOutPutResult === 'Success') return res.json(IntOutPutResult);
  return res.json('some error occurred');
}));

module.exports = router;
