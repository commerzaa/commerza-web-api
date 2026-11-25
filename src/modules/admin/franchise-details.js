'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FranchiseDetails.cs (class FranchiseDetailsController => /admin/FranchiseDetails/...)
// Database: affiliate (Db_Affiliate). Model ViewUserDetails (Approved_FranchiseController.cs).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');
const { firstCol } = require('./_shared/batch07-c-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FranchiseDetails';

/** class ViewUserDetails */
const VUD_PROPS = ['NAME', 'PACKAGENAME', 'COUNTRY', 'STATE', 'CITY', 'ADDRESS', 'JOINDATE', 'PINCODE', 'Taluk', 'District', 'Circle',
  'Region', 'ApprovalDate', 'FRCode', 'Emailid', 'Mobile', 'StoreType', 'GST', 'TinNo', 'PASSWORD', 'USERNAME', 'SystemAgreement',
  'MemberAgreement'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (set, never read in this controller).
let url = '';
let url1 = '';

/** [USP_GetUserDetailsByFRID] @FRID  (.FirstOrDefault()) */
async function getUserDetails(FRID) {
  const rows = mapRows(await db.proc(DB, 'USP_GetUserDetailsByFRID', { FRID: B.cvtInt(FRID) }), VUD_PROPS);
  return rows.length ? rows[0] : null;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string UserName, string Package, string Mobile, int? page, int? ddlcustpage, string btnexel, string FRCode, string FRID, string FIMID)
// auth (legacy had no session check; admin data (incl. decrypted franchise password) => adminAuth)
// route-config: "AdminPanel/Franchise-Details" -> FranchiseDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Franchise-Details'], adminAuth, asyncHandler(async (req, res) => {
  // (dynamicpagging, orderbydate, UserName, Package, Mobile, page, ddlcustpage, btnexel, FRCode are bound but unused in legacy)
  let FRID = B.nStr(req.p.FRID);
  const FIMID = B.nStr(req.p.FIMID);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (FRID !== '' && FRID !== null) {
    ViewBag.FRID = await UtilityClass.Decryptword(FRID);
    FRID = ViewBag.FRID;
  }
  if (FIMID !== '' && FIMID !== null) {
    ViewBag.FIMID = await UtilityClass.Decryptword(FIMID);
  }
  // [USP_ALLPINCODE] @FRID  (SqlQuery<string>.FirstOrDefault())
  ViewBag.AllPincode = firstCol(await db.proc(DB, 'USP_ALLPINCODE', { FRID: B.cvtInt(FRID) }));
  const ObjDetails = await getUserDetails(FRID);
  if (!ObjDetails) throw B.nullRef(); // ObjDetails.SystemAgreement on null => NullReferenceException (500)
  ViewBag.SystemAgreement = ObjDetails.SystemAgreement;
  ViewBag.MemberAgreement = ObjDetails.MemberAgreement;
  ViewBag.FRCode = ObjDetails.FRCode;
  const pass = await UtilityClass.Decryptword(ObjDetails.PASSWORD);
  ObjDetails.PASSWORD = pass;
  return res.json({ view: '~/Views/AdminPanel/FranchiseDetails/Index.cshtml', Model: ObjDetails, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult GetUserDetails(string FRID)
// auth (legacy had no session check; returns the decrypted franchise password => adminAuth)
router.all(`/admin/${C}/GetUserDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ObjDetails = await getUserDetails(B.nStr(req.p.FRID));
  if (!ObjDetails) throw B.nullRef(); // ObjDetails.PASSWORD on null => NullReferenceException (500)
  const pass = await UtilityClass.Decryptword(ObjDetails.PASSWORD);
  ObjDetails.PASSWORD = pass;
  return res.json(ObjDetails);
}));

// ---------------------------------------------------------------- JsonResult Mailsend(string FRID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Mailsend{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  try {
    const ObjDetails = await getUserDetails(B.nStr(req.p.FRID));
    if (!ObjDetails) throw B.nullRef(); // swallowed below like legacy
    if (ObjDetails.SystemAgreement !== '' && ObjDetails.SystemAgreement !== null) {
      if (ObjDetails.Emailid !== '' && ObjDetails.Emailid !== null) {
        // (the agreement e-mail thread is commented out in legacy => nothing is sent)
      } else {
        return res.json('Member EmailID Not update.');
      }
    }
  } catch (ex) {
    // swallowed (legacy empty catch)
  }
  return res.json('');
}));

module.exports = router;
