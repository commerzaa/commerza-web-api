// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ReferralDashBoard.cs (ReferralDashBoardController => /portal/ReferralDashBoard/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const Member_Master = require('../../lib/portal/Member_Master');
const ps = require('./_shared/portal-session');
const { DB, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/ReferralDashBoard';
/** class Visitor_Statics */
const VISITOR_STATICS = ['SRNO', 'DATE', 'REGISTER_USER', 'ACTIVE_USER', 'REFERRAL_USER', 'DateWithMonth'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/dashBoard -> ReferralDashBoard/Index
router.all([`${P}/Index{/:id}`, P, '/portal/referral/dashBoard'], ps.customerAuth, asyncHandler(async (req, res) => {
  const FavoriteURL = ps.sessionGet(req, 'FavoriteURL');
  if (FavoriteURL !== null && FavoriteURL !== undefined) {
    // Response.Redirect(url) ends the response (ThreadAbortException)
    return res.json({ redirect: String(FavoriteURL) });
  }
  const bag = {};
  const ServerTime = await UtilityClass.GetDatabaseDate();
  bag.ServerTime = ServerTime;
  const Plid = Number(req.user.plid);
  // db._Refferal_Member_Performance ([Table("DBO.MEMBER_PERFORMANCE")]).Where(a => a.REGNO == Plid).FirstOrDefault()
  const row = await db.queryOne(DB, 'SELECT totalincome FROM member_performance WHERE regno = @Plid LIMIT 1', { Plid });
  if (row != null) {
    bag.TotalIncome = Number(row.totalincome || 0).toFixed(2); // TOTALINCOME.ToString("0.00")
  }
  // PORT-NOTE: CAST(decimal AS BigInt) truncates in SQL Server; trunc() keeps that (a PG ::bigint cast would round).
  const wp = await db.queryOne(DB, `SELECT CAST(CAST(trunc(coalesce(MAX(totalavailableamount), 0)) AS bigint) AS varchar(10)) AS totalavailableamount
    FROM tbl_membertaskincome WHERE plid = @Plid`, { Plid });
  const WalletPoints = wp ? wp.totalavailableamount : null;
  bag.WalletPoint = WalletPoints;
  let loginid = ''; // eslint-disable-line no-unused-vars
  const row1 = await db.queryOne(DB, 'SELECT username FROM member_master WHERE plid = @Plid LIMIT 1', { Plid });
  if (row1 != null) {
    loginid = row1.username;
  }
  const LeftTotalRecord = 0;
  const RightTotalRecord = 0;
  bag.TotalLefRecord = LeftTotalRecord;
  bag.TotalRightRecord = RightTotalRecord;
  bag.TotalMember = LeftTotalRecord + RightTotalRecord;
  bag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  return view(res, '~/Views/CustomerPanel/ReferralDashBoard/Index.cshtml', undefined, bag);
}));

// ---------------------------------------------------------------- DefaultSponserSide(string side) : JsonResult
// public (legacy handled a null session: Regno = 0 / plid = 0 and both UPDATEs still ran)
router.all(`${P}/DefaultSponserSide{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const side = req.p.side === undefined || req.p.side === '' ? null : req.p.side;
  let Regno = 0; let plid = 0;
  const LoginDetails = ps.getCustomerLogin(req);
  if (LoginDetails != null) {
    plid = Number(LoginDetails.Plid);
    const member_details = await new Member_Master().Get_member_details(LoginDetails.Plid);
    if (member_details != null) {
      Regno = Number(member_details.REGNO);
    }
  }
  // PORT-NOTE: legacy concatenated `side` into the SQL text ("... set DefaultSponserSide=" + side). Now a bound parameter;
  // a missing/empty side was a SQL syntax error (HTTP 500) and still is.
  if (side === null) throw new Error("Incorrect syntax near the keyword 'where'.");
  let Ret = await db.exec(DB, 'UPDATE member_master SET defaultsponserside = trunc(CAST(@side AS numeric))::int WHERE regno = @Regno', { side: String(side), Regno });
  Ret = await db.exec(DB, 'UPDATE portal_login SET communityside = trunc(CAST(@side AS numeric))::int WHERE plid = @plid', { side: String(side), plid });
  res.json(Ret);
}));

// ---------------------------------------------------------------- Visitor_statatics_data() : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all(`${P}/Visitor_statatics_data{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const Plidd = Number(req.user.plid);
  const VisitorStatics = mapRows(await db.proc(DB, 'usp_visitor_statics', { PLID: Plidd }), VISITOR_STATICS);
  res.json(VisitorStatics);
}));

module.exports = router;
