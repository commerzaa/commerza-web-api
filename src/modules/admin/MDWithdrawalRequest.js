'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MDWithdrawalRequest.cs (class MDWithdrawalRequestController => /MDWithdrawalRequest/...)
// Database: affiliate (Db_Affiliate). Procs: USP_MDREQUESTEDWITHDRAWALLIST, USP_UPDATEMDWITHDRAWALSTATUS.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, nStr, s0, outStr, outOf, cvtIntStrict } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'MDWithdrawalRequest';

/** class MDWithdrawalRequest */
const PROPS = ['RowNumber', 'WithdrawalDateTime', 'WithdrawalInCurrency', 'WithdrawalAmount', 'AccountHolderName', 'AccountNumber', 'BankName',
  'IfscOrSwiftCode', 'WithdrawalRate', 'ApprovalStatus', 'AdminActivityDateTime', 'AdminRemarks', 'TransactionId', 'FlagUrl', 'CurrencySymbol', 'TDMID',
  'TMDWRID', 'MDID', 'ACTIVITYBYADMINYUSER'];

// ---------------------------------------------------------------- Index(int? page, string searchvalue, string fromDate, string toDate, string wfromDate, string wtoDate,
//   string RequestType, string username, int? ddlcustpage)
// auth (PORT-NOTE: legacy had no session check on this admin withdrawal list - protected)
// route-config: "AdminPanel/cppointrequest" -> MDWithdrawalRequest/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/cppointrequest'], adminAuth, asyncHandler(async (req, res) => {
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  const fromDate = s0(req.p.fromDate);
  const searchvalue = s0(req.p.searchvalue);
  const toDate = s0(req.p.toDate);
  const RequestType = s0(req.p.RequestType);
  const username = s0(req.p.username); void username;
  let page = nInt(req.p.page);
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    // [USP_MDREQUESTEDWITHDRAWALLIST] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@STATUS,@FROMDATE,@TODATE,@TOTALCOUNT OUT,@TDMID
    const rows = await db.proc(DB, 'USP_MDREQUESTEDWITHDRAWALLIST', {
      STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: searchvalue.trim(), STATUS: RequestType, FROMDATE: fromDate, TODATE: toDate,
      TDMID: '0',
    });
    const list = mapRows(rows, PROPS);
    const ViewBag = { fromDate, toDate, searchvalue, RequestType };
    const tc = outOf(rows, 'totalcount');
    const TotalRecord = cvtIntStrict(tc === '' && rows.length === 0 ? '0' : tc); // PORT-NOTE: no row => OUT value unavailable => 0
    Object.assign(ViewBag, { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), ddlcustpage });
    return res.json({ view: '~/Views/AdminPanel/MDWithdrawalRequest/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ redirect: '/page-not-found' }); // Response.Redirect("/page-not-found") (ends the request)
  }
}));

// ---------------------------------------------------------------- JsonResult ChangeWithdrawalStatus(string Status, string Remark, string TMDWRID)
// auth (reads Session["Admin_User"] => NullReferenceException without a session)
router.all(`/admin/${C}/ChangeWithdrawalStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (v) => (v === null || v === undefined ? '' : String(v));
  const EmpUserName = s(req.user.emp_loginid) + '(' + s(req.user.emp_code) + ')';
  // [DBO].[USP_UPDATEMDWITHDRAWALSTATUS] @Status,@Remark,@TMDWRID,@EmpUserName,@STRRESULT OUT,@TRANSACTIONID OUT
  const row = await db.procOne(DB, 'USP_UPDATEMDWITHDRAWALSTATUS', {
    Status: nStr(req.p.Status), Remark: nStr(req.p.Remark), TMDWRID: nStr(req.p.TMDWRID), EmpUserName,
  });
  return res.json(outStr(row, 'strresult'));
}));

module.exports = router;
