'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ChangeUserName.cs (class ChangeUserNameController => /ChangeUserName/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ChangeUserName';

/** class userdetails */
const USERDETAILS_PROPS = ['Name', 'EMAILID', 'MOBILE', 'REGNO'];

/** private void history(double RegNo, string OLDUsername, string NewUserName, int Status, string resValue) */
async function history(req, RegNo, OLDUsername, NewUserName, Status, resValue) {
  if (resValue === 'Failed') Status = 0;
  else Status = 1;
  // PORT-NOTE: legacy also resolved Dns.GetHostName()/GetHostByName() of the web server (values unused) - not ported.
  const host = req.hostname || '';
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') IAddress = '67.225.214.45';
  else IAddress = await GetIP.GetLocalIP(req);
  try {
    await db.proc(DB, 'USP_USERNAMEChangePasswordHistory', {
      RegNo, OLDUsername, NewUserName, IPAddress: IAddress, Status, Type: resValue,
    });
  } catch (_) {
    // legacy: empty catch
  }
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? page, string fromdate, ... string TransactionId)
// auth ([SessionExpireCheck]); parameters unused
// route-config: "AdminPanel/Change-UserName" -> ChangeUserName/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Change-UserName'], adminAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/ChangeUserName/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult Updateusername(string Username, string NewUserName, long RegNo)
// auth (Session["Admin_User"] == null => Response.Redirect("/"))
router.all(`/admin/${C}/Updateusername{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = B.sp(req, 'Username');
  const NewUserName = B.sp(req, 'NewUserName');
  const RegNo = B.reqNum(req, 'RegNo', 'System.Int64');
  let resValue = '';
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (NewUserName === '') return res.json('Error^New UserName cannot be left blank.');
  if (RegNo <= 0) return res.json('Error^Some error occured.Try typing username again.');
  if (Username === NewUserName) return res.json('Error^Both User Name are Same.Try typing different User Name again.');
  if (Username === null || NewUserName === null) throw B.NRE(); // .Trim() on null
  const rows = await db.proc(DB, 'USP_UPDATEUSERNAME', { RegNo, Username: Username.trim(), NewUserName: NewUserName.trim() });
  resValue = B.str(B.outVal(rows, 'INTRESULT'));
  // `rows` (ExecuteSqlCommand affected rows) was passed as Status but history() overwrites it
  await history(req, RegNo, Username, NewUserName, Array.isArray(rows) ? rows.length : 0, resValue);
  return res.json(resValue);
}));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string Username)
// auth (member lookup for the admin page; legacy had no session check)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const getval = 'Invalid';
  try {
    const Username = B.sp(req, 'Username');
    if (Username === null) throw B.NRE();
    const details = mapRows(await db.proc(DB, 'USP_GETUSERDETAILSBYUSERNAME', { USERNAME: Username.trim() }), USERDETAILS_PROPS);
    return res.json(details);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return res.json(getval);
}));

module.exports = router;
