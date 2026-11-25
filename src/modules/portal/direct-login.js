'use strict';
// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\DirectLoginController.cs (class DirectLoginController => /portal/DirectLogin/...)
// Database: shopping (Db_Shopping). Login action (SESSION.md section 4): Session["Plid"] = ObjLogin => ps.issueCustomerToken.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, NRE, col, csInt32 } = require('./_shared/batch-09-common');

const router = express.Router();

// ---------------------------------------------------------------- Index(string clid)
// route-config: "reseller/{loginid}/Login-profile" -> DirectLogin/Index (clid still comes from the query string / form)
// public (login action). PORT-NOTE (security, legacy behaviour kept): anyone holding an encrypted CLID is logged in as that customer.
router.all(['/portal/DirectLogin/Index{/:id}', '/portal/DirectLogin', '/portal/reseller/:loginid/Login-profile'], ps.portalSession, asyncHandler(async (req, res) => {
  let clid = req.p.clid === undefined ? null : req.p.clid;
  if (clid !== '') clid = await UtilityClass.Decryptword(clid);
  const custCLID = csInt32(clid);
  const UserName = col(await db.queryOne(DB, 'SELECT username FROM tbl_customerlogin WHERE clid = @clid LIMIT 1', { clid: custCLID }), 'username') ?? null;
  const Password = col(await db.queryOne(DB, 'SELECT password FROM tbl_customerlogin WHERE clid = @clid LIMIT 1', { clid: custCLID }), 'password') ?? null;
  const didRow = await db.queryOne(DB, 'SELECT did FROM tbl_customerlogin WHERE clid = @clid LIMIT 1', { clid: custCLID });
  if (didRow && (didRow.did === null || didRow.did === undefined)) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
  const Did = didRow ? Number(didRow.did) : 0;

  const loginRow = await db.procOne(DB, 'usp_portallogin_m_customer', { username: UserName, password: Password, ipaddress: '', did: Did });
  const ObjLogin = loginRow ? mapRow(loginRow, ps.LOGIN_PROPS) : null;
  if (!ObjLogin) {
    ps.sessionRemove(req, 'Plid');
    throw NRE(); // ((Login)Session["Plid"]).Plid on a null session value
  }
  const token = ps.issueCustomerToken(ObjLogin, req);
  const Plid = req.user.plid;

  const ViewBag = {};
  const kyc = await db.procOne(DB, 'usp_check_kyc', { plid: Plid });
  const result = String(col(kyc, 'strresult') ?? '');
  ViewBag.status = result;
  // eslint-disable-next-line no-unused-vars
  const memdetails = await db.procOne(DB, 'usp_getcontactdetails', { plid: Plid }); // MemberProfile, unused by the redirect
  return res.json({ redirect: '/Home/Index', token });
}));

module.exports = router;
