'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Franchaise_Change_Password.cs
// (class FrachiseChange_PasswordController => /admin/FrachiseChange_Password/...). Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');
const { nn } = require('./_shared/batch07-c-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FrachiseChange_Password';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; view only, no server-side data)
// route-config: "AdminPanel/FrachiseChange-Password" -> FrachiseChange_Password/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FrachiseChange-Password'], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/Franchaise_Change_Password/Index.cshtml' });
}));

/**
 * private void history(double FRID, string OldPassword, string NewPassword, string ConfirmPassword, int Status, string resValue)
 * Exceptions propagate to UpdatePassword's catch (legacy: no try around the proc call).
 */
async function history(req, FRID, OldPassword, NewPassword, ConfirmPassword, Status, resValue) {
  if (resValue === 'Failed') Status = 0; else Status = 1;
  // PORT-NOTE: Dns.GetHostName()/GetHostByName()/GetHostEntry() results (myIP, ipAddress) were computed but never used - dropped.
  const host = String(req.hostname || '');
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') {
    IAddress = '67.225.214.45';
  } else {
    IAddress = await GetIP.GetLocalIP(req);
  }
  const url = 'https://extreme-ip-lookup.com/json/' + IAddress;
  try {
    // WebClient.DownloadString + JavaScriptSerializer.Deserialize<dynamic>
    const r = await axios.get(url, { responseType: 'text', transformResponse: (x) => x });
    const location = JSON.parse(r.data);
    // location["lat"] on a missing key => KeyNotFoundException (swallowed below, session untouched)
    if (!location || typeof location !== 'object' || !('lat' in location)) throw new Error('The given key was not present in the dictionary.');
    sessionStore.set(req, 'Latitude', location.lat);
    if (!('lon' in location)) throw new Error('The given key was not present in the dictionary.');
    sessionStore.set(req, 'longitude', location.lon);
  } catch (ex) {
    // swallowed (legacy empty catch)
  }
  const LATITUDE = sessionStore.get(req, 'Latitude');
  const LONGITUDE = sessionStore.get(req, 'longitude');
  // PORT-NOTE: legacy passed Session["Latitude"/"longitude"] directly; a null SqlParameter value is not sent and the procedure has no
  // default for @LATITUDE/@LONGITUDE => SqlException. Reproduced.
  if (LATITUDE === undefined || LATITUDE === null) {
    throw new Error("Procedure or function 'USP_FranchiseChangePasswordHistory' expects parameter '@LATITUDE', which was not supplied.");
  }
  if (LONGITUDE === undefined || LONGITUDE === null) {
    throw new Error("Procedure or function 'USP_FranchiseChangePasswordHistory' expects parameter '@LONGITUDE', which was not supplied.");
  }
  // USP_FranchiseChangePasswordHistory @FRID,@OldPassword,@Newpassword,@IPAddress,@LATITUDE,@LONGITUDE,@Status,@Type
  await db.proc(DB, 'USP_FranchiseChangePasswordHistory', {
    FRID, OldPassword, Newpassword: NewPassword, IPAddress: IAddress, LATITUDE: String(LATITUDE), LONGITUDE: String(LONGITUDE),
    Status: String(Status), Type: resValue,
  });
}

// ---------------------------------------------------------------- JsonResult UpdatePassword(string UserName, string OldPassword, string NewPassword, string ConfirmPassword)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdatePassword{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const UserName = B.nStr(req.p.UserName);
  let OldPassword = B.nStr(req.p.OldPassword);
  let NewPassword = B.nStr(req.p.NewPassword);
  let ConfirmPassword = B.nStr(req.p.ConfirmPassword);
  let resValue = '';
  // PORT-NOTE: MVC binds "" as null, so `!= ""` is true for empty fields (legacy quirk kept: the "mandatory" branch only triggers
  // when a literal empty string reaches the action, which model binding never produces).
  if (OldPassword !== '' && NewPassword !== '' && ConfirmPassword !== '') {
    if (NewPassword !== ConfirmPassword) {
      resValue = "Passwords don't match.";
      return res.json(resValue);
    }
  } else {
    resValue = 'Enter the mandatory fields.';
    return res.json(resValue);
  }
  OldPassword = await UtilityClass.Encryptword(OldPassword);
  NewPassword = await UtilityClass.Encryptword(NewPassword);
  ConfirmPassword = await UtilityClass.Encryptword(ConfirmPassword);
  let FRID = 0;
  try {
    // DBO.USP_FRANCHISEADMINPASSWORDCHANGE @FRID OUT,@OLDPASS,@NEWPASS,@UserName,@INTRESULT OUT
    // OUT params (@FRID, @INTRESULT) come back as result columns; a null @UserName is not sent (no default => error, caught below)
    const rows = await db.proc(DB, 'USP_FRANCHISEADMINPASSWORDCHANGE', nn({ OLDPASS: OldPassword, NEWPASS: NewPassword, UserName }));
    const row = rows[0];
    // PORT-NOTE: `int rows = ExecuteSqlCommand(...)` (rows affected) was passed to history() whose Status is overwritten there - unused.
    resValue = B.outStr(row, 'INTRESULT');
    if (resValue !== 'Invalid Password') {
      const f = B.col(row, 'FRID');
      if (f === null || f === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDouble(DBNull)
      FRID = Number(f);
      await history(req, FRID, OldPassword, NewPassword, ConfirmPassword, rows.length, resValue);
    }
  } catch (Exp) {
    await errorInsert(req, Exp, 'USP_CONTACTPASSWORDCHANGE');
    // ViewBag.Message = Exp.Message (not visible in a JsonResult)
    resValue = 'error^Some Error Occured.Please Try Again';
  }
  return res.json(resValue);
}));

module.exports = router;
