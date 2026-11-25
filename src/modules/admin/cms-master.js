'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CMS_Master.cs (class CMS_MasterController => /CMS_Master/..., [ValidateInput(false)])
// Database: affiliate (Db_Affiliate) - only via the CMS_Master lib.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const CMS_Master = require('../../lib/admin/CMS_Master');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const C = 'CMS_Master';

// View-only actions (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"); the DataBaseContext was opened and unused)
const VIEWS = [
  // [action, view, route-config friendly url]
  ['aboutus', 'aboutus', 'AdminPanel/about-us'],
  ['contactus', 'Contactus', 'AdminPanel/contact-us'],
  ['disclaimer', 'disclaimer', 'AdminPanel/Disclaimer'],
  ['mission', 'mission', 'AdminPanel/Mission'],
  ['privacypolicy', 'privacypolicy', 'AdminPanel/Privacy-Policy'],
  ['termsCondition', 'termsCondition', 'AdminPanel/Terms-Conditions'],
];
for (const [action, view, friendly] of VIEWS) {
  // ---------------------------------------------------------------- ActionResult <action>()
  // auth
  // route-config: friendly -> CMS_Master/<action>
  router.all([`/admin/${C}/${action}{/:id}`, `/admin/${friendly}`], adminAuth, asyncHandler(async (req, res) => {
    res.json({ view: `~/Views/AdminPanel/CMS_Master/${view}.cshtml` });
  }));
}

// ---------------------------------------------------------------- JsonResult UpdateContactUs(string Name, string EmailID, string phone, string Address)
// auth (reads Session["Admin_User"].Emp_Code)
router.all(`/admin/${C}/UpdateContactUs{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const empcode = req.user.emp_code; // unused in legacy
  void empcode;
  let ReturnValue = 'ok';
  const cms = new CMS_Master();
  ReturnValue = await cms.UpdateCMS(B.sp(req, 'Name'), B.sp(req, 'EmailID'), B.sp(req, 'phone'), B.sp(req, 'Address'), '', 'contactus');
  return res.json(ReturnValue);
}));

// ---------------------------------------------------------------- JsonResult UpdateInfo(string value, string mode)
// auth (reads Session["Admin_User"].Emp_Code)
router.all(`/admin/${C}/UpdateInfo{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let value = B.sp(req, 'value');
  const mode = B.sp(req, 'mode');
  let ReturnValue = 'ok';
  const cms = new CMS_Master();
  if (value === null) throw B.NRE(); // value.Replace on null
  value = value.split('+#!#+').join('<');
  value = value.split('+!#!+').join('>');
  ReturnValue = await cms.UpdateCMS('', '', '', '', value, mode);
  return res.json(ReturnValue);
}));

module.exports = router;
