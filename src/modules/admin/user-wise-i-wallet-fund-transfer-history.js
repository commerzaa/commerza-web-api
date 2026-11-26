'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UserWiseIWalletFundTransferHistoryController.cs
// (class UserWiseIWalletFundTransferHistoryController => /admin/UserWiseIWalletFundTransferHistory/...)
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
const C = 'UserWiseIWalletFundTransferHistory';

/** class UserWiseIWalletFundTransferHistoryController_Report */
const PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount', 'Date', 'Remark', 'Type',
  'CreditType'];

// ---------------------------------------------------------------- Index(int? Page, string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (legacy had no session check; admin data => adminAuth)
// route-config: "AdminPanel/member-wise-inr-fund-history" -> UserWiseIWalletFundTransferHistory/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-wise-inr-fund-history{/:id}'], adminAuth, asyncHandler(async (req, res) => {
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
    // [Usp_TransferFundToUser] @Mode,@TMFTHID,@PLID,@ToPlid,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,
    //   @MaxRows,'',@TYPEOFCRDR   (positional: 13th = @SearchUsername '', 14th = @Typeofcrdr)
    // PORT-NOTE: @Typeofcrdr is BIGINT; SQL Server converted '' implicitly to 0 - reproduced ('' => 0).
    const rows = await db.proc(DB, 'Usp_TransferFundToUser', {
      Mode: '5', TMFTHID: '0', PLID: Plid, ToPlid: '0', Amount: '0', Remark: '', StrResult: '', FromDate, ToDate, StartRowIndex: Page,
      MaxRows, SearchUsername: '', Typeofcrdr: SearchField.trim() === '' ? 0 : SearchField,
    });
    const LiUserWiseIWalletFundTransferHistoryController_Report = mapRows(rows, PROPS);
    const TotalRecord = B.outIntOf(rows, 'TotalCount'); // Convert.ToInt32(SpOutputCount.Value.ToString())
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    return viewJson(res, '~/Views/AdminPanel/UserWiseIWalletFundTransferHistory/Index.cshtml', LiUserWiseIWalletFundTransferHistoryController_Report, ViewBag);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_TransferFundToUser');
    ViewBag.ErrorMessage = ExpObj.message;
    return viewJson(res, '~/Views/PageNotFound/Index.cshtml', null, ViewBag);
  }
}));

module.exports = router;
