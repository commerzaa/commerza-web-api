'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\KYC_UploadWithDetail.cs (KYC_UploadWithDetailController) */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/KYC_UploadWithDetail';
const multerAny = multer({ storage: multer.memoryStorage() }).any(); // ImageUpload.FileUploader / FileUploaderBack / TakeFile (HttpPostedFileBase)
// parse multipart, then rebuild req.p so the form fields of the multipart body are bound too
const upload = (req, res, next) => multerAny(req, res, (err) => {
  if (err) return next(err);
  req.p = require('../../middleware/params').build(req);
  return next();
});
const BIND_PROPS = ['MKIID', 'ImageName', 'Photostatus', 'IDstatus', 'PANstatus', 'Bankstatus', 'KYCSTATUS'];
const IDTYPE_PROPS = ['IDTID', 'TITLE'];
const KYC_PROPS = ['ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'Photo', 'ID', 'Pan', 'Bank', 'DOB', 'IdType', 'IdRefNo', 'PANNO',
  'ImageName', 'KTID', 'MKDID', 'USERNAME', 'approvalstatus', 'ADMINREMARK', 'RESULT'];
const toInt = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const SaveKYCImages = () => (config.app && config.app.Kyc_Images) || '';
const KYC_DIR = () => path.join(config.uploadDir, 'Kyc_Images'); // Server.MapPath("~/Kyc_Images/")

async function logError(req, ex, PROCEDURENAME) {
  console.error(ex.message);
  try { await new DataUtility().ErrorInsert(0, ex.message, PROCEDURENAME, 0, req.path); } catch (e) { console.error(e.message); }
}
// SqlQuery<int>(...).FirstOrDefault(): first column of the first row, 0 when no rows
const firstInt = (rows) => {
  if (!rows.length) return 0;
  const r = rows[0];
  const v = r[Object.keys(r)[0]];
  return v === null || v === undefined ? 0 : Number(v);
};
// the uploaded HttpPostedFileBase (model property names may arrive prefixed, e.g. "ImageUpload.FileUploader")
const pickFile = (req, name) => (req.files || []).find((f) => f.fieldname.toLowerCase().replace(/^.*\./, '') === name.toLowerCase()) || null;
const pad6 = (n) => String(n).padStart(6, '0');

// void checkMemberExist() -> ViewBag.regno (or ViewBag.filepath on error)
async function checkMemberExist(req) {
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // @Result is an OUTPUT parameter (not sent)
    const rows = await proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: 3 });
    ViewBag.regno = firstInt(rows);
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
  return ViewBag;
}

// auth (null session => RedirectToAction("Index","Home"))
// route-config: "referral/sVXIBiDIdcV89aVA1RaqpNZSn1tGFp7W==" -> KYC_UploadWithDetail/Index
router.all([`${P}/Index{/:id}`, P, '/member/referral/sVXIBiDIdcV89aVA1RaqpNZSn1tGFp7W=='], auth, upload, asyncHandler(async (req, res) => {
  let { img, ID, bank, pan } = req.p;
  const TempData = {};
  if (img == null) {
    img = '';
  } else {
    const ar = String(img).split('^');
    sessionStore.set(req, 'Photo', ar[0]);
    if (ar.length < 2) throw new Error('Index was outside the bounds of the array.');
    TempData.Photoapprove = String(ar[1]);
  }
  if (ID == null) {
    ID = '';
  } else {
    const ar = String(ID).split('^');
    sessionStore.set(req, 'ID', ar[0]);
    if (ar.length < 2) throw new Error('Index was outside the bounds of the array.');
    TempData.IDapprove = String(ar[1]);
  }
  if (bank == null) {
    bank = '';
  } else {
    const ar = String(bank).split('^');
    sessionStore.set(req, 'bank', ar[0]);
    if (ar.length < 2) throw new Error('Index was outside the bounds of the array.');
    TempData.bankapprove = String(ar[1]);
  }
  if (pan == null) {
    pan = '';
  } else {
    const ar = String(pan).split('^');
    sessionStore.set(req, 'pan', ar[0]);
    if (ar.length < 2) throw new Error('Index was outside the bounds of the array.');
    TempData.panapprove = String(ar[1]);
  }
  sessionStore.set(req, 'ID', 'IDCard');
  sessionStore.set(req, 'Photo', 'photo');
  sessionStore.set(req, 'pan', 'pan');
  sessionStore.set(req, 'bank', 'bank');

  const ViewBag = await checkMemberExist(req);
  res.json({ Model: '', ViewBag, TempData });
}));

