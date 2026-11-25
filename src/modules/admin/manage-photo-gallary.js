'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Manage_Photo_Gallary.cs (class Manage_Photo_GallaryController => /Manage_Photo_Gallary/...)
// Database: affiliate (Db_Affiliate) via lib Photo_Gallary (tbl_photogallary).
// Config: PhotoGallary (legacy AppSettings["PhotoGallary"], a virtual folder mapped with Server.MapPath).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const Photo_Gallary = require('../../lib/admin/Photo_Gallary');
const { adminAuth } = require('./_shared/admin-session');
const { nStr, reqInt, mapPath, netFormat, nullRef } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Manage_Photo_Gallary';

// private static bool ThumbnailCallback() { throw new NotImplementedException(); }
// (GDI+ abort callback for GetThumbnailImage; never invoked in practice - kept for completeness, not routed)
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Inexd","adminlogin") (sic))
// route-config: "AdminPanel/Manage-Photo-Gallary" -> Manage_Photo_Gallary/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-Photo-Gallary'], adminAuth, asyncHandler(async (req, res) => {
  const obj = new Photo_Gallary();
  await obj.ShowPhotoGallary('gallary'); // (legacy called it twice)
  return res.json({ view: '~/Views/AdminPanel/Manage_Photo_Gallary/Index.cshtml', Model: await obj.ShowPhotoGallary('gallary') });
}));

// ---------------------------------------------------------------- JsonResult RemovePhoto(int PGID)
// auth (reads Session["Admin_User"].Emp_Code first => NullReferenceException without a session)
router.all(`/admin/${C}/RemovePhoto{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PGID = reqInt(req.p.PGID, 'PGID');
  const empcode = req.user.emp_code; void empcode;
  const ret = await new Photo_Gallary().RemovePhoto(PGID);
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult AddPhoto(int PGID, string imagename)
// auth (reads Session["Admin_User"].Emp_Code after saving the image => NullReferenceException without a session)
router.all(`/admin/${C}/AddPhoto{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  reqInt(req.p.PGID, 'PGID'); // bound, unused
  const imagename = nStr(req.p.imagename);
  if (imagename === null) throw nullRef();
  let imgname = '';
  if (imagename.trim() !== '') {
    const SavePaths = config.app.PhotoGallary || '';
    let base64String = '';
    if (imagename !== '') {
      base64String = imagename;
      if (imagename.length < 10) throw new Error('Index and length must refer to a location within the string.\r\nParameter name: length');
      let ProfileImage = 'photog-gallary_' + imagename.substring(0, 10) + '_';
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '_' + netFormat(new Date(), 'ddMMhhmmss') + '.jpg';
    } else {
      imgname = ' ';
    }
    const dir = mapPath(SavePaths);
    const strValidFullName = path.join(dir, imgname);
    if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
    const t = base64String.replace(/\s/g, '');
    if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
      throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
    }
    const b = Buffer.from(t, 'base64');
    const sharp = require('sharp');
    await sharp(b).metadata(); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // oldimage is always "" (legacy) => no delete
    // GetThumbnailImage(img.Width, img.Height) -> Save(ImageFormat.Jpeg) -> re-read -> imgnew.Save(strValidFullName) (JPEG, same size)
    // PORT-NOTE: System.Drawing replaced by sharp (same-size JPEG re-encode).
    const jpeg = await sharp(b).jpeg().toBuffer();
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(strValidFullName, jpeg);
  }
  const empcode = req.user.emp_code; void empcode;
  const ret = await new Photo_Gallary().AddPhoto('gallary', imgname, '');
  return res.json(ret);
}));

module.exports = router;
