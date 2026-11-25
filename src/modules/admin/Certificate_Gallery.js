'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Certificate_Gallery.cs (class Certificate_GalleryController => /admin/Certificate_Gallery/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { s, col, str } = require('./_shared/batch04A_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Certificate_Gallery';
const upload = multer({ storage: multer.memoryStorage() });

/** class CertificateGallery */
const PROPS = ['RegNo', 'TCFG', 'rownumber', 'Images', 'ImageUrl', 'Status', 'IsActive'];

// ---------------------------------------------------------------- ActionResult Index(MasterImageUpload ObjMasterImageUpload)
// auth (legacy had no session check; uploads gallery images => protected)
// route-config: "AdminPanel/Certificate-Gallery" -> Certificate_Gallery/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Certificate-Gallery'], adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const scaleFactor = 1;
  let Filename = '';
  const DomainName = `${req.protocol}://${req.get('host')}`; // uri.Scheme + "://" + uri.Authority
  // ObjMasterImageUpload.FileUploader (IEnumerable<HttpPostedFileBase>): null when no such file field was posted
  const files = (req.files || []).filter((f) => f.fieldname.toLowerCase() === 'fileuploader');
  const FileUploader = files.length ? files : null;
  const ViewBag = {};
  if (FileUploader !== null) {
    let ImageName = '';
    try {
      for (const File of FileUploader) {
        Filename = path.basename(File.originalname);
        const thePictureAsBytes = File.buffer;
        const randomnumb = String(Math.floor(Math.random() * 999999)).padStart(6, '0'); // generator.Next(0, 999999).ToString("D6")
        Filename = 'CertificateGallery' + randomnumb + '_' + (await UtilityClass.GetTimestamp(new Date())) + '.jpeg';
        const strValidFullName = path.join(config.uploadDir, 'MasterImageUploads', Filename); // Server.MapPath("~/MasterImageUploads/" + Filename)
        let filesize = thePictureAsBytes.length;
        filesize /= 1024;
        await UtilityClass.ResizeImage(strValidFullName, scaleFactor, filesize, thePictureAsBytes, 'MasterImageUploads');
        // Image.FromFile(strValidFullName) + Save(ms1, Jpeg) + ToBase64String (result unused; throws when the file is missing / not an image)
        const saved = fs.readFileSync(strValidFullName);
        const sharp = require('sharp');
        await sharp(saved).jpeg().toBuffer();
      }
      ImageName = ImageName.replace(/,+$/, '');
      // Usp_CertificateGallery @Mode,@RegNo,@ImageName,@ImageUrl,@Status,@IsActive,@StrResult out
      const row = await db.procOne(DB, 'Usp_CertificateGallery', {
        Mode: '1', RegNo: '0', ImageName: Filename, ImageUrl: '' + DomainName + '/MasterImageUploads/', Status: '1', IsActive: '1',
      });
      str(col(row, 'strresult')); // string message = spOutput.Value.ToString(); (unused)
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'Index');
      ViewBag.Message = ExpObj.message;
      return res.json({ view: '~/Views/AdminPanel/Certificate_Gallery/Index.cshtml', Model: null, ...ViewBag });
    }
  }
  const ObjMasterImage = mapRows(await db.proc(DB, 'Usp_CertificateGallery', {
    Mode: '2', RegNo: '', ImageName: '', ImageUrl: '', Status: '', IsActive: '',
  }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Certificate_Gallery/Index.cshtml', Model: ObjMasterImage, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult DeleteImage(string TCFG)
// auth (legacy had no session check; deletes gallery images => protected)
router.all(`/admin/${C}/DeleteImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TCFG = s(req.p.TCFG);
  try {
    // Update tbl_certificateGallery set IsActive = 0, Status = 0 Where TCFG = '<TCFG>'  (parameterised; '' converted to 0 like SQL Server)
    await db.exec(DB, "update tbl_certificategallery set isactive = 0, status = 0 where tcfg = cast(coalesce(nullif(trim(@TCFG), ''), '0') as int)",
      { TCFG: TCFG === null ? '' : TCFG });
    const result = 'success';
    return res.json(result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DeleteImage');
    // PORT-NOTE: Json(ExpObj) serialised the Exception object; the main public properties are returned.
    return res.json({ ClassName: 'System.Exception', Message: ExpObj.message, StackTrace: ExpObj.stack || null, Source: null, InnerException: null });
  }
}));

module.exports = router;
