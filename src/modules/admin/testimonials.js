'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Testimonials.cs (class TestimonialsController => /admin/Testimonials/...)
// Database: affiliate (Db_Affiliate). Libs: Testimonial (tbl_testimonial), Photo_Gallary (tbl_photogallary).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const Testimonial = require('../../lib/admin/Testimonial');
const Photo_Gallary = require('../../lib/admin/Photo_Gallary');
const { adminAuth } = require('./_shared/admin-session');
const { nStr, reqInt, mapPath, cleanName, nullRef } = require('./_shared/batch11-common');
const { viewRes, rnd, legacyBase64Bytes, loadImage, saveImageAsIs } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Testimonials';

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (never used) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

/** public string imageupload(string imagename) */
async function imageupload(imagename) {
  let imgname = '';
  if (imagename === null || imagename === undefined) throw nullRef();
  if (imagename.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.Testimonial_Images || '';
    if (imagename !== '') {
      const no = rnd(0, 999999);
      base64String = imagename;
      imgname = cleanName('Testimonials') + no + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    const b = legacyBase64Bytes(base64String);
    await loadImage(b); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    // (oldimage == "" => no delete; newWidth1/newHeight1/radio computed but unused)
    saveImageAsIs(b, strValidFullName); // img.Save(strValidFullName)
  }
  return imgname;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Testimonials" and "AdminPanel/Customer-Speak" -> Testimonials/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Testimonials', '/admin/AdminPanel/Customer-Speak'], adminAuth,
  asyncHandler(async (req, res) => viewRes(res, '~/Views/AdminPanel/Testimonials/Index.cshtml', await new Testimonial().ShowTestimonialAll())));

// ---------------------------------------------------------------- JsonResult RemovePhoto(int PGID)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/RemovePhoto{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const PGID = reqInt(req.p.PGID, 'PGID');
  return res.json(await new Photo_Gallary().RemovePhoto(PGID));
}));

// ---------------------------------------------------------------- public string imageupload(string imagename)
// auth (public method => routable in legacy, no session check; writes files => adminAuth)
router.all(`/admin/${C}/imageupload{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.type('text/html').send(await imageupload(nStr(req.p.imagename)));
}));

// ---------------------------------------------------------------- JsonResult SubmitTestimonial(string Name, string Desc, string city, string memberimg)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SubmitTestimonial{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = 0;
  const image = await imageupload(nStr(req.p.memberimg));
  return res.json(await new Testimonial().AddTestimonial(nStr(req.p.Name), nStr(req.p.Desc), nStr(req.p.city), Regno, image));
}));

// ---------------------------------------------------------------- JsonResult UpdateTestimonial(string Name, string Desc, string city, int TID1, string memberimg)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateTestimonial{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TID1 = reqInt(req.p.TID1, 'TID1');
  const Regno = 0;
  const image = await imageupload(nStr(req.p.memberimg));
  return res.json(await new Testimonial().UpdateTestimonial(nStr(req.p.Name), nStr(req.p.Desc), nStr(req.p.city), Regno, TID1, image));
}));

// ---------------------------------------------------------------- JsonResult RemoveTesti(int TID)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/RemoveTesti{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TID = reqInt(req.p.TID, 'TID');
  return res.json(await new Testimonial().RemoveTestimonial(TID));
}));

// ---------------------------------------------------------------- JsonResult ApproveTesti(int TID)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/ApproveTesti{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TID = reqInt(req.p.TID, 'TID');
  return res.json(await new Testimonial().ApproveTestimonial(TID));
}));

// ---------------------------------------------------------------- JsonResult ShowTestimonialDetails(int TID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/ShowTestimonialDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TID = reqInt(req.p.TID, 'TID');
  // db._Testimonial.Where(a => a.TID == TID).OrderByDescending(a => a.Date).FirstOrDefault()  (same query as the lib method)
  return res.json(await new Testimonial().ShowTestimonialDetails(TID));
}));

module.exports = router;
