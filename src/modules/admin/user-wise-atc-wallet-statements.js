'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWiseATCWalletStatementsController.cs
// (class UserWiseATCWalletStatementsController => /admin/UserWiseATCWalletStatements/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'UserWiseATCWalletStatements';

/** class UserWiseATCWalletStatementsController_Report */
const PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance'];

// ---------------------------------------------------------------- Index(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/member-wise-atc-wallet-statements" -> UserWiseATCWalletStatements/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-wise-atc-wallet-statements{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let Plid = 0;
  let Page = B.nInt(req.p.Page);
  const FromDate = B.s0(req.p.FromDate);
  const ToDate = B.s0(req.p.ToDate);
  const SearchField = B.s0(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  if (SearchValue === null) SearchValue = 'CRBTOP';
  const ViewBag = {};
  try {
    // Select PLID From Portal_login Where UserName='<SearchValue>'  (parameterised) .FirstOrDefault() => 0 when no row
    Plid = Number((await db.scalar(DB, 'select plid from portal_login where username = @SearchValue limit 1', { SearchValue })) || 0);
    const MaxRows = await UtilityClass.GridPageSize();
    if (Page === null) Page = 1;
    // [Usp_TransactionHistory] @PLID,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@StrResult OUT,@TotalCount OUT,@CrDrType,@TrType  (positional)
    const rows = await db.proc(DB, 'Usp_TransactionHistory', {
      PLID: Plid, FROMDATE: FromDate, TODATE: ToDate, STARTROWINDEX: Page, MAXROWS: MaxRows, STRRESULT: '', CRDRTYPE: SearchField, TRTYPE: '0',
    });
    const LiUserWiseATCWalletStatementsController = mapRows(rows, PROPS);
    const TotalRecord = B.outIntOf(rows, 'TotalCount'); // Convert.ToInt32(SpOutputCount.Value.ToString())
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    return viewJson(res, '~/Views/AdminPanel/UserWiseATCWalletStatements/Index.cshtml', LiUserWiseATCWalletStatementsController, ViewBag);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_TransactionHistory');
    ViewBag.ErrorMessage = ExpObj.message;
    return viewJson(res, '~/Views/PageNotFound/Index.cshtml', null, ViewBag);
  }
}));

module.exports = router;
