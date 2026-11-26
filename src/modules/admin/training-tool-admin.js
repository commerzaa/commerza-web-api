'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Training_Tool_Admin.cs (class Training_Tool_AdminController => /admin/Training_Tool_Admin/...)
// Database: affiliate (Db_Affiliate). Entity: DataBaseContext._Training_Tool => table training_tool (Models/TrainingTool.cs).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const TrainingTool = require('../../lib/admin/TrainingTool');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, reqInt, mapPath, nullRef } = require('./_shared/batch11-common');
const { toBool, csSubstring, fromBase64, getFileName } = require('./_shared/batch13-09-common');

const router = express.Router();
const C = 'Training_Tool_Admin';

/** class TrainingTool */
const TT_PROPS = ['TLID', 'Type', 'Title', 'Desp', 'VUrl', 'Active', 'Date'];

/** public static int IsValidImage(byte[] bytes) (static => not an MVC action) */
async function IsValidImage(bytes) {
  try {
    // System.Drawing.Image.FromStream(ms)
    // PORT-NOTE: System.Drawing is not available; validity is sniffed from the magic bytes (src/lib/Save_ImageFile.IsValidImage).
    const Save_ImageFile = require('../../lib/Save_ImageFile');
    if (!Save_ImageFile.IsValidImage(bytes)) throw new Error('Parameter is not valid.');
  } catch (ExpObj) {
    // #region For ErrorInsert
    try {
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'IsValidImage', 0, 'Controllers/AdminPanel/Training_Tool_Admin');
    } catch (e) {
      console.error('[admin] ErrorInsert failed:', e.message);
    }
    return 0;
  }
  return 1;
}

/** public string SaveImageNmaeCurrent(int pdfimg, string getimagebytecode, string imgname, string strValidFullName, string documents_Exten) */
async function SaveImageNmaeCurrent(pdfimg, getimagebytecode, imgname, strValidFullName, documents_Exten) {
  // pdfimg if pdfimg=1 then only image else pdfimg  file
  if (getimagebytecode === null || getimagebytecode === undefined) throw nullRef();
  if (getimagebytecode.includes('base64,')) {
    let ImageExt = '';
    const IndexNo = getimagebytecode.indexOf('/') + 1;
    const lastIndexNo = getimagebytecode.indexOf(';');
    ImageExt = csSubstring(getimagebytecode, IndexNo, lastIndexNo - IndexNo);
    void ImageExt; // (unused by legacy: documents_Exten is the extension)
    const IndexNo1 = getimagebytecode.indexOf(',') + 1;
    const Pathlength1 = getimagebytecode.length;
    getimagebytecode = csSubstring(getimagebytecode, IndexNo1, Pathlength1 - IndexNo1);
    if (imgname === null || imgname === undefined) {
      const e = new Error('Value cannot be null.\r\nParameter name: input'); e.name = 'ArgumentNullException'; throw e; // Regex.Replace(null)
    }
    const ext = documents_Exten === null || documents_Exten === undefined ? '' : documents_Exten;
    imgname = String(imgname).replace(/[^0-9a-zA-Z]+/g, '') + '.' + ext;
    strValidFullName = (strValidFullName === null || strValidFullName === undefined ? '' : strValidFullName) + '/' + imgname;
    const b = fromBase64(getimagebytecode);
    const retrunimagetype = await IsValidImage(b);
    if (fs.existsSync(strValidFullName)) {
      const rand = String(Math.floor(Math.random() * 99999)); // random.Next(99999)
      strValidFullName = strValidFullName.split('.' + ext).join('') + '_' + rand + '.' + ext;
    }
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    if (pdfimg === 1) {
      if (retrunimagetype === 1) {
        // PORT-NOTE: img.Save(strValidFullName) (System.Drawing re-encode) => the decoded bytes are written unchanged.
        fs.writeFileSync(strValidFullName, b);
      } else if (imgname !== null && imgname.length > 0 && b !== null) {
        fs.writeFileSync(strValidFullName, b);
      }
    } else if (imgname !== null && imgname.length > 0 && b !== null) {
      fs.writeFileSync(strValidFullName, b);
    }
  }
  getimagebytecode = getFileName(strValidFullName);
  return getimagebytecode;
}

/** public string savefile(...) / public string ThumbnailImage(...) (identical bodies)
 *  Config: TrainingToolFile */
async function savefile(filename, documents_Exten, documents, art_doucment) {
  if (filename === null) filename = '';
  if (documents_Exten === null) documents_Exten = '';
  if (art_doucment === null) art_doucment = '';
  if (documents === null) documents = '';
  let strValidFullName = '';
  // SaveImage objimage = new SaveImage(); (unused)
  if (documents.trim() !== '') {
    if (art_doucment.includes('base64,')) {
      strValidFullName = mapPath(config.app.TrainingToolFile || '');
      // documents = objimage.SaveImageNmae(0, art_doucment, documents, strValidFullName);
      documents = await SaveImageNmaeCurrent(0, art_doucment, documents, strValidFullName, documents_Exten);
    }
  }
  if (documents.trim() !== '') documents = getFileName(documents);
  return documents;
}
const ThumbnailImage = savefile;

