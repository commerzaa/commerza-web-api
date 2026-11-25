'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\MasterImageUploadController.cs (class MasterImageUploadController => /MasterImageUpload/...)
// Database: affiliate (Db_Affiliate). Proc: Usp_MasterImageUpload. Table: tbl_imagegallery. Folder: <uploadDir>/MasterImageUploads.
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
const { DB, nStr, outStr } = require('./_shared/batch09_common');

const router = express.Router();
const C = 'MasterImageUpload';
const upload = multer({ storage: multer.memoryStorage() });

/** class MasterImages */
const PROPS = ['RegNo', 'IGID', 'rownumber', 'Images', 'ImageUrl', 'Status', 'IsActive', 'Title', 'ImagesName'];

// ---------------------------------------------------------------- ActionResult Index(MasterImageUpload ObjMasterImageUpload, string Title)
// auth (PORT-NOTE: legacy had no session check; uploads gallery images - protected)
// route-config: "AdminPanel/MasterImageUpload" -> MasterImageUpload/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/MasterImageUpload'], adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const scaleFactor = 1;
  let Filename = '';
  const DomainName = `${req.protocol}://${req.get('host')}`; // string.Format("{0}://{1}", uri.Scheme, uri.Authority)
  const Title = nStr(req.p.Title);
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
        Filename = 'MasterImageUploads' + randomnumb + '_' + (await UtilityClass.GetTimestamp(new Date())) + '.jpeg';
        const strValidFullName = path.join(config.uploadDir, 'MasterImageUploads', Filename);
        let filesize = thePictureAsBytes.length;
        filesize /= 1024;
        await UtilityClass.ResizeImage(strValidFullName, scaleFactor, filesize, thePictureAsBytes, 'MasterImageUploads');
        // Image.FromFile(strValidFullName) + Save(ms1, Jpeg) + ToBase64String (result unused; throws when the file is missing / not an image)
        const saved = fs.readFileSync(strValidFullName);
        const sharp = require('sharp');
        await sharp(saved).jpeg().toBuffer();
      }
      ImageName = ImageName.replace(/,+$/, '');
      // Usp_MasterImageUpload @Mode,@RegNo,@ImageName,@ImageUrl,@Status,@IsActive,@StrResult out,@Title
      const row = await db.procOne(DB, 'Usp_MasterImageUpload', {
        Mode: '1', RegNo: '0', ImageName: Filename, ImageUrl: '' + DomainName + '/MasterImageUploads/', Status: '1', IsActive: '1', Title,
      });
      outStr(row, 'strresult'); // string message (unused)
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'Usp_MasterImageUpload');
      ViewBag.Message = ExpObj.message;
      return res.json({ view: '~/Views/AdminPanel/MasterImageUpload/Index.cshtml', Model: null, ...ViewBag });
    }
  }
  const ObjMasterImage = mapRows(await db.proc(DB, 'Usp_MasterImageUpload', {
    Mode: '2', RegNo: '', ImageName: '', ImageUrl: '', Status: '', IsActive: '',
  }), PROPS);
  return res.json({ view: '~/Views/AdminPanel/MasterImageUpload/Index.cshtml', Model: ObjMasterImage, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult DeleteImage(string IGID)
// auth (PORT-NOTE: legacy had no session check; deactivates gallery images - protected)
router.all(`/admin/${C}/DeleteImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IGID = nStr(req.p.IGID);
  try {
    // Update Tbl_ImageGallery set IsActive = 0, Status = 0 Where IGID = '<IGID>'  (parameterised; '' => 0 like SQL Server's implicit conversion)
    await db.exec(DB, "update tbl_imagegallery set isactive = 0, status = 0 where igid = cast(coalesce(nullif(trim(@IGID), ''), '0') as int)",
      { IGID: IGID === null ? '' : IGID });
    const result = 'success';
    return res.json(result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DeleteImage');
    // PORT-NOTE: Json(ExpObj) serialised the Exception object; the main public properties are returned.
    return res.json({ ClassName: 'System.Exception', Message: ExpObj.message, StackTrace: ExpObj.stack || null, Source: null, InnerException: null });
  }
}));

module.exports = router;
