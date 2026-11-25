'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/ChangePassword.cs (ChangePasswordController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };

// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all('/member/ChangePassword/Index{/:id}', auth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/ChangePassword/Index.cshtml' });
});

/** Shared body of UpdatePassword (Mode 1, PASSWORD column) and UpdateTransactionPassword (Mode 2, TPASSWORD column). */
async function updatePasswordCommon(req, res, passwordColumn, mode, withModeInText) {
  let resValue = '';
  let { OldPassword, NewPassword, ConfirmPassword } = req.p;
  OldPassword = await UtilityClass.Encryptword(OldPassword);
  NewPassword = await UtilityClass.Encryptword(NewPassword);
  ConfirmPassword = await UtilityClass.Encryptword(ConfirmPassword);
  if (OldPassword !== '' && NewPassword !== '' && ConfirmPassword !== '') {
    if (NewPassword !== ConfirmPassword) {
      resValue = "error^Passwords don't match.";
      return res.json(resValue);
    }
  } else {
    resValue = 'error^Enter the mandatory fields.';
    return res.json(resValue);
  }
  // (Session["Plid"] == null => "This page has been expired" is covered by the auth middleware)
  const Plid = Number(req.user.plid);
  try {
    const user = await db.queryOne(DB, 'select loginid from portal_login where plid = @plid limit 1', { plid: Plid });
    // user.LoginId on a null user => NullReferenceException (caught below)
    const loginId = user.loginid;
    const row = await db.queryOne(DB, `select plid from portal_login where loginid = @loginid and ${passwordColumn} = @pass limit 1`, { loginid: loginId, pass: OldPassword });
    if (row) {
      // PORT-NOTE: @INTRESULT OUT is returned as a column of the result row.
      const args = { plid: Plid, oldpass: OldPassword, newpass: NewPassword, confpass: ConfirmPassword };
      if (withModeInText) args.mode = mode; // Mode 1 call omitted @Mode from the SQL text (proc default is 1)
      const out = await db.procOne(DB, 'usp_contactpasswordchange', args);
      const v = col(out, 'intresult');
      resValue = v === null ? '' : String(v);
    } else {
      resValue = '2';
    }
  } catch (Exp) {
    try { await new DataUtility().ErrorInsert(0, Exp.message, 'USP_CONTACTPASSWORDCHANGE', 0, legacyPath(req)); } catch (e) { console.error(e); }
    resValue = 'error^Some Error Occured.Please Try Again';
  }
  return res.json(resValue);
}

// auth
router.all('/member/ChangePassword/UpdatePassword{/:id}', auth, asyncHandler((req, res) => updatePasswordCommon(req, res, 'password', '1', false)));

// auth
router.all('/member/ChangePassword/UpdateTransactionPassword{/:id}', auth, asyncHandler((req, res) => updatePasswordCommon(req, res, 'tpassword', '2', true)));

module.exports = router;
