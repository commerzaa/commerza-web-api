'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Employee_Profile.cs (class Employee_ProfileController, no namespace => /Employee_Profile/...)
// Database: affiliate (Db_Affiliate). Table tbl_employee_master; proc usp_admin_changepassword (via DataUtility.ExecuteSqlSP).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const Base32Encoder = require('../../lib/admin/Base32Encoder');
const { adminAuth, errorInsert, ADMIN_USER_PROPS, publicAdminUser } = require('./_shared/adminSession');
const { nStr } = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Employee_Profile';

/** public TwoFactorSecret SecretKey(string secret) => new TwoFactorSecret { EncodedSecret = Base32(ASCII bytes) } */
function SecretKey(secret) {
  const enc = new Base32Encoder().Encode(Buffer.from(String(secret === null || secret === undefined ? '' : secret), 'ascii'));
  return { EncodedSecret: enc };
}

/** private static bool ThumbnailCallback() - throws NotImplementedException (unused; not an action). */
function ThumbnailCallback() { // eslint-disable-line no-unused-vars
  throw new Error('The method or operation is not implemented.');
}

/** optional string parameter with default "" (absent => ""; present-but-empty => null like MVC ConvertEmptyStringToNull) */
const optStr = (v) => (v === undefined ? '' : nStr(v));

// ---------------------------------------------------------------- public TwoFactorSecret SecretKey(string secret)
// auth (PORT-NOTE: public method => routable in legacy; admin 2FA helper => adminAuth)
// PORT-NOTE: a public non-ActionResult method is an MVC action whose result is ContentResult(value.ToString()) => the type name "TwoFactorSecret".
router.all(`/admin/${C}/SecretKey{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const secret = nStr(req.p.secret);
  if (secret === null) throw new Error("Value cannot be null.\r\nParameter name: s"); // Encoding.ASCII.GetBytes(null)
  SecretKey(secret);
  res.type('text/html').send('TwoFactorSecret');
}));

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Employee-Profile" -> Employee_Profile/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Employee-Profile'], adminAuth, asyncHandler(async (req, res) => {
  // db._Employee_Master.Where(a => a.Emp_Code == EM.Emp_Code).FirstOrDefault()
  const r = await db.queryOne(DB, 'select * from tbl_employee_master where emp_code = @code limit 1', { code: req.user.emp_code });
  const row = r ? mapRow(r, ADMIN_USER_PROPS) : null;
  // PORT-NOTE / security: Emp_Password (reversibly encrypted) is removed from the JSON model.
  res.json({ view: '~/Views/AdminPanel/Employee_Profile/Index.cshtml', Model: publicAdminUser(row) });
}));

// ---------------------------------------------------------------- JsonResult Changepassword(string oldpassword, string newPassword)
// auth (PORT-NOTE: legacy had no session check; dereferenced Session["Admin_User"] inside its try => adminAuth)
router.all(`/admin/${C}/Changepassword{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let oldpassword = nStr(req.p.oldpassword);
  let newPassword = nStr(req.p.newPassword);
  try {
    const Emp_Code = req.user.emp_code;
    await db.queryOne(DB, 'select emp_id from tbl_employee_master where emp_code = @Emp_Code limit 1', { Emp_Code }); // `row` (unused)
    oldpassword = await UtilityClass.Encryptword(oldpassword);
    newPassword = await UtilityClass.Encryptword(newPassword);
    const ObjDUT = new DataUtility();
    const Param = [
      { ParameterName: '@Emp_Code', Value: Emp_Code },
      { ParameterName: '@Oldpassword', Value: oldpassword },
      { ParameterName: '@newpassword', Value: newPassword },
      { ParameterName: '@INTRESULT', Direction: 'Output' },
    ];
    const Reply = await ObjDUT.ExecuteSqlSP(Param, '[usp_admin_changepassword]');
    const Result = String(Reply); // Param[3].Value.ToString()
    if (Result === '1') return res.json('1');
    if (Result === '2') return res.json('2');
    return res.json('0');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'usp_admin_changepassword');
    return res.json('error^Some error occured');
  }
}));

// ---------------------------------------------------------------- JsonResult VerifyGoogleAuthentication(string GAKey = "", string Password = "", string FACode = "")
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
router.all(`/admin/${C}/VerifyGoogleAuthentication{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GAKey = optStr(req.p.GAKey);
  let Password = optStr(req.p.Password);
  const FACode = optStr(req.p.FACode);
  try {
    let RetOutPutResult = '';
    let validUser = 0;
    const EmpId = req.user.emp_id;
    validUser = await UtilityClass.checkUserDetailsByPLID(Number(EmpId), await UtilityClass.Encryptword(Password));
    if (validUser > 0 && EmpId > 0) {
      const sGAKey = sessionStore.get(req, 'GAKey');
      const s2FA = sessionStore.get(req, '2FACode');
      if (sGAKey !== undefined && sGAKey !== null && s2FA !== undefined && s2FA !== null) {
        if (GAKey !== '' && Password !== '' && FACode !== '') {
          if (GAKey === String(sGAKey)) {
            const objs = new Admin_Security_Key();
            Password = await UtilityClass.Encryptword(Password);
            if (!(await objs.Check_GaKeyForEnableTime(Number(EmpId), String(s2FA), FACode))) {
              RetOutPutResult = 'Please enter valid 2FA code!';
              return res.json(RetOutPutResult);
            }
            const RandomNo = String(s2FA);
            await objs.Manage_Security_Key(Number(EmpId), 'add', '', 2, GAKey, FACode, RandomNo);
            RetOutPutResult = 'SUCCESS';
            return res.json(RetOutPutResult);
          }
          RetOutPutResult = 'Invalid GA key!';
          return res.json(RetOutPutResult);
        }
        RetOutPutResult = 'Invalid Details!';
        return res.json(RetOutPutResult);
      }
      RetOutPutResult = 'Session Expired!';
      return res.json(RetOutPutResult);
    }
    RetOutPutResult = 'Invalid Password';
    return res.json(RetOutPutResult);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'VerifyGoogleAuthentication');
    return res.json('Invalid Details!');
  }
}));

// ---------------------------------------------------------------- JsonResult DisableGoogleAuthentication(string Password = "", string FACode = "")
// auth (PORT-NOTE: legacy dereferenced Session["Admin_User"] inside its try => adminAuth)
router.all(`/admin/${C}/DisableGoogleAuthentication{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Password = optStr(req.p.Password);
  const FACode = optStr(req.p.FACode);
  try {
    let RetOutPutResult = '';
    let validUser = 0;
    const EmpId = req.user.emp_id;
    const Obj = new Admin_Security_Key();
    validUser = await UtilityClass.checkUserDetailsByPLID(Number(EmpId), await UtilityClass.Encryptword(Password));
    if (validUser > 0 && EmpId > 0) {
      const ValidRandomNo = await Obj.Get_GA_Key(EmpId);
      if (!(await Obj.Check_GaKeyForEnableTime(EmpId, ValidRandomNo, FACode))) {
        if (FACode !== '') {
          RetOutPutResult = 'Enter a valid GA Key Below!';
          return res.json(RetOutPutResult);
        }
      } else {
        await Obj.Manage_Security_Key(Number(EmpId), 'reset', '', 0, '', '', '');
        RetOutPutResult = 'SUCCESS';
      }
    } else {
      RetOutPutResult = 'Invalid Password';
      return res.json(RetOutPutResult);
    }
    return res.json(RetOutPutResult);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DisableGoogleAuthentication');
    return res.json('Invalid Details!');
  }
}));

module.exports = router;
