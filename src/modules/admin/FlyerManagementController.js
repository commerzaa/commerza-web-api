'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FlyerManagementController.cs (class FlyerManagementController => /admin/FlyerManagement/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const FlyerManagement = require('../../lib/admin/FlyerManagement');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FlyerManagement';

/** Legacy concatenated '<value>' compared with an INT column: SQL Server converted '' (and null => '') to 0, an invalid string raised a
 *  conversion error (=> catch). PORT-NOTE: parameterised; '' / null => '0', other values cast to int in SQL (error => catch). */
const intText = (v) => (v === null || v === undefined || String(v).trim() === '' ? '0' : String(v).trim());

/** Json(ExpObj): PORT-NOTE - the legacy serialised the Exception object (JavaScriptSerializer); its public properties are approximated. */
const exceptionJson = (e) => ({
  ClassName: 'System.Exception', Message: e ? e.message : null, Data: {}, InnerException: null, HelpLink: null, Source: 'EntityFramework',
  HResult: -2146233088, StackTrace: null,
});

// ---------------------------------------------------------------- Index()
// public (legacy had no session check; read-only flyer/video list)
// route-config: "AdminPanel/FlyerManagement" -> FlyerManagement/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FlyerManagement'], asyncHandler(async (req, res) => {
  // PORT-NOTE: @Status / @IsActive were "" (SQL Server implicit conversion => 0); 0 is passed explicitly.
  const rows = await db.proc(DB, 'Usp_FlyerManagement', {
    Mode: 2, TFMID: 0, ContentType: 1, Title: '', Name: '', Status: 0, IsActive: 0,
  });
  const _ObjFlyerManagement = FlyerManagement.mapAll(rows);
  const ViewBag = {};
  ViewBag.message = B.outStr(rows[0], 'strresult'); // @StrResult OUT (result column)
  return res.json({ view: '~/Views/AdminPanel/FlyerManagement/Index.cshtml', Model: _ObjFlyerManagement, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult SaveVideo(string txtvideotitle, string txtembedcode, string chk)
// auth (PORT-NOTE: legacy had NO session check although it inserts flyer content - protected here)
router.all(`/admin/${C}/SaveVideo{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const txtvideotitle = B.nStr(req.p.txtvideotitle);
  const txtembedcode = B.nStr(req.p.txtembedcode);
  const chk = B.nStr(req.p.chk);
  const row = await db.procOne(DB, 'Usp_FlyerManagement', {
    Mode: 1, TFMID: 0, ContentType: 1, Title: txtvideotitle, Name: txtembedcode, Status: 1, IsActive: B.cvtInt(chk),
  });
  const result = B.outStr(row, 'strresult');
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult DeleteVideo(string TFMID)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/DeleteVideo{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = B.nStr(req.p.TFMID);
  try {
    await db.exec(DB, 'update tbl_flyermanagement set isactive = 0 where tfmid = cast(@TFMID as int)', { TFMID: intText(TFMID) });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DeleteVideo');
    return res.json(exceptionJson(ExpObj));
  }
}));

// ---------------------------------------------------------------- JsonResult MakeActive(string TFMID, string contentType)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/MakeActive{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = B.nStr(req.p.TFMID);
  const contentType = B.nStr(req.p.contentType);
  try {
    await db.exec(DB, 'update tbl_flyermanagement set isactive = 1, status = 1 where tfmid = cast(@TFMID as int) and contenttype = cast(@contentType as int)',
      { TFMID: intText(TFMID), contentType: intText(contentType) });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'MakeActive');
    return res.json(exceptionJson(ExpObj));
  }
}));

// ---------------------------------------------------------------- JsonResult DeleteVideoFromGallery(string TFMID)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/DeleteVideoFromGallery{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const TFMID = B.nStr(req.p.TFMID);
  try {
    await db.exec(DB, 'update tbl_flyermanagement set status = 0 where tfmid = cast(@TFMID as int)', { TFMID: intText(TFMID) });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DeleteVideo');
    return res.json(exceptionJson(ExpObj));
  }
}));

module.exports = router;
