'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_To_Member_ATC_Fund_Transfer_RequestController.cs
// (class Member_To_Member_ATC_Fund_Transfer_RequestController => /Member_To_Member_ATC_Fund_Transfer_Request/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, nStr, s0, outIntOf, outOf, tab, cellStr, dec2, col } = require('./_shared/batch10_common');
const { writeXlsFile } = require('./_shared/batch10A_common');

const router = express.Router();
const C = 'Member_To_Member_ATC_Fund_Transfer_Request';

/** class Member_Atc_Fund_Transfer_Request */
const PROPS = ['ROWNUMBER', 'TRMAFTID', 'TransferedBy', 'TransferedFor', 'Transfer_Date', 'Amount', 'Remark', 'Type', 'Status', 'AdminRemark',
  'AdminUserName', 'ActivityByAdminDateTime'];

// [Usp_ApproveTransferFundApprovalByAdmin] @Mode,@TRMAFTID,@Status,@Remark,@FromDate,@ToDate,@SearchType,@SearchValue,@StartRowIndex,@MaxRows,
//   @TotalCount Out,@ActivityByAdminUserId,@StrResult Out
const callProc = (p) => db.proc(DB, 'Usp_ApproveTransferFundApprovalByAdmin', p);

// ---------------------------------------------------------------- Index(int? Page, string fromDate, string toDate, string SearchField, string SearchValue)
// auth (PORT-NOTE: legacy Index had NO session check; admin-only data => adminAuth added)
// route-config: "AdminPanel/member-to-member-atc-fund-transfer-request" -> Member_To_Member_ATC_Fund_Transfer_Request/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/member-to-member-atc-fund-transfer-request'], adminAuth,
  asyncHandler(async (req, res) => {
    const fromDate = s0(req.p.fromDate);
    const toDate = s0(req.p.toDate);
    const SearchField = s0(req.p.SearchField);
    const SearchValue = s0(req.p.SearchValue);
    try {
      const MaxRows = await UtilityClass.GridPageSize();
      let Page = nInt(req.p.Page); if (Page === null) Page = 1;
      const rows = await callProc({
        Mode: '1', TRMAFTID: '0', Status: '0', Remark: '', FromDate: fromDate, ToDate: toDate, SearchType: SearchField, SearchValue,
        StartRowIndex: Page, MaxRows, ActivityByAdminUserId: '0',
      });
      const list = mapRows(rows, PROPS);
      const TotalRecord = outIntOf(rows, 'totalcount');
      const ViewBag = {
        CurrentPage: Page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), toDate, fromDate, SearchField,
        SearchValue,
      };
      await UtilityClass.GridNumbersPerPage(); // Int32 Noofpage (unused)
      return res.json({ view: '~/Views/AdminPanel/Member_To_Member_ATC_Fund_Transfer_Request/Index.cshtml', Model: list, ...ViewBag });
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'Usp_ApproveTransferFundApprovalByAdmin');
      return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ErrorMessage: ExpObj.message });
    }
  }));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string fromDate, string toDate, string SearchField, string SearchValue)
// auth (PORT-NOTE: legacy had no session check; admin-only export => adminAuth added)
// PORT-NOTE: legacy only wrote ~/AllExcelSheets/Member_to_member_coin_fund_transfer_request.xls (the Response.Redirect is commented out); response is empty.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const fromDate = nStr(req.p.fromDate);
  const toDate = nStr(req.p.toDate);
  const SearchField = nStr(req.p.SearchField);
  const SearchValue = nStr(req.p.SearchValue);
  await UtilityClass.GridPageSize(); // int MaxRows (unused; @MaxRows = "100000000")
  let Page = nInt(req.p.Page); if (Page === null) Page = 1;
  const rows = await callProc({
    Mode: '1', TRMAFTID: '0', Status: '0', Remark: '', FromDate: fromDate, ToDate: toDate, SearchType: SearchField, SearchValue,
    StartRowIndex: Page, MaxRows: '100000000', ActivityByAdminUserId: '0',
  });
  const list = mapRows(rows, PROPS);
  const ViewBag = {};
  try {
    ViewBag.filepath = require('./_shared/batch10_common').mapPath('~/AllExcelSheets/Member_to_member_coin_fund_transfer_request.xls');
    await writeXlsFile({
      req, file: '~/AllExcelSheets/Member_to_member_coin_fund_transfer_request.xls',
      rawHeaders: 'S.No. \tTransferedBy \tTransferedFor \tTransfer_Date \tAmount\tType \tStatus \tAdminUserName \tActivityByAdminDateTime \tAction \t',
      rows: list, innerProc: 'Member_Atc_Fund_Transfer_Request',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'TransferedBy')) + ' \t');
        w(tab(cellStr(item, 'TransferedFor')) + ' \t');
        w(tab(cellStr(item, 'Transfer_Date')) + ' \t');
        w(tab(dec2(col(item, 'Amount'))) + ' \t');
        w(tab(cellStr(item, 'Type')) + ' \t');
        w(tab(cellStr(item, 'Status')) + ' \t');
        w(tab(cellStr(item, 'AdminUserName')) + ' \t');
        w(tab(cellStr(item, 'ActivityByAdminDateTime')) + ' \t');
        w(tab(cellStr(item, 'TRMAFTID')) + ' \t');
      },
    });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_ApproveTransferFundApprovalByAdmin');
    ViewBag.filepath = ExpObj.message;
  }
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult UpdateStatus(string TRMAFTID, string Status, string Remarks)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  try {
    const Emp_ID = req.user.emp_id;
    const rows = await callProc({
      Mode: '2', TRMAFTID: nStr(req.p.TRMAFTID), Status: nStr(req.p.Status), Remark: nStr(req.p.Remarks), FromDate: '', ToDate: '', SearchType: '',
      SearchValue: '', StartRowIndex: '1', MaxRows: '100', ActivityByAdminUserId: Emp_ID,
    });
    const ReturnValue = outOf(rows, 'strresult');
    return res.json(ReturnValue);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_ApproveTransferFundApprovalByAdmin');
    return res.json('error^Some Error Occured Please Try Again Sorry !!! ' + ExpObj.message);
  }
}));

module.exports = router;
