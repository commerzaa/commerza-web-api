'use strict';
// Ported from Merchant Panel\Controllers\Link_ForAnroid.cs (Link_ForAnroidController)  - DB: shopping (Db_Shopping)
// These actions are the mobile-app entry links. dashboard_/Listing_/Agreement_ForAnroid log the merchant in by Plid (legacy behaviour:
// Login_Check with the stored phone/password, Session["Plid"] = Login) => they are the login of this controller and stay public;
// they return the legacy redirect plus a JWT `token`.
const express = require('express');
const db = require('../../db');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DAL_RegistrationOrLogin = require('../../lib/merchant/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/merchant/GetIP');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Link_ForAnroid';

const pick = (o, name) => {
  if (!o) return undefined;
  const k = Object.keys(o).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : o[k];
};

// Session["LoginwithMobile"] = "LoginMobile" (before login => anonymous store key, like the other public outer pages)
function setMobileSession(req) {
  sessionStore.set(req, 'LoginwithMobile', 'LoginMobile');
}

function simpleRedirect(target) {
  return asyncHandler(async (req, res) => {
    try {
      setMobileSession(req);
      return res.json({ redirect: target });
    } catch (ex) {
      return res.json(String(ex.message));
    }
  });
}

// Pricing_ForAnroid / FAQ_ForAnroid / termofuse_Payment_ForAnroid / Benefites_ForAnroid
// public
router.all([`${P}/Pricing_ForAnroid{/:id}`, '/merchant/Mobile-advertise-pricing'], simpleRedirect('Pricing/index')); // route-config: Mobile-advertise-pricing
// public
router.all([`${P}/FAQ_ForAnroid{/:id}`, '/merchant/Mobile-faq'], simpleRedirect('OuterPages/FAQ')); // route-config: Mobile-faq
// public
router.all([`${P}/termofuse_Payment_ForAnroid{/:id}`, '/merchant/termofuse-ForAnroid'], simpleRedirect('OuterPages/TermAndConditions')); // route-config: termofuse-ForAnroid
// public
router.all([`${P}/Benefites_ForAnroid{/:id}`, '/merchant/Mobile-advertise-benefits'], simpleRedirect('OuterPages/Benefites')); // route-config: Mobile-advertise-benefits

// dashboard_ForAnroid / Listing_ForAnroid / Agreement_ForAnroid: login by Plid then redirect
function loginAndRedirect(target) {
  return asyncHandler(async (req, res) => {
    try {
      const p = req.p.Plid;
      if (p === undefined || p === null || p === '' || !/^[+-]?\d+$/.test(String(p).trim())) {
        throw new Error('The parameters dictionary contains a null entry for parameter \'Plid\' of non-nullable type \'System.Int32\'.');
      }
      const Plid = parseInt(p, 10);
      const v = await db.queryOne(DB, 'SELECT phone, password FROM portal_login WHERE plid = @plid LIMIT 1', { plid: Plid });
      if (!v) throw new TypeError('Object reference not set to an instance of an object.');
      const username = v.phone;
      const password = v.password;

      const ip = await GetIP.GetLocalIP(req);
      const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(username, password, ip);
      const out = { redirect: target };
      if (ObjLogin) {
        // Session["Plid"] = ObjLogin  => JWT carrying every Login field
        const plid = Number(pick(ObjLogin, 'Plid'));
        out.token = signToken({
          userType: 'merchant',
          plid,
          pmid: pick(ObjLogin, 'Pmid'),
          smdid: pick(ObjLogin, 'Smdid'),
          loginid: pick(ObjLogin, 'LoginID'),
          userName: pick(ObjLogin, 'UserName'),
          username: pick(ObjLogin, 'UserName'),
          emailid: pick(ObjLogin, 'EmailId'),
          name: pick(ObjLogin, 'Name'),
          cid: pick(ObjLogin, 'Cid'),
          phone: pick(ObjLogin, 'PHONE'),
        });
        // Session["LoginwithMobile"] stored for the (now logged-in) user
        sessionStore.set({ user: { userType: 'merchant', plid }, ip: req.ip }, 'LoginwithMobile', 'LoginMobile');
      } else {
        setMobileSession(req);
      }
      return res.json(out);
    } catch (ex) {
      return res.json(String(ex.message));
    }
  });
}

// public (login by Plid; legacy behaviour)
router.all([`${P}/dashboard_ForAnroid{/:id}`, '/merchant/dashboard-Mobile'], loginAndRedirect('CustomerDashBoard/Index')); // route-config: merchant/dashboard-Mobile
// public (login by Plid; legacy behaviour)
router.all([`${P}/Listing_ForAnroid{/:id}`, '/merchant/Listing-Mobile'], loginAndRedirect('OuterBusinessKeywords/Index')); // route-config: merchant/Listing-Mobile
// public (login by Plid; legacy behaviour)
router.all([`${P}/Agreement_ForAnroid{/:id}`, '/merchant/Agreement-Mobile'], loginAndRedirect('Agreement/Index')); // route-config: merchant/Agreement-Mobile

module.exports = router;
