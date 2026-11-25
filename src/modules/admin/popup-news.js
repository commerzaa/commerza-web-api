'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Popup_news.cs (class Popup_newsController => /admin/Popup_news/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { optionalAuth } = require('../../middleware/auth');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const { DB, nre, nint, nstr, reqInt, col, view, mapRows, mapRow } = require('./_shared/batch02-common');
const { reqDec, outIntOf } = require('./_shared/batch11-common');
const { jsonNull, cleanProfileName, decodeDataUrlImage } = require('./_shared/batch13-02-common');

const router = express.Router();
const C = 'Popup_news';

/** class popupnews1 */
const POPUPNEWS1_PROPS = ['descriptions', 'startdate', 'enddate', 'is_show'];
/** class VisitornewsList1 */
const VISITORNEWSLIST1_PROPS = ['rowNumber', 'nid', 'title', 'descriptions', 'date', 'type', 'ImageName'];
/** class VisitornewListsingle (Visitor_news.cs) */
const VISITORNEWLISTSINGLE_PROPS = ['nid', 'title', 'descriptions', 'date', 'type', 'imagename'];
// class VisitornewListsingle1 is declared in the C# file but never used.

/** type => messagetype ("v" Visitor, "m" Member, else Popup); type.Trim() on null => NullReferenceException */
function messageTypeOf(type) {
  if (type === null || type === undefined) throw nre();
  const t = String(type).trim().toLowerCase();
  if (t === 'v') return 'Visitor';
  if (t === 'm') return 'Member';
  return 'Popup';
}

