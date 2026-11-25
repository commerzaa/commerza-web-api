'use strict';
// Ported from Member\Controllers\Login_as_member.cs (1 action) - database: affiliate (Db_Affiliate)
const express = require('express');
const router = express.Router();
const db = require('../../db');
const { signToken } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const GetIP = require('../../lib/member/GetIP');
const DAL_RegistrationOrLogin = require('../../lib/member/DAL_RegistrationOrLogin');
const DB = 'affiliate';

// public (legacy login-as-member entry; it creates the session => JWT is issued here)
// route-config: Login-as-member -> Index
router.all(['/member/Login_as_member/Index{/:id}', '/member/Login-as-member'], asyncHandler(async (req, res) => {
  const LoginID = req.p.LoginID;
  const Plid = Number(req.p.Plid);
  if (Number.isNaN(Plid) || req.p.Plid === undefined || req.p.Plid === '') {
    return res.status(400).json({ message: "The parameters dictionary contains a null or invalid entry for parameter 'Plid'" });
  }
  const newLoginID = await UtilityClass.Decryptword(LoginID);
  // (legacy also loaded Member_Master by USERNAME into an unused variable; omitted - no side effects)
  const sp = await db.procOne(DB, 'USP_SCALERDATA', { mode: 7, Identity: newLoginID, Uniqueid: 0 });
  const newPassword = sp ? sp[Object.keys(sp)[0]] : null;
  const dashboardurl = await db.scalar(DB, "SELECT coalesce(URL,'') AS URL FROM TBL_DASHBOARDS WHERE ACTINE=1 limit 1");
  const ip = await GetIP.GetLocalIP(req);
  const ObjLogin = await DAL_RegistrationOrLogin.Login_Check(newLoginID, newPassword, ip, 0);
  const menu = await db.proc(DB, 'Usp_PickAdminUserRights_memberpanel', { EmpID: 1, Plid });
  const out = {};
  // Session["Plid"] = ObjLogin; Session["Member_User_Menu"] = list; Session["LoginType"] = 2  =>  JWT carrying every session value
  const payload = {};
  if (ObjLogin) for (const k of Object.keys(ObjLogin)) payload[k.toLowerCase()] = ObjLogin[k];
  out.token = signToken({ ...payload, userType: 'member', plid: payload.plid, member_user_menu: menu, logintype: 2 });
  out.Member_User_Menu = menu;
  out.LoginType = 2;
  out.redirect = (dashboardurl === null || dashboardurl === undefined || dashboardurl === '') ? 'referral/dashboard' : dashboardurl;
  res.json(out);
}));

module.exports = router;
