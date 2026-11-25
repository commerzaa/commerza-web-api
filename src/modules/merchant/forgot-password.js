'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Forgot_Password.cs (Forgot_PasswordController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { queryOne, exec } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: Reset-Password/{loginid}/{RandomNumber}
// public
router.all(['/merchant/Forgot_Password/Index{/:id}', '/merchant/Reset-Password/:loginid{/:RandomNumber}'], asyncHandler(async (req, res) => {
  const { loginid, RandomNumber } = req.p;
  const ViewBag = {};
  ViewBag.LoginId = loginid + (RandomNumber === null || RandomNumber === undefined ? '' : '^' + RandomNumber);
  return res.json({ view: '~/Views/Forgot_Password/Index.cshtml', ViewBag });
}));

// ---- reset_password ------------------------------------------------------------------------------------
// public
router.all('/merchant/Forgot_Password/reset_password{/:id}', asyncHandler(async (req, res) => {
  let { loginid, password } = req.p;
  if (loginid === undefined || loginid === null) throw NRE();
  const Array_ = loginid.split('^');
  loginid = loginid.split('^').join('/');
  const Decryt = await UtilityClass.Decryptword(Array_[0]);
  let result = '';
  try {
    if (password === undefined || password === null) throw NRE();
    if (String(password).trim() === '') {
      // ViewBag.Message = "Please Enter Password.";
    } else {
      const row = await queryOne(DB, 'SELECT * FROM portal_login WHERE loginid = @loginid LIMIT 1', { loginid: Decryt });
      if (!row) throw NRE(); // row.PLID on null row
      const Row1 = await queryOne(DB,
        'SELECT * FROM tbl_password_change_history WHERE plid = @plid AND resetlink = @resetlink AND islinkexpired = 0 LIMIT 1',
        { plid: row.plid, resetlink: loginid });
      if (row && Row1) {
        await exec(DB, 'UPDATE portal_login SET password = @password WHERE plid = @plid', { password, plid: row.plid });
        result = 'success';
        await exec(DB, 'UPDATE tbl_password_change_history SET islinkexpired = 1 WHERE tpchid = @tpchid', { tpchid: Row1.tpchid });
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
