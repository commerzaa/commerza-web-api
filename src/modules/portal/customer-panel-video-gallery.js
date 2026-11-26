'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/VideoGallery.cs (VideoGalleryController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const DAL_VideoGallery = require('../../lib/portal/DAL_VideoGallery');
const ps = require('./_shared/portal-session');
const { csReplace } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const VIDEO_PROPS = ['ID', 'NAME', 'CONTENTTYPE', 'DATA', 'STATUS', 'PMID'];

// auth (acts on a merchant's video; legacy had no session check)
router.all('/portal/VideoGallery/DeletingVideo{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const raw = req.p.VideoId;
  if (raw === undefined || raw === null || raw === '') throw new Error("The parameters dictionary contains a null entry for parameter 'VideoId' of non-nullable type 'System.Int32'.");
  const VideoId = parseInt(raw, 10);
  const ReturnResultMessage = 'Video Successfully Deleted';
  await db.exec(DB, 'update videodata set status = 0 where id = @id', { id: VideoId });
  res.json(ReturnResultMessage);
}));

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/videogallery -> VideoGallery/Index
router.all(['/portal/VideoGallery/Index{/:id}', '/portal/VideoGallery', '/portal/merchant/videogallery{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const ObjVIDEODATA = await DAL_VideoGallery.Login_Check(Plid);
  res.json({ view: '~/Views/CustomerPanel/VideoGallery/Index.cshtml', Model: mapRows(ObjVIDEODATA || [], VIDEO_PROPS) });
}));

// auth (unguarded session cast)
router.all('/portal/VideoGallery/InsertingVideo{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  let { Title, Vcode } = req.p;
  const { Vdid } = req.p; // PmidParam unused in legacy
  let ReturnResultMessage = '';
  const Plid = Number(req.user.plid);
  const pm = await db.scalar(DB, 'select pmid from portal_master where plid = @plid and active::int = 1 limit 1', { plid: Plid });
  const Pmid = pm === null || pm === undefined ? 0 : Number(pm);
  if (Pmid <= 0) ReturnResultMessage = 'Your Session Expired Please Login Again.'; // overwritten below, as in legacy
  Title = csReplace(Title.toString(), 'SingleInvertedComa', "'"); // legacy: null -> NullReferenceException
  Vcode = csReplace(Vcode.toString(), 'SingleInvertedComa', "'");
  if (Vcode.indexOf('iframe') > -1) {
    const IndexOfSrc = Vcode.indexOf('src');
    const Ind1Coma = Vcode.indexOf('"', IndexOfSrc + 1);
    const Ind2Coma = Ind1Coma < 0 ? -1 : Vcode.indexOf('"', Ind1Coma + 1);
    if (Ind1Coma < 0 || Ind2Coma < 0) throw new RangeError('Length cannot be less than zero.');
    Vcode = Vcode.substring(Ind1Coma + 1, Ind2Coma);
  }
  ReturnResultMessage = await DAL_VideoGallery.InsertingVideo(Title, Vcode, Vdid, String(Pmid));
  if (ReturnResultMessage === '1') ReturnResultMessage = 'Your Video Updated Sucessfully.';
  else if (ReturnResultMessage === '3') ReturnResultMessage = 'You Can Add Only Eight Video.';
  else ReturnResultMessage = 'There Is Some Error While Updating Video.';
  res.json(ReturnResultMessage);
}));

module.exports = router;
