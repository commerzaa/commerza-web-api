'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SMS_Schedule_List.cs (class SMS_Schedule_ListController, no namespace => /admin/SMS_Schedule_List/...)
// Database: affiliate (Db_Affiliate) - no database access in this controller.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { jsonOrEmpty } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'SMS_Schedule_List';

// private string result;  (instance field, never assigned => always null)
const result = null;

// ---------------------------------------------------------------- ActionResult Index()
// auth (PORT-NOTE: legacy had no session check; admin panel view => adminAuth)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/SMS_Schedule_List/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult SMSTemplate(string FromDate, string Todate)
// auth (PORT-NOTE: legacy had no session check; admin panel => adminAuth)
// Json(null) => MVC JsonResult writes an empty body.
router.all(`/admin/${C}/SMSTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  jsonOrEmpty(res, result);
}));

module.exports = router;
