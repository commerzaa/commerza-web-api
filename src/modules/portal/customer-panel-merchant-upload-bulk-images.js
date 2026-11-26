// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Merchant_UploadBulkImages.cs (class Merchant_UploadBulkImagesController; no DB access)
// Started from src/modules/merchant/merchant-upload-bulk-images.js, then matched line by line with the portal C#.
// PORT-NOTE: zip extraction (Ionic.Zip) uses the npm package `adm-zip` (lazy require, not installed => "failed^..." status like any legacy exception).
'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const P = '/portal/Merchant_UploadBulkImages';

// private static fields (shared by every request/user of the process, as in the legacy controller)
let count = 0;
let totalcount = 0;
let Message;
let running = 0;
// private string OriginalImageFolder = "../Product_Images_Large"; ThumbNailImageFolder = "../Product_Images"
// (Server.MapPath("../X") from /Merchant_UploadBulkImages/<action> resolves to the application root => <uploadDir>/X)
const OriginalImageFolder = '~/Product_Images_Large';
const ThumbNailImageFolder = '~/Product_Images';

const isImg = (f) => ['.png', '.jpg', '.jpeg'].includes(String(f.Extension).toLowerCase());
const str = (v) => (v === undefined || v === null ? '' : String(v));

function uploadAny(req, res, next) {
  const ct = String((req.headers && req.headers['content-type']) || '');
  if (!/multipart\/form-data/i.test(ct)) return next();
  const multer = require('multer');
  return multer({ storage: multer.memoryStorage() }).any()(req, res, next);
}

// auth ([SessionExpireCheck]); PrCode, search, filtercategory, page, ddlstatus are bound but unused
// route-config: merchant/UploadImage -> Merchant_UploadBulkImages/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/UploadImage'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const SellerCode = String(req.user.plid);
  const TempZipFodler = '~/TempZip/' + SellerCode;
  let p = b.mapPath(TempZipFodler);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  // Delete Thumbs.db File if Exist
  p = b.mapPath(TempZipFodler + '/Thumbs.db');
  if (fs.existsSync(p) && fs.statSync(p).isFile()) fs.unlinkSync(p);
  const files = b.listFiles(b.mapPath(TempZipFodler)).filter((a) => a.Extension === '.zip');
  res.json({ view: '~/Views/CustomerPanel/Merchant_UploadBulkImages/Index.cshtml', Model: files.map(b.fileInfoJson), ViewBag: {} });
}));

// auth ([SessionExpireCheck] [HttpPost])
router.post(`${P}/UploadFiles{/:id}`, ps.SessionExpireCheck, uploadAny, asyncHandler(async (req, res) => {
  let ret = 'failed';
  const r = [];
  // foreach (string file in Request.Files) { Request.Files[file] } => first file of every distinct field name
  const seen = new Set();
  const list = [];
  for (const f of req.files || []) { if (!seen.has(f.fieldname)) { seen.add(f.fieldname); list.push(f); } }
  for (const hpf of list) {
    if (hpf.size === 0) continue;
    const SellerCode = String(req.user.plid);
    const TempImageFolder = '~/TempImage/' + SellerCode;
    const TempZipFodler = '~/TempZip/' + SellerCode;
    // if (ModelState.IsValid) - always valid
    const p = b.mapPath(TempImageFolder);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
    const fileName = path.win32.basename(String(hpf.originalname || ''));
    const fileLocation = b.mapPath(TempZipFodler + '/' + b.utcStamp(new Date()) + '_' + fileName);
    // hpf.SaveAs: the TempZip folder is only created by Index (DirectoryNotFoundException otherwise, as legacy)
    fs.writeFileSync(fileLocation, hpf.buffer);
    b.listFiles(b.mapPath(TempZipFodler));
    r.push({ Name: hpf.originalname, Length: hpf.size, Type: hpf.mimetype });
    ret = '{"name":"' + r[0].Name + '","type":"' + r[0].Type + '","size":"' + (await UtilityClass.SizeSuffix(r[0].Length)) + '"}';
  }
  // Content(ret, "application/json")
  res.type('application/json').send(ret);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/DownloadFile{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const FileName = b.mvcStr(req, 'FileName');
  let Ret = '';
  try {
    const BranchCode = String(req.user.plid);
    const TempZipFodler = '/TempZip/' + BranchCode + '/' + str(FileName);
    const p = b.mapPath('~' + TempZipFodler);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) Ret = TempZipFodler;
    else Ret = 'notfound';
  } catch (ex) {
    Ret = ex.message;
  }
  res.json(Ret);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/DeleteFile{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const FileName = b.mvcStr(req, 'FileName');
  let Ret = '';
  try {
    const BranchCode = String(req.user.plid);
    const TempZipFodler = '~/TempZip/' + BranchCode + '/';
    const p = b.mapPath(TempZipFodler + str(FileName));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.unlinkSync(p);
      Ret = 'ok';
    }
  } catch (ex) {
    Ret = ex.message;
  }
  res.json(Ret);
}));

/** public bool IsFileLocked(FileInfo) - read-only => locked; Node cannot open a file with FileShare.None, so it is otherwise unlocked. */
function IsFileLocked(f) {
  try {
    // FileAttributes.ReadOnly (Temporary/System attributes do not exist on this platform)
    if ((fs.statSync(f.FullName).mode & 0o200) === 0) return true;
    const fd = fs.openSync(f.FullName, 'r');
    fs.closeSync(fd);
    return false;
  } catch (ex) {
    return true; // IOException
  }
}

