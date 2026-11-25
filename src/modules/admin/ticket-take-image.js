'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TicketTakeImageController.cs
// (class Common.Controllers.AdminPanel.TicketTakeImageController => /admin/TicketTakeImage/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, mapPath, cleanName, nullRef } = require('./_shared/batch11-common');
const { csSubstring, imageFromStream, body, fromBase64 } = require('./_shared/batch13-09-common');

const router = express.Router();
const C = 'TicketTakeImage';

/** class image_url */
const IMAGE_URL_PROPS = ['imageurl'];

// ---------------------------------------------------------------- ActionResult Index(string url)
// public (legacy had no session check; view only, echoes the url)
// route-config: "AdminPanel/Ticket-Image" -> TicketTakeImage/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ticket-Image'], asyncHandler(async (req, res) => {
  const url = nStr(req.p.url);
  const ViewBag = {};
  ViewBag.URL = url;
  if (url === null) throw nullRef(); // url.Split('/') on null
  const imagename = url.split('/');
  const name = imagename[imagename.length - 1];
  ViewBag.name = name;
  return res.json({ view: '~/Views/AdminPanel/TicketTakeImage/inded.cshtml', ...ViewBag });
}));

/** select imagecode as imageurl from tbl_bit64codeimage */
async function loadImages() {
  return mapRows(await db.query(DB, 'select imagecode as imageurl from tbl_bit64codeimage'), IMAGE_URL_PROPS);
}

// ---------------------------------------------------------------- ActionResult cropimage() / cropimage1() / cropimage2() / cropimage4()
// auth (no session check in legacy; returns admin data from tbl_bit64codeimage => protected)
// route-config: "AdminPanel/TakeImage-withcrop{,1,2,4}" point at the TakeImage controller (not this one) => not registered here.
for (const a of ['cropimage', 'cropimage1', 'cropimage2', 'cropimage4']) {
  router.all(`/admin/${C}/${a}{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const img = await loadImages();
    return res.json({ view: `~/Views/AdminPanel/TakeImage/${a}.cshtml`, Model: img, Base64String: img });
  }));
}

// ---------------------------------------------------------------- [HttpPost] ActionResult ScreenShot(FormCollection formCollection)
// auth (no session check in legacy; writes a file on the server => protected)
router.post(`/admin/${C}/ScreenShot{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const screenShot = body(req, 'capturedShot');
  if (screenShot === null || screenShot === undefined) throw nullRef();
  // remove the image header details
  const trimmedData = String(screenShot).split('data:image/png;base64,').join('');
  // convert the base 64 string image to byte array
  const uploadedImage = fromBase64(trimmedData);
  // saving the image on the server
  const fileName = crypto.randomUUID() + '.png';
  const p = mapPath('~/App_Data/' + fileName);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, uploadedImage);
  return res.json({ view: '~/Views/TicketTakeImage/ScreenShot.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult Details(string IMAGE)
// auth (reads Session["Admin_User"])
// Config: adminpanelticketcenter
router.all(`/admin/${C}/Details{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IMAGE = nStr(req.p.IMAGE);
  // #region TicketImage
  let regNo = req.user.emp_id;
  const Vcode = 100000 + Math.floor(Math.random() * (555555 - 100000)); // Random.Next(100000, 555555)
  regNo = Vcode;
  const loginid = req.user.emp_loginid;
  let imgname = '';
  if (IMAGE === null) throw nullRef(); // IMAGE.Trim()
  if (IMAGE.trim() !== '') {
    let SavePaths = '';
    let base64String = '';
    let ImageExt = '';
    SavePaths = (config.app.adminpanelticketcenter || '');
    if (IMAGE !== '') {
      base64String = IMAGE;
      const ProfileImage = cleanName(loginid); // Trim, &amp; => And, & => " And ", [^\w\d] removed, " " => "-"
      // imgname = ProfileImage + "-" + regNo + ".jpg";
      imgname = ProfileImage + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      ImageExt = csSubstring(base64String, IndexNo, lastIndexNo - IndexNo);
      void ImageExt;
      const IndexNo1 = base64String.indexOf(',') + 1;
      const Pathlength1 = base64String.length;
      base64String = csSubstring(base64String, IndexNo1, Pathlength1 - IndexNo1);
    }
    const b = fromBase64(base64String); // Convert.FromBase64String
    const img = imageFromStream(b); // System.Drawing.Image.FromStream
    let filesize = b.length;
    filesize /= 1024;
    void filesize;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = ''; // param[9].Value.ToString();
    if (oldimage !== '') {
      const old = path.join(mapPath(SavePaths), oldimage);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    } else {
      // PORT-NOTE: img.Save(path) (System.Drawing re-encode in the raw format) => the decoded bytes are written unchanged.
      fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
      fs.writeFileSync(strValidFullName, img);
    }
  }
  // #endregion TicketImage
  //  Response.Redirect("/AdminPanel/Create-Ticket-ToSupport?url="+imgname+"");
  return res.json(imgname);
}));

module.exports = router;
