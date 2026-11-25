'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\video_galleryController.cs (class video_galleryController => /admin/video_gallery/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_MasterImageUpload_Video, Usp_FlyerManagement. Table: tbl_imagegallery.
// Folder: <uploadDir>/VideoUpload.
//
// Coverage: Index -> route ; DeleteImage (JsonResult) -> route.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch11-common');
const { viewJson } = require('./_shared/batch13-11-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'video_gallery';
const upload = multer({ storage: multer.memoryStorage() });

/** class MasterImages (Controllers/AdminPanel/MasterImageUploadController.cs) */
const PROPS = ['RegNo', 'IGID', 'rownumber', 'Images', 'ImageUrl', 'Status', 'IsActive', 'Title', 'ImagesName'];

// ---------------------------------------------------------------- ActionResult Index(MasterImageUpload MasterImageUpload, string txtvideotitle, string chkActive, string ddlcat)
// auth (PORT-NOTE: legacy had no session check; uploads gallery videos - protected)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, upload.any(), asyncHandler(async (req, res) => {
  let Filename = '';
  const DomainName = `${req.protocol}://${req.get('host')}`; // string.Format("{0}://{1}", uri.Scheme, uri.Authority)
  const txtvideotitle = B.nStr(req.p.txtvideotitle);
  let chkActive = B.nStr(req.p.chkActive);
  const ddlcat = B.nStr(req.p.ddlcat);
  // MasterImageUpload.FileUploader (IEnumerable<HttpPostedFileBase>): null when no such file field was posted
  const files = (req.files || []).filter((f) => f.fieldname.toLowerCase() === 'fileuploader');
  const FileUploader = files.length ? files : null;
  const ViewBag = {};
  if (FileUploader !== null) {
    let ImageName = '';
    try {
      let IsExist = 0;
      const No = Math.floor(Math.random() * 100000); // rnd.Next(100000)
      for (const File of FileUploader) {
        Filename = path.basename(File.originalname); // System.IO.Path.GetFileName(File.FileName)
        // Select count(1) From Tbl_ImageGallery Where Type=0 and Isactive=1 and REPLACE(SUBSTRING(Images, CHARINDEX('_', Images), LEN(Images)), '_','') = '<Filename>'
        IsExist = Number(await db.scalar(DB, `select count(1) from tbl_imagegallery where type = 0 and isactive = 1
          and replace(substring(images from position('_' in images) for length(images)), '_', '') = @Filename`, { Filename }) || 0);
        if (IsExist === 0) {
          const dest = B.mapPath('~/VideoUpload/' + No + '_' + Filename);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, File.buffer); // File.SaveAs(...)
          ImageName += No + '_' + Filename + ',';
          break;
        }
      }
      ImageName = ImageName.replace(/,+$/, '');
      if (IsExist === 0) {
        // Usp_MasterImageUpload_Video @RegNo,@ImageName,@ImageUrl,@Status,@IsActive,@Title,@CategoryType
        // PORT-NOTE: the schema dump's Usp_MasterImageUpload_Video has no @CategoryType parameter (legacy SQL Server raised "too many
        // arguments" => caught below); the argument is still passed so the behaviour follows the deployed procedure.
        await db.proc(DB, 'Usp_MasterImageUpload_Video', {
          RegNo: '0', ImageName, ImageUrl: '' + DomainName + '/VideoUpload/' + No + '_' + Filename, Status: '1', IsActive: '1',
          Title: txtvideotitle, CategoryType: ddlcat,
        });
        // MasterImageUpload.FileUploader = null;
        if (chkActive === null) throw B.nullRef(); // chkActive.ToUpper()
        if (chkActive.toUpperCase() === 'on'.toUpperCase()) chkActive = '1';
        else chkActive = '0';
        // [Usp_FlyerManagement] @Mode,@TFMID,@ContentType,@Title,@Name,@Status,@IsActive,@StrResult out
        const row = await db.procOne(DB, 'Usp_FlyerManagement', {
          Mode: '1', TFMID: '0', ContentType: '1', Title: txtvideotitle, Name: ddlcat, Status: '1', IsActive: B.cvtInt(chkActive),
        });
        const result = B.str(B.col(row, 'strresult')); void result;
      }
    } catch (ExpObj) {
      ViewBag.Message = ExpObj.message;
    }
  }
  // Select ROW_NUMBER() Over (Order by IGID Desc) as rownumber, *, REPLACE(SUBSTRING(Images, CHARINDEX('_', Images), LEN(Images)), '_','') as [ImagesName]
  //   From Tbl_ImageGallery Where IsActive = 1 and Type=0
  const ObjMasterImage = mapRows(await db.query(DB, `select row_number() over (order by igid desc) as rownumber, *,
      replace(substring(images from position('_' in images) for length(images)), '_', '') as imagesname
    from tbl_imagegallery where isactive = 1 and type = 0`, {}), PROPS);
  return viewJson(res, '~/Views/AdminPanel/video_gallery/Index.cshtml', ObjMasterImage, ViewBag);
}));

// ---------------------------------------------------------------- JsonResult DeleteImage(string IGID)
// auth (PORT-NOTE: legacy had no session check; deactivates gallery items - protected)
router.all(`/admin/${C}/DeleteImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const IGID = B.nStr(req.p.IGID);
  try {
    // Update Tbl_ImageGallery set IsActive = 0, Status = 0 Where IGID = '<IGID>'  (parameterised; '' => 0 like SQL Server's implicit conversion)
    await db.exec(DB, "update tbl_imagegallery set isactive = 0, status = 0 where igid = cast(coalesce(nullif(trim(@IGID), ''), '0') as int)",
      { IGID: IGID === null ? '' : IGID });
    const result = 'success';
    return res.json(result);
  } catch (Ex) {
    // PORT-NOTE: Json(Ex) serialised the Exception object (legacy did not log it); the main public properties are returned.
    return res.json({ ClassName: 'System.Exception', Message: Ex.message, StackTrace: Ex.stack || null, Source: null, InnerException: null });
  }
}));

module.exports = router;
