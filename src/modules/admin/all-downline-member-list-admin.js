'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\All_Downline_Member_List_Admin.cs
// (class All_Downline_Member_List_AdminController => /admin/All_Downline_Member_List_Admin/...)
// Database: affiliate (Db_Affiliate). Table: member_master.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'All_Downline_Member_List_Admin';
const VIEW = '~/Views/AdminPanel/All_Downline_Member_List_Admin/Index.cshtml';

/** nested class AllDownlineMemberLeftRight */
const ADMLR_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'DOC',
  'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'income', 'spounser_userName', 'root_userName', 'KITNAME'];

/** db._Member_Master.Where(a => a.LoginId == Password).FirstOrDefault()
 *  PORT-NOTE: SQL Server compared with a case-insensitive collation ignoring trailing spaces; emulated with lower()/rtrim(). */
const memberByLoginId = (Password) => db.queryOne(DB,
  'select loginid from member_master where lower(rtrim(loginid)) = lower(rtrim(@Password)) limit 1', { Password });

/** decimal.ToString("0.00") on a non-nullable decimal */
const d2 = (v) => B.dec2(v);

/**
 * public void ExportReport(string FileName) - writes ~/AllExcelSheets/<FileName> from ExcelList (not sent to the client).
 * Legacy loop `for (i = 0; i <= Dt.Rows.Count; i++)` always ended with IndexOutOfRangeException (swallowed by the empty catch).
 * PORT-NOTE: the StreamWriter was never closed on that path, so the legacy file could miss its unflushed tail; the content produced
 * before the exception is written here.
 */
