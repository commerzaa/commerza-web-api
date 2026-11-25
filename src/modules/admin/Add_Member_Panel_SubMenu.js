'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_Member_Panel_SubMenu.cs (class Add_Member_Panel_SubMenuController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nint, nstr, nre, reqInt, toInt32, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRows, mapRow,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Add_Member_Panel_SubMenu';

const SUBMENU_PROPS = ['MID', 'TITLE'];
const SUBMENUDETAIL_PROPS = ['SID', 'MID', 'TITLE', 'DISPLAYORDER', 'HERF', 'STATUS', 'SubTitle', 'ACTUALTITLE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

// USP_ADD_MEMBER_PANEL_SUBMMENU @STARTROWINDEX,@MAXROWS,@MAINTITLE,@URL,@DISPLAYORDER,@STATUS,@AICLASS,@BCLASS,@MODE,@MID,@SID,@SUBTITLE,@INTRESULT OUT,@INTCOUNT OUT[,@TITLE]
const subMenuProc = (p) => {
  const params = {
    STARTROWINDEX: p.STARTROWINDEX, MAXROWS: p.MAXROWS, MAINTITLE: '', URL: p.URL, DISPLAYORDER: p.DISPLAYORDER, STATUS: p.STATUS,
    AICLASS: '', BCLASS: '', MODE: p.MODE, MID: p.MID, SID: p.SID, SUBTITLE: p.SUBTITLE,
  };
  if (p.TITLE !== undefined) params.TITLE = p.TITLE;
  return db.proc(DB, 'USP_ADD_MEMBER_PANEL_SUBMMENU', params);
};

// public void ExportReport(int? DisplayOrder, int? status, string Titles)
async function ExportReport(req, res, DisplayOrder, status, Titles, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Member_Sub_Menu' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const rows = await subMenuProc({
    STARTROWINDEX: 1, MAXROWS: 99999999, URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '1', MID: '0', SID: '0', SUBTITLE: '', TITLE: Titles,
  });
  const list = mapRows(rows, SUBMENUDETAIL_PROPS);
  if (list.length > 0) {
    let srno = 1;
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Member_Sub_Menu.xls', Filename, disposition: 'attachment; filename= Member_Sub_Menu.xls',
      headers: ['S.No.', 'MAIN MENU TITLE', 'SUB MENU TITLE', 'ACTUAL NAME', 'HERF', 'DISPLY ORDER', 'STATUS'],
      rows: list,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w(tab(String(srno)) + ' \t');
        w(tab(cs(item.TITLE)) + ' \t');
        w(tab(cs(item.SubTitle)) + ' \t');
        w(tab(cs(item.ACTUALTITLE)) + ' \t');
        w(tab(cs(item.HERF)) + ' \t');
        w(tab(cs(item.DISPLAYORDER)) + ' \t');
        w(tab(cs(item.STATUS === null ? false : !!item.STATUS)) + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? page, int? DisplayOrder, int? status, int? mode, string Titles, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Add-Member-Panel-SubMenu" -> Add_Member_Panel_SubMenu/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Add-Member-Panel-SubMenu'], adminAuth, asyncHandler(async (req, res) => {
  let page = nint(req.p.page);
  let DisplayOrder = nint(req.p.DisplayOrder);
  let status = nint(req.p.status);
  let mode = nint(req.p.mode);
  let Titles = nstr(req.p.Titles);
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  if (DisplayOrder === null) DisplayOrder = 0;
  if (status === null) status = 1;
  if (mode === null) mode = 1; // (unused: legacy always passed @MODE "1")
  if (Titles === null) Titles = '';
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    const rows = await subMenuProc({
      STARTROWINDEX: page, MAXROWS: MaxRows, URL: '', DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '1', MID: '0', SID: '0', SUBTITLE: '', TITLE: Titles,
    });
    const AllSubMenuDetail = mapRows(rows, SUBMENUDETAIL_PROPS);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = toInt32(outStr(col(rows[0], 'intcount')) || 'x'); // int.Parse(DBNull => "") => FormatException
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, DisplayOrder, status, Titles, ViewBag);
      if (r.sent) return undefined;
    }
    return view(res, '~/Views/AdminPanel/Add_Member_Panel_SubMenu/Index.cshtml', AllSubMenuDetail, ViewBag);
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

// ---------------------------------------------------------------- JsonResult AddMemberPanelSubMenu(int mid, string Url, int DisplayOrder, int status, string subtitle)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/AddMemberPanelSubMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mid = reqInt(req.p.mid, 'mid');
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const row = (await subMenuProc({
    STARTROWINDEX: '1', MAXROWS: '100', URL: nstr(req.p.Url), DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '3', MID: mid, SID: '0', SUBTITLE: nstr(req.p.subtitle),
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

// ---------------------------------------------------------------- JsonResult UpdateMemberPanelSubMenu(int sid, int mid, string Url, int DisplayOrder, int status, string subtitle)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateMemberPanelSubMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sid = reqInt(req.p.sid, 'sid');
  const mid = reqInt(req.p.mid, 'mid');
  const DisplayOrder = reqInt(req.p.DisplayOrder, 'DisplayOrder');
  const status = reqInt(req.p.status, 'status');
  const Url = nstr(req.p.Url);
  if (Url === null) throw nre();
  const arr = Url.split('/');
  if (arr.length < 3) throw new Error('Index was outside the bounds of the array.');
  const binaraylevelbouns = await UtilityClass.Encryptword(arr[2]); // computed but unused (legacy)
  void binaraylevelbouns;
  const row = (await subMenuProc({
    STARTROWINDEX: '1', MAXROWS: '100', URL: Url, DISPLAYORDER: DisplayOrder, STATUS: status, MODE: '2', MID: mid, SID: sid, SUBTITLE: nstr(req.p.subtitle),
  }))[0];
  return res.json(outStr(col(row, 'intresult')));
}));

// ---------------------------------------------------------------- JsonResult GetSiglMainTitleByMid(int Mid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetSiglMainTitleByMid{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mid = reqInt(req.p.Mid, 'Mid');
  // db._TBL_Main_Menu (tbl_mainmenu_memberpanel).Where(a => a.MID == Mid).FirstOrDefault()
  const row = await db.queryOne(DB, 'select title, mid from tbl_mainmenu_memberpanel where mid = @Mid limit 1', { Mid });
  if (!row) return res.type('application/json').send(''); // Json(null) => empty body
  return res.json(mapRow(row, ['TITLE', 'MID']));
}));

// ---------------------------------------------------------------- JsonResult GetAllTitle()
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetAllTitle{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'select mid, title from tbl_mainmenu_memberpanel order by displayorder asc', {});
  return res.json(mapRows(rows, SUBMENU_PROPS));
}));

module.exports = router;