// ---------------------------------------------------------------- Index(int? NID, string Msg, string type, string mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Popup-news/{id}" -> Popup_news/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Popup-news{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let NID = nint(req.p.NID);
  let Msg = nstr(req.p.Msg);
  let type = nstr(req.p.type);
  const mode = nstr(req.p.mode);
  const ViewBag = {};
  if (Msg === '' || Msg === null) Msg = '';
  if (NID === null) NID = 0;
  if (type === '' || type === null) type = 'v';
  ViewBag.type = type;
  const messagetype = messageTypeOf(type);
  // SELECT TOP 1 ISNULL(DESCRIPTIONS,'') AS DESCRIPTIONS, CONVERT(VARCHAR(50),DATE,103) AS ENDDATE, ('') AS STARTDATE, IS_SHOW
  //   FROM TBL_NEWS WHERE TYPE='POPUP' ORDER BY DATE DESC   (SQL Server collation is case-insensitive => lower() compare)
  const Viewpopup = mapRows(await db.query(DB, `select coalesce(descriptions, '') as descriptions, to_char(date, 'DD/MM/YYYY') as enddate,
      '' as startdate, is_show::text as is_show
    from tbl_news where lower(type) = 'popup' order by date desc limit 1`, {}), POPUPNEWS1_PROPS);
  ViewBag.popupnews = Viewpopup;
  if (mode === 'delete') {
    // "delete from tbl_news where nid='" + NID + "' "  (parameterised)
    await db.exec(DB, 'delete from tbl_news where nid = @NID', { NID });
  }
  // usp_Get_news_popup @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@Type,@TotalCount out
  const rows = await db.proc(DB, 'usp_Get_news_popup', {
    StartRowIndex: 1, MaxRows: 1000, SearchField: '', SearchValue: '', fromDate: '', ToDate: '', Type: messagetype,
  });
  const allVisitornewsList = mapRows(rows, VISITORNEWSLIST1_PROPS);
  const TotalRecord = outIntOf(rows, 'TotalCount'); // eslint-disable-line no-unused-vars
  if (mode !== 'delete') {
    const d1 = await db.queryOne(DB, "select coalesce(descriptions, '') as v from tbl_news where lower(type) = 'popup' order by date desc limit 1", {});
    const descriptions1 = d1 ? col(d1, 'v') : null;
    const n1 = await db.queryOne(DB, "select coalesce(nid, 0) as v from tbl_news where lower(type) = 'popup' order by date desc limit 1", {});
    const nid1 = n1 ? Number(col(n1, 'v')) : 0;
    const s1 = await db.queryOne(DB, "select coalesce(status, 0) as v from tbl_news where lower(type) = 'popup' order by date desc limit 1", {});
    const status = s1 ? Number(col(s1, 'v')) : 0;
    ViewBag.Desc = descriptions1;
    ViewBag.NewID = nid1;
    ViewBag.status = status;
    if (NID > 0 && Msg === '') {
      const Row = await db.queryOne(DB, 'select nid, title, type, descriptions, date, status, imagename from tbl_news where nid = @NID limit 1', { NID });
      // PORT-NOTE: the legacy SQL here was "... where type=Popup ..." (unquoted => SQL Server "Invalid column name 'Popup'." => unhandled 500).
      // The same statement is executed so the same failure (column "popup" does not exist) is reproduced.
      const d2 = await db.queryOne(DB, "select coalesce(descriptions, '') as v from tbl_news where type = popup order by date desc limit 1", {});
      const descriptions = d2 ? col(d2, 'v') : null;
      const n2 = await db.queryOne(DB, 'select coalesce(nid, 0) as v from tbl_news where type = popup order by date desc limit 1', {});
      const nid = n2 ? Number(col(n2, 'v')) : 0;
      if (!Row) throw nre(); // Row.title
      ViewBag.NewsTitle = col(Row, 'title');
      ViewBag.Desc = descriptions;
      ViewBag.NewID = nid;
      ViewBag.Msg = '';
    }
    if (NID === 0 && Msg !== '') ViewBag.Msg = Msg;
  }
  return view(res, '~/Views/AdminPanel/Popup_news/Index.cshtml', allVisitornewsList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult addnews(string getnid, string type, string getTitles, string message)
// auth-by-check (legacy returned Json("This Page has been expired") without a session, AFTER type.Trim() / message.Replace)
router.all(`/admin/${C}/addnews{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const getnid = nstr(req.p.getnid);
  const type = nstr(req.p.type);
  const getTitles = nstr(req.p.getTitles);
  let message = nstr(req.p.message);
  const messagetype = messageTypeOf(type); // ViewBag.type = type (unused by a JsonResult)
  if (message === null) throw nre();
  message = message.split('+#!#+').join('<');
  message = message.split('+!#!+').join('>');
  let ret = 'ok';
  if (!isAdmin(req)) return res.json('This Page has been expired');
  if (getTitles === null) throw nre();
  if (getTitles.trim() === '') return res.json('Enter your title');
  try {
    const objdut = new DataUtility();
    const param = [
      DataUtility.SqlParameter('@nid', getnid),
      DataUtility.SqlParameter('@titile', getTitles),
      DataUtility.SqlParameter('@descriptions', message),
      DataUtility.SqlParameter('@Type', messagetype),
      DataUtility.SqlParameter('@strResult', null, 'Output'),
    ];
    ret = await objdut.ExecuteSqlSPS(param, 'usp_News_popup');
    const empcode = req.user.emp_code; // eslint-disable-line no-unused-vars
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'addnews');
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetnewsDetails(double nid)
// auth (PORT-NOTE: legacy had no session check; admin panel data => adminAuth)
router.all(`/admin/${C}/GetnewsDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const nid = reqDec(req.p.nid, 'nid');
  // "select nid,title,'sssss' as descriptions, CONVERT(varchar(30),date,106) as date, type from tbl_news where nid=" + nid  (parameterised)
  const r = await db.queryOne(DB, `select nid, title, 'sssss' as descriptions, to_char(date, 'DD Mon YYYY') as date, type
    from tbl_news where nid = @nid limit 1`, { nid });
  if (!r) return jsonNull(res);
  return res.json(mapRow(r, VISITORNEWLISTSINGLE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult addpopupnews(int nid, int actiontype, string popupimg, string tilldate, string Startdate, string descriptions)
// auth (reads Session["Admin_User"] at the end - legacy threw NullReferenceException AFTER saving without a session)
// Config: MemberImagePath
router.all(`/admin/${C}/addpopupnews{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const nid = reqInt(req.p.nid, 'nid');
  const actiontype = reqInt(req.p.actiontype, 'actiontype');
  const popupimg = nstr(req.p.popupimg);
  let descriptions = nstr(req.p.descriptions);
  let imgname = '';
  let ret = '';
  if (popupimg === null) throw nre(); // popupimg.Trim()
  if (popupimg.trim() !== '') {
    let base64String = '';
    const SavePaths = (config.app.MemberImagePath || '');
    if (popupimg !== '') {
      base64String = popupimg;
      imgname = cleanProfileName('popupnews') + '.jpg';
    } else {
      imgname = ' ';
    }
    const dir = path.join(config.uploadDir, String(SavePaths).replace(/^~?[\\/]*/, ''));
    const strValidFullName = path.join(dir, imgname);
    const b = decodeDataUrlImage(base64String); // Convert.FromBase64String + Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // oldimage is always "" ; the scale/ratio maths of the legacy code is computed but unused
    // PORT-NOTE: img.Save(path) re-encoded the image in its own (raw) format; the decoded bytes are written unchanged.
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(strValidFullName, b);
  }
  if (descriptions === null) throw nre();
  descriptions = descriptions.split('lessthan').join('<');
  descriptions = descriptions.split('greatthan').join('>');
  const new_descriptions = descriptions.replace(/<[^\n]*?>/g, ''); // Regex.Replace(descriptions, "<.*?>", "")
  if (new_descriptions === '') descriptions = '';
  const objduts = new DataUtility();
  const param = [
    DataUtility.SqlParameter('@nid', nid),
    DataUtility.SqlParameter('@titile', ''),
    DataUtility.SqlParameter('@descriptions', descriptions),
    DataUtility.SqlParameter('@Type', 'Popup'),
    DataUtility.SqlParameter('@active', actiontype),
    DataUtility.SqlParameter('@strResult', null, 'Output'),
  ];
  ret = await objduts.ExecuteSqlSPS(param, 'usp_News_popup');
  const empcode = req.user.emp_code; // eslint-disable-line no-unused-vars
  return res.json(ret);
}));

module.exports = router;
