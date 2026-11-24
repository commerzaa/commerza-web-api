'use strict';
// Ported from Franchise/Controllers/CustomerPanel/AgreementController.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const BASE = '/franchise/Agreement';
const AGR = ['rownumber', 'regno', 'Name', 'fathername', 'address', 'packageamount', 'clickamount', 'selectvalues', 'maxamount', 'uploadimage', 'remark', 'status', 'Mobile', 'Companyname', 'DESIGNATION'];
const str = (v) => (v === null || v === undefined ? '' : String(v));

// "~/Folder" style AppSettings path -> directory under config.uploadDir
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^~?[\\/]+/, ''));
const rand6 = () => String(Math.floor(100000 + Math.random() * 900000));

// AddTicketController.ImageUploadMasterMethod (used by AggrementImages)
async function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      let Image = rand6();
      Image = Image.trim().replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
      RealImageName = Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const StrValidFullNameAndPath = path.join(mapPath(SavePaths), RealImageName);
    if (Base64String.includes('base64,')) {
      // PORT-NOTE: legacy re-encoded through System.Drawing at scale 1 (JPEG); raw decoded bytes are written instead
      const bytes = Buffer.from(Base64String.substring(Base64String.indexOf(',') + 1), 'base64');
      fs.mkdirSync(path.dirname(StrValidFullNameAndPath), { recursive: true });
      if (fs.existsSync(StrValidFullNameAndPath)) fs.unlinkSync(StrValidFullNameAndPath);
      fs.writeFileSync(StrValidFullNameAndPath, bytes);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

function SaveImageNmaeCurrent(user, pdfimg, getimagebytecode, imgname, strValidFullName, documents_Exten) {
  if (getimagebytecode.includes('base64,')) {
    const Plid = user.did;
    let File = rand6().trim();
    File = File.replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
    imgname = path.basename(imgname, path.extname(imgname));
    imgname = imgname.replace(/[^0-9a-zA-Z]+/g, '') + '-' + File + '-' + Plid + '.' + documents_Exten;
    strValidFullName = strValidFullName + '/' + imgname;
    const b = Buffer.from(getimagebytecode.substring(getimagebytecode.indexOf(',') + 1), 'base64');
    if (fs.existsSync(strValidFullName)) {
      const rnd = String(Math.floor(Math.random() * 99999));
      strValidFullName = strValidFullName.replace('.' + documents_Exten, '') + '_' + rnd + '.' + documents_Exten;
    }
    if (pdfimg === 1) {
      // nothing
    } else if (imgname && imgname.length > 0 && b) {
      fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
      fs.writeFileSync(strValidFullName, b);
    }
  }
  return path.basename(strValidFullName);
}

function savefile(user, filename, documents_Exten, documents, art_doucment) {
  if (filename == null) filename = '';
  if (documents_Exten == null) documents_Exten = '';
  if (art_doucment == null) art_doucment = '';
  if (documents == null) documents = '';
  let strValidFullName = '';
  if (documents.trim() !== '') {
    if (art_doucment.includes('base64,')) {
      strValidFullName = mapPath(config.app.AggrementImages);
      documents = SaveImageNmaeCurrent(user, 0, art_doucment, documents, strValidFullName, documents_Exten);
    }
  }
  if (documents.trim() !== '') documents = path.basename(documents);
  return documents;
}

// auth  (route-config: franchisee/add-Agreement)
const index = asyncHandler(async (req, res) => {
  const Regno = req.user.did;
  const ViewBag = {};
  ViewBag.check = Number(await scalar('shopping', 'select coalesce(count(1),0) from tbl_agreement_details_distributor where did = @did', { did: String(Regno) })) || 0;
  const Row = await queryOne('shopping', 'select emailid, loginid from tbl_distributor where did = @did limit 1', { did: Regno });
  ViewBag.Emailid = Row.emailid;     // legacy NRE when row missing
  ViewBag.Resellerid = Row.loginid;
  let agreement;
  if (ViewBag.check === 0) {
    agreement = mapRows(await proc('shopping', 'usp_agreementdetails_distributor', { regno: Regno, mode: '1' }), AGR);
  } else {
    agreement = mapRows(await proc('shopping', 'usp_agreementdetails_distributor', { regno: Regno, mode: 2 }), AGR);
  }
  for (const Item of agreement) {
    ViewBag.Image = Item.uploadimage;
    ViewBag.Status = Item.status;
  }
  res.json({ Model: agreement, ViewBag });
});
router.all([`${BASE}/Index{/:id}`, BASE], auth, index);
// route-config
router.all('/franchise/franchisee/add-Agreement', auth, index);

// auth
router.all(`${BASE}/saveagreement{/:id}`, auth, asyncHandler(async (req, res) => {
  const Regno = req.user.did;
  const { value, name, fathername, address, packamt, clkamt } = req.p;
  const row = await procOne('shopping', 'usp_add_agreemnnt_distributor', {
    selectvalues: value, updatedate: '', name, fathername, address, regno: Regno, packamt, clkamt,
    mode: 1, uploadimage: '', allpageno: '',
  });
  // PORT-NOTE: @StrResult OUT read from "strresult" column
  res.json(str(row && row.strresult).trim());
}));

// auth
router.all(`${BASE}/updateagreement{/:id}`, auth, asyncHandler(async (req, res) => {
  const Regno = req.user.did;
  const row = await procOne('shopping', 'usp_update_agreemnnt', {
    sendvia: req.p.sendvia, trackno: req.p.trackno, comname: req.p.comname, regno: Regno, senddate: req.p.fromdate,
  });
  res.json(str(row && row.strresult).trim());
}));

// auth
router.all(`${BASE}/AggrementImages{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let AllImageName = '', OneByOneImageName = '', AllPageno = '', pdfname = '';
  const Plid = req.user.did;
  const folder = config.app.AggrementImages;
  const S = (v) => (v === undefined || v === null ? '' : String(v));
  if (p.extension !== 'pdf') {
    AllImageName = await ImageUploadMasterMethod(S(p.ImgPreviewFirst), folder, String(Plid));
    AllPageno = p.spnfirstaddmore;

    const rest = [[p.ImgPreviewSecond, p.spnsecondaddmore], [p.ImgPreviewThird, p.spnthirdaddmore], [p.ImgPreviewFourth, p.spnfourthaddmore], [p.ImgPreviewFifth, p.spnfifthaddmore]];
    for (const [img, pg] of rest) {
      OneByOneImageName = await ImageUploadMasterMethod(S(img), folder, String(Plid));
      AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
      AllPageno = AllPageno + ',' + S(pg);
    }
  } else {
    AllImageName = p.ImgPreviewFirst;
    pdfname = savefile(req.user, '', p.extension, p.extentionname, AllImageName);
    AllImageName = pdfname;
    AllPageno = p.spnfirstaddmore;
  }
  const row = await procOne('shopping', 'usp_add_agreemnnt_distributor', {
    selectvalues: '', updatedate: '', name: '', fathername: '', address: '', regno: Plid, packamt: '0', clkamt: '',
    mode: 2, uploadimage: AllImageName, allpageno: AllPageno,
  });
  res.json(str(row && row.strresult).trim());
}));

// auth - public string savefile(...) (exposed as MVC action)
router.all(`${BASE}/savefile{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(savefile(req.user, req.p.filename, req.p.documents_Exten, req.p.documents, req.p.art_doucment));
}));

