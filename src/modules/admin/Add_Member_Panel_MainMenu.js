'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_Member_Panel_MainMenu.cs (class Add_Member_Panel_MainMenuController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Add_Member_Panel_MainMenu';

/** class MainMenu */
const MAINMENU_PROPS = ['MID', 'TITLE', 'DISPLAYORDER', 'HERF', 'STATUS', 'ACTUALTITLE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// usp_Add_Member_Panel_Main_Menu @STARTROWINDEX,@MAXROWS,@MAINTITLE,@URL,@DISPLAYORDER,@STATUS,@AICLASS,@BCLASS,@MODE,@MID,@INTRESULT OUT,@INTCOUNT OUT
const addMainMenu = (p) => db.proc(DB, 'usp_Add_Member_Panel_Main_Menu', {
  STARTROWINDEX: p.STARTROWINDEX, MAXROWS: p.MAXROWS, MAINTITLE: p.MAINTITLE, URL: p.URL, DISPLAYORDER: p.DISPLAYORDER, STATUS: p.STATUS,
  AICLASS: '', BCLASS: '', MODE: p.MODE, MID: p.MID,
});

// public void ExportReport(int? DisplayOrder, int? status, int? mode)
async function ExportReport(req, res, DisplayOrder, status, mode, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_Main_Menu' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const rows = await addMainMenu({ STARTROWINDEX: 1, MAXROWS: 9999999, MAINTITLE: '', URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: mode, MID: '0' });
  const AllMainMenu = mapRows(rows, MAINMENU_PROPS);
  if (AllMainMenu.length > 0) {
    let RowNumber = 1;
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Member_Main_Menu.xls', Filename, disposition: 'attachment; filename= Member_Main_Menu.xls',
      headers: ['S.No.', 'TITLE', 'HERF', 'DISPLY ORDER', 'STATUS'],
      rows: AllMainMenu,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cs(item.TITLE)) + ' \t');
        w(tab(cs(item.HERF)) + ' \t');
        w(tab(cs(item.DISPLAYORDER)) + ' \t');
        w(tab(cs(item.STATUS === null ? false : !!item.STATUS)) + ' \t'); // bool => "True"/"False"
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? page, int? DisplayOrder, int? status, int? mode, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Add-Member-Panel-MainMenu" -> Add_Member_Panel_MainMenu/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Add-Member-Panel-MainMenu'], adminAuth, asyncHandler(async (req, res) => {
  let page = nint(req.p.page);
  let DisplayOrder = nint(req.p.DisplayOrder);
  let status = nint(req.p.status);
  let mode = nint(req.p.mode);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (DisplayOrder === null) DisplayOrder = 0;
  if (status === null) status = 1;
  if (mode === null) mode = 1;
  ViewBag.excelactive = await excelLink(url);
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await addMainMenu({ STARTROWINDEX: page, MAXROWS: MaxRows, MAINTITLE: '', URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: mode, MID: '0' });
    const AllMainMenu = mapRows(rows, MAINMENU_PROPS);
    const TotalRecord = toInt32(outStr(col(rows[0], 'intcount')) || 'x'); // int.Parse(DBNull => "") => FormatException
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, DisplayOrder, status, mode, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/Add_Member_Panel_MainMenu/Index.cshtml', AllMainMenu, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'usp_Add_Member_Panel_Main_Menu');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? DisplayOrder, int? status, int? mode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nint(req.p.DisplayOrder), nint(req.p.status), nint(req.p.mode), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult AddMemberPanelMainMenu(string MainTitle, string Url, int DisplayOrder, int status)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/AddMemberPanelMainMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const row = (await addMainMenu({
    STARTROWINDEX: '1', MAXROWS: '100', MAINTITLE: nstr(req.p.MainTitle), URL: nstr(req.p.Url), DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '0', MID: '0',
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberPanelMainMenu(int Mid, string MainTitle, string Url, int DisplayOrder, int status)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateMemberPanelMainMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mid = reqInt(req.p.Mid, 'Mid');
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const row = (await addMainMenu({
    STARTROWINDEX: '1', MAXROWS: '100', MAINTITLE: nstr(req.p.MainTitle), URL: nstr(req.p.Url), DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '2', MID: Mid,
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

module.exports = router;
