'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Admin_Bank_Details.cs (class Admin_Bank_DetailsController)
// Database: affiliate (Db_Affiliate). Tables: tbl_admin_bankdetails, tbl_companymaster.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const GetIP = require('../../lib/admin/GetIP');
const Admin_Bank_DetailsPage = require('../../lib/admin/Admin_Bank_DetailsPage');
const Save_ImageFile = require('../../lib/Save_ImageFile');
const { errorInsert: libErrorInsert } = require('../../lib/admin/_helpers');
const { adminAuth, isAdmin, errorInsert, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nstr, nre, reqInt, outStr, col, view, inlinePerms, excelLink, nowStamp, tab, cs, excelHistory, tsvDownload, mapRow,
} = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Admin_Bank_Details';
const upload = multer({ storage: multer.memoryStorage() });

const ADMIN_BANK_DETAILSPAGE_PROPS = ['TABDID', 'EmpId', 'AccountHolderName', 'AccountNo', 'BankName', 'BranchName', 'IFSCCode', 'Date', 'UpdateDate',
  'Status', 'Active', 'BANKID', 'PurposeFor', 'CorporateID'];
// class bankname { int BANKID; string BANKNAME } (declared in the C# file, unused)

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** non-nullable Int64 action parameter */
const reqLong = (v, name) => {
  const n = v === undefined || v === null || v === '' ? NaN : Number(v);
  if (!Number.isInteger(n)) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int64'`);
    e.status = 500;
    throw e;
  }
  return n;
};

// public void ExportReport()
async function ExportReport(req, res, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Admin_Bank_Details' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename, '1');
  const pum = new Admin_Bank_DetailsPage();
  const list = await pum.AllDetails();
  if (list.length > 0) {
    let srno = 1;
    return tsvDownload({
      req, res, ViewBag, xlsName: 'Admin_Bank_Details.xls', Filename, disposition: 'attachment; filename= Admin_Bank_Details.xls',
      headers: ['S.No.', 'Account Holder Name', 'Account No', 'Bank Name', 'Branch Name', 'IFSC Code', 'Date'],
      rows: list,
      innerProc: 'ExportReport',
      outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w(tab(String(srno)) + ' \t');
        w(tab(cs(item.AccountHolderName)) + ' \t');
        w(tab(cs(item.AccountNo)) + ' \t');
        w(tab(cs(item.BankName)) + ' \t');
        w(tab(cs(item.BranchName)) + ' \t');
        w(tab(cs(item.IFSCCode)) + ' \t');
        w(tab(cs(item.Date)) + ' \t'); // DateTime.ToString()
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// public static void ResizeImage(string FullName, double scaleFactor, double filesize, MemoryStream fromstream, string Folder)
async function ResizeImage(FullName, scaleFactor, filesize, fromstream, Folder) {
  if (!Save_ImageFile.IsValidImage(fromstream)) throw new Error('Parameter is not valid.'); // Image.FromStream
  fs.mkdirSync(path.dirname(FullName), { recursive: true });
  if (filesize > 100) {
    let out = fromstream;
    if (Folder === 'ThumbNail') {
      // PORT-NOTE: GetThumbnailImage(same width/height) + JPEG re-encode => sharp (lazy); without sharp the original bytes are written.
      try { const sharp = require('sharp'); out = await sharp(fromstream).jpeg().toBuffer(); } catch (e) { out = fromstream; }
    }
    fs.writeFileSync(FullName, out);
  } else {
    fs.writeFileSync(FullName, fromstream); // image.Save(FullName)
  }
}

// ---------------------------------------------------------------- Index(string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Admin-Bank-Details" -> Admin_Bank_Details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Admin-Bank-Details'], adminAuth, asyncHandler(async (req, res) => {
  let btnexel = nstr(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (btnexel === null) btnexel = '';
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag);
    if (r.sent) return undefined;
  }
  const pum = new Admin_Bank_DetailsPage();
  return view(res, '~/Views/AdminPanel/Admin_Bank_Details/Index.cshtml', await pum.AllDetails(), ViewBag);
}));

