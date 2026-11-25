'use strict';
// Ported from Member\Controllers\Forgot_Password.cs (Forgot_PasswordController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const P = '/member/Forgot_Password';
const DB = 'affiliate';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const PERMIT = ['FID', 'Status', 'VALIDATIONACTIVE', 'ACTIVE', 'FIELDNAME'];

// CheckTransactionIDActiveORNot: Usp_CheckTransactionActiveORNot @LoginID => ViewBag.TranActive
async function CheckTransactionIDActiveORNot(Loginid) {
  const rows = await db.proc(DB, 'usp_checktransactionactiveornot', { LoginID: Loginid });
  let v = rows && rows.length ? rows[0][Object.keys(rows[0])[0]] : null;
  if (v === null || v === undefined) v = false; // bool FirstOrDefault
  return v === true || v === 1 || v === '1' || v === 'true';
}

// route-config: Reset-Password/{loginid}/{RandomNumber}
// public
router.all([`${P}/Index{/:id}`, '/member/Reset-Password/:loginid{/:RandomNumber}'], asyncHandler(async (req, res) => {
  const { loginid, RandomNumber } = req.p;
  const ViewBag = {};
  ViewBag.LoginId = loginid + (RandomNumber === undefined || RandomNumber === null ? '' : '^' + RandomNumber);
  const login_id = await UtilityClass.Decryptword(loginid);
  ViewBag.TranActive = await CheckTransactionIDActiveORNot(login_id);
  res.json({ ViewBag });
}));

// public
router.all(`${P}/reset_password{/:id}`, asyncHandler(async (req, res) => {
  let { loginid, password, tpassword } = req.p;
  let result = '';
  // legacy: these statements are outside the try block (a failure here is an unhandled error)
  const Array_ = String(loginid).split('^');
  password = await UtilityClass.Encryptword(password);
  tpassword = await UtilityClass.Encryptword(tpassword);
  loginid = loginid.split('^').join('/');
  const Decryt = await UtilityClass.Decryptword(Array_[0]);
  try {
    if (String(password).trim() === '') {
      result = 'Please Enter Login Password.';
    }
    if (tpassword !== password) {
      result = 'Login passwords & confirm login password do not matched .';
    } else {
      const row = await db.queryOne(DB, 'select * from member_master where loginid = @l limit 1', { l: Decryt });
      if (!row) throw NRE(); // row.REGNO on a null row
      const Row1 = await db.queryOne(DB, 'select * from tbl_password_change_history where plid = @p and resetlink = @r and islinkexpired = 0 limit 1', { p: row.regno, r: loginid });
      const orows = await db.proc(DB, 'usp_getpassworddetails', { MODE: 1, REGNO: row.regno });
      const OldPassword = orows && orows.length ? orows[0][Object.keys(orows[0])[0]] : null;
      if (row !== null && Row1 !== null) {
        await db.proc(DB, 'usp_contactpasswordchange', { PLID: row.regno, OLDPASS: OldPassword, NEWPASS: password, CONFPASS: password, Mode: '1' });
        result = 'success'; // Db.SaveChanges() has nothing pending
        await db.exec(DB, 'Update tbl_password_change_history set islinkexpired = 1 Where tpchid = @t', { t: Row1.tpchid });
      } else if (Row1 === null) {
        result = 'This link has been Expired.';
      } else {
        result = 'Link Is Invalid. Sorry...!!!';
      }
    }
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'reset_password', 0, req.path); } catch (_) { /* ignore */ }
    result = 'Some error occured.';
  }
  res.json(result);
}));

// public
router.all(`${P}/CheckCheckboxOnTheBehalfOfPermission{/:id}`, asyncHandler(async (req, res) => {
  const rows = await db.proc(DB, 'usp_getdataforregistration', { MODE: 1 });
  res.json(mapRows(rows, PERMIT));
}));

// public (public void action in legacy: runs the lookup, returns an empty result)
router.all(`${P}/CheckTransactionIDActiveORNot{/:id}`, asyncHandler(async (req, res) => {
  await CheckTransactionIDActiveORNot(req.p.Loginid);
  res.status(200).end();
}));

module.exports = router;
