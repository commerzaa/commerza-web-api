'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/VideoGallery.cs (VideoGalleryController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const { exec, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DAL_VideoGallery = require('../../lib/merchant/DAL_VideoGallery');

const router = express.Router();
const DB = 'shopping';
const C = 'VideoGallery';
const VIDEO_PROPS = ['ID', 'NAME', 'CONTENTTYPE', 'DATA', 'STATUS', 'PMID'];

// ---- DeletingVideo -------------------------------------------------------------------------------------
// auth (acts on a logged-in merchant's data; legacy had no session check)
router.all(`/merchant/${C}/DeletingVideo{/:id}`, auth, asyncHandler(async (req, res) => {
  const VideoId = parseInt(req.p.VideoId, 10);
  const ReturnResultMessage = 'Video Successfully Deleted';
  await exec(DB, 'UPDATE videodata SET status=0 WHERE id=@id', { id: VideoId });
  res.json(ReturnResultMessage);
}));

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/videogallery
// auth  (legacy: Session null => RedirectToAction("Index","Home") => auth middleware)
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/videogallery{/:id}'], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const ObjVIDEODATA = await DAL_VideoGallery.Login_Check(Plid);
  res.json(mapRows(ObjVIDEODATA, VIDEO_PROPS));
}));

// ---- InsertingVideo ------------------------------------------------------------------------------------
// auth
router.all(`/merchant/${C}/InsertingVideo{/:id}`, auth, asyncHandler(async (req, res) => {
  let { Title, Vcode, Vdid } = req.p;
  let ReturnResultMessage = '';
  const Plid = Number(req.user.plid);
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
