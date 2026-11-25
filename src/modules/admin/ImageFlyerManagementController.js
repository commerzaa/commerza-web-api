'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ImageFlyerManagementController.cs
// (class ImageFlyerManagementController => /admin/ImageFlyerManagement/...). Database: affiliate (Db_Affiliate).
// The file also declares `public class ImageFlyerManagement` (plain model, unused here).
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'ImageFlyerManagement';
const upload = multer({ storage: multer.memoryStorage() });

/** bool model binding ("true" / "true,false" checkbox pair / "on") */
function bindBool(v) {
  if (Array.isArray(v)) v = v[0];
  if (v === undefined || v === null || v === '') return false;
  const s = String(v).split(',')[0].trim().toLowerCase();
  return s === 'true' || s === 'on';
}

/** Json(ExpObj) */
const exceptionJson = (e) => ({ ClassName: 'System.Exception', Message: e.message, StackTrace: e.stack || null, Source: null, InnerException: null });

// ---------------------------------------------------------------- ActionResult Index(FlyerManagement ObjFlyerManagement, string txttitle)
// auth (legacy had no session check; uploads flyer images => protected)
// route-config: "AdminPanel/ImageFlyerManagement" -> ImageFlyerManagement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/ImageFlyerManagement'], adminAuth, upload.any(),
  asyncHandler(async (req, res) => {
    const ViewBag = {};
    const body = req.body || {};
    const files = (req.files || []).filter((f) => String(f.fieldname).toLowerCase() === 'fileuploader');
    // ObjFlyerManagement (model binding)
    const ObjFlyerManagement = {
      FileUploader: files.length > 0 ? files : null,
      TFMID: B.nInt(req.p.TFMID) === null ? 0 : B.nInt(req.p.TFMID),
      Title: B.nStr(req.p.Title),
      Active: bindBool(body.Active !== undefined ? body.Active : req.p.Active),
      TYPE: B.nStr(req.p.TYPE),
    };
    let Filename = '';
    const scaleFactor = 1;
    if (ObjFlyerManagement.FileUploader !== null) {
      try {
        for (const File of ObjFlyerManagement.FileUploader) {
          Filename = path.basename(File.originalname || '');
          const thePictureAsBytes = File.buffer;
          const randomnumb = String(Math.floor(Math.random() * 999999)).padStart(6, '0'); // generator.Next(0, 999999).ToString("D6")
          Filename = 'FlyerImages' + randomnumb + '_' + (await UtilityClass.GetTimestamp(new Date())) + '.jpeg';
          const strValidFullName = B.mapPath('~/FlyerImages/' + Filename);
          let filesize = thePictureAsBytes.length;
          filesize /= 1024;
          await UtilityClass.ResizeImage(strValidFullName, scaleFactor, filesize, thePictureAsBytes, 'FlyerImages');
        }
        const active = ObjFlyerManagement.Active === true ? 1 : 0;
        if (ObjFlyerManagement.Title === null || ObjFlyerManagement.TYPE === null) throw B.nullRef(); // .Title.ToString() / .TYPE.ToString()
        // [Usp_FlyerManagement] @Mode,@TFMID,@ContentType,@Title,@Name,@Status,@IsActive,@StrResult out,@Imagetype
        const r = await db.procOne(DB, 'Usp_FlyerManagement', {
          Mode: '1', TFMID: ObjFlyerManagement.TFMID, ContentType: '2', Title: String(ObjFlyerManagement.Title), Name: Filename, Status: '1',
          IsActive: active, Imagetype: String(ObjFlyerManagement.TYPE),
        });
        void B.str(B.col(r, 'StrResult')); // string message = spOutput.Value.ToString(); (unused)
        ObjFlyerManagement.FileUploader = null;
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, 'Usp_FlyerManagement');
        ViewBag.Message = ExpObj.message;
        return res.json({ view: '~/Views/AdminPanel/ImageFlyerManagement/Index.cshtml', ...ViewBag });
      }
    }
    return res.json({ view: '~/Views/AdminPanel/ImageFlyerManagement/Index.cshtml', ...ViewBag });
  }));

// ---------------------------------------------------------------- JsonResult DeleteImage(string TFMID)
// auth (legacy had no session check; deactivates flyers => protected)
router.all(`/admin/${C}/DeleteImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = B.nStr(req.p.TFMID);
  try {
    // Update Tbl_FlyerManagement set IsActive = 0, Status = 0 Where TFMID = '<TFMID>'  (parameterised; '' converted to 0 like SQL Server)
    await db.exec(DB, "update tbl_flyermanagement set isactive = 0, status = 0 where tfmid = cast(coalesce(nullif(trim(@TFMID), ''), '0') as int)",
      { TFMID: TFMID === null ? '' : TFMID });
    const result = 'success';
    return res.json(result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DeleteImage');
    // PORT-NOTE: Json(ExpObj) serialised the Exception object; the main public properties are returned.
    return res.json(exceptionJson(ExpObj));
  }
}));

// ---------------------------------------------------------------- JsonResult MakeActive(string TFMID, string contentType, string MemberType)
// auth (legacy had no session check; changes flyers => protected)
router.all(`/admin/${C}/MakeActive{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = B.nStr(req.p.TFMID);
  const contentType = B.nStr(req.p.contentType);
  const MemberType = B.nStr(req.p.MemberType);
  try {
    let result = '';
    if (MemberType !== null && MemberType !== '') {
      const ct = contentType === null ? '' : contentType;
      await db.exec(DB, "update tbl_flyermanagement set isactive = 0 where contenttype = cast(coalesce(nullif(trim(@contentType), ''), '0') as int)",
        { contentType: ct });
      await db.exec(DB, `update tbl_flyermanagement set isactive = 1, status = 1
        where tfmid = cast(coalesce(nullif(trim(@TFMID), ''), '0') as int) and contenttype = cast(coalesce(nullif(trim(@contentType), ''), '0') as int)`,
      { TFMID: TFMID === null ? '' : TFMID, contentType: ct });
      result = 'success';
    }
    return res.json(result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'MakeActive');
    // PORT-NOTE: Json(ExpObj) serialised the Exception object; the main public properties are returned.
    return res.json(exceptionJson(ExpObj));
  }
}));

module.exports = router;
