'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\add_vendor.cs (class add_vendorController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin } = require('./_shared/adminSession');
const { DB, nstr, reqInt, toInt32, view, mapRows } = require('./_shared/batch02_common');

const router = express.Router();
const C = 'add_vendor';

/** class CategoryMasterDetails (Controllers/AdminPanel/CategoryMaster.cs) */
const CATEGORYMASTERDETAILS_PROPS = ['ROWNUMBER', 'PCMID', 'Status1', 'Status', 'Name', 'Category', 'Remark', 'Date', 'Added_by'];

// ---------------------------------------------------------------- Index(string VID)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Add-Vendor/{vendorid}" -> add_vendor/Index (vendorid is a route value only; the action reads VID)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Add-Vendor{/:vendorid}'], adminAuth, asyncHandler(async (req, res) => {
  let VID = nstr(req.p.VID);
  const ViewBag = {};
  if (VID === null) {
    VID = '';
    ViewBag.vendorid = '';
  } else {
    ViewBag.vendorid = await UtilityClass.Decryptword(VID);
    const CatID = mapRows(await db.proc(DB, 'USP_GetCategoryDetails', {
      fromDate: '', toDate: '', MAXROWS: 100, STARTROWINDEX: 1, Category: '', MODE: 2, VMID: toInt32(ViewBag.vendorid),
    }), CATEGORYMASTERDETAILS_PROPS);
    ViewBag.CatID = CatID;
  }
  const CategoryMasterDetails = mapRows(await db.proc(DB, 'USP_GetCategoryDetails', {
    fromDate: '', toDate: '', MAXROWS: 100, STARTROWINDEX: 1, Category: '',
  }), CATEGORYMASTERDETAILS_PROPS);
  ViewBag.CategoryMaster = CategoryMasterDetails;
  return view(res, '~/Views/AdminPanel/add_vendor/Index.cshtml', undefined, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult funAddUpdateVendor(string vendorid, string vendortype, string vendorname, string emailaddress, string mobile, string panno, string tinno, string address, int state, string password, string city, string pincode, string servicetax, string GST_No, string catid)
// auth-by-check (legacy: null session => NullReferenceException inside the try => "Something went wrong. Please try later")
router.all(`/admin/${C}/funAddUpdateVendor{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const state = reqInt(req.p.state, 'state');
  try {
    if (!isAdmin(req)) throw new Error('Object reference not set to an instance of an object.');
    const P = (k) => nstr(req.p[k]);
    const vendor_master = require('../../lib/admin/vendor_master');
    const vm = new vendor_master();
    const output = await vm.insertUpdateVendor(P('vendorid'), P('vendortype'), P('vendorname'), P('emailaddress'), P('mobile'), P('panno'), P('tinno'),
      P('address'), state, P('password'), P('city'), P('pincode'), P('servicetax'), P('GST_No'));
    const outsp = String(output).split('^');
    if (outsp.length < 2) throw new Error('Index was outside the bounds of the array.');
    if (outsp[1] !== '') {
      const catid = P('catid');
      if (catid === null) throw new Error('Object reference not set to an instance of an object.');
      const cat = catid.split('^');
      for (let i = 0; i < cat.length; i++) {
        await db.proc(DB, 'USP_INSERT_Vendor_Category', { vmid: toInt32(outsp[1]), PCMID: toInt32(cat[i]) });
      }
    }
    return res.json(outsp[0]);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

module.exports = router;