// auth - public string SaveImageNmaeCurrent(...)
router.all(`${BASE}/SaveImageNmaeCurrent{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  res.json(SaveImageNmaeCurrent(req.user, parseInt(p.pdfimg, 10), str(p.getimagebytecode), str(p.imgname), str(p.strValidFullName), str(p.documents_Exten)));
}));

// auth - PartialViewResult _ResellerAgreement
router.all(`${BASE}/GetRequestAggreement{/:id}`, auth, asyncHandler(async (req, res) => {
  const Regno = req.user.did;
  const agreement = mapRows(await proc('shopping', 'usp_agreementdetails_distributor', { regno: Regno, mode: 1 }), AGR);
  res.json({ Model: agreement });
}));

const timestamp = (d) => {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds() * 10, 4)}`;
};

// auth
router.all(`${BASE}/SendResellerAgreement{/:id}`, auth, asyncHandler(async (req, res) => {
  let ret = '0';
  try {
    // HtmlInvoice = Uri.UnescapeDataString(HtmlData) - only used by the commented-out HtmlConverter
    const HtmlInvoice = decodeURIComponent(String(req.p.HtmlData));
    void HtmlInvoice;
    let strValidFullName = mapPath(config.app.ResellerAgreement);
    const CorrectTimeStamp = timestamp(new Date());
    let attachment = '', Filename = '', Emailid = '', Subject = '';
    const RegNo = req.user.did;
    const loginid = req.user.loginid;
    const Row = await queryOne('shopping', 'select emailid from tbl_distributor where did = @did limit 1', { did: RegNo });
    if (Row) {
      Emailid = Row.emailid;
      Filename = 'Agreement_' + loginid + '_' + CorrectTimeStamp + '.pdf';
      strValidFullName = strValidFullName + '/' + Filename;
      fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
      fs.writeFileSync(strValidFullName, ''); // FileStream(FileMode.Create); PDF conversion is commented out in the legacy code
    }
    if (Filename !== '') attachment = CompanySettings.CompanyDomain + 'ResellerAgreement/' + Filename;
    Subject = CompanySettings.CompanyName + ' Reseller Agreement Acceptance';
    void attachment; void Subject; void Emailid;
    ret = '1';
  } catch (ex) {
    try { await UtilityClass.TrackError(ex.message); } catch (e) { /* ignore */ }
    throw ex;
  }
  res.json(ret);
}));

// auth
router.all(`${BASE}/UpdateRejectstatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const DID = req.user.did;
  await exec('shopping', "update tbl_agreement_details_distributor set status = 0, uploadimage = '' where did = @did and status = 2", { did: DID });
  res.json(1);
}));

// auth
router.all(`${BASE}/GetResellerExits{/:id}`, auth, asyncHandler(async (req, res) => {
  const DID = req.user.did;
  const result = await scalar('shopping', 'select count(1) from tbl_agreement_details_distributor where did = @did', { did: DID });
  res.json(Number(result) || 0);
}));

module.exports = router;
