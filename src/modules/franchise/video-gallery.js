'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/VideoGallery.cs (VideoGalleryController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'VideoGallery';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}


const DAL_VideoGallery = require('../../lib/franchise/DAL_VideoGallery');
const VIDEO_PROPS = ['ID', 'NAME', 'CONTENTTYPE', 'DATA', 'STATUS', 'PMID'];

// ---- DeletingVideo -------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/DeletingVideo{/:id}`, auth, asyncHandler(async (req, res) => {
  const VideoId = parseInt(req.p.VideoId, 10);
  const ReturnResultMessage = 'Video Successfully Deleted';
  await exec(DB, 'UPDATE videodata SET status=0 WHERE id=@id', { id: VideoId });
  res.json(ReturnResultMessage);
}));

// ---- Index ---------------------------------------------------------------------------------------------
// auth  (legacy: Session null => RedirectToAction("Index","Home") => auth middleware)
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const ObjVIDEODATA = await DAL_VideoGallery.Login_Check(Plid);
  res.json(mapRows(ObjVIDEODATA, VIDEO_PROPS));
}));

// ---- InsertingVideo ------------------------------------------------------------------------------------
// auth
router.all(`/franchise/${C}/InsertingVideo{/:id}`, auth, asyncHandler(async (req, res) => {
  let { Title, Vcode, Vdid } = req.p;
  let ReturnResultMessage = '';
  const Plid = Number(req.user.did);
  let Pmid = Number(await scalar(DB, 'Select pmid From portal_master Where plid=@plid And active=1 LIMIT 1', { plid: Plid }));
  if (!Pmid) Pmid = 0;
  if (Pmid <= 0) ReturnResultMessage = 'Your Session Expired Please Login Again.';
  Title = Title.split('SingleInvertedComa').join("'");   // legacy: null => NullReferenceException
  Vcode = Vcode.split('SingleInvertedComa').join("'");
  if (Vcode.indexOf('iframe') > -1) {
    const IndexOfSrc = Vcode.indexOf('src');
    const Ind1Coma = Vcode.indexOf('"', IndexOfSrc + 1);
    const Ind2Coma = Vcode.indexOf('"', Ind1Coma + 1);
    if (Ind1Coma < 0 || Ind2Coma < 0) throw new RangeError('Index and length must refer to a location within the string.');
    Vcode = Vcode.substring(Ind1Coma + 1, Ind2Coma);
  }
  ReturnResultMessage = await DAL_VideoGallery.InsertingVideo(Title, Vcode, Vdid, String(Pmid));
  if (ReturnResultMessage === '1') ReturnResultMessage = 'Your Video Updated Sucessfully.';
  else if (ReturnResultMessage === '3') ReturnResultMessage = 'You Can Add Only Eight Video.';
  else ReturnResultMessage = 'There Is Some Error While Updating Video.';
  res.json(ReturnResultMessage);
}));

module.exports = router;
