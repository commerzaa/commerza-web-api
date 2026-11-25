'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TakeImageController.cs (class Common.Controllers.AdminPanel.TakeImageController => /admin/TakeImage/...)
// Database: affiliate (Db_Affiliate). Table tbl_bit64codeimage.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, mapPath, cleanName, nullRef, decodeBase64Image } = require('./_shared/batch11-common');
const { viewRes, rnd, legacyBase64Bytes, loadImage, saveImageAsIs } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'TakeImage';

/** select imagecode as imageurl from tbl_bit64codeimage => List<image_url> ; ViewBag.Base64String = same list */
async function imageView(res, viewName) {
  const img = mapRows(await db.query(DB, 'select imagecode as imageurl from tbl_bit64codeimage', {}), ['imageurl']);
  return viewRes(res, viewName, img, { Base64String: img });
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin page data => adminAuth)
// route-config: "AdminPanel/TakeImage" -> TakeImage/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/TakeImage'], adminAuth, asyncHandler(async (req, res) =>
  imageView(res, '~/Views/AdminPanel/TakeImage/inded.cshtml')));

// ---------------------------------------------------------------- ActionResult cropimage()
// auth (legacy had no session check; admin page data => adminAuth)
// route-config: "AdminPanel/TakeImage-withcrop" -> TakeImage/cropimage
router.all([`/admin/${C}/cropimage{/:id}`, '/admin/AdminPanel/TakeImage-withcrop'], adminAuth, asyncHandler(async (req, res) =>
  imageView(res, '~/Views/AdminPanel/TakeImage/cropimage.cshtml')));

// ---------------------------------------------------------------- ActionResult cropimage1()
// auth (legacy had no session check; admin page data => adminAuth)
// route-config: "AdminPanel/TakeImage-withcrop1" -> TakeImage/cropimage1
router.all([`/admin/${C}/cropimage1{/:id}`, '/admin/AdminPanel/TakeImage-withcrop1'], adminAuth, asyncHandler(async (req, res) =>
  imageView(res, '~/Views/AdminPanel/TakeImage/cropimage1.cshtml')));

// ---------------------------------------------------------------- ActionResult cropimage2()
// auth (legacy had no session check; admin page data => adminAuth)
// route-config: "AdminPanel/TakeImage-withcrop2" -> TakeImage/cropimage2
router.all([`/admin/${C}/cropimage2{/:id}`, '/admin/AdminPanel/TakeImage-withcrop2'], adminAuth, asyncHandler(async (req, res) =>
  imageView(res, '~/Views/AdminPanel/TakeImage/cropimage2.cshtml')));

// ---------------------------------------------------------------- ActionResult cropimage4()
// auth (legacy had no session check; admin page data => adminAuth)
// route-config: "AdminPanel/TakeImage-withcrop4" -> TakeImage/cropimage4
router.all([`/admin/${C}/cropimage4{/:id}`, '/admin/AdminPanel/TakeImage-withcrop4'], adminAuth, asyncHandler(async (req, res) =>
  imageView(res, '~/Views/AdminPanel/TakeImage/cropimage4.cshtml')));

// ---------------------------------------------------------------- [HttpPost] ActionResult ScreenShot(FormCollection formCollection)
// auth (legacy had no session check; writes files on the server => adminAuth)
router.post(`/admin/${C}/ScreenShot{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const screenShot = nStr((req.body || {}).capturedShot !== undefined ? req.body.capturedShot : req.p.capturedShot);
  if (screenShot === null) throw nullRef();
  const trimmedData = screenShot.split('data:image/png;base64,').join('');
  const uploadedImage = decodeBase64Image(trimmedData); // Convert.FromBase64String
  const fileName = crypto.randomUUID() + '.png';
  const p = mapPath('~/App_Data/' + fileName);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, uploadedImage);
  return viewRes(res, '~/Views/TakeImage/ScreenShot.cshtml'); // return View()
}));

// ---------------------------------------------------------------- JsonResult Details(string IMAGE)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/Details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IMAGE = nStr(req.p.IMAGE);
  // #region TicketImage
  let regNo = req.user.emp_id;
  const Vcode = rnd(100000, 555555);
  regNo = Vcode;
  const loginid = req.user.emp_loginid;
  let imgname = '';
  if (IMAGE === null) throw nullRef();
  if (IMAGE.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.adminpanelticketcenter || '';
    if (IMAGE !== '') {
      base64String = IMAGE;
      imgname = cleanName(loginid) + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    const b = legacyBase64Bytes(base64String);
    await loadImage(b); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      const o = path.join(mapPath(SavePaths), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    } else {
      saveImageAsIs(b, strValidFullName); // img.Save(strValidFullName)
    }
  }
  // #endregion TicketImage
  return res.json(imgname);
}));

module.exports = router;
