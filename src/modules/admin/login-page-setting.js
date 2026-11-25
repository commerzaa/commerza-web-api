'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\LoginPageSetting.cs (class LoginPageSettingController => /LoginPageSetting/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const { isAdmin, errorInsert } = require('./_shared/admin-session');

const router = express.Router();
const DB = 'affiliate';
const C = 'LoginPageSetting';

// ---------------------------------------------------------------- Index()
// public (legacy had no session check; read-only LOGINSTATUS flag)
// route-config: "AdminPanel/Login-Page-Setting" -> LoginPageSetting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Login-Page-Setting'], asyncHandler(async (req, res) => {
  // SELECT CONVERT(INT,LIMITS) AS LIMITS FROM SETTINGS WITH(NOLOCK) WHERE CAPTION='LOGINSTATUS'
  const row = await db.queryOne(DB, "select (limits)::int as limits from settings where caption = 'LOGINSTATUS' limit 1", {});
  const rm = row ? mapRow(row, ['LIMITS']) : null;
  res.json({ view: '~/Views/AdminPanel/LoginPageSetting/Index.cshtml', Model: rm });
}));

// ---------------------------------------------------------------- JsonResult Show_Hide(int value)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Show_Hide{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const raw = req.p.value;
  const value = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (!Number.isInteger(value)) {
    return res.status(500).json({ message: "The parameters dictionary contains a null entry for parameter 'value' of non-nullable type 'System.Int32'" });
  }
  if (!isAdmin(req)) {
    return res.json('Session Expired. Please login again');
  }
  try {
    // UPDATE SETTINGS SET LIMITS=<value> WHERE CAPTION='LOGINSTATUS'  (parameterised)
    await db.exec(DB, "update settings set limits = @value where caption = 'LOGINSTATUS'", { value });
    return res.json('Success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Show_Hide');
    return res.json('Error occurred. Please try later');
  }
}));

module.exports = router;
