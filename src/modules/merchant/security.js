'use strict';
/**
 * Port of Merchant Panel/Controllers/CustomerPanel/Security.cs (SecurityController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { queryOne, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';

/** value of an OUT parameter returned as a column of the single result row */
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all(['/merchant/Security/Index{/:id}', '/merchant/Security'], auth, asyncHandler(async (req, res) => { // route-config: merchant/Security
  return res.json({ view: '~/Views/Security/Index.cshtml' });
}));

// ---- UpdatePassword ------------------------------------------------------------------------------------
// auth (legacy: Session["Plid"] == null => "This page has been expired")
router.all('/merchant/Security/UpdatePassword{/:id}', auth, asyncHandler(async (req, res) => {
  const { OldPassword, NewPassword, ConfirmPassword } = req.p;
  let resValue = '';
  const Plid = Number(req.user.plid);
  try {
    const user = await queryOne(DB, 'SELECT loginid FROM portal_login WHERE plid = @plid LIMIT 1', { plid: Plid });
    if (!user) throw new TypeError('Object reference not set to an instance of an object.');
    const row = await queryOne(DB, 'SELECT * FROM portal_login WHERE loginid = @loginid AND password = @password LIMIT 1', {
      loginid: user.loginid, password: OldPassword,
    });
    if (row) {
      // @INTRESULT is an OUT parameter => column of the single result row
      const r = await procOne(DB, 'usp_contactpasswordchangemerchent', {
        plid: Plid, oldpass: OldPassword, newpass: NewPassword, confpass: ConfirmPassword,
      });
      const v = outVal(r, 'intresult');
      if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      resValue = String(v);
    } else {
      resValue = '2';
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message;
    resValue = 'error^Some Error Occured.Please Try Again';
  }
  return res.json(resValue);
}));

module.exports = router;
