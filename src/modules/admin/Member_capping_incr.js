'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_capping_incr.cs (class Member_capping_incrController => /Member_capping_incr/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_MmemberCapping_history, Usp_UpdateMember_capping.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/adminSession');
const { DB, nStr, reqDec, outStr, errorView } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Member_capping_incr';

/** class membercapping */
const PROPS = ['Row', 'UserName', 'oldCapping', 'NewCapping', 'Date'];

// ---------------------------------------------------------------- [SessionExpireCheck] Index()
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Member-Capping-Increase" -> Member_capping_incr/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-Capping-Increase'], adminAuth, asyncHandler(async (req, res) => {
  try {
    const Withdrwal = mapRows(await db.proc(DB, 'Usp_MmemberCapping_history', { UserName: '' }), PROPS);
    return res.json({ view: '~/Views/AdminPanel/Member_capping_incr/Index.cshtml', Model: Withdrwal });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'Index');
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberCapping(string UserName, decimal NewCappingLimit)
// auth (reads Session["Admin_User"].Emp_ID => NullReferenceException without a session)
router.all(`/admin/${C}/UpdateMemberCapping{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const NewCappingLimit = reqDec(req.p.NewCappingLimit, 'NewCappingLimit');
  const userid = req.user.emp_id; void userid;
  // [Usp_UpdateMember_capping] @Username,@cappingLimit,@StrResult OUT
  const row = await db.procOne(DB, 'Usp_UpdateMember_capping', { Username: nStr(req.p.UserName), cappingLimit: NewCappingLimit });
  return res.json(outStr(row, 'strresult'));
}));

module.exports = router;
