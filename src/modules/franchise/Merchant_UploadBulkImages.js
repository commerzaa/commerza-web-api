'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Merchant_UploadBulkImages.cs
// PORT-NOTE: zip extraction (Ionic.Zip) uses the optional npm package "adm-zip" (lazy-required, NOT installed yet).
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const BASE = '/franchise/Merchant_UploadBulkImages';
const upload = multer({ storage: multer.memoryStorage() }).any();

// legacy static state
let count = 0;
let totalcount = 0;
let Message;
let running = 0;

const root = (...p) => path.join(config.uploadDir, ...p);
const OriginalImageFolder = () => root('Product_Images_Large'); // "../Product_Images_Large"
const ThumbNailImageFolder = () => root('Product_Images');      // "../Product_Images"
const isImg = (f) => ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase());
const filesOf = (dir) => {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile())
    .map((d) => { const full = path.join(dir, d.name); return { name: d.name, full, ext: path.extname(d.name), created: fs.statSync(full).birthtimeMs }; })
    .sort((a, b) => b.created - a.created);
};
const dirsOf = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(dir, d.name)) : []);

// auth ([SessionExpireCheck])
router.all([`${BASE}/Index{/:id}`, BASE], auth, asyncHandler(async (req, res) => {
  const SellerCode = String(req.user.did);
  const dir = root('TempZip', SellerCode);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const thumbs = path.join(dir, 'Thumbs.db');
  if (fs.existsSync(thumbs)) fs.unlinkSync(thumbs);
  const files = filesOf(dir).filter((a) => a.ext === '.zip').map((a) => {
    const st = fs.statSync(a.full);
    return { Name: a.name, FullName: a.full, Extension: a.ext, Length: st.size, CreationTime: st.birthtime };
  });
  res.json({ Model: files });
}));

// auth ([SessionExpireCheck][HttpPost]) - multipart upload
router.post(`${BASE}/UploadFiles{/:id}`, auth, upload, asyncHandler(async (req, res) => {
  let ret = 'failed';
  const r = [];
  for (const hpf of req.files || []) {
    if (hpf.size === 0) continue;
    const SellerCode = String(req.user.did);
    const TempImageFolder = root('TempImage', SellerCode);
    const TempZipFodler = root('TempZip', SellerCode);
    fs.mkdirSync(TempImageFolder, { recursive: true });
    fs.mkdirSync(TempZipFodler, { recursive: true });
    const fileName = path.basename(hpf.originalname);
    const d = new Date();
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    const p2 = (n) => String(n).padStart(2, '0');
    const h12 = d.getUTCHours() % 12 === 0 ? 12 : d.getUTCHours() % 12;
    const stamp = `${p2(d.getUTCDate())}-${mon}-${d.getUTCFullYear()} ${p2(h12)}-${p2(d.getUTCMinutes())}-${p2(d.getUTCSeconds())}-${d.getUTCHours() < 12 ? 'AM' : 'PM'}`;
    fs.writeFileSync(path.join(TempZipFodler, stamp + '_' + fileName), hpf.buffer);
    r.push({ Name: hpf.originalname, Length: hpf.size, Type: hpf.mimetype });
    ret = '{"name":"' + r[0].Name + '","type":"' + r[0].Type + '","size":"' + (await UtilityClass.SizeSuffix(r[0].Length)) + '"}';
  }
  res.type('application/json').send(ret);
}));

// auth
router.all(`${BASE}/DownloadFile{/:id}`, auth, asyncHandler(async (req, res) => {
  let Ret = '';
  try {
    const BranchCode = String(req.user.did);
    const FileName = req.p.FileName;
    const TempZipFodler = '/TempZip/' + BranchCode + '/' + FileName;
    const p = root('TempZip', BranchCode, FileName);
    Ret = fs.existsSync(p) ? TempZipFodler : 'notfound';
  } catch (ex) { Ret = ex.message; }
  res.json(Ret);
}));