// ---------------------------------------------------------------- public void ExportReport()
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(Int64 EmpId)
// auth-by-check (legacy returned Json("Session Expired. Please login again"))
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const EmpId = reqLong(req.p.EmpId, 'EmpId');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  try {
    let stringret = ''; let AccountHolderName = ''; let AccountNo = '';
    let BankName = ''; let BranchName = ''; let IFSCCode = ''; let Status = 0; let BANKID = 0; let PurposeFor = ''; let CorporateID = '';
    // legacy concatenated EmpId (Int64) into the SQL; parameterised here
    const r = await db.queryOne(DB, `select coalesce(empid, 0) as empid, tabdid, coalesce(accountholdername, '') as accountholdername,
        coalesce(accountno, '') as accountno, coalesce(bankname, '') as bankname, coalesce(branchname, '') as branchname,
        coalesce(ifsccode, '') as ifsccode, coalesce(date, '1900-01-01') as date, coalesce(updatedate, '1900-01-01') as updatedate,
        status, active, bankid, purposefor, corporateid
      from tbl_admin_bankdetails where status = 1 and active = 1 and tabdid = @EmpId limit 1`, { EmpId });
    if (r) {
      const row = mapRow(r, ADMIN_BANK_DETAILSPAGE_PROPS);
      if (row.Status === null || row.BANKID === null) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
      AccountHolderName = row.AccountHolderName;
      AccountNo = row.AccountNo;
      BankName = row.BankName;
      BranchName = row.BranchName;
      IFSCCode = row.IFSCCode;
      Status = row.Status;
      BANKID = row.BANKID;
      PurposeFor = row.PurposeFor;
      CorporateID = row.CorporateID;
    }
    const s = (v) => (v === null || v === undefined ? '' : String(v));
    stringret = stringret + '^' + 'Success' + '^' + s(AccountHolderName) + '^' + s(AccountNo) + '^' + s(BankName) + '^' + s(BranchName) + '^' + s(IFSCCode)
      + '^' + s(Status) + '^' + s(BANKID) + '^' + s(PurposeFor) + '^' + s(CorporateID);
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- JsonResult Updatebankdetails(Int64 EmpId, string AccHolName, string AccountNo, string BankName, string BranchName, string IFSCCode, string IMAGE, int status, string imageupload2, int bankID, string Purpose, string CorporateID)
// auth-by-check (legacy returned Json("Session Expired. Please login again"))
// Config: VhostsRoot (optional; legacy hard-coded "C://inetpub//vhosts//")
router.all(`/admin/${C}/Updatebankdetails{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const EmpId = reqLong(req.p.EmpId, 'EmpId');
  const status = reqInt(req.p.status, 'status');
  const bankID = reqInt(req.p.bankID, 'bankID');
  if (!isAdmin(req)) return res.json('Session Expired. Please login again');
  const P = (k) => nstr(req.p[k]);
  const VROOT = (config.app.VhostsRoot || 'C://inetpub//vhosts//');
  let Loginurl = '';
  let MainURL = '';
  try {
    const regNo = req.user.emp_id;
    const loginid = req.user.emp_loginid;
    const r1 = await db.queryOne(DB, "select coalesce(software_url, '') as software_url from tbl_companymaster limit 1", {});
    Loginurl = r1 ? col(r1, 'software_url') : null;
    const r2 = await db.queryOne(DB, "select coalesce(main_url, '') as software_url from tbl_companymaster limit 1", {});
    MainURL = r2 ? col(r2, 'software_url') : null;
    if (Loginurl === null || MainURL === null) throw nre();
    Loginurl = Loginurl.split('http://').join('').split('https://').join('');
    MainURL = MainURL.split('http://').join('').split('https://').join('');
    let imgname = '';
    const IMAGE = P('IMAGE');
    if (IMAGE === null) throw nre(); // IMAGE.Trim()
    if (IMAGE.trim() !== '') {
      let base64String = '';
      const timestamp = await UtilityClass.GetTimestamp(new Date());
      const SavePaths = VROOT + MainURL + '//' + Loginurl + '//BankImage';
      if (IMAGE !== '') {
        base64String = IMAGE;
        if (loginid === null || loginid === undefined) throw nre();
        let ProfileImage = String(loginid).trim();
        ProfileImage = ProfileImage.split('&amp;').join('And');
        ProfileImage = ProfileImage.split('&').join(' And ');
        ProfileImage = ProfileImage.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, '');
        ProfileImage = ProfileImage.split(' ').join('-');
        imgname = ProfileImage + '-' + regNo + '_' + timestamp + '.png';
      } else {
        imgname = ' ';
      }
      const strValidFullName = SavePaths + '/' + imgname;
      if (IMAGE !== '') {
        if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
        const clean = base64String.replace(/\s/g, '');
        if (!/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.length % 4 !== 0) {
          throw new Error('The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
        }
        const b = Buffer.from(clean, 'base64');
        if (!Save_ImageFile.IsValidImage(b)) throw new Error('Parameter is not valid.');
        const filesize = b.length / 1024;
        if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
        const scaleFactor = 0.25;
        // oldimage == "" => ResizeImage(strValidFullName, scaleFactor, filesize, ms, "ThumbNail")
        await ResizeImage(strValidFullName, scaleFactor, filesize, b, 'ThumbNail');
      }
    }
    let CorporateID = P('CorporateID');
    if (CorporateID === null) CorporateID = '';
    const row = await db.procOne(DB, 'USP_INSERTADMINBANKDETAIS', {
      Empid: regNo, TABDID: EmpId, HOLDERNAME: P('AccHolName'), ACOUNTNO: P('AccountNo'), BANKNAME: P('BankName'), BRANCHNAME: P('BranchName'),
      IESCCODE: P('IFSCCode'), LOGO: imgname, status, Filename: P('imageupload2'), bankID, PurposeFor: P('Purpose'), CorporateID,
    });
    return res.json(outStr(col(row, 'strresult')));
  } catch (ExpObj) {
    const SavePaths = VROOT + (MainURL ?? '') + '//' + (Loginurl ?? '') + '//BankImage';
    const strValidFullName = SavePaths + '/JustCheck.png';
    await libErrorInsert('USP_INSERTADMINBANKDETAIS', strValidFullName, ExpObj); // ErrorURL = the image path (legacy)
    return res.json('Error occurred. Please try later');
  }
}));

// ---------------------------------------------------------------- [HttpPost] JsonResult Uploadexcel()
// auth (legacy had no session check; file upload into the admin site => adminAuth)
router.post(`/admin/${C}/Uploadexcel{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  let Filename = '';
  let Typename = '';
  const ip = await GetIP.GetLocalIP(req); // read, unused (legacy)
  void ip;
  const TempData = {};
  try {
    const files = req.files || [];
    const file = files[0];
    if (!file) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.'); // Request.Files[0]
    if (file.size > 0) {
      const fu = files.find((f) => f.fieldname === 'FileUpload');
      if (!fu) throw nre(); // Request.Files["FileUpload"]
      const FileExtension = path.extname(fu.originalname).toLowerCase();
      void FileExtension;
      Typename = req.body && req.body.Typename !== undefined ? String(req.body.Typename) : '';
      void Typename;
      Filename = path.basename(fu.originalname);
      Filename = nowStamp() + Filename;
      const dir = path.join(config.uploadDir, 'WithdrawalsClubExcel');
      const PathForFile = path.join(dir, Filename);
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
      fs.writeFileSync(PathForFile, fu.buffer);
      // TempData["ExcelFileName"] / TempData["UploadedExcel"] (empty DataTable) / ViewBag.filename: set and discarded (JSON action)
      TempData.ExcelFileName = Filename;
    }
  } catch (Ex) {
    TempData.Message = 'Some error occured while performing the operation(s).' + Ex.message;
    return res.json('error');
  }
  return res.json(Filename);
}));

router.helpers = { ResizeImage };

module.exports = router;