function ExportReport(FileName, ExcelList) {
  let out = '';
  let filepath = null;
  try {
    filepath = B.safeMapPath('~/AllExcelSheets/' + (FileName === null || FileName === undefined ? '' : FileName));
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    // DataTable columns: S.No., LoginID, Name, RegistrationDate, ParentID, SponserID, PackageCost, Income, Status (Status never filled => DBNull)
    const Dt = ExcelList.map((items) => [items.rownumber, items.userName, items.Name, items.RegDate, items.root_userName, items.spounser_userName,
      d2(items.kitprice), d2(items.income), null]);
    const ColumnsCount = 9;
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    const HEAD = { 1: 'S.No. \t', 2: 'Login_ID \t', 3: 'Name \t', 4: 'Registration Date \t', 5: 'Parent ID \t', 6: 'Sponser ID \t',
      7: 'Package Cost \t', 8: 'Income \t', 9: 'Status \t' };
    for (let i = 0; i <= ColumnsCount; i++) if (HEAD[i]) out += HEAD[i];
    for (let i = 0; i <= Dt.length; i++) {
      out += '\r\n';
      if (i >= Dt.length) throw new Error(`There is no row at position ${i}.`);
      for (let j = 0; j <= ColumnsCount - 1; j++) {
        const v = Dt[i][j];
        const vals = v === null || v === undefined ? '' : String(v); // DBNull.ToString() == ""
        out += vals.replace(/\t/g, '    ') + ' \t';
      }
    }
  } catch (ex) {
    // empty catch
  }
  if (filepath) {
    try { fs.writeFileSync(filepath, out); } catch (e) { /* legacy: errors swallowed */ }
  }
}

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string side, int? page, string CP1, string CP2, string Password)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/All-Downline-Member-List-Admin" -> All_Downline_Member_List_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/All-Downline-Member-List-Admin'], adminAuth, asyncHandler(async (req, res) => {
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  const side = B.nStr(req.p.side);
  let page = B.nInt(req.p.page);
  const CP1 = B.nStr(req.p.CP1);
  const CP2 = B.nStr(req.p.CP2);
  let Password = B.nStr(req.p.Password);
  let Loginid = '';
  const ViewBag = {};
  const redirectSelf = () => res.json({ redirect: `/${C}/Index` });

  if (B.tdPeek(req, 'tpassvalid') !== null) {
    if (Password === null) {
      const tp = B.tdGet(req, 'Password');
      if (tp === null) throw B.nullRef(); // TempData["Password"].ToString()
      Password = String(tp);
    }
    const ref = req.get('referer') || req.get('referrer');
    let refUrl = null;
    if (ref) { try { refUrl = new URL(ref); } catch (_) { refUrl = null; } }
    if (refUrl === null) {
      B.tdSet(req, 'tpassvalid', null);
      B.tdSet(req, 'Password', '');
      return redirectSelf();
    }
    const segs = refUrl.pathname.split('/');
    const pagename = decodeURIComponent(segs[segs.length - 1] || (refUrl.pathname === '/' ? '/' : '')).toLowerCase().trim();
    if (pagename !== 'all-downline-member-list-admin') {
      B.tdSet(req, 'tpassvalid', null);
      B.tdSet(req, 'Password', '');
      return redirectSelf();
    }
  }

  if (Password !== '' && Password !== null) {
    const row = await memberByLoginId(Password);
    if (row !== null) {
      if (String(row.loginid).toLowerCase().trim() === Password.toLowerCase().trim()) {
        B.tdSet(req, 'tpassvalid', 'valid');
        B.tdSet(req, 'Password', Password);
      } else {
        B.tdSet(req, 'Password', '');
        B.tdSet(req, 'tpassvalid', null);
        ViewBag.msg = 'Invalid User Name';
      }
    } else {
      B.tdSet(req, 'Password', '');
      B.tdSet(req, 'tpassvalid', null);
      ViewBag.msg = 'Invalid User Name';
    }
  } else {
    return res.json({ view: VIEW });
  }

  if (Password !== '' && Password !== null) {
    try {
      let CurrentPage1 = 1; let CurrentPage2 = 1;
      let side1 = '0'; let side2 = '0';
      if (SearchField === '' && SearchValue === '' && side === '') { side1 = '1'; side2 = '2'; }
      if (SearchField !== '' || (SearchValue !== '' && side === null)) { side1 = '1'; side2 = '2'; }
      if (side === '1') {
        CurrentPage2 = B.cvtInt(CP2);
        CurrentPage1 = page === null ? 0 : page; // Convert.ToInt32(int?)
        side1 = '1'; side2 = '3';
      }
      if (side === '2') {
        CurrentPage1 = B.cvtInt(CP1);
        CurrentPage2 = page === null ? 0 : page;
        side1 = '3'; side2 = '2';
      }
      if (side === null) { side1 = '1'; side2 = '2'; }
      if (side === '0') { side1 = '1'; side2 = '2'; }
      if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
      const row = await memberByLoginId(Password);
      if (row !== null) {
        if (row.loginid === null || row.loginid === undefined) throw B.nullRef();
        Loginid = String(row.loginid).trim();
      }
      const MaxRows = await UtilityClass.GridPageSize();
      if (page === null) page = 1;
      const objAll = { LMember: null, RMember: null };
      const call = (s) => db.proc(DB, 'usp_get_Member_DownlineLIst_Side_Wise', {
        LoginID: Loginid, StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), fromDate: '', ToDate: '',
        levenumber: 0, side: B.cvtInt(s),
      });
      const rowsL = await call(side1);
      let LRMember = mapRows(rowsL, ADMLR_PROPS);
      objAll.LMember = LRMember;
      ExportReport('All_Left_DownLine.xls', LRMember);
      const rowsR = await call(side2);
      LRMember = mapRows(rowsR, ADMLR_PROPS);
      objAll.RMember = LRMember;
      ExportReport('All_Right_DownLine.xls', LRMember);

      const LeftTotalRecord = B.intOutStrict(rowsL, 'TotalCount');
      const RightTotalRecord = B.intOutStrict(rowsR, 'TotalCount');
      const LeftTotalBV = B.decOutStrict(rowsL, 'TotalLRBV');
      const RightTotalBV = B.decOutStrict(rowsR, 'TotalLRBV');
      const LeftTotalIncome = B.decOutStrict(rowsL, 'TotalLRincome');
      const RightTotalIncome = B.decOutStrict(rowsR, 'TotalLRincome');

      ViewBag.CurrentPage1 = CurrentPage1;
      ViewBag.CurrentPage2 = CurrentPage2;
      ViewBag.GridPageSize = MaxRows;
      ViewBag.CP1 = CurrentPage1;
      ViewBag.CP2 = CurrentPage2;
      ViewBag.TotallefRecord = LeftTotalRecord;
      ViewBag.TotalrightRecord = RightTotalRecord;
      ViewBag.TotalLeftBV = LeftTotalBV;
      ViewBag.TotalRightBV = RightTotalBV;
      ViewBag.TotalLeftIncome = LeftTotalIncome;
      ViewBag.TotalRightIncome = RightTotalIncome;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
      return res.json({ view: VIEW, Model: objAll, ...ViewBag });
    } catch (ex) {
      // Response.Redirect("~/AdminPanel/All-Downline-Member-List-Admin")
      return res.json({ redirect: 'AdminPanel/All-Downline-Member-List-Admin' });
    }
  }
  return res.json({ view: VIEW, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string FileName)
// auth (PORT-NOTE: legacy had no session check; writes a file on the server => adminAuth). A fresh controller has an empty ExcelList.
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  ExportReport(B.nStr(req.p.FileName), []);
  res.send('');
}));

module.exports = router;