// auth
router.all(`${BASE}/DeleteFile{/:id}`, auth, asyncHandler(async (req, res) => {
  let Ret = '';
  try {
    const BranchCode = String(req.user.did);
    const p = root('TempZip', BranchCode, req.p.FileName);
    if (fs.existsSync(p)) { fs.unlinkSync(p); Ret = 'ok'; }
  } catch (ex) { Ret = ex.message; }
  res.json(Ret);
}));

function IsFileLocked() { return false; }

async function FileMoveAndDelete(SellerCode, OFile) {
  let ret = false;
  if (fs.existsSync(OFile.full)) {
    if (OFile.name === 'Thumbs.db') {
      fs.unlinkSync(OFile.full);
    } else {
      const bytes = fs.readFileSync(OFile.full);
      const NewFileName = SellerCode + '_' + OFile.name;
      await UtilityClass.UploadImageFromExtractProcess(bytes, OriginalImageFolder(), ThumbNailImageFolder(), UtilityClass.ImageMode.Both, NewFileName);
      fs.unlinkSync(OFile.full);
      ret = true;
    }
  }
  return ret;
}

async function extractWorker(SellerCode, location) {
  let Return = '';
  try {
    count = 0;
    totalcount = 0;
    const AdmZip = require('adm-zip'); // PORT-NOTE: dependency to be installed (npm i adm-zip)
    const zip = new AdmZip(location);
    const target = root('TempImage', SellerCode);
    fs.mkdirSync(target, { recursive: true });
    // ExtractExistingFileAction.DoNotOverwrite
    for (const e of zip.getEntries()) {
      const out = path.join(target, e.entryName);
      if (!path.resolve(out).startsWith(path.resolve(target))) continue; // zip-slip guard
      if (e.isDirectory) { fs.mkdirSync(out, { recursive: true }); continue; }
      if (fs.existsSync(out)) continue;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, e.getData());
    }
    const dir = target;
    const OuterFile = filesOf(dir).filter((a) => isImg(a.name));
    totalcount = OuterFile.length;
    for (const folder of dirsOf(dir)) {
      const FolderFile = filesOf(folder).filter((a) => isImg(a.name));
      totalcount += FolderFile.length;
      for (const NestedFolder of dirsOf(folder)) {
        totalcount += FolderFile.length; // legacy bug kept: counts FolderFile again
      }
    }
    for (const OFile of OuterFile) {
      await FileMoveAndDelete(SellerCode, OFile);
      Return = 'extract^' + totalcount + '^' + count;
      Message = Return;
      count++;
    }
    for (const folder of dirsOf(dir)) {
      const FolderFile = filesOf(folder).filter((a) => isImg(a.name));
      for (const OFile of FolderFile) {
        await FileMoveAndDelete(SellerCode, OFile);
        Return = 'extract^' + totalcount + '^' + count;
        Message = Return;
        count++;
      }
      for (const NestedFolder of dirsOf(folder)) {
        const NestedFile = filesOf(folder).filter((a) => isImg(a.name)); // legacy reads folder (not NestedFolder)
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

// auth
router.all(`${BASE}/ExtractAndMove{/:id}`, auth, asyncHandler(async (req, res) => {
  let Return = '';
  const SellerCode = String(req.user.did);
  const uploadedFile = path.basename(req.p.FileName);
  const location = root('TempZip', SellerCode, uploadedFile);
  if (running === 0) {
    running = 1;
    setImmediate(() => { extractWorker(SellerCode, location); });
    Return = 'started^Zip Extraction Prcocss is Started.';
    Message = Return;
  } else {
    Return = 'running^Zip Extraction Prcocss is Already Running.^' + totalcount + '^' + count;
    Message = Return;
  }
  res.json(Return);
}));

// auth (no session check in C#, but it returns process state of the logged in panel)
router.all(`${BASE}/GetMoveFileStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(Message === undefined ? null : Message);
}));

// auth - public method IsFileLocked(FileInfo) exposed as action in MVC; not callable with a FileInfo, returns false
router.all(`${BASE}/IsFileLocked{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(IsFileLocked());
}));

module.exports = router;
