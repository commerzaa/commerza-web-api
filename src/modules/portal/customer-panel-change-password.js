'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ChangePassword.cs ([CheckResellerTimeout] ChangePasswordController, 2 actions).
// Database: shopping (Db_Shopping). [CheckResellerTimeout] has no body in legacy (no check).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, outOf } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'ChangePassword';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "user/changepassword" is commented out in RouteConfig.cs
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/ChangePassword/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult UpdatePassword(string OldPassword, string NewPassword, string ConfirmPassword)
// auth (Session["Plid"] == null => Json("This page has been expired"))
router.all(`/portal/${C}/UpdatePassword{/:id}`, ...ps.customerOr('This page has been expired'), asyncHandler(async (req, res) => {
  const NewPassword = mvcStr(req, 'NewPassword');
  const ConfirmPassword = mvcStr(req, 'ConfirmPassword');
  let resValue = '';
  const Plid = req.user.plid;
  try {
    const user = await db.queryOne(DB, 'select loginid as "LoginId" from tbl_customerlogin where clid = @Plid limit 1', { Plid });
    if (user !== null) {
      // DBO.USP_CONTACTPASSWORDCHANGE @PLID,@OLDPASS,@NEWPASS,@CONFPASS,@INTRESULT OUT  (@OLDPASS was always "")
      const rows = await db.proc(DB, 'usp_contactpasswordchange', { plid: Plid, oldpass: '', newpass: NewPassword, confpass: ConfirmPassword });
      const v = outOf(rows, 'intresult');
      resValue = v === undefined || v === null ? '' : String(v); // DBNull.ToString() => ""
    } else {
      resValue = '2';
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message;
    resValue = 'error^Some Error Occured.Please Try Again';
  }
  return res.json(resValue);
}));

module.exports = router;
