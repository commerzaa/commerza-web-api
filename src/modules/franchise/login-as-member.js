'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Login_as_member.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
const GetIP = require('../../lib/franchise/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/franchise/DAL_RegistrationOrLogin');
const SendConfirmationMail = require('../../lib/franchise/SendConfirmationMail');

const router = express.Router();
const P = '/franchise/Login_as_member';
const rnd = (min, max) => Math.floor(Math.random() * (max - min)) + min; // Random.Next(min, max)

// UpdateMember is a public static method in C# (not an MVC action); kept as a helper
async function UpdateMember(PLID, EmailID, mode, HtmlMailPath) {
  const o = await db.procOne('shopping', 'usp_updatevisitor_reseller', { PLID, EmailId: EmailID });
  const g = (n) => { const k = o && Object.keys(o).find((x) => x.toLowerCase() === n); return k ? o[k] : null; };
  const IntResult = parseInt(String(g('intresult')), 10);
  const matplid = parseInt(String(g('maxplid')), 10);
  if (Number.isNaN(IntResult) || Number.isNaN(matplid)) throw new Error('Input string was not in a correct format.');
  if (IntResult === 1) {
    if (mode === 'Direct') {
      // nothing
    }
    setImmediate(() => { Promise.resolve(SendConfirmationMail.SendMail(matplid, EmailID, HtmlMailPath)).catch((e) => console.error(e.message)); });
  }
}

// public (legacy login-as-member entry; creates the session => JWT)
// route-config: Login-as-reseller
router.all([P + '/Index{/:id}', '/franchise/Login-as-reseller'], asyncHandler(async (req, res) => {
  let { LoginID = '', Email = '', token = '' } = req.p;
  if (Email == null) Email = '';
  if (LoginID == null) LoginID = '';
  if (token == null) token = '';
  const ip = await GetIP.GetLocalIP(req);
  let checktoken = '';
  const Random = rnd(10000, 99999);
  const password = CompanySettings.CompanyName + '@' + Random;
  const RandomLoginID = rnd(10000000, 99999999);
  if (Email !== '') {
    const t = await db.procOne('shopping', 'usp_gettoken_franchise', { Email });
    checktoken = t ? t[Object.keys(t)[0]] : null;
  }
  let newLoginID = ''; let newPassword = ''; let dashboardurl = '';
  if (Email !== '' && token === checktoken) {
    let v = await db.queryOne('shopping', 'select password, loginid from tbl_distributor where emailid=@e limit 1', { e: Email });
    newLoginID = Email;
    if (v == null) {
      newLoginID = String(RandomLoginID);
      const IntOutPutResult = await DAL_RegistrationOrLogin.Registration('', Email, password, 'EUR', String(sessionStore.get(req, 'CountryName') || ''), String(RandomLoginID), ip, '', '');
      if (IntOutPutResult === '1') {
        await UpdateMember(0, Email, 'Direct', '');
        v = await db.queryOne('shopping', 'select password, loginid from tbl_distributor where emailid=@e limit 1', { e: Email });
        newPassword = v.password;
        newLoginID = v.loginid;
        dashboardurl = 'franchisee/dashBoard';
      }
    } else {
      v = await db.queryOne('shopping', 'select password, loginid from tbl_distributor where emailid=@e limit 1', { e: Email });
      if (v != null) {
        newPassword = v.password;
        newLoginID = v.loginid;
        dashboardurl = 'franchisee/dashBoard';
      }
    }
  } else {
    newLoginID = await UtilityClass.Decryptword(LoginID);
    const v = await db.queryOne('shopping', 'select password from tbl_distributor where emailid=@e limit 1', { e: newLoginID });
    newPassword = v.password; // NullReference in legacy when no row
    dashboardurl = 'franchisee/dashBoard';
  }
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(newLoginID, newPassword, ip);
  const out = {};
  // Session["Plid"] = ObjLogin  =>  JWT carrying every session value
  if (ObjLogin) {
    const payload = {};
    for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
    out.token = signToken({ ...payload, userType: 'franchise', plid: payload.plid, did: payload.did });
  }
  if (dashboardurl == null || dashboardurl === '') out.redirect = 'Home/Index';
  else out.redirect = dashboardurl;
  res.json(out);
}));

module.exports = router;