// auth (legacy dereferenced the session); `public void checkMemberExist()` is an empty-result action in legacy
router.all(`${P}/checkMemberExist{/:id}`, auth, asyncHandler(async (req, res) => {
  await checkMemberExist(req);
  res.status(200).end();
}));

// auth (legacy dereferenced the session)
router.all(`${P}/bindIDType{/:id}`, auth, asyncHandler(async (req, res) => {
  let lstid = [];
  try {
    // @Regno was sent as "" (=> 0 for the int parameter)
    lstid = mapRows(await proc(DB, 'usp_insertmemberkycimages', { regno: 0, imagename: '', mode: 4 }), IDTYPE_PROPS);
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
  }
  res.json(lstid);
}));

// auth (legacy dereferenced the session)
router.all(`${P}/bindbuttonwithstatus{/:id}`, auth, asyncHandler(async (req, res) => {
  let lstbuttonid = [];
  try {
    const Plid = Number(req.user.plid);
    lstbuttonid = mapRows(await proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: 6 }), BIND_PROPS);
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
  }
  res.json(lstbuttonid);
}));

// auth (legacy dereferenced the session)
router.all(`${P}/InsertKYC{/:id}`, auth, upload, asyncHandler(async (req, res) => {
  let { ExistFileName, ExistBackName, bankname, branchname, Accountholdername, AccountNo, IFSC, PAncard, ID_REF, ID_Type, DOB, MKDID, MODE } = req.p;
  if (ExistFileName == null) ExistFileName = '';
  if (ExistBackName == null) ExistBackName = '';
  if (bankname == null && ID_REF == null && PAncard == null) MODE = '1';
  if (bankname == null && ID_REF != null && PAncard == null) MODE = '2';
  if (bankname == null && ID_REF == null && PAncard != null) MODE = '3';
  if (bankname != null && ID_REF == null && PAncard == null) MODE = '4';
  if (MKDID === '' || MKDID == null) MKDID = '0';
  if (bankname == null) bankname = '';
  if (branchname == null) branchname = '';
  if (Accountholdername == null) Accountholdername = '';
  if (AccountNo == null) AccountNo = '';
  if (IFSC == null) IFSC = '';
  if (PAncard == null) PAncard = '';
  if (ID_REF == null) ID_REF = '';
  if (ID_Type == null) ID_Type = '';
  if (DOB == null) DOB = '';
  let result = '';
  const TempData = {};
  const ViewBag = {};
  const FileUploader = pickFile(req, 'FileUploader');
  const FileUploaderBack = pickFile(req, 'FileUploaderBack');

  try {
    const Plid = Number(req.user.plid);
    let thePictureDataAsString1 = '';
    const scaleFactor = 1;
    let filename = '';
    let getimage = '';
    let files = '';
    let strValidFullName = '';
    fs.mkdirSync(KYC_DIR(), { recursive: true });

    // Resize the uploaded picture, keep it as a base64 data URI and store that text in "<LoginID>_<timestamp>.txt" (legacy format)
    const storePicture = async (File) => {
      filename = path.basename(File.originalname);
      const extension = path.extname(filename);
      if (extension !== '.txt') {
        getimage = path.basename(File.originalname);
        const thePictureAsBytes = File.buffer;
        const randomnumb = pad6(Math.floor(Math.random() * 999999));
        getimage = 'Kyc_Images' + randomnumb + (await UtilityClass.GetTimestamp(new Date())) + '.jpeg';
        strValidFullName = path.join(KYC_DIR(), getimage);
        const filesize = thePictureAsBytes.length / 1024;
        await UtilityClass.ResizeImages(strValidFullName, scaleFactor, filesize, thePictureAsBytes, 'Kyc_Images');
        // PORT-NOTE: legacy re-encoded the resized file as JPEG through System.Drawing; here the resized file bytes are used as they are
        thePictureDataAsString1 = 'data:image/*;base64,' + fs.readFileSync(strValidFullName).toString('base64');
      }
      const Loginid = req.user.loginid;
      filename = Loginid + '_' + (await UtilityClass.GetTimestamp(new Date())) + '.txt';
      fs.writeFileSync(path.join(KYC_DIR(), filename), Buffer.from(thePictureDataAsString1, 'utf8'));
      const extension1 = path.extname(getimage);
      if (extension1 === '.jpeg') {
        try { fs.unlinkSync(strValidFullName); } catch (e) { /* File.Delete on a missing file is a no-op */ }
      }
    };

    if (FileUploader != null) {
      await storePicture(FileUploader);
      files = filename;
    } else {
      files += ExistFileName;
    }
    if (FileUploaderBack != null) {
      await storePicture(FileUploaderBack);
      files += '~' + filename;
    } else if ((FileUploader != null && ExistBackName !== '') || (ExistFileName !== '' && ExistBackName !== '')) {
      files += '~' + ExistBackName;
    }
    if (files !== '') {
      // @RESULT is an OUTPUT parameter (read from the result row)
      const rows = await proc(DB, 'usp_kycrequest', {
        mkdid: toInt(MKDID), regno: Math.trunc(Plid), photo: files, processdate: '', actiondate: '', status: '',
        bankname, branchname, accountholdername: Accountholdername, accountno: AccountNo, ifsccode: IFSC,
        pancard: PAncard, id_refno: ID_REF, id_type: ID_Type, dob: DOB, mode: MODE,
      });
      if (!rows.length || rows[0].result === null || rows[0].result === undefined) throw new Error('Object reference not set to an instance of an object.');
      result = String(rows[0].result);
      TempData.Success = result;
    } else {
      TempData.Success = 'Failed';
    }
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
    ViewBag.filepath = ex.message;
  }
  // RedirectToAction("Index", "KYC_UploadWithDetail")
  res.json({ redirect: 'KYC_UploadWithDetail/Index', TempData, ViewBag });
}));

