'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Excel_PermissionController.cs (class Excel_PermissionController => /admin/Excel_Permission/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const ExcelPermission = require('../../lib/admin/ExcelPermission');
const { isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Excel_Permission';

// ---------------------------------------------------------------- Index()
// public (legacy had no session check; read-only list of tbl_excelpermission - see security notes)
// route-config: "AdminPanel/Excel-Permission" -> Excel_Permission/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Excel-Permission'], asyncHandler(async (req, res) => {
  const ep = new ExcelPermission();
  res.json({ view: '~/Views/AdminPanel/Excel_Permission/Index.cshtml', Model: await ep.AllList() });
}));

// ---------------------------------------------------------------- JsonResult Show_Hide(int id, int value)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Show_Hide{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = B.reqInt(req.p.id, 'id');
  const value = B.reqInt(req.p.value, 'value');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  // (id == null / value == null checks on non-nullable ints are always false)
  try {
    const row = await db.procOne(DB, 'USP_EXCEL_PERMISSION', { ID: id, VALUE: value });
    const stringret = B.outStr(row, 'intresult');
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_EXCEL_PERMISSION');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