// ---------------------------------------------------------------- ActionResult Index(string artnew)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Upload-file" -> Training_Tool_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Upload-file'], adminAuth, asyncHandler(async (req, res) => {
  // db._Training_Tool.OrderByDescending(a => a.TLID)
  const row = mapRows(await db.query(DB, 'select * from training_tool order by tlid desc', {}), TT_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Training_Tool_Admin/Index.cshtml', Model: row });
}));

// ---------------------------------------------------------------- JsonResult AddUpdate_Videos(string Type, string Title, string Vurl, string status, string Mode, int TLID, string filename, string documents_Exten, string documents, string art_doucment, string desc, string art_doucment1)
// auth (no session check in legacy; admin content write + file upload => protected)
// Config: TrainingToolFile
router.all(`/admin/${C}/AddUpdate_Videos{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = req.p;
  const Type = nStr(P.Type);
  const Title = nStr(P.Title);
  const Vurl = nStr(P.Vurl);
  const status = nStr(P.status);
  const Mode = nStr(P.Mode);
  const TLID = reqInt(P.TLID, 'TLID');
  const filename = nStr(P.filename);
  const documents_Exten = nStr(P.documents_Exten);
  const documents = nStr(P.documents);
  const art_doucment = nStr(P.art_doucment);
  const art_doucment1 = nStr(P.art_doucment1);
  let documentfile = '';
  let Thumbnail = '';
  if (Type === 'File') {
    if (documents_Exten !== '') { // (MVC binds "" as null, so this is true unless the value is missing - same as legacy)
      documentfile = await savefile(filename, documents_Exten, documents, art_doucment);
      Thumbnail = await ThumbnailImage(filename, documents_Exten, documents, art_doucment1);
    } else {
      documentfile = documents;
    }
  }
  let Result = '';
  if (Mode === 'Insert') {
    const VUrl = Type === 'File' ? documentfile : Vurl;
    await db.exec(DB, `insert into training_tool (type, title, desp, vurl, active, date)
      values (@Type, @Title, @Desp, @VUrl, @Active, now())`, { Type, Title, Desp: Thumbnail, VUrl, Active: toBool(status) });
    Result = Type === 'File' ? 'New File Successfully Added.' : 'New Video Successfully Added.';
  }
  if (Mode === 'Update') {
    // db._Training_Tool.Single(a => a.TLID == TLID)
    const rows = await db.query(DB, 'select tlid from training_tool where tlid=@TLID', { TLID });
    if (rows.length === 0) throw new Error('Sequence contains no elements');
    if (rows.length > 1) throw new Error('Sequence contains more than one element');
    const VUrl = Type === 'File' ? documentfile : Vurl;
    const Active = toBool(status);
    await db.exec(DB, `update training_tool set type=@Type, title=@Title, desp='', vurl=@VUrl, active=@Active where tlid=@TLID`,
      { Type, Title, VUrl, Active, TLID });
    Result = Type === 'File' ? 'File Successfully Updated.' : 'Video Successfully Updated.';
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult DeleteTrainingTool(int TLID)
// auth (no session check in legacy; admin content delete => protected)
router.all(`/admin/${C}/DeleteTrainingTool{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TLID = reqInt(req.p.TLID, 'TLID');
  let Result = '';
  const tl = new TrainingTool();
  const i = await tl.DeleteT(TLID);
  if (i > 0) Result = 'Delete';
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult VideosCollection(int TLID)
// auth (no session check in legacy; admin content => protected)
router.all(`/admin/${C}/VideosCollection{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TLID = reqInt(req.p.TLID, 'TLID');
  const row = mapRows(await db.query(DB, 'select * from training_tool where tlid=@TLID order by tlid desc', { TLID }), TT_PROPS);
  return res.json(row);
}));

// ---------------------------------------------------------------- public string ThumbnailImage(string filename, string documents_Exten, string documents, string art_doucment)
// auth (public method => routable in legacy (Content result); writes an uploaded file => protected)
router.all(`/admin/${C}/ThumbnailImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ThumbnailImage(nStr(req.p.filename), nStr(req.p.documents_Exten), nStr(req.p.documents), nStr(req.p.art_doucment));
  return res.type('text/html').send(r === null ? '' : r);
}));

// ---------------------------------------------------------------- public string savefile(string filename, string documents_Exten, string documents, string art_doucment)
// auth (public method => routable in legacy (Content result); writes an uploaded file => protected)
router.all(`/admin/${C}/savefile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await savefile(nStr(req.p.filename), nStr(req.p.documents_Exten), nStr(req.p.documents), nStr(req.p.art_doucment));
  return res.type('text/html').send(r === null ? '' : r);
}));

// ---------------------------------------------------------------- public string SaveImageNmaeCurrent(int pdfimg, string getimagebytecode, string imgname, string strValidFullName, string documents_Exten)
// auth (public method => routable in legacy (Content result); writes a file to a caller-supplied path => protected)
// PORT-NOTE: strValidFullName is a caller-supplied physical path in legacy; it is resolved under config.uploadDir here.
router.all(`/admin/${C}/SaveImageNmaeCurrent{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const pdfimg = reqInt(req.p.pdfimg, 'pdfimg');
  const sv = nStr(req.p.strValidFullName);
  const r = await SaveImageNmaeCurrent(pdfimg, nStr(req.p.getimagebytecode), nStr(req.p.imgname),
    sv === null ? null : mapPath(sv), nStr(req.p.documents_Exten));
  return res.type('text/html').send(r === null ? '' : r);
}));

module.exports = router;
