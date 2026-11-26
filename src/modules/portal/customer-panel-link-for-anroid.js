// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Link_ForAnroid.cs (class Link_ForAnroidController => /portal/Link_ForAnroid/...)
'use strict';
// Database: shopping (Db_Shopping). 17 actions; the Android app opens them in a WebView to land on a customer page already logged in.
// Login actions (SESSION.md 4): Session["Plid"] = ObjLogin (14 actions) => ps.issueCustomerToken, `token` added to the { redirect } JSON.
// PORT-NOTE: legacy auto-login by Clid: `authentication` is hard-coded to 1 (UtilityClass.sessioncheck is commented out), so anyone
//   who knows a CLID is logged in as that customer (phone + stored password from TBL_CUSTOMERLOGIN). Kept `// public` as legacy.
//   The dead `authentication == 0` branch (OutPutSystemSessionService JSON built then RedirectToAction("Index","Home")) is not reachable.
// PORT-NOTE: MLMWallet_mobileForAnroid never set Session["Plid"] (commented out in legacy) => no token is issued there.
// PORT-NOTE: Mobile_Recharge_mobileForAnroid: legacy RedirectToAction("servicejewaria_Mobile", "Index") has action/controller swapped;
//   reproduced as '/Index/servicejewaria_Mobile'.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_RegistrationOrLogin = require('../../lib/portal/DAL_RegistrationOrLogin');
const GetIP = require('../../lib/portal/GetIP');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const { DB, NRE, mvcStr, mvcInt32, redirectJson, loginSession, customerByClid } = require('./_shared/batch-20-common');

const router = express.Router();
const C = '/portal/Link_ForAnroid';

/**
 * Body shared by the Clid actions:
 *   var v = Db._Customer_Login.Where(a => a.CLID == Clid).FirstOrDefault(); Login_Check(v.PHONE, v.PASSWORD, ip, did);
 *   Session["Plid"] = ObjLogin (unless setSession = false); [after()]; return RedirectToAction(target)
 *   catch (Exception ex) { [UtilityClass.TrackError(ex.Message)]; return Json(ex.Message) }
 */
function clidAction(target, { setSession = true, after = null, trackError = false } = {}) {
  return asyncHandler(async (req, res) => {
    // MVC binding (before the action body): int Clid, string Authentication, int did
    const Clid = mvcInt32(req, 'Clid');
    mvcStr(req, 'Authentication'); // bound, unused (authentication = 1)
    const did = mvcInt32(req, 'did');
    const authentication = 1; // UtilityClass.sessioncheck(Authentication, Clid) is commented out
    if (authentication === 0) return redirectJson(res, '/Home/Index');
    let token;
    try {
      const v = await customerByClid(Clid);
      if (v == null) throw NRE();
      const username = v.PHONE;
      const password = v.PASSWORD;
      const ip = await GetIP.GetLocalIP(req);
      const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(username, password, ip, did);
      if (setSession) token = loginSession(req, ObjLogin);
      if (after) await after(did);
      return redirectJson(res, target, token);
    } catch (ex) {
      if (trackError) await UtilityClass.TrackError(String(ex.message));
      if (token) res.setHeader('x-auth-token', token);
      return res.json(String(ex.message));
    }
  });
}

/** termofuse_Payment_ForAnroid / faq_ForAnroid (int did): Session["LoginwithMobile"] = "LoginMobile" then redirect */
function mobileFlagAction(target, resellerData) {
  return asyncHandler(async (req, res) => {
    mvcInt32(req, 'did'); // bound, unused
    try {
      ps.sessionSet(req, 'LoginwithMobile', 'LoginMobile');
      if (resellerData) await CompanyMasterSettings.GetResellerData();
      return redirectJson(res, target);
    } catch (ex) {
      return res.json(String(ex.message));
    }
  });
}

// route-config: referral/AddMoney_ForAnroid
// public (Android auto-login by Clid, see PORT-NOTE)
router.all([`${C}/AddMoney_ForAnroid{/:id}`, '/portal/referral/AddMoney_ForAnroid'], ps.portalSession, clidAction('/AddMoney/Index'));

// route-config: referral/Passbook-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Passbook_mobileForAnroid{/:id}`, '/portal/referral/Passbook-mobileForAnroid'], ps.portalSession, clidAction('/Passbook/Index'));

