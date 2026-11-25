'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\Forgot_Password.cs (class Forgot_PasswordController => /portal/Forgot_Password/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout] = no check. RouteConfig "Reset-Password/{loginid}/{RandomNumber}" is commented out in the portal.
// Differs from the Merchant fork: portal uses TBL_CUSTOMERLOGIN (Customer_Login) + Tbl_Password_Change_History_Member and has a phone branch.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, NRE, isNull } = require('./_shared/batch-09-common');

const router = express.Router();

// ---------------------------------------------------------------- Index(string loginid, string RandomNumber)
// public
router.all('/portal/Forgot_Password/Index{/:id}', ps.CheckResellerTimeout, (req, res) => {
  const loginid = isNull(req.p.loginid) ? null : req.p.loginid;
  const { RandomNumber } = req.p;
  const ViewBag = {};
  ViewBag.LoginId = (loginid === null ? '' : loginid) + (isNull(RandomNumber) ? '' : '^' + RandomNumber);
  return res.json({ view: '~/Views/Forgot_Password/Index.cshtml', ...ViewBag });
});

// ---------------------------------------------------------------- reset_password(string loginid, string password, string tpassword)
// public
router.all('/portal/Forgot_Password/reset_password{/:id}', ps.CheckResellerTimeout, asyncHandler(async (req, res) => {
  let loginid = isNull(req.p.loginid) ? null : String(req.p.loginid);
  const password = isNull(req.p.password) ? null : String(req.p.password);
  if (loginid === null) throw NRE(); // loginid.Split('^') outside the try (unhandled in legacy)
  const Arr = loginid.split('^');
  loginid = loginid.split('^').join('/');
  const Decryt = await UtilityClass.Decryptword(Arr[0]);
  let result = '';
  try {
    if (password === null) throw NRE();
    if (password.trim() === '') {
      // ViewBag.Message = "Please Enter Password."; (result stays "")
    } else if (Decryt !== '') {
      const row = await db.queryOne(DB, 'SELECT clid FROM tbl_customerlogin WHERE loginid = @loginid LIMIT 1', { loginid: Decryt });
      if (!row) throw NRE(); // row.CLID inside the second LINQ query on a null row
      const Row1 = await db.queryOne(DB,
        'SELECT tpchid FROM tbl_password_change_history_member WHERE plid = @plid AND resetlink = @resetlink AND islinkexpired = 0 LIMIT 1',
        { plid: row.clid, resetlink: loginid });
      if (row && Row1) {
        await db.exec(DB, 'UPDATE tbl_customerlogin SET password = @password WHERE clid = @clid', { password, clid: row.clid });
        result = 'success';
        await db.exec(DB, 'UPDATE tbl_password_change_history_member SET islinkexpired = 1 WHERE tpchid = @tpchid', { tpchid: Row1.tpchid });
      } else if (!Row1) {
        result = 'This link has been Expired.';
      } else {
        result = 'Link Is Invalid. Sorry...!!!';
      }
    } else {
      const row = await db.queryOne(DB, 'SELECT clid FROM tbl_customerlogin WHERE phone = @phone LIMIT 1', { phone: loginid });
      if (!row) throw NRE();
      // PORT-NOTE: legacy bug kept - this branch matches ANY non-expired reset link of the customer (no ResetLink check).
      const Row1 = await db.queryOne(DB,
        'SELECT tpchid FROM tbl_password_change_history_member WHERE plid = @plid AND islinkexpired = 0 LIMIT 1', { plid: row.clid });
      if (row && Row1) {
        await db.exec(DB, 'UPDATE tbl_customerlogin SET password = @password WHERE clid = @clid', { password, clid: row.clid });
        result = 'success';
        await db.exec(DB, 'UPDATE tbl_password_change_history_member SET islinkexpired = 1 WHERE tpchid = @tpchid', { tpchid: Row1.tpchid });
      } else if (!Row1) {
        result = 'This link has been Expired.';
      } else {
        result = 'Link Is Invalid. Sorry...!!!';
      }
    }
  } catch (ex) {
    result = 'Please Enter Password';
  }
  return res.json(result);
}));

module.exports = router;
