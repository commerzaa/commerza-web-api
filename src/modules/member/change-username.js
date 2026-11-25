'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Change_Username.cs (Change_UsernameController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const GetIP = require('../../lib/member/GetIP');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return '';
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || f[k] === null || f[k] === undefined ? '' : String(f[k]);
};
const nn = (v) => (v === undefined || v === null ? '' : String(v));

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/mCj7sN_slash_IqXjeh1ft5hNh5A==  (Change_Username / Index)
// auth
router.all(['/member/Change_Username/Index{/:id}', '/member/referral/mCj7sN_slash_IqXjeh1ft5hNh5A=='], auth, asyncHandler(async (req, res) => {
  return res.json({ view: '~/Views/CustomerPanel/Change_Username/Index.cshtml' });
}));

// ---- GetUsernameAndEmail -------------------------------------------------------------------------------
// auth (legacy had no session check; it is only called from the logged-in Change_Username page)
router.all('/member/Change_Username/GetUsernameAndEmail{/:id}', auth, asyncHandler(async (req, res) => {
  const getval = 'Invalid';
  try {
    const Username = nn(req.p.Username);
    const rows = await proc(DB, 'usp_getuserdetailsbyusername', { username: Username.trim() });
    return res.json(mapRows(rows, ['Name', 'EMAILID', 'MOBILE', 'REGNO']));
  } catch (e) {
    console.error(e);
    try { await new DataUtility().ErrorInsert(0, e.message, 'GetUsernameAndEmail', 0, req.path); } catch (e2) { console.error(e2); }
  }
  return res.json(getval);
}));

// history(...) is a private helper (not an action): writes the username-change audit row.
async function history(req, RegNo, OLDUsername, NewUserName, Status, resValue) {
  Status = resValue === 'Failed' ? 0 : 1;
  // PORT-NOTE: the legacy Dns.GetHostName()/GetHostByName/GetHostEntry lookups only fed unused locals and are dropped.
  const host = req.hostname || '';
  let IAddress = '';
  if (host.toLowerCase() === 'localhost') {
    IAddress = '67.225.214.45';
  } else {
    IAddress = await GetIP.GetLocalIP(req);
  }
  try {
    await proc(DB, 'usp_usernamechangepasswordhistory', {
      regno: RegNo, oldusername: OLDUsername, newusername: NewUserName, ipaddress: IAddress, status: Status, type: resValue,
    });
  } catch (e) {
    // legacy: empty catch
  }
}

// ---- Updateusername ------------------------------------------------------------------------------------
// auth
router.all('/member/Change_Username/Updateusername{/:id}', auth, asyncHandler(async (req, res) => {
  let resValue = '';
  const Username = req.p.Username;
  const NewUserName = req.p.NewUserName;
  const RegNo = parseInt(req.p.RegNo, 10);
  if (Username === '') {
    return res.json('Error^Username cannot be left blank.');
  }
  if (NewUserName === '') {
    return res.json('Error^New UserName cannot be left blank.');
  }
  if (RegNo <= 0) {
    return res.json('Error^Some error occured.Try typing username again.');
  }
  if (Username === NewUserName) {
    return res.json('Error^Both User Name are Same.Try typing different User Name again.');
  }
  // PORT-NOTE: @INTRESULT OUT is read from the first result row (column intresult).
  const rows = await proc(DB, 'usp_updateusername', { regno: RegNo, username: nn(Username).trim(), newusername: nn(NewUserName).trim() });
  resValue = outOf(rows, 'intresult');
  await history(req, RegNo, Username, NewUserName, 1, resValue);
  return res.json(resValue);
}));

module.exports = router;
