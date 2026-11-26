'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\Post_Blog.cs (class Post_BlogController => /portal/Post_Blog/...)
// Database: shopping (Db_Shopping). EF _Blog_Master = Tbl_SubmitedBlogMaster, _Topic_Master = Tbl_TopicMaster.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB, NRE, nStr, s, rep, cvtInt, reqInt } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/Post_Blog';

// ---------------------------------------------------------------- Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/post-blog" -> Post_Blog/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/post-blog'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = { TSBMID: 0 };
  const id = nStr(req.p.id);
  if (id !== null) {
    const TECMID = cvtInt(UtilityClass.Decryptword(id));
    const row = await db.queryOne(DB, 'select * from tbl_submitedblogmaster where tsbmid = @id limit 1', { id: TECMID });
    if (row) {
      ViewBag.Titles = row.title;
      ViewBag.Introduction = row.introduction;
      ViewBag.Description = row.description;
      ViewBag.Conclusion = row.conclusion;
      ViewBag.TSBMID = row.tsbmid;
      ViewBag.TTMID = row.ttmid;
      ViewBag.Images = row.blogimage;
    }
  }
  res.json({ view: '~/Views/CustomerPanel/Post_Blog/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- Add_Blog(Title, Introduction, Description, Conclusion, int TSBMID, int Topic, ImageByte64)
// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all(`${C}/Add_Blog{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Title = nStr(req.p.Title); let Introduction = nStr(req.p.Introduction);
  let Description = nStr(req.p.Description); let Conclusion = nStr(req.p.Conclusion);
  const TSBMID = reqInt(req.p.TSBMID, 'TSBMID');
  const Topic = reqInt(req.p.Topic, 'Topic');
  const ImageByte64 = nStr(req.p.ImageByte64);
  let ImageName = '';
  if (Title === null || Introduction === null || Description === null || Conclusion === null) throw NRE();
  Title = rep(Title, '+#!#+', '<'); Title = rep(Title, '+!#!+', '>');
  Introduction = rep(Introduction, '+#!#+', '<'); Introduction = rep(Introduction, '+!#!+', '>');
  Description = rep(Description, '+#!#+', '<'); Description = rep(Description, '+!#!+', '>');
  Conclusion = rep(Conclusion, '+#!#+', '<'); Conclusion = rep(Conclusion, '+!#!+', '>');
  let Result = '';
  const Plid = Number(req.user.plid);
  if (ImageByte64 !== '' && ImageByte64 !== null) {
    const ImageArray = ImageByte64.split('^');
    for (let i = 0; i < ImageArray.length; i++) {
      if (i > 2) break; // Upto Two Images will be saved. Others will be skipped
      ImageName += s(await UtilityClass.ImageUploadMasterMethod(ImageArray[i], '~/Blog_Images', '~/Blog_Images/Thumbnails',
        UtilityClass.ImageMode.Both, "BlogImage_'" + Plid + "'_")) + '~';
    }
  }
  if (ImageName !== '') ImageName = ImageName.replace(/~+$/, '');
  const r = await db.procOne(DB, 'usp_submitedblogmaster', {
    Mode: cvtInt('2'), PLID: Math.round(Plid), Title, Introduction, Description, Conclusion, TTMID: Topic, TSBMID, Images: ImageName,
  });
  Result = s(r && r.intresult);
  res.json(Result);
}));

// ---------------------------------------------------------------- Topic_Show(int Topicid)
// public (no session check in legacy)
router.all(`${C}/Topic_Show{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const Topicid = reqInt(req.p.Topicid, 'Topicid');
  let RetMsg = 'Invalid';
  const RowSp = await db.queryOne(DB, 'select * from tbl_topicmaster where ttmid = @id and isactive = 1 limit 1', { id: Topicid });
  if (!RowSp) return res.json(RetMsg);
  // EF materialisation of non-nullable Topic_Master properties (TopicTypeId, Status, TotalRemainPosting) throws on NULL columns
  for (const k of ['topictypeid', 'status', 'totalremainposting']) {
    if (RowSp[k] === null || RowSp[k] === undefined) {
      throw new Error(`The '${k}' property on 'Topic_Master' could not be set to a 'null' value.`);
    }
  }
  RetMsg = 'valid|^' + s(RowSp.postinginstruction) + '^' + s(RowSp.topicname) + '^' + s(RowSp.instructionforintroduction) + '^'
    + s(RowSp.instructionfordescription) + '^' + s(RowSp.instructionforconclusion) + '^' + s(RowSp.totalremainposting) + '^'
    + s(RowSp.accuracytips) + '^' + s(RowSp.minnoofwords) + '^' + s(RowSp.maxnoofwords);
  return res.json(RetMsg);
}));

module.exports = router;
