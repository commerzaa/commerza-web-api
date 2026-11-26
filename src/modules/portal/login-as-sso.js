// Ported from ClusterofferShopingPortal\Controllers\Login_as_sso.cs (class Login_as_ssoController => /portal/Login_as_sso/...)
'use strict';
// Database: shopping (Db_Shopping). Login action (SESSION.md 4): Session["Plid"] = ObjLogin => ps.issueCustomerToken, token added at
// the top level of the { redirect } response.
// `static string pass, userid` are declared but never used by this controller (not ported).
// PORT-NOTE: legacy concatenated `email` into the two SELECTs (SQL injection); parameterised here.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/portal/GetIP');
const CS = require('../../lib/portal/CompanySettings');
const { DB, mvcStr, toInt32, redirectJson, loginSession } = require('./_shared/batch-20-common');

const CompanySettings = CS.CompanySettings || CS;
const { CompanyMasterSettings } = CS;
const router = express.Router();

/** new Random().Next(min, max) (max exclusive) */
const rnd = (min, max) => min + Math.floor(Math.random() * (max - min));
/** SqlQuery<string>(...).FirstOrDefault() */
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : null);

// ---------------------------------------------------------------- Index(email = "", token = "", IdToken = "", RefreshToken = "", SessionId = "")
// route-config: "Login-as-member" -> Login_as_sso/Index
// public (SSO login action)
router.all(['/portal/Login_as_sso/Index{/:id}', '/portal/Login_as_sso', '/portal/Login-as-member'], ps.portalSession, asyncHandler(async (req, res) => {
  let email = mvcStr(req, 'email', '');
  let token = mvcStr(req, 'token', '');
  // IdToken, RefreshToken, SessionId are bound but never used.
  const firstName = ''; const lastName = '';
  if (email == null) email = '';
  if (token == null) token = '';
  let IntOutPutResult = '-1'; let ip_address = ''; let password = ''; let LoginID;
  let DID = 0;
  await CompanyMasterSettings.GetResellerData();
  DID = toInt32(config.app.DID);
  let checktoken = '';
  if (email !== '') {
    checktoken = firstCol(await db.procOne(DB, 'usp_gettoken', { email }));
    if (checktoken === undefined) checktoken = null;
  }
  if (email !== '' && token === (checktoken === null ? null : String(checktoken))) {
    let issued;
    try {
      let ObjLogin = null;
      ip_address = await GetIP.GetLocalIP(req);
      password = firstCol(await db.queryOne(DB, 'select password from tbl_customerlogin where emailid = @email limit 1', { email }));
      if (password === undefined) password = null;
      if (password != null && password !== '') {
        ObjLogin = await DAL_RegistrationOrLogin.Login_Check(email, password, ip_address, DID);
        if (ObjLogin != null) {
          issued = loginSession(req, ObjLogin); // ReturnOutPut = "success"; Session["Plid"] = ObjLogin
          return redirectJson(res, '/Home/Index', issued);
        }
      } else if (email !== '') {
        const Random = rnd(1000, 9999);
        password = `${CompanySettings.CompanyName == null ? '' : CompanySettings.CompanyName}@${Random}`;
        const RandomLoginID = rnd(10000000, 99999999);
        LoginID = String(RandomLoginID);
        const country = ps.sessionGet(req, 'CountryName');
        IntOutPutResult = await DAL_RegistrationOrLogin.SocialRegistration(email, firstName, lastName, password, ip_address, DID, LoginID,
          country == null ? '' : String(country));
        if (IntOutPutResult === '2') {
          ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
          issued = loginSession(req, ObjLogin); // null => Session["Plid"] = null (ReturnOutPut "0"), else "success"
          return redirectJson(res, '/Home/Index', issued);
        } else if (IntOutPutResult === '1') {
          // string LoginId = SELECT LOGINID ... (read but unused)
          await db.queryOne(DB, 'select loginid from tbl_customerlogin where emailid = @email and active = 1 limit 1', { email });
          ObjLogin = await DAL_RegistrationOrLogin.SocialLoginCheck(email, DID);
          issued = loginSession(req, ObjLogin);
        }
      }
      return redirectJson(res, '/', issued);
    } catch (Exp) {
      return res.json(Exp.message);
    }
  }
  return redirectJson(res, '/');
}));

module.exports = router;
