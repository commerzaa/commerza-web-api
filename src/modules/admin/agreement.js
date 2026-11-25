'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AgreementController.cs (class Agreement_istController => /admin/Agreement_ist/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nint, nstr, outStr, col, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Agreement_ist';

/** class Agreemnt_List */
const AGREEMNT_LIST_PROPS = ['rownumber', 'AGID', 'regno', 'username', 'Name', 'mobileno', 'fathername', 'address', 'packageamount', 'clickamount',
  'senddate', 'selectvalues', 'status'];

// ---------------------------------------------------------------- Index(string UserName, string STATUS, string Mobile, string From, string To, int? page, int? ddlcustpage)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let UserName = nstr(req.p.UserName);
  let STATUS = nstr(req.p.STATUS);
  let Mobile = nstr(req.p.Mobile);
  let From = nstr(req.p.From);
  let To = nstr(req.p.To);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (UserName === null) UserName = '';
  if (Mobile === null) Mobile = '';
  if (From === null) From = '';
  if (To === null) To = '';
  if (STATUS === null) STATUS = '';
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'Usp_AgreementList', {
    UserName, Mode: 1, STARTROWINDEX: page, MAXROWS: ddlcustpage, Status: STATUS.trim(), mobileno: Mobile.trim(), fromDate: From.trim(), toDate: To.trim(),
  });
  const AllEPinRequestsList = mapRows(rows, AGREEMNT_LIST_PROPS);
  const tc = outStr(col(rows[0], 'totalcount'));
  const ViewBag = {
    CurrentPage: page, GridPageSize: ddlcustpage, TotalRecord: parseInt(tc === '' ? '0' : tc, 10), NoPerPage: await UtilityClass.GridNumbersPerPage(),
  };
  return view(res, '~/Views/AdminPanel/Agreement_ist/Index.cshtml', AllEPinRequestsList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult Verify_Agreement(string mode, string AGID, string remark)
// auth (reads Session["Admin_User"] => NullReferenceException without a session)
router.all(`/admin/${C}/Verify_Agreement{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Assignby = req.user.emp_id;
  // DBO.Usp_updatestatus @AGID,@mode,@remark,@StrResult out  -- legacy passed the Emp_ID as @remark (the `remark` argument is ignored)
  const row = await db.procOne(DB, 'Usp_updatestatus', { mode: nstr(req.p.mode), remark: String(Assignby), AGID: nstr(req.p.AGID) });
  return res.json(outStr(col(row, 'strresult')));
}));

module.exports = router;
