'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Upload_Aggrement.cs (Upload_AggrementController)
const express = require('express');
const path = require('path');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const config = require('../../config');
const sessionStore = require('../../utils/sessionStore');
const SaveImage = require('../../lib/member/SaveImage');
const DB = 'affiliate';

// Server.MapPath(ConfigurationManager.AppSettings["MemberDocPath"]) -> config.uploadDir/<path without leading ~ or />
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^~?[\\/]*/, ''));
// Session["member_master"] (Member_Master_Custom) -> JWT payload field `member_master` ({ regNo }) or sessionStore
const memberMaster = (req) => (req.user && req.user.member_master) || sessionStore.get(req, 'member_master') || null;
const regNoOf = (mm) => (mm.regNo !== undefined ? mm.regNo : mm.regno);
const s = (v) => (v === undefined || v === null ? null : String(v));

function GetRandomNo() {
  const _allowedChars = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i++) out += _allowedChars[Math.floor(_allowedChars.length * Math.random())];
  return out;
}

// pdfimg=1 would write the file; pdfimg=0 (the only value used by this controller) only computes the file name.
// PORT-NOTE: System.Drawing re-encode for images is replaced by writing the decoded bytes unchanged. The (client supplied)
// strValidFullName is resolved inside config.uploadDir so that it cannot escape the upload folder.
function SaveImageNmaeCurrent(pdfimg, getimagebytecode, imgname, strValidFullName, documents_Exten) {
  const fs = require('fs');
  if (getimagebytecode.includes('base64,')) {
    getimagebytecode = getimagebytecode.substring(getimagebytecode.indexOf(',') + 1);
    strValidFullName = strValidFullName + '/' + imgname;
    const b = Buffer.from(getimagebytecode, 'base64');
    SaveImage.IsValidImage(b);
    const safe = (p) => path.resolve(config.uploadDir, '.' + path.sep + String(p).replace(/^[a-zA-Z]:/, '').replace(/^[\\/]+/, ''));
    if (fs.existsSync(safe(strValidFullName))) {
      const rand = String(Math.floor(Math.random() * 99999));
      strValidFullName = strValidFullName.replace('.' + documents_Exten, '') + '_' + rand + '.' + documents_Exten;
    }
    if (pdfimg === 1) {
      if (imgname !== null && imgname.length > 0 && b !== null) {
        const target = safe(strValidFullName);
        if (target.startsWith(path.resolve(config.uploadDir))) {
          fs.mkdirSync(path.dirname(target), { recursive: true });
          fs.writeFileSync(target, b);
        }
      }
    }
  }
  getimagebytecode = path.basename(strValidFullName.replace(/\\/g, '/'));
  return getimagebytecode;
}

async function updateMemberAgreement(regNo, documentPath) {
  const checkUserType = 'Member';
  let query = '';
  if (checkUserType === 'Member') {
    query = 'update MEMBER_MASTER set IsAgreementUploadByMember=1,MemberAgreementDocumentUploadedURL=@p where regNo=@regNo';
  }
  return db.exec(DB, query, { p: documentPath, regNo });
}

// route-config: referral/2LnlbAZTWFEncU5dgdcbbxhPvG2Cw== -> Upload_Aggrement/Index
// auth
router.all(['/member/Upload_Aggrement/Index{/:id}', '/member/referral/2LnlbAZTWFEncU5dgdcbbxhPvG2Cw=='], auth, asyncHandler(async (req, res) => {
  const PLID = parseInt(req.user.plid, 10);
  const ViewBag = { ShowType: 'reg' };
  const mm = memberMaster(req);
  if (mm !== null) {
    const regNumber = regNoOf(mm);
    const row = await db.queryOne(DB, "select coalesce(IsAgreementUploadByMember,0) as IsAgreementUploadByMember, coalesce(IsAgreementUploadByAdmin,0) as IsAgreementUploadByAdmin, coalesce(AdminAgreementDocumentUplodedURL,'') as AdminAgreementDocumentUplodedURL from Member_Master where regNo=@r limit 1", { r: regNumber });
    ViewBag.isAgreeuplodedmyMember = row.isagreementuploadbymember;
    ViewBag.isAgreeuplodedmyAdmin = row.isagreementuploadbyadmin;
    ViewBag.DocumentName = row.adminagreementdocumentuplodedurl;
  }
  void PLID;
  res.json(ViewBag);
}));