/** private bool FileMoveAndDelete(string SellerCode, FileInfo OFile) */
async function FileMoveAndDelete(SellerCode, OFile) {
  let ret = false;
  if (fs.existsSync(OFile.FullName)) {
    // If Your FILE is locked then Your can't b deleted.
    if (IsFileLocked(OFile)) fs.chmodSync(OFile.FullName, 0o666); // OFile.Attributes = FileAttributes.Normal
    if (OFile.Name === 'Thumbs.db') {
      fs.unlinkSync(OFile.FullName);
    } else {
      const bytes = fs.readFileSync(OFile.FullName);
      const NewFileName = SellerCode + '_' + OFile.Name;
      await UtilityClass.UploadImageFromExtractProcess(bytes, b.mapPath(OriginalImageFolder), b.mapPath(ThumbNailImageFolder), UtilityClass.ImageMode.Both, NewFileName);
      fs.unlinkSync(OFile.FullName);
      ret = true;
    }
  }
  return ret;
}

/** ZipFile.Read(location).ExtractAll(target, ExtractExistingFileAction.DoNotOverwrite) */
function extractAll(location, target) {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(location);
  fs.mkdirSync(target, { recursive: true });
  const root = path.resolve(target);
  for (const e of zip.getEntries()) {
    const out = path.resolve(target, e.entryName);
    // PORT-NOTE (security): entries that would be written outside the target folder (zip-slip) are skipped.
    if (out !== root && !out.startsWith(root + path.sep)) continue;
    if (e.isDirectory) { fs.mkdirSync(out, { recursive: true }); continue; }
    if (fs.existsSync(out)) continue; // DoNotOverwrite
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, e.getData());
  }
}

/** body of the legacy background Thread */
async function extractThread(SellerCode, location) {
  let Return = '';
  try {
    count = 0;
    totalcount = 0;
    extractAll(location, b.mapPath('~/TempImage/' + SellerCode));
    const dir = b.mapPath('~/TempImage/' + SellerCode);
    // This is Outer File inside directory of Seller
    const OuterFile = b.listFiles(dir).filter(isImg);
    totalcount = OuterFile.length;
    for (const folder of b.listDirs(dir)) {
      const FolderFile = b.listFiles(folder).filter(isImg);
      totalcount += FolderFile.length;
      for (const NestedFolder of b.listDirs(folder)) {
        b.listFiles(NestedFolder).filter(isImg);
        totalcount += FolderFile.length; // legacy adds FolderFile.Count again (not NestedFile)
      }
    }
    for (const OFile of OuterFile) {
      await FileMoveAndDelete(SellerCode, OFile);
      Return = 'extract^' + totalcount + '^' + count;
      Message = Return;
      count++;
    }
    // This is Folder Collection inside Seller Directory
    for (const folder of b.listDirs(dir)) {
      const FolderFile = b.listFiles(folder).filter(isImg);
      for (const OFile of FolderFile) {
        await FileMoveAndDelete(SellerCode, OFile);
        Return = 'extract^' + totalcount + '^' + count;
        Message = Return;
        count++;
      }
      for (const NestedFolder of b.listDirs(folder)) {
        void NestedFolder;
        const NestedFile = b.listFiles(folder).filter(isImg); // legacy reads `folder` again (not NestedFolder)
        for (const OFile of NestedFile) {
          await FileMoveAndDelete(SellerCode, OFile);
          Return = 'extract^' + totalcount + '^' + count;
          Message = Return;
          count++;
        }
        if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
      }
      if (fs.existsSync(folder)) fs.rmSync(folder, { recursive: true, force: true });
    }
    Return = 'completed^Zip Extraction Prcocss is Completed.';
    Message = Return;
  } catch (ex) {
    Return = 'failed^Zip Extraction Prcocss is Failed. ' + ex.message;
    Message = Return;
  } finally {
    running = 0;
  }
}

// auth ([SessionExpireCheck])
router.all(`${P}/ExtractAndMove{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const FileName = b.mvcStr(req, 'FileName');
  let Return = '';
  const SellerCode = String(req.user.plid);
  const TempZipFodler = '~/TempZip/' + SellerCode + '/';
  const uploadedFile = FileName === null ? '' : path.win32.basename(FileName);
  const location = b.mapPath(TempZipFodler + uploadedFile);
  // Interlocked.CompareExchange(ref running, 1, 0) == 0
  if (running === 0) {
    running = 1;
    // new Thread(...) { IsBackground = true, Name = SellerCode + "_ExtractThread", Priority = Highest }.Start()
    setImmediate(() => { extractThread(SellerCode, location).catch((e) => console.error(e)); });
    Return = 'started^Zip Extraction Prcocss is Started.';
    Message = Return;
  } else {
    Return = 'running^Zip Extraction Prcocss is Already Running.^' + totalcount + '^' + count;
    Message = Return;
  }
  res.json(Return);
}));

// public (no session check in legacy; returns the process-wide static Message)
router.all(`${P}/GetMoveFileStatus{/:id}`, asyncHandler(async (req, res) => {
  res.json(Message === undefined ? null : Message);
}));

// public (public bool action; MVC cannot bind a FileInfo parameter (no parameterless constructor) => the request failed)
router.all(`${P}/IsFileLocked{/:id}`, asyncHandler(async () => {
  throw new Error('No parameterless constructor defined for this object.');
}));

module.exports = router;
