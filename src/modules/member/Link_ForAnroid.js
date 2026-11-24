'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Link_ForAnroid.cs (Link_ForAnroidController)
// These actions are the Android-app deep links: they validate the app "Authentication" session id (UtilityClass.sessioncheck),
// re-create the member session (Session["Plid"], Member_User_Menu, LoginType) and redirect. Session -> JWT: a token is returned.
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const { signToken } = require('../../middleware/auth');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const DB = 'affiliate';

const Member_User_Menu = ['mid', 'mainMenuTitle', 'mainhref', 'aiClass', 'bClass', 'sid', 'subMenuTitle', 'subhref', 'isEdit', 'HeaderClass', 'isDelete', 'Active', 'rid', 'active', 'userRight_isEdit', 'mainMenuView', 'mainMenuEdit', 'subMenuView', 'subMenuEdit', 'submenuChecked'];
const InvoicePrint = ['RowNumber', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo', 'ImageName', 'BankName', 'BranchName', 'ReferenceDate', 'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'PuchaseDate', 'IsActive', 'Status', 'Plid', 'AllPackageName', 'IsApproved', 'Transaction_id', 'service_tax', 'service_tax_per', 'With_out_tax_Amount', 'username', 'fullname', 'mobile', 'emailid', 'ADDRESS', 'CITY', 'POSTALCODE', 'alladdress', 'sid', 'statename', 'statenamepincode', 'invoice_no'];

// Re-creates the session of the portal login (Session["Plid"], Session["Member_User_Menu"], Session["LoginType"]=2).
// Returns the JWT (null when Login_Check returned null, exactly like Session["Plid"] = null).
async function createSession(req, Plid) {
  const v = await db.queryOne(DB, 'select * from portal_login where plid=@plid limit 1', { plid: Plid });
  const username = v.username; // NullReference in legacy when no row -> caught by the action
  const password = v.password;
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(username, password, ip, 0);
  let token = null;
  if (ObjLogin) {
    const payload = {
      userType: 'member', plid: ObjLogin.Plid, pmid: ObjLogin.Pmid, smdid: ObjLogin.Smdid, loginid: ObjLogin.LoginID,
      userName: ObjLogin.UserName, name: ObjLogin.Name, cid: ObjLogin.Cid, mobile: ObjLogin.MOBILE, emailid: ObjLogin.EMAILID,
      secretcode: ObjLogin.SecretCode, logintype: 2,
    };
    token = signToken(payload);
    req.user = payload; // so that sessionStore is keyed by this member
    const rows = await db.proc(DB, 'usp_pickadminuserrights_memberpanel', { empid: 1, plid: Plid });
    sessionStore.set(req, 'Member_User_Menu', mapRows(rows, Member_User_Menu));
    sessionStore.set(req, 'LoginType', 2);
  } else {
    await db.proc(DB, 'usp_pickadminuserrights_memberpanel', { empid: 1, plid: Plid });
  }
  return token;
}