// auth
router.all('/member/Upload_Aggrement/UploadDocument{/:id}', auth, asyncHandler(async (req, res) => {
  let doctype = s(req.p.doctype);
  const imagename = s(req.p.imagename);
  let documents_Exten = s(req.p.documents_Exten);
  let agreementdoucment = s(req.p.agreementdoucment);
  let documentPath = '';
  if (imagename.trim() !== '') { // NullReferenceException when imagename is null (legacy)
    let SavePaths = config.app.MemberDocPath;
    void SavePaths;
    if (documents_Exten === null) documents_Exten = '';
    if (agreementdoucment === null) agreementdoucment = '';
    if (doctype === null) doctype = '';
    let imgname = imagename;
    imgname = imgname.trim();
    imgname = imgname.split('&amp;').join('And');
    imgname = imgname.split('&').join(' And ');
    imgname = imgname.replace(/[^\w\d]/g, '');
    imgname = imgname.split(' ').join('-');
    imgname = imgname.split('.').join('');
    let regNumber = '';
    const mm = memberMaster(req);
    if (mm !== null && !(req.user && req.user.admin_user)) {
      regNumber = String(regNoOf(mm));
    }
    imgname = regNumber + imgname + '-' + GetRandomNo() + '.' + documents_Exten;
    let strValidFullName = '';
    if (doctype.trim() !== '') {
      if (agreementdoucment.includes('base64,')) {
        strValidFullName = mapPath(config.app.MemberDocPath);
        documentPath = imgname;
        doctype = SaveImageNmaeCurrent(0, agreementdoucment, imgname, strValidFullName, documents_Exten);
      }
    }
    if (doctype.trim() !== '') {
      doctype = path.basename(doctype);
    }
  }
  const regNo = String(req.user.plid);
  const Result = await updateMemberAgreement(regNo, documentPath);
  res.json(Result);
}));

// auth
router.all('/member/Upload_Aggrement/updateMemberAgreement{/:id}', auth, asyncHandler(async (req, res) => {
  const r = await updateMemberAgreement(req.p.regNo, req.p.documentPath);
  res.type('text/plain').send(String(r));
}));

// auth
router.all('/member/Upload_Aggrement/GetRandomNo{/:id}', auth, asyncHandler(async (req, res) => {
  res.type('text/plain').send(GetRandomNo());
}));

// auth (returns a plain string)
router.all('/member/Upload_Aggrement/savefile{/:id}', auth, asyncHandler(async (req, res) => {
  const filename = s(req.p.filename) === null ? '' : s(req.p.filename);
  const documents_Exten = s(req.p.documents_Exten) === null ? '' : s(req.p.documents_Exten);
  const agreementdoucment = s(req.p.agreementdoucment) === null ? '' : s(req.p.agreementdoucment);
  let documents = s(req.p.documents) === null ? '' : s(req.p.documents);
  void filename;
  if (documents.trim() !== '') {
    if (agreementdoucment.includes('base64,')) {
      const strValidFullName = mapPath(config.app.MemberDocPath);
      documents = SaveImageNmaeCurrent(0, agreementdoucment, documents, strValidFullName, documents_Exten);
    }
  }
  if (documents.trim() !== '') {
    documents = path.basename(documents);
  }
  res.type('text/plain').send(documents);
}));

// auth (returns a plain string)
router.all('/member/Upload_Aggrement/SaveImageNmaeCurrent{/:id}', auth, asyncHandler(async (req, res) => {
  const out = SaveImageNmaeCurrent(parseInt(req.p.pdfimg, 10), String(req.p.getimagebytecode), s(req.p.imgname), String(req.p.strValidFullName), String(req.p.documents_Exten));
  res.type('text/plain').send(out);
}));

module.exports = router;
