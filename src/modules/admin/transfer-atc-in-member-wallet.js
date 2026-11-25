'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Transfer_Atc_In_Member_Wallet.cs
// (class Transfer_Atc_In_Member_WalletController => /admin/Transfer_Atc_In_Member_Wallet/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, outIntStrict, tsvFile, XLS_DIR } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Transfer_Atc_In_Member_Wallet';
const PROC = 'USP_Transfer_Atc_In_Member_Wallet_BY_Admin';

/** class Transfer_Atc_In_Member_WalletProperty */
const PROPS = ['ROWNUMBER', 'ToUserName', 'Amount', 'Transfer_Date', 'Remark', 'Type', 'Emp_Name'];

/** shared null/"" defaulting of Index / ExportReport */
function defaults(req) {
  const v = (n) => B.nStr(req.p[n]);
  let OrderBy = v('OrderBy'); let Mobile = v('Mobile'); let Mode = v('Mode'); let Maxamount = v('Maxamount'); let Minamount = v('Minamount');
  let Fromdate = v('Fromdate'); let Todate = v('Todate'); let Username = v('Username');
  if (OrderBy === null) OrderBy = '';
  if (Mobile === null) Mobile = '';
  if (Mode === null) Mode = '';
  if (Maxamount === null) Maxamount = '0';
  if (Maxamount === '') Maxamount = '0';
  if (Minamount === '') Minamount = '0';
  if (Minamount === null) Minamount = '0';
  if (Fromdate === null) Fromdate = '';
  if (Todate === null) Todate = '';
  if (Username === null) Username = '';
  return { Page: B.nInt(req.p.Page), OrderBy, Mobile, Mode, Maxamount, Minamount, Fromdate, Todate, Username };
}

// ---------------------------------------------------------------- ActionResult Index(int? Page, string Fromdate, string Todate, string OrderBy, string Username, string Mobile, string Minamount, string Maxamount, string Mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/transfer-fund-member" -> Transfer_Atc_In_Member_Wallet/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/transfer-fund-member'], adminAuth, asyncHandler(async (req, res) => {
  const d = defaults(req);
  let { Page } = d;
  const ViewBag = {};
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const rows = await db.proc(DB, PROC, {
    USERNAME: d.Username, ATC: 0, ActivityByAdminUserId: 0, Remark: '', MODE: 2, FROMDATE: d.Fromdate, TODATE: d.Todate,
    STARTROWINDEX: Page, MAXROWS: MaxRows,
  });
  const Obj = mapRows(rows, PROPS);
  const TotalRecord = outIntStrict(rows, 'totalcount'); // int.Parse(TotalCount.Value.ToString())
  ViewBag.CurrentPage = Page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.OrderBy = d.OrderBy;
  ViewBag.Username = d.Username;
  ViewBag.Mobile = d.Mobile;
  ViewBag.Minamount = d.Minamount === '0' ? '' : d.Minamount;
  ViewBag.Maxamount = d.Maxamount === '0' ? '' : d.Maxamount;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = d.Fromdate;
  ViewBag.toDate = d.Todate;
  // ExportReport(...) commented out in legacy
  return res.json({ view: '~/Views/AdminPanel/Transfer_Atc_In_Member_Wallet/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string Fromdate, string Todate, string OrderBy, string Username, string Mobile, string Minamount, string Maxamount, string Mode)
// auth (public method => routable in legacy; no session check; writes the admin transfer list to a server file => protected)
// Legacy only wrote ~/AllExcelSheets/Transfer_Atc_In_Member_Wallet.xls (Response.Redirect commented out) => empty response.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const d = defaults(req);
  const MaxRows = await UtilityClass.GridPageSize(); // unused (call passes "1000000")
  void MaxRows;
  let { Page } = d;
  if (Page === null) Page = 1;
  const Obj = mapRows(await db.proc(DB, PROC, supplied({
    USERNAME: d.Username, ATC: 0, ActivityByAdminUserId: 0, Remark: '', MODE: 2, FROMDATE: d.Fromdate, TODATE: d.Todate,
    STARTROWINDEX: Page, MAXROWS: '1000000',
  })), PROPS);
  await tsvFile({
    req, res, ViewBag: {}, filepath: path.join(XLS_DIR(), 'Transfer_Atc_In_Member_Wallet.xls'),
    header: 'S.No. \tTransfer Date \tUser Name \tAmount \tType \tRemark \tActivity By User \t',
    rows: Obj,
    innerProc: 'Transfer_Atc_In_Member_WalletProperty',
    outerProc: 'USP_Transfer_Atc_In_Member_Wallet_BY_Admin',
    download: null,
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
      w(B.tab(B.cellStr(item, 'Transfer_Date')) + ' \t');
      w(B.tab(B.cellStr(item, 'ToUserName')) + ' \t');
      w(B.tab(B.dec2(item.Amount)) + ' \t');
      w(B.tab(B.cellStr(item, 'Type')) + ' \t');
      w(B.tab(B.cellStr(item, 'Remark')) + ' \t');
      w(B.tab(B.cellStr(item, 'Emp_Name')) + ' \t');
    },
  });
  return res.send(''); // void action
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, string Remark, string GAKEY)
// auth (Session["Admin_User"] == null => Response.Redirect("/"))
router.all(`/admin/${C}/AddFunds{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Username = B.nStr(req.p.Username);
  const Amount = B.reqDec(req.p.Amount, 'Amount');
  const Remark = B.nStr(req.p.Remark);
  const GAKEY = B.nStr(req.p.GAKEY);
  const EmpId = req.user.emp_id;
  let ret = '';
  let IsGoogleAuthenticated = '';
  // PORT-NOTE: MVC binds "" as null, so (as in legacy) the `== ""` checks below only fire for an explicit empty value that survived binding.
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  // Authencation For Google Starts Here
  const gaObj = await new Admin_Security_Key().Get_Security_Key(EmpId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return res.json('Error^Enter your GA Key.');
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    let objs = await new Admin_Security_Key().Get_Security_Key(EmpId);
    if (objs) {
      objs = await objs.Get_Security_Key(EmpId);
      if (objs) {
        const ValidRandomNo = await objs.Get_GA_Key(EmpId);
        if (!(await objs.Check_GaKeyForEnableTime(EmpId, ValidRandomNo, GAKEY))) {
          if (GAKEY !== '') return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
        }
      }
    }
  }
  // ExecuteSqlCommand(TransactionalBehavior.DoNotEnsureTransaction, ...) @MODE = 1
  const row = await db.procOne(DB, PROC, supplied({
    USERNAME: Username, ATC: Amount, ActivityByAdminUserId: EmpId, Remark, MODE: 1, FROMDATE: '', TODATE: '', STARTROWINDEX: 1, MAXROWS: 100,
  }));
  ret = B.outStr(row, 'strresult');
  return res.json(ret);
}));

module.exports = router;
