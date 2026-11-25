'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\TreeIcon.cs (class TreeIconController => /admin/TreeIcon/...)
// Database: affiliate (Db_Affiliate). Procs USP_GetTreeIconDetails, Usp_UpdateTreeIconImage.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const { adminAuth } = require('./_shared/admin-session');
const { DB, mapPath } = require('./_shared/batch11-common');
const { sqlInt } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'TreeIcon';
const upload = multer({ storage: multer.memoryStorage() });

/** class TreeIconObject */
const TREE_ICON_PROPS = ['TIID', 'rownumber', 'Type', 'Images', 'IMG_MALE', 'IMG_FEMALE', 'IMGURL'];

const NRE = () => new Error('Object reference not set to an instance of an object.');

/** Request.Files[name] (first file posted under that field name, null when absent) */
const fileByName = (req, name) => (req.files || []).find((f) => f.fieldname === name) || null;

/**
 * Shared body of the 8 SaveAndUpdateTreeICON* actions (identical C# except the Request.Files key).
 * Returns the JsonResult value.
 */
async function saveAndUpdateTreeIcon(req, fieldName) {
  let ret = '';
  let Filename = '';
  const ip = GetIP.GetLocalIP(req); // eslint-disable-line no-unused-vars
  try {
    // HttpPostedFileBase file = Request.Files[0];
    const files = req.files || [];
    if (files.length < 1) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
    const file = files[0];
    if (file.size > 0) {
      const body = req.body || {};
      const TIID = body.TIID === undefined || body.TIID === null ? '' : String(body.TIID); // Convert.ToString(Request.Form["TIID"])
      const Mode = body.MODE === undefined || body.MODE === null ? '' : String(body.MODE);
      const TimeStamp = await UtilityClass.GetTimestamp(new Date());
      const named = fileByName(req, fieldName);
      if (!named) throw NRE(); // Request.Files["FileUploader..."].FileName on null
      const FileExtension = path.extname(named.originalname).toLowerCase();
      const validFileTypes = ['.jpg', '.png', '.gif', '.bmp'];
      const dir = mapPath('~/MasterImageUploads');
      const PathForFile = `${dir}/${TimeStamp}${named.originalname}`;
      Filename = path.basename(PathForFile);
      // if (!Directory.Exists(PathForFile)) => always true (it is a file path)
      fs.mkdirSync(dir, { recursive: true });
      if (FileExtension !== null || FileExtension !== '') { // (always true in legacy)
        if (validFileTypes.includes(FileExtension)) {
          if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
          fs.writeFileSync(PathForFile, named.buffer);
          // Usp_UpdateTreeIconImage @TIID,@Mode,@IMGURL,@StrResult out
          await db.proc(DB, 'Usp_UpdateTreeIconImage', { TIID: sqlInt(TIID), MODE: sqlInt(Mode), IMGURL: Filename });
          ret = '1';
        } else {
          return 'InvalidFile';
        }
      }
    }
  } catch (Ex) {
    return 'Some error occured while performing the operation(s).' + Ex.message;
  }
  return ret;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin settings page => adminAuth)
// route-config: "AdminPanel/TreeIcon" -> TreeIcon/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/TreeIcon{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const DetailsOfTreeIcon = mapRows(await db.proc(DB, 'USP_GetTreeIconDetails', {}), TREE_ICON_PROPS);
  return res.json({ view: '~/Views/AdminPanel/TreeIcon/Index.cshtml', Model: DetailsOfTreeIcon });
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICON1()  (Request.Files["FileUploaderMale1"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICON1{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderMale1'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICON2()  (Request.Files["FileUploaderMale2"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICON2{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderMale2'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICON3()  (Request.Files["FileUploaderMale3"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICON3{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderMale3'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICON4()  (Request.Files["FileUploaderMale4"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICON4{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderMale4'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICONFemale1()  (Request.Files["FileUploaderFemale1"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICONFemale1{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderFemale1'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICONFemale2()  (Request.Files["FileUploaderFemale2"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICONFemale2{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderFemale2'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICONFemale3()  (Request.Files["FileUploaderFemale3"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICONFemale3{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderFemale3'));
}));

// ---------------------------------------------------------------- JsonResult SaveAndUpdateTreeICONFemale4()  (Request.Files["FileUploaderFemale4"])
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/SaveAndUpdateTreeICONFemale4{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  res.json(await saveAndUpdateTreeIcon(req, 'FileUploaderFemale4'));
}));

module.exports = router;
