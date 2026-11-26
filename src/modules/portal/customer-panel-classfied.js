'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Classfied.cs (ClassfiedController, 2 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const Classified_Master = require('../../lib/portal/Classified_Master');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcInt, nullRef, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'Classfied';

// ---------------------------------------------------------------- Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/post-classified -> Classfied/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/referral/post-classified'], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcStr(req, 'id');
  const ViewBag = { TSCMID: 0 };
  if (id !== null) {
    const TSCMID = toInt32(await UtilityClass.Decryptword(id));
    const row = mapRow(await db.queryOne(DB, 'select * from tbl_submitedclassifiedmaster where tscmid = @TSCMID limit 1', { TSCMID }),
      Classified_Master.PROPS);
    if (row !== null) {
      ViewBag.Titles = row.Title;
      ViewBag.Description = row.Description;
      ViewBag.TSCMID = row.TSCMID;
      ViewBag.TTMID = row.TTMID;
      ViewBag.Images = row.BlogImage;
    }
  }
  return res.json({ view: '~/Views/CustomerPanel/Classfied/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult Add_Blog(string Title, string Description, int TSCMID, int Topic, string ImageByte64)
// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all(`/portal/${C}/Add_Blog{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Title = mvcStr(req, 'Title');
  let Description = mvcStr(req, 'Description');
  const TSCMID = mvcInt(req, 'TSCMID');
  const Topic = mvcInt(req, 'Topic');
  const ImageByte64 = mvcStr(req, 'ImageByte64');
  let ImageName = '';
  if (Title === null) nullRef();
  Title = Title.split('+#!#+').join('<');
  Title = Title.split('+!#!+').join('>');
  if (Description === null) nullRef();
  Description = Description.split('+#!#+').join('<');
  Description = Description.split('+!#!+').join('>');
  let Result = '';

  const Plid = req.user.plid;
  // legacy: if (ImageByte64 != "" || ImageByte64 != null) is always true
  if (ImageByte64 === null) nullRef();
  const ImageArray = ImageByte64.split('^');
  for (let i = 0; i < ImageArray.length; i++) {
    if (i > 2) {
      break; // Upto Two Images will be saved. Others will be skipped
    }
    ImageName += await UtilityClass.ImageUploadMasterMethod(ImageArray[i], '~/Classified_Images', '~/Classified_Images/Thumbnails',
      UtilityClass.ImageMode.Both, "BlogImage_'" + Plid + "'_") + '~';
  }
  if (ImageName !== '') {
    ImageName = ImageName.replace(/~+$/, '');
  }
  // DBO.Usp_SubmitedClassifiedMaster @Mode,@PLID,@Title,@Description,@TTMID,@IntResult OUT,@TSCMID,@Images
  const rows = await db.proc(DB, 'usp_submitedclassifiedmaster', {
    mode: toInt32('2'), plid: toInt32(Plid), title: Title, description: Description, ttmid: Topic, tscmid: TSCMID, images: ImageName,
  });
  const v = outOf(rows, 'intresult');
  Result = v === undefined || v === null ? '' : String(v);
  return res.json(Result);
}));

module.exports = router;
