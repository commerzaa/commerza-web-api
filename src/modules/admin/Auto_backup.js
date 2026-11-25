'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Auto_backup.cs (class Auto_backupController => /Auto_backup/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { DB, col, str } = require('./_shared/batch03_common');

const router = express.Router();
const C = 'Auto_backup';

// PORT-NOTE: `public static DataUtility objdut` (unused) and `private static string url, url1` (module state).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/auto-backup" -> Auto_backup/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/auto-backup'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  return res.json({ view: '~/Views/AdminPanel/Auto_backup/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult Backup()
// auth (reads Session["Admin_User"].Emp_ID; legacy NullReference was caught => "Error occurred. Please try later Object reference...")
router.all(`/admin/${C}/Backup{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  try {
    const Eid = req.user.emp_id;
    // [USP_BACKUPAUTOPAYOUT] @EMPID,@STRRESULT OUT   (TransactionalBehavior.DoNotEnsureTransaction)
    const row = await db.procOne(DB, 'USP_BACKUPAUTOPAYOUT', { EMPID: Eid });
    const stringret = str(col(row, 'strresult'));
    return res.json(stringret);
  } catch (ex) {
    return res.json('Error occurred. Please try later ' + ex.message);
  }
}));

module.exports = router;
