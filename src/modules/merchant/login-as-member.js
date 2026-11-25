'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\Login_as_member.cs  (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
const GetIP = require('../../lib/merchant/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/merchant/DAL_RegistrationOrLogin');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Login_as_member';
const rnd = (min, max) => Math.floor(Math.random() * (max - min)) + min; // Random.Next(min, max)
const col = (o, n) => { const k = o && Object.keys(o).find((x) => x.toLowerCase() === n); return k ? o[k] : null; };

// updatemember is a public static method in C# (not an MVC action); kept as a helper
async function updatemember(PLID, EmailID, mode, HtmlMailPath) {
  let IntResult = 0; let matplid = 0;
  const o = await db.procOne(DB, 'usp_updatevisitor', { plid: PLID, emailid: EmailID });
  IntResult = parseInt(String(col(o, 'intresult')), 10);
  matplid = parseInt(String(col(o, 'maxplid')), 10);
  if (Number.isNaN(IntResult) || Number.isNaN(matplid)) throw new Error('Input string was not in a correct format.');
  if (IntResult === 1) {
    if (mode === 'Direct') {
      // nothing
    }
    // SendConfirmationMail thread is commented out in the Merchant C#
  }
}

// public (legacy login-as-member entry; creates the session => JWT)
// route-config: Login-as-member
router.all([P + '/Index{/:id}', '/merchant/Login-as-member', '/Login-as-member'], asyncHandler(async (req, res) => {
  try {
    let { LoginID = '', Email = '', token = '' } = req.p;
    if (Email == null) Email = '';
    if (LoginID == null) LoginID = '';
    if (token == null) token = '';
    let checktoken = '';
    if (Email !== '') {
      const t = await db.procOne(DB, 'usp_gettoken_merchant', { email: Email });
      checktoken = t ? t[Object.keys(t)[0]] : null;
    }
    const ip = await GetIP.GetLocalIP(req);
    let newLoginID = ''; let newPassword = ''; let dashboardurl = '';
    const Random = rnd(10000, 99999);
    const password = CompanySettings.CompanyName + '@' + Random;
    const RandomLoginID = rnd(10000000, 99999999);
    const getLogin = () => db.queryOne(DB, 'select * from portal_login where emailid=@e limit 1', { e: Email });
    if (Email !== '') { // && token == checktoken
      let v = await getLogin();
      if (v == null) {
        newLoginID = String(RandomLoginID);
        const IntOutPutResult = await DAL_RegistrationOrLogin.Registration('', Email, password, 'EUR', String(sessionStore.get(req, 'CountryName') || ''), String(RandomLoginID), ip, '', '', '0', '');
        if (IntOutPutResult === '1') {
          const o = await db.procOne(DB, 'usp_checking_email_click_visitor', { plid: 0, emailid: Email });
          const IntResult = parseInt(String(col(o, 'intresult')), 10);
          if (Number.isNaN(IntResult)) throw new Error('Input string was not in a correct format.');
          if (IntResult === 3) {
            await updatemember(0, Email, 'Direct', '');
          }
        }
      }
      v = await getLogin();
      newPassword = v.password; // NullReference in legacy when no row
      dashboardurl = 'merchant/dashBoard';
    } else if (LoginID != null && LoginID !== '') {
      newLoginID = await UtilityClass.Decryptword(LoginID);
      const v = await db.queryOne(DB, 'select * from portal_login where emailid=@e limit 1', { e: newLoginID });
      newPassword = v.password; // NullReference in legacy when no row
      dashboardurl = 'merchant/dashBoard';
    } else {
      return res.json({ redirect: 'Home/Index' });
    }
    const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(newLoginID, newPassword, ip);
    const out = {};
    // Session["Plid"] = ObjLogin  =>  JWT carrying every session value
    if (ObjLogin) {
      const payload = {};
      for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
      out.token = signToken({ ...payload, userType: 'merchant', plid: payload.plid });
    }
    if (dashboardurl == null || dashboardurl === '') out.redirect = 'Home/Index';
    else out.redirect = dashboardurl;
    return res.json(out);
  } catch (e) {
    // catch { return RedirectToAction("", "Index", "Home"); }
    return res.json({ redirect: 'Home/Index' });
  }
}));

module.exports = router;
