'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_SubMenu.cs (class Add_SubMenuController)
// Database: affiliate (Db_Affiliate). Table: tbl_mainmenu (TBL_MainMenu, declared in this C# file).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nint, nstr, nre, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, mapRow,
} = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Add_SubMenu';

/** class Sub_Menu */
const SUB_MENU_PROPS = ['MID', 'TITLE', 'HrefTitle'];
/** class SubMenuDetails */
const SUBMENUDETAILS_PROPS = ['SID', 'MID', 'TITLE', 'DISPLAYORDER', 'HERF', 'STATUS', 'SubTitle', 'ACTUALTITLE', 'ISEXCELVISIBLE'];
/** class TBL_MainMenu [Table("dbo.Tbl_MainMenu")] */
const TBL_MAINMENU_PROPS = ['TITLE', 'MID', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// USP_ADD_SUBMMENU @STARTROWINDEX,@MAXROWS,@MAINTITLE,@URL,@DISPLAYORDER,@STATUS,@AICLASS,@BCLASS,@MODE,@MID,@SID,@SUBTITLE,@INTRESULT OUT,@INTCOUNT OUT,@TITLE,@ExcelVisible
const subMenuProc = (p) => db.proc(DB, 'USP_ADD_SUBMMENU', {
  STARTROWINDEX: p.STARTROWINDEX, MAXROWS: p.MAXROWS, MAINTITLE: '', URL: p.URL, DISPLAYORDER: p.DISPLAYORDER, STATUS: p.STATUS,
  AICLASS: '', BCLASS: '', MODE: p.MODE, MID: p.MID, SID: p.SID, SUBTITLE: p.SUBTITLE, TITLE: p.TITLE, ExcelVisible: p.ExcelVisible,
});

// public void ExportReport(int? DisplayOrder, int? status, string Titles)
async function ExportReport(req, res, DisplayOrder, status, Titles, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Sub_Menu_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const rows = await subMenuProc({
    STARTROWINDEX: 1, MAXROWS: 9999999, URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '1', MID: Titles, SID: '0', SUBTITLE: '', TITLE: '', ExcelVisible: 0,
  });
  const list = mapRows(rows, SUBMENUDETAILS_PROPS);
  if (list.length > 0) {
    let RowNumber = 1;
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Sub_Menu_List.xls', Filename,
      headers: ['S.No.', 'MAIN MENU TITLE', 'SUB MENU TITLE', 'HREF', 'DISPLY ORDER', 'STATUS'],
      rows: list,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cs(item.TITLE)) + ' \t');
        w(tab(cs(item.SubTitle)) + ' \t');
        w(tab(cs(item.HERF)) + ' \t');
        w(tab(cs(item.DISPLAYORDER)) + ' \t');
        w(tab(cs(item.STATUS === null ? false : !!item.STATUS)) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? page, int? DisplayOrder, int? status, int? mode, string Titles, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Add-SubMenu" -> Add_SubMenu/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Add-SubMenu'], adminAuth, asyncHandler(async (req, res) => {
  let page = nint(req.p.page);
  let DisplayOrder = nint(req.p.DisplayOrder);
  let status = nint(req.p.status);
  let mode = nint(req.p.mode);
  let Titles = nstr(req.p.Titles);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  if (btnexel === null) btnexel = '';
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  ViewBag.excelactive = await excelLink(url);
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  if (DisplayOrder === null) DisplayOrder = 0;
  if (status === null) status = 1;
  if (mode === null) mode = 1; // (unused: legacy always passed @MODE "1")
  if (Titles === null) Titles = '0';
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await subMenuProc({
      STARTROWINDEX: page, MAXROWS: MaxRows, URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '1', MID: Titles, SID: '0', SUBTITLE: '', TITLE: '', ExcelVisible: 0,
    });
    const AllSubMenuDetail = mapRows(rows, SUBMENUDETAILS_PROPS);
    const ic = outStr(col(rows[0], 'intcount'));
    ViewBag.TotalRecord = toInt32(ic === '' ? '0' : ic);
    ViewBag.Titles = Titles;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, DisplayOrder, status, Titles, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/Add_SubMenu/Index.cshtml', AllSubMenuDetail, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_ADD_MEMBER_PANEL_SUBMMENU');
    return view(res, '~/Views/PageNotFound/Index.cshtml');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? DisplayOrder, int? status, string Titles)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nint(req.p.DisplayOrder), nint(req.p.status), nstr(req.p.Titles), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult AddSubMenu(int mid, string Url, int DisplayOrder, int status, string subtitle, int ExcelVisible)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/AddSubMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mid = reqInt(req.p.mid, 'mid');
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const ExcelVisible = reqInt(req.p.ExcelVisible, 'ExcelVisible');
  const row = (await subMenuProc({
    STARTROWINDEX: '1', MAXROWS: '100', URL: nstr(req.p.Url), DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '3', MID: mid, SID: '0',
    SUBTITLE: nstr(req.p.subtitle), TITLE: '', ExcelVisible,
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdateSubMenu(int sid, int mid, string Url, int DisplayOrder, int status, string subtitle, int ExcelVisible)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateSubMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sid = reqInt(req.p.sid, 'sid');
  const mid = reqInt(req.p.mid, 'mid');
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const ExcelVisible = reqInt(req.p.ExcelVisible, 'ExcelVisible');
  const Url = nstr(req.p.Url);
  if (Url === null) throw nre();
  const arr = Url.split('/');
  if (arr.length < 3) throw new Error('Index was outside the bounds of the array.');
  const binaraylevelbouns = await UtilityClass.Encryptword(arr[2]); // computed but unused (legacy)
  void binaraylevelbouns;
  const row = (await subMenuProc({
    STARTROWINDEX: '1', MAXROWS: '100', URL: Url, DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '2', MID: mid, SID: sid,
    SUBTITLE: nstr(req.p.subtitle), TITLE: '', ExcelVisible,
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

// ---------------------------------------------------------------- JsonResult GetSiglMainTitleByMid(int Mid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetSiglMainTitleByMid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mid = reqInt(req.p.Mid, 'Mid');
  // db._TBL_MainMenu (dbo.Tbl_MainMenu).Where(a => a.MID == Mid).FirstOrDefault()
  const row = await db.queryOne(DB, 'select title, mid, status from tbl_mainmenu where mid = @Mid limit 1', { Mid });
  if (!row) return res.type('application/json').send(''); // Json(null) => empty body
  return res.json(mapRow(row, TBL_MAINMENU_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetAllTitle()
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetAllTitle{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // PORT-NOTE: legacy passed "" for the int parameters @STARTROWINDEX/@MAXROWS/@DISPLAYORDER/@STATUS (SQL Server converts '' to 0) => 0.
  const rows = await subMenuProc({
    STARTROWINDEX: 0, MAXROWS: 0, URL: '', DISPLAYORDER: 0, STATUS: 0, MODE: '4', MID: '0', SID: '0', SUBTITLE: '', TITLE: '', ExcelVisible: 0,
  });
  return res.json(mapRows(rows, SUB_MENU_PROPS));
}));

module.exports = router;
