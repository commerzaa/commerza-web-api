'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Transfer_Btc_In_Member_Wallet.cs
// (class Transfer_Btc_In_Member_WalletController => /admin/Transfer_Btc_In_Member_Wallet/...)
// Database: affiliate (Db_Affiliate).
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const BitCoinCoreDaemon = require('../../lib/admin/BitCoinCoreDaemon');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { supplied, outIntStrict, tsvFile } = require('./_shared/batch13-09-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Transfer_Btc_In_Member_Wallet';
const PROC = 'USP_Transfer_Btc_In_Member_Wallet_BY_Admin';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** class Transfer_Btc_In_Member_WalletProperty */
const PROPS = ['ROWNUMBER', 'ToUserName', 'Amount', 'Transfer_Date', 'Remark', 'Type', 'Emp_Name'];

const trimNN = (v) => { if (v === null || v === undefined) throw B.nullRef(); return String(v).trim(); };

/** public void ExportReport(int? Page, string Username, string Fromdate, string Todate) */
async function ExportReport(req, res, ViewBag, Page, Username, Fromdate, Todate) {
  const MaxRows = await UtilityClass.GridPageSize();
  const Obj = mapRows(await db.proc(DB, PROC, supplied({
    USERNAME: Username, BTC: 0, ActivityByAdminUserId: 0, Remark: '', MODE: 2, FROMDATE: Fromdate, TODATE: Todate,
    STARTROWINDEX: Page, MAXROWS: MaxRows,
  })), PROPS);
  if (Obj.length > 0) {
    // ~/Transfer_Btc_In_Member_Wallet.xls (site root, not AllExcelSheets); per-row catch without ErrorInsert; outer catch without ErrorInsert
    return tsvFile({
      req, res, ViewBag, filepath: path.join(config.uploadDir, 'Transfer_Btc_In_Member_Wallet.xls'),
      header: 'S.No. \tTransfer Date \tUser Name \tAmount \tType \tRemark \tActivity By User \t',
      rows: Obj,
      innerProc: null,
      outerProc: null,
      download: 'Transfer_Btc_In_Member_Wallet.xls',
      cells: (item, w) => {
        w('\r\n'); // wr.WriteLine()
        w(String(item.ROWNUMBER) + ' \t');
        w(trimNN(item.Transfer_Date) + ' \t');
        w(trimNN(item.ToUserName) + ' \t');
        // PORT-NOTE: decimal.ToString() kept the SQL scale (e.g. 1.50000000); the JS number string is written.
        w(String(item.Amount) + ' \t');
        w(trimNN(item.Type) + ' \t');
        w(trimNN(item.Remark) + ' \t');
        w(trimNN(item.Emp_Name) + ' \t');
      },
    });
  }
  return { sent: false };
}

/** #region For Auto Approval Of BTC Node Deposit (background thread started before the session check) */
function autoApproval(req, res, next) {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  Promise.resolve().then(() => BitCoinCoreDaemon.PaymentAutoClearificationBTCNode(0))
    .catch((e) => console.error('[admin] PaymentAutoClearificationBTCNode failed:', e.message));
  next();
}

// ---------------------------------------------------------------- ActionResult Index(int? Page, string Fromdate, string Todate, string OrderBy, string Username, string Mobile, string Minamount, string Maxamount, string Mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"); the BTC auto-approval thread starts before that check)
// route-config: "AdminPanel/manage-btc-wallet" -> Transfer_Btc_In_Member_Wallet/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/manage-btc-wallet'], autoApproval, adminAuth, asyncHandler(async (req, res) => {
  const v = (n) => B.nStr(req.p[n]);
  let OrderBy = v('OrderBy'); let Mobile = v('Mobile'); let Mode = v('Mode'); let Maxamount = v('Maxamount'); let Minamount = v('Minamount');
  let Fromdate = v('Fromdate'); let Todate = v('Todate'); let Username = v('Username');
  let Page = B.nInt(req.p.Page);
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
  const ViewBag = {};
  const MaxRows = await UtilityClass.GridPageSize();
  if (Page === null) Page = 1;
  const Empid = req.user.emp_id;
  Object.assign(ViewBag, await B.perms(Empid, url));
  const rows = await db.proc(DB, PROC, {
    USERNAME: Username, BTC: 0, ActivityByAdminUserId: 0, Remark: '', MODE: 2, FROMDATE: ' ', TODATE: ' ', STARTROWINDEX: Page, MAXROWS: MaxRows,
  });
  const Obj = mapRows(rows, PROPS);
  const TotalRecord = outIntStrict(rows, 'totalcount');
  ViewBag.CurrentPage = Page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.OrderBy = OrderBy;
  ViewBag.Username = Username;
  ViewBag.Mobile = Mobile;
  ViewBag.Minamount = Minamount === '0' ? '' : Minamount;
  ViewBag.Maxamount = Maxamount === '0' ? '' : Maxamount;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = Fromdate;
  ViewBag.toDate = Todate;
  if (Mode !== '') {
    const r = await ExportReport(req, res, ViewBag, Page, Username, Fromdate, Todate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Transfer_Btc_In_Member_Wallet/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(int? Page, string Username, string Fromdate, string Todate)
// auth (public method => routable in legacy; no session check; exports the admin BTC transfer list => protected)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nInt(req.p.Page), B.nStr(req.p.Username), B.nStr(req.p.Fromdate), B.nStr(req.p.Todate));
  if (!r.sent) res.send('');
}));

/** shared body of AddFunds (MODE 1) / DeductFunds (MODE 3); `nested` = AddFunds' extra Get_Security_Key call */
function fundsAction(MODE, nested) {
  return asyncHandler(async (req, res) => {
    const Username = B.nStr(req.p.Username);
    const Amount = B.reqDec(req.p.Amount, 'Amount');
    const Remark = B.nStr(req.p.Remark);
    const GAKEY = B.nStr(req.p.GAKEY);
    const EmpId = req.user.emp_id;
    let ret = '';
    let IsGoogleAuthenticated = '';
    // PORT-NOTE: MVC binds "" as null, so (as in legacy) the `== ""` checks rarely fire.
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
      if (objs && nested) objs = await objs.Get_Security_Key(EmpId);
      if (objs) {
        const ValidRandomNo = await objs.Get_GA_Key(EmpId);
        if (!(await objs.Check_GaKeyForEnableTime(EmpId, ValidRandomNo, GAKEY))) {
          if (GAKEY !== '') return res.json('Error^Invalid GA Key. Please enter a valid GA Key.');
        }
      }
    }
    // [USP_Transfer_Btc_In_Member_Wallet_BY_Admin] @USERNAME,@ATC,... : @ATC is passed positionally into @BTC
    const row = await db.procOne(DB, PROC, supplied({
      USERNAME: Username, BTC: Amount, ActivityByAdminUserId: EmpId, Remark, MODE, FROMDATE: '', TODATE: '', STARTROWINDEX: 1, MAXROWS: 100,
    }));
    ret = B.outStr(row, 'strresult');
    return res.json(ret);
  });
}

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, string Remark, string GAKEY)
// auth (Session["Admin_User"] == null => Response.Redirect("/"))
router.all(`/admin/${C}/AddFunds{/:id}`, adminAuth, fundsAction(1, true));

// ---------------------------------------------------------------- JsonResult DeductFunds(string Username, decimal Amount, string Remark, string GAKEY)
// auth (Session["Admin_User"] == null => Response.Redirect("/"))
router.all(`/admin/${C}/DeductFunds{/:id}`, adminAuth, fundsAction(3, false));

module.exports = router;