// route-config: referral/kyc-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/kyc_mobileForAnroid{/:id}`, '/portal/referral/kyc-mobileForAnroid'], ps.portalSession, clidAction('/KYC/Index'));

// route-config: referral/TransferToBank-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/TransferToBank_mobileForAnroid{/:id}`, '/portal/referral/TransferToBank-mobileForAnroid'], ps.portalSession,
  clidAction('/TransferToBank/Index'));

// route-config: referral/MLMWallet-mobileForAnroid
// public (Android; Login_Check runs but Session["Plid"] is NOT set in legacy)
router.all([`${C}/MLMWallet_mobileForAnroid{/:id}`, '/portal/referral/MLMWallet-mobileForAnroid'], ps.portalSession,
  clidAction('/MLMWallet/Index', {
    setSession: false,
    trackError: true,
    // string ResellerLoginID = SqlQuery<string>("select isnull(loginid,'') from tbl_distributor where did=" + did).FirstOrDefault(); (unused)
    after: async (did) => {
      await db.queryOne(DB, "select coalesce(loginid, '') as loginid from tbl_distributor where did = @did limit 1", { did });
    },
  }));

// route-config: referral/MLMwalletstatement-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/MLMwalletstatement_mobileForAnroid{/:id}`, '/portal/referral/MLMwalletstatement-mobileForAnroid'], ps.portalSession,
  clidAction('/MLMwalletstatement/Index'));

// route-config: referral/Completed-Recharge-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Completed_Recharge_mobileForAnroid{/:id}`, '/portal/referral/Completed-Recharge-mobileForAnroid'], ps.portalSession,
  clidAction('/Completed_Recharge/Index'));

// route-config: referral/Pending-Recharge-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Pending_Recharge_mobileForAnroid{/:id}`, '/portal/referral/Pending-Recharge-mobileForAnroid'], ps.portalSession,
  clidAction('/Pending_Recharge/Index'));

// route-config: referral/Falied-Recharge-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Falied_Recharge_mobileForAnroid{/:id}`, '/portal/referral/Falied-Recharge-mobileForAnroid'], ps.portalSession,
  clidAction('/Falied_Recharge/Index'));

// route-config: referral/Customermobile-ForAnroid
// public (Android auto-login by Clid; CompanyMasterSettings.GetResellerData() after the login)
router.all([`${C}/CustomermobileForAnroid{/:id}`, '/portal/referral/Customermobile-ForAnroid'], ps.portalSession,
  clidAction('/AddTicket/CustomerIndex', { after: async () => { await CompanyMasterSettings.GetResellerData(); } }));

// route-config: referral/Security-ForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Security_mobileForAnroid{/:id}`, '/portal/referral/Security-ForAnroid'], ps.portalSession,
  clidAction('/Member_Profile/security'));

// route-config: referral/termofuse-ForAnroid
// public (no login; sets Session["LoginwithMobile"])
router.all([`${C}/termofuse_Payment_ForAnroid{/:id}`, '/portal/referral/termofuse-ForAnroid'], ps.portalSession,
  mobileFlagAction('/termofuse/Index', true));

// route-config: referral/Address-ForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Address_mobileForAnroid{/:id}`, '/portal/referral/Address-ForAnroid'], ps.portalSession, clidAction('/Address/Index'));

// route-config: referral/all_tickets-Customermobile-ForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/all_tickets_mobileForAnroid{/:id}`, '/portal/referral/all_tickets-Customermobile-ForAnroid'], ps.portalSession,
  clidAction('/AllTickets/CustomermobileIndex'));

// route-config: referral/Mobile-Recharge-ForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Mobile_Recharge_mobileForAnroid{/:id}`, '/portal/referral/Mobile-Recharge-ForAnroid'], ps.portalSession,
  clidAction('/Index/servicejewaria_Mobile'));

// route-config: referral/Passcode-mobileForAnroid
// public (Android auto-login by Clid)
router.all([`${C}/Passcode_mobileForAnroid{/:id}`, '/portal/referral/Passcode-mobileForAnroid'], ps.portalSession, clidAction('/Passcode/Index'));

// route-config: referral/faq-ForAnroid
// public (no login; sets Session["LoginwithMobile"])
router.all([`${C}/faq_ForAnroid{/:id}`, '/portal/referral/faq-ForAnroid'], ps.portalSession, mobileFlagAction('/faq/Index', false));

module.exports = router;