// auth (legacy dereferenced the session); `public void checkImageUploadornot()` is an empty-result action in legacy
router.all(`${P}/checkImageUploadornot{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const Plid = Number(req.user.plid);
    await proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: 5 }); // ViewBag.checkuploadimages = first value
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
  }
  res.status(200).end();
}));

// auth (legacy dereferenced the session)
router.all(`${P}/bindKycDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  let lstkycdata = [];
  try {
    const Plid = Number(req.user.plid);
    lstkycdata = mapRows(await proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: toInt(req.p.mode) }), KYC_PROPS);
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
  }
  res.json(lstkycdata);
}));

// auth (legacy dereferenced the session)
router.all(`${P}/BindAdimnRemark{/:id}`, auth, asyncHandler(async (req, res) => {
  let lstkycdata = [];
  try {
    const Plid = Number(req.user.plid);
    lstkycdata = mapRows(await proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: toInt(req.p.mode) }), KYC_PROPS);
    // ViewBag.imgurl = SaveKYCImages (config key Kyc_Images) is not part of the JSON result
    void SaveKYCImages();
  } catch (ex) {
    await logError(req, ex, 'usp_InsertMemberKYCImages');
  }
  res.json(lstkycdata);
}));

// auth (legacy dereferenced the session; exceptions are rethrown like in legacy)
router.all(`${P}/Resubmit{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_resetkycstatus', { regno: Math.trunc(Plid), ktid: req.p.KTID });
  if (!rows.length || rows[0].result === null || rows[0].result === undefined) throw new Error('Object reference not set to an instance of an object.');
  res.json(String(rows[0].result));
}));

// public (no session use in legacy)
router.all(`${P}/CountAllowesPANNum{/:id}`, asyncHandler(async (req, res) => {
  let allowedpan = '';
  try {
    const rows = await proc(DB, 'usp_countnumberofusedpannumber', { panno: req.p.PANNUM });
    // @Result is an OUTPUT parameter (read from the result row)
    if (!rows.length || rows[0].result === null || rows[0].result === undefined) throw new Error('Object reference not set to an instance of an object.');
    allowedpan = String(rows[0].result);
  } catch (ex) {
    await logError(req, ex, 'USP_COUNTNUMBEROFUSEDPANNUMBER');
  }
  res.json(allowedpan);
}));

module.exports = router;
