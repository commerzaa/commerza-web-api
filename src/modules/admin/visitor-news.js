'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Visitor_news.cs (class Visitor_newsController => /admin/Visitor_news/...)
// Database: affiliate (Db_Affiliate). Table: tbl_news (News_Master). Procs: usp_Get_news, usp_popNews.
//
// Coverage: Index (session check) -> route ; addnews, GetnewsDetails, addpopupnews (JsonResult) -> routes.
// (public Visitor_newsController() - empty constructor, not an action)
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, isAdmin, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Visitor_news';

/** class VisitornewsList */
const LIST_PROPS = ['rowNumber', 'nid', 'title', 'descriptions', 'date', 'type', 'ImageName'];
/** class VisitornewListsingle */
const SINGLE_PROPS = ['nid', 'title', 'descriptions', 'date', 'type', 'imagename'];
/** class popupnews */
const POPUP_PROPS = ['descriptions', 'startdate', 'enddate', 'is_show'];

/** type.Trim() (null => NullReferenceException) */
function trimS(v) {
  if (v === null || v === undefined) throw B.nullRef();
  return String(v).trim();
}

// ---------------------------------------------------------------- Index(int? NID, string Msg, string type, string mode)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Visitor-news/{id}" -> Visitor_news/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Visitor-news{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  let NID = B.nInt(req.p.NID);
  let Msg = B.nStr(req.p.Msg);
  let type = B.nStr(req.p.type);
  const mode = B.nStr(req.p.mode);
  const ViewBag = {};
  if (Msg === '' || Msg === null) Msg = '';
  if (NID === null) NID = 0;
  if (type === '' || type === null) type = 'v';
  ViewBag.type = type;
  let messagetype = '';
  if (type.trim().toLowerCase() === 'v') messagetype = 'Visitor';
  else if (type.trim().toLowerCase() === 'm') messagetype = 'Member';
  else if (type === 'Member') messagetype = 'Member';
  else if (type === 'Website') messagetype = 'Website';
  else messagetype = 'Popup';

  if (mode === 'delete') {
    const empcode = req.user.emp_code; void empcode; // (unused, like legacy; new UtilityClass() unused too)
    const Row = await db.queryOne(DB, 'select nid from tbl_news where nid = @NID limit 1', { NID });
    if (Row === null) throw new Error('Value cannot be null.\r\nParameter name: entity'); // db._News_Master.Remove(null)
    await db.exec(DB, 'delete from tbl_news where nid = @nid', { nid: B.col(Row, 'nid') });
  }
  // [dbo].[usp_Get_news] @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@Type,@TotalCount out
  const rows = await db.proc(DB, 'usp_Get_news', {
    STARTROWINDEX: 1, MAXROWS: 1000, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', TYPE: messagetype,
  });
  const allVisitornewsList = mapRows(rows, LIST_PROPS);
  const TotalRecord = B.outIntOf(rows, 'TotalCount'); void TotalRecord; // int.Parse(spOutput.Value.ToString()) (unused)
  if (mode !== 'delete') {
    if (NID > 0 && Msg === '') {
      const Row = await db.queryOne(DB, 'select nid, title, descriptions, type from tbl_news where nid = @NID limit 1', { NID });
      if (Row === null) throw B.nullRef(); // Row.title on a missing row
      ViewBag.NewsTitle = B.col(Row, 'title');
      ViewBag.Desc = B.col(Row, 'descriptions');
      ViewBag.NewID = B.col(Row, 'nid');
      ViewBag.Msg = '';
      ViewBag.type = B.col(Row, 'type');
    }
    if (NID === 0 && Msg !== '') {
      ViewBag.Msg = Msg;
    }
  }
  // SELECT TOP 1 DESCRIPTIONS, CONVERT(VARCHAR(50),DATE,103) AS ENDDATE, CONVERT(VARCHAR(50),'',103) AS STARTDATE, ISNULL(IS_SHOW,'') AS IS_SHOW
  //   FROM TBL_NEWS WHERE TYPE='POPUP' AND ISNULL(DESCRIPTIONS,'')!='' AND STATUS=1 ORDER BY DATE DESC
  // PORT-NOTE: TYPE='POPUP' compared case-insensitively (SQL Server default collation).
  const Viewpopup = mapRows(await db.query(DB, `select descriptions, to_char(date, 'DD/MM/YYYY') as enddate, ''::varchar as startdate,
      coalesce(is_show::text, '') as is_show
    from tbl_news where upper(type) = 'POPUP' and coalesce(descriptions, '') <> '' and status = 1 order by date desc limit 1`, {}), POPUP_PROPS);
  ViewBag.popupnews = Viewpopup;
  return viewJson(res, '~/Views/AdminPanel/Visitor_news/Index.cshtml', allVisitornewsList, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult addnews(int getnid, string type, string getTitles, string message)
// auth-by-check (legacy returned Json("This Page has been expired") without a session - contract kept)
router.all(`/admin/${C}/addnews{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const getnid = B.reqInt(req.p.getnid, 'getnid');
  const type = B.nStr(req.p.type);
  const getTitles = B.nStr(req.p.getTitles);
  let message = B.nStr(req.p.message);
  let messagetype = '';
  // ViewBag.type = type;
  if (trimS(type).toLowerCase() === 'v') messagetype = 'Visitor';
  else if (trimS(type).toLowerCase() === 'm') messagetype = 'Member';
  else if (type === 'Member') messagetype = 'Member';
  else if (type === 'Branchpanel') messagetype = 'Branchpanel';
  else if (type === 'Website') messagetype = 'Website';
  else if (type === 'TradeWithUs') messagetype = 'TradeWithUs';
  else messagetype = 'Popup';
  if (message === null) throw B.nullRef();
  message = message.split('+#!#+').join('<');
  message = message.split('+!#!+').join('>');
  let ret = 'ok';
  if (!isAdmin(req)) {
    return res.json('This Page has been expired');
  }
  if (trimS(getTitles) === '') {
    return res.json('Enter your title');
  }
  try {
    if (getnid > 0) {
      const Row = await db.queryOne(DB, 'select nid from tbl_news where nid = @getnid limit 1', { getnid });
      if (Row !== null) {
        await db.exec(DB, `update tbl_news set date = now(), title = @getTitles, descriptions = @message, type = @messagetype, status = 1,
            imagename = '' where nid = @nid`, { getTitles, message, messagetype, nid: B.col(Row, 'nid') });
        ret = 'update';
      }
    } else {
      await db.exec(DB, `insert into tbl_news (date, title, descriptions, type, status, imagename)
        values (now(), @getTitles, @message, @messagetype, 1, '')`, { getTitles, message, messagetype });
      ret = 'new entry';
    }
    const empcode = req.user.emp_code; void empcode; // (unused, like legacy)
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'addnews');
    ret = 'Error occurred. Please try later';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult GetnewsDetails(double nid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetnewsDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const nid = B.reqDec(req.p.nid, 'nid');
  // select nid,title,'sssss' as descriptions, CONVERT(varchar(30),date,106) as date, type from tbl_news where nid=<nid>  (parameterised)
  const row = await db.queryOne(DB, `select nid, title, 'sssss' as descriptions, to_char(date, 'DD Mon YYYY') as date, type
    from tbl_news where nid = @nid limit 1`, { nid });
  if (row === null) return res.type('application/json').send(''); // Json(null) => empty body
  return res.json(mapRow(row, SINGLE_PROPS));
}));

// ---------------------------------------------------------------- JsonResult addpopupnews(string actiontype, string popupimg, string tilldate)
// auth (reads Session["Admin_User"] - legacy NullReference without a session)
router.all(`/admin/${C}/addpopupnews{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const actiontype = B.nStr(req.p.actiontype);
  const popupimg = B.nStr(req.p.popupimg);
  const tilldate = B.nStr(req.p.tilldate);
  let imgname = '';
  let ret = '';
  if (trimS(popupimg) !== '') {
    let SavePaths = '';
    let base64String = '';
    let ImageExt = '';
    SavePaths = (config.app.MemberImagePath || '');
    if (popupimg !== '') {
      base64String = popupimg;
      imgname = B.cleanName('popupnews') + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0 || IndexNo + (lastIndexNo - IndexNo) > base64String.length) {
        throw new Error('Length cannot be less than zero.\r\nParameter name: length'); // String.Substring
      }
      ImageExt = base64String.substring(IndexNo, lastIndexNo); void ImageExt;
    }
    const b = B.decodeBase64Image(base64String); // strips "...base64," and Convert.FromBase64String
    // System.Drawing.Image.FromStream(ms) (throws on invalid image data)
    const sharp = require('sharp');
    const meta = await sharp(b).metadata();
    let filesize = b.length; filesize /= 1024; void filesize;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = ''; void oldimage; // (param[9].Value.ToString() - commented in legacy)
    const scaleFactor = 0.5;
    const newWidth1 = Math.trunc(meta.width * scaleFactor);
    const newHeight1 = Math.trunc(meta.height * scaleFactor);
    const radio = newWidth1 / newHeight1; void radio;
    // img.Save(strValidFullName)
    // PORT-NOTE: System.Drawing Image.Save(path) re-encoded the image in its own format; the decoded bytes are written as-is.
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    fs.writeFileSync(strValidFullName, b);
  }
  const objdut = new DataUtility();
  const param = [];
  param[0] = DataUtility.SqlParameter('@imagename', imgname);
  param[1] = DataUtility.SqlParameter('@actiontype', actiontype);
  if (trimS(tilldate) !== '') {
    const dates = tilldate.split('/');
    const y = B.cvtInt(B.at(dates, 2));
    const m = B.cvtInt(B.at(dates, 1));
    const d = B.cvtInt(B.at(dates, 0));
    const tilldatea = new Date(y, m - 1, d);
    if (y < 1 || y > 9999 || m < 1 || m > 12 || d < 1 || tilldatea.getMonth() !== m - 1 || tilldatea.getFullYear() !== y) {
      throw new Error('Year, Month, and Day parameters describe an un-representable DateTime.');
    }
    param[2] = DataUtility.SqlParameter('@date', tilldatea);
  } else {
    param[2] = DataUtility.SqlParameter('@date', '');
  }
  param[3] = DataUtility.SqlParameter('@strResult', null, 'Output');
  ret = await objdut.ExecuteSqlSPS(param, '[usp_popNews]');
  const empcode = req.user.emp_code; void empcode; // (unused, like legacy)
  return res.json(ret);
}));

module.exports = router;
