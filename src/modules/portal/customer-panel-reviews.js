// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\reviews.cs (class reviewsController => /portal/reviews/...)
'use strict';
// Database: shopping (Db_Shopping). [DistributerSessionExpireCheck] has an empty (commented-out) body in legacy: no extra check.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { nullRef, mvcStr, toStr, outOf } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/reviews';

/** class Review */
const REVIEW_PROPS = ['PMID', 'RWID', 'NAME', 'EMAILID', 'REVIEWTITLE', 'REVIEWDESC', 'STARS', 'DATE', 'STATUS', 'ProductImages', 'ProductTitle'];
/** class Myreview */
const MYREVIEW_PROPS = ['PMID', 'RWID', 'REVIEWDESC', 'STARS', 'NAME'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "customer/reviews" -> reviews/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/reviews'], ps.customerAuth, asyncHandler(async (req, res) => {
  const LoginID = req.user.loginid;
  // [USP_GETCUSTOMERREVIEWS] @LOGINID,@MESSAGE out
  const rows = await db.proc(DB, 'usp_getcustomerreviews', { loginid: LoginID });
  const Myreview = mapRows(rows, REVIEW_PROPS);
  const result = toStr(outOf(rows, 'message')); // spOutput.Value.ToString() (DBNull => "")
  const ViewBag = { status: result, LoginID };
  return view(res, '~/Views/UserPanel/reviews/Index.cshtml', Myreview, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult myratings(string id)
// public (no session check in legacy; read-only review detail)
router.all(`${C}/myratings{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const id = mvcStr(req, 'id');
  // Usp_MYREVIEWDETAIL @RWID  (PORT-NOTE: procedure not present in the Db_Shopping schema dump)
  const rows = await db.proc(DB, 'usp_myreviewdetail', { rwid: id });
  return res.json(mapRows(rows, MYREVIEW_PROPS));
}));

// ---------------------------------------------------------------- JsonResult AddComment(string RWID, string StarValue, string title, string description)
// auth: legacy had no session check (anyone could rewrite any review by RWID); protected here because it edits the logged-in
// customer's review (PORTING_GUIDE_MVC lesson 8).
router.all(`${C}/AddComment{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  try {
    let OutputResult = '';
    // USP_UPDATEREVIEW @RWID,@TITLE,@DESCRIPTION,@STARS,@StrOutputResult out  (PORT-NOTE: procedure not present in the schema dump)
    const rows = await db.proc(DB, 'usp_updatereview', {
      rwid: mvcStr(req, 'RWID'), title: mvcStr(req, 'title'), description: mvcStr(req, 'description'), stars: mvcStr(req, 'StarValue'),
    });
    OutputResult = toStr(outOf(rows, 'stroutputresult'));
    return res.json(OutputResult);
  } catch (ex) {
    const result = '';
    return res.json(result);
  }
}));

// ---------------------------------------------------------------- JsonResult Updatesingleproduct(string RWID)
// auth: legacy had no session check (anonymous DELETE of any review); protected here (PORTING_GUIDE_MVC lesson 8).
router.all(`${C}/Updatesingleproduct{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const RWID = mvcStr(req, 'RWID');
  // legacy: "DELETE FROM TBL_REVIEWMASTER where RWID=" + RWID (a missing RWID was a SQL syntax error); bound parameter here
  if (RWID === null || RWID.trim() === '') nullRef();
  await db.exec(DB, 'delete from tbl_reviewmaster where rwid = @RWID', { RWID: RWID.trim() });
  return res.json('ok');
}));

module.exports = router;
