// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PostShareManagement.cs (class PostShareManagementController => /portal/PostShareManagement/...)
'use strict';
// Database: shopping (Db_Shopping).
// PORT-NOTE: Usp_ClickManagements in the Db_Shopping schema dump has no Mode 5 / Mode 6 branch and a different positional parameter
//   order (Mode, Plid, MemberPLID, TATBID, StrResult OUT, StartRowIndex, MaxRows, TotalCount OUT); the live database evidently had a
//   newer version. The calls use named notation with the legacy SqlParameter names; the two positional literals of the Mode 5 call
//   (0, '') are passed as memberplid = 0 and tatbid = 0 ('' converted to int by T-SQL).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { mvcStr, toStr, outOf } = require('./_shared/batch-03-common');
const { view } = require('./_shared/batch-06-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/PostShareManagement';

/** class PostShareLinks */
const POSTSHARELINKS_PROPS = ['RowNumber', 'URL', 'TATBID', 'AddedDate', 'Button', 'PLID', 'ShareButton', 'ShareTypeID'];

// ---------------------------------------------------------------- ActionResult Index(string Date, string PendingStatus, string Sharetype)
// auth (legacy cast (Login)Session["Plid"] without a null check)
// route-config: "referral/post-share" -> PostShareManagement/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/post-share'], ps.customerAuth, asyncHandler(async (req, res) => {
  let Date_ = mvcStr(req, 'Date'); let PendingStatus = mvcStr(req, 'PendingStatus'); let Sharetype = mvcStr(req, 'Sharetype');
  if (Date_ === null) Date_ = '';
  if (PendingStatus === null) {
    PendingStatus = '2';
  } else {
    if (PendingStatus === 'Pending') PendingStatus = '0';
    if (PendingStatus === 'Shared') PendingStatus = '1';
  }
  if (Sharetype === null) Sharetype = '0';
  // [DBO].[Usp_ClickManagements] @Mode,@Plid,0,'',@Date,@IsPendingOrShared,@SharedTypeId
  const rows = await db.proc(DB, 'usp_clickmanagements', {
    mode: '5', plid: Number(req.user.plid), memberplid: 0, tatbid: 0, date: Date_, ispendingorshared: PendingStatus, sharedtypeid: Sharetype,
  });
  const LiPostShareLinks = mapRows(rows, POSTSHARELINKS_PROPS);
  return view(res, '~/Views/CustomerPanel/PostShareManagement/Index.cshtml', LiPostShareLinks);
}));

// ---------------------------------------------------------------- JsonResult ManageHistoryOfSessionForEachUser(string PLID, string TATBID)
// auth: legacy had no session check (records a share/click for any PLID); protected here (PORTING_GUIDE_MVC lesson 8). The PLID
// request parameter is still used as legacy did.
router.all(`${C}/ManageHistoryOfSessionForEachUser{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let ReturnOutPut = '';
  // [DBO].[Usp_ClickManagements] @Mode,@PLID,@TATBID,@StrResult Out
  const rows = await db.proc(DB, 'usp_clickmanagements', { mode: '6', plid: mvcStr(req, 'PLID'), tatbid: mvcStr(req, 'TATBID') });
  ReturnOutPut = toStr(outOf(rows, 'strresult'));
  return res.json(ReturnOutPut);
}));

module.exports = router;