function androidAction(redirectController) {
  return asyncHandler(async (req, res) => {
    const Plid = parseInt(req.p.Plid, 10);
    const Authentication = req.p.Authentication === undefined || req.p.Authentication === null ? '' : String(req.p.Authentication);
    const authentication = await UtilityClass.sessioncheck(Authentication, Plid);
    if (!authentication) {
      // OutPutSystemSessionService{Flag:"error",...,Authentication:"Authorization has been denied for this request."} is built and discarded in legacy; it redirects to Home
      return res.status(401).json({ status: 'false', message: 'Authorization has been denied for this request.', redirect: '/member/Home/Index' });
    }
    try {
      const token = await createSession(req, Plid);
      const out = { redirect: '/member/' + redirectController + '/Index' };
      if (token) out.token = token;
      return res.json(out);
    } catch (ex) {
      return res.json(ex.message.toString());
    }
  });
}

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wPayItForward_ForAnroidTKFiBFojQ== -> Link_ForAnroid/PayItForward_ForAnroid
router.all(['/member/Link_ForAnroid/PayItForward_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wPayItForward_ForAnroidTKFiBFojQ=='], androidAction('PayItForward_mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wSecurity_ForAnroidTKFiBFojQ== -> Link_ForAnroid/Security_ForAnroid
router.all(['/member/Link_ForAnroid/Security_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wSecurity_ForAnroidTKFiBFojQ=='], androidAction('separte_ga_mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wNewDeposit_ForAnroidTKFiBFojQ== -> Link_ForAnroid/NewDeposit_ForAnroid
router.all(['/member/Link_ForAnroid/NewDeposit_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wNewDeposit_ForAnroidTKFiBFojQ=='], androidAction('Topup_Request_Mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wTransfer_EWallet_ForAnroidTKFiBFojQ== -> Link_ForAnroid/Transfer_EWallet_ForAnroid
router.all(['/member/Link_ForAnroid/Transfer_EWallet_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wTransfer_EWallet_ForAnroidTKFiBFojQ=='], androidAction('Transfer_Wallet_Fund_mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wUpgradePackage_ForAnroidKFiBFojQ== -> Link_ForAnroid/UpgradePackage_ForAnroid
router.all(['/member/Link_ForAnroid/UpgradePackage_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wUpgradePackage_ForAnroidKFiBFojQ=='], androidAction('Upgrade_package_member'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wMyTree_ForAnroidKFiBFojQ== -> Link_ForAnroid/MyTree_ForAnroid
router.all(['/member/Link_ForAnroid/MyTree_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wMyTree_ForAnroidKFiBFojQ=='], androidAction('treeview_mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wCommssionWalletTransfer_ForAnroidKFiBFojQ== -> Link_ForAnroid/CommssionWalletTransfer_ForAnroid
router.all(['/member/Link_ForAnroid/CommssionWalletTransfer_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wCommssionWalletTransfer_ForAnroidKFiBFojQ=='], androidAction('Transfer_Commission_Wallet_Fund_mobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wBTCWithdrawal_ForAnroidKFiBFojQ== -> Link_ForAnroid/BTCWithdrawal_ForAnroid
router.all(['/member/Link_ForAnroid/BTCWithdrawal_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wBTCWithdrawal_ForAnroidKFiBFojQ=='], androidAction('WithdrawalMobile'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wBankWithdrawal_ForAnroidKFiBFojQ== -> Link_ForAnroid/BankWithdrawal_ForAnroid
router.all(['/member/Link_ForAnroid/BankWithdrawal_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wBankWithdrawal_ForAnroidKFiBFojQ=='], androidAction('BankAccountWithdraw'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wCOINWithdrawal_ForAnroidKFiBFojQ== -> Link_ForAnroid/COINWithdrawal_ForAnroid
router.all(['/member/Link_ForAnroid/COINWithdrawal_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wCOINWithdrawal_ForAnroidKFiBFojQ=='], androidAction('Coin_Withdrawal'));

// public (Android deep link authenticated by the app session id; issues the JWT)
// route-config: referral/iMytKN79ISI6wETHWithdrawal_ForAnroidKFiBFojQ== -> Link_ForAnroid/ETHWithdrawal_ForAnroid
router.all(['/member/Link_ForAnroid/ETHWithdrawal_ForAnroid{/:id}', '/member/referral/iMytKN79ISI6wETHWithdrawal_ForAnroidKFiBFojQ=='], androidAction('ETHWithdrawal'));

// public (legacy had no session check; it re-creates the session for the supplied Plid and returns the invoice list)
// route-config: referral/iMytKN79ISI6wInvicesforpackagepurchaselistKFiBFojQ== -> Link_ForAnroid/Invicesforpackagepurchaselist
router.all(['/member/Link_ForAnroid/Invicesforpackagepurchaselist{/:id}', '/member/referral/iMytKN79ISI6wInvicesforpackagepurchaselistKFiBFojQ=='], asyncHandler(async (req, res) => {
  const ID = req.p.ID === undefined || req.p.ID === null ? req.params.id : req.p.ID;
  const Plid = parseInt(req.p.Plid, 10);
  let InvoicePrintLi = [];
  try {
    const token = await createSession(req, Plid);
    const rows = await db.proc(DB, 'usp_userinvoice', { plid: Plid, sfdid: ID });
    InvoicePrintLi = mapRows(rows, InvoicePrint);
    const out = { Model: InvoicePrintLi };
    if (token) out.token = token;
    return res.json(out);
  } catch (ex) {
    return res.json(ex.message.toString());
  }
}));

module.exports = router;
