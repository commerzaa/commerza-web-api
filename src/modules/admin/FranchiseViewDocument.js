'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FranchiseViewDocument.cs (class FranchiseViewDocumentController => /admin/FranchiseViewDocument/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');
const { firstCol } = require('./_shared/batch07C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FranchiseViewDocument';

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (set, never read).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string Package, string Mobile, int? page, int? ddlcustpage, string btnexel, string FRCode, string FRID, string URl)
// auth (legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/FranchiseViewDocument" -> FranchiseViewDocument/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FranchiseViewDocument'], adminAuth, asyncHandler(async (req, res) => {
  let FRID = B.nStr(req.p.FRID);
  let URl = B.nStr(req.p.URl);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (FRID !== '' && FRID !== null) {
    ViewBag.FRID = await UtilityClass.Decryptword(FRID);
    FRID = ViewBag.FRID;
  }
  if (URl !== '' && URl !== null) {
    ViewBag.URl = await UtilityClass.Decryptword(URl);
    URl = ViewBag.URl;
  }
  // [USP_GETAGREEMENTSYSTEM] @FRID  (SqlQuery<string>.FirstOrDefault())
  ViewBag.SystemAgreement = firstCol(await db.proc(DB, 'USP_GETAGREEMENTSYSTEM', { FRID: B.cvtInt(FRID) }));
  return res.json({ view: '~/Views/AdminPanel/FranchiseViewDocument/Index.cshtml', ...ViewBag });
}));

module.exports = router;
