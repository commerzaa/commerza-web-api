'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\V4Admin\UpdateMemberProfileController.cs (class UpdateMemberProfileController => /admin/UpdateMemberProfile/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { nInt, nStr, col, str, outStr, cvtInt } = require('./_shared/batch11-common');
const { WALLETS_PROPS } = require('./_shared/batch03-models');

const router = express.Router();
const DB = 'affiliate';
const C = 'UpdateMemberProfile';

/** class KYCDetails */
const KYC_PROPS = ['REGNO', 'PID', 'IDFRUNTBACKIMG', 'PCID', 'BID', 'PHOTOTITLE', 'RESDENTIALTITLE', 'TAXATIONTITLE', 'BANKTITLE', 'PHOTOIMAGE',
  'RESDINTALTYPE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'TAXATIONTTYPE', 'PCIDNO', 'DOB', 'PANCARDIMG', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO',
  'IFSCCODE', 'BANKNAME', 'BANKIMG', 'BRANCHNAME', 'PHOTOSTATUS', 'IDFRUNTIMGSTATUS', 'PANSTATUS', 'BANKSTATUS', 'ALLSTATUS', 'PHOTOREMARK',
  'IDFRUNTIMGREMARK', 'PANREMARK', 'BANKREMARK', 'PHOTOAPPROVEDATE', 'IDFRUNTIMGAPPROVEDDATE', 'PANAPPROVEDDATE', 'BANKAPPROVEDDATE', 'KYCMODE'];

const IMG_EXT = ['.jpg', '.png', '.gif', '.jpeg', '.bmp'];

/** System.IO.Path.GetExtension */
function getExtension(p) {
  if (p === null || p === undefined) return null;
  const s = String(p);
  const dot = s.lastIndexOf('.');
  const sep = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'), s.lastIndexOf(':'));
  if (dot <= sep || dot < 0) return '';
  if (dot === s.length - 1) return '';
  return s.substring(dot);
}

/** using (StreamReader Str = File.OpenText(path)) { if ((x = Str.ReadLine()) != null) ... }  => first line or null (empty file) */
function readFirstLine(p) {
  const content = fs.readFileSync(p, 'utf8'); // FileNotFoundException => unhandled (500) like the legacy
  if (content === '') return null;
  return content.replace(/^﻿/, '').split(/\r\n|\r|\n/)[0];
}

// ---------------------------------------------------------------- ActionResult Index(int Regno = 0)
// auth (no session check in the legacy; admin-only KYC page => adminAuth)
// route-config: "V4Admin/Update-Member-Profile" -> UpdateMemberProfile/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/V4Admin/Update-Member-Profile'], adminAuth, asyncHandler(async (req, res) => {
  let Regno = nInt(req.p.Regno);
  if (Regno === null) Regno = 0;
  const MemberURL = config.app.MemberKYCURL || '';
  let Memberurls = '';
  const ViewBag = {};
  // if (Regno == null) Response.Redirect("~/AdminPanel/Dashboard")  -- int can never be null (dead branch in legacy)
  const r = await db.queryOne(DB, 'select software_url from tbl_companymaster where comid=1 limit 1');
  Memberurls = r ? r.software_url : null;
  ViewBag.walletlst = mapRows(await db.proc(DB, 'usp_wallet_type', {}), WALLETS_PROPS);
  ViewBag.Regno = Regno;
  // UtilityClass.GetDataSetSPNamed(@Regno, "dbo.usp_View_all_detail_Member", "dsData")
  const dsRows = await db.proc(DB, 'usp_View_all_detail_Member', { Regno });
  const kyctitle = async (ktid) => {
    const t = await db.queryOne(DB, 'select title from tbl_kyctype where status::int=1 and ktid=@k limit 1', { k: ktid });
    return t ? t.title : null;
  };
  ViewBag.IDProof = await kyctitle(1);
  ViewBag.ResidentialProof = await kyctitle(2);
  ViewBag.TaxationDocument = await kyctitle(3);
  ViewBag.Bank = await kyctitle(4);
  const kr = await db.procOne(DB, 'USP_MEMBERKYC_STATUSIMG', { MODE: 7, REGNO: Regno });
  const KYC_Details = kr ? mapRow(kr, KYC_PROPS) : null;
  const urlOf = (f) => nz(Memberurls) + '/KYC_Images/' + f;
  if (KYC_Details !== null) {
    const ExtIdProoPhoto = getExtension(KYC_Details.PHOTOIMAGE);
    const ExtfruntImg = getExtension(KYC_Details.FRUNTIMG);
    const ExtBackPhoto = getExtension(KYC_Details.BACKIMG);
    const ExtPanCardImg = getExtension(KYC_Details.PANCARDIMG);
    const ExtBankImg = getExtension(KYC_Details.BANKIMG);
    if (ExtIdProoPhoto === '.txt' && KYC_Details.PHOTOIMAGE !== null) {
      const l = readFirstLine(MemberURL + KYC_Details.PHOTOIMAGE);
      if (l !== null) ViewBag.IdProofPhoto = l;
    }
    if (IMG_EXT.includes(ExtIdProoPhoto) && KYC_Details.PHOTOIMAGE !== null) ViewBag.IdProofPhoto = urlOf(KYC_Details.PHOTOIMAGE);
    if (ExtfruntImg === '.txt' && ExtBackPhoto === '.txt') {
      if (KYC_Details.FRUNTIMG !== null) {
        const l = readFirstLine(MemberURL + KYC_Details.FRUNTIMG);
        if (l !== null) ViewBag.FRUNTIMG = l;
      }
      if (KYC_Details.BACKIMG !== null) {
        const l = readFirstLine(MemberURL + KYC_Details.BACKIMG);
        if (l !== null) ViewBag.BACKIMG = l;
      }
    }
    if (IMG_EXT.includes(ExtfruntImg) && KYC_Details.FRUNTIMG !== null) ViewBag.FRUNTIMG = urlOf(KYC_Details.FRUNTIMG);
    if (IMG_EXT.includes(ExtBackPhoto) && KYC_Details.BACKIMG !== null) ViewBag.BACKIMG = urlOf(KYC_Details.BACKIMG);
    if (ExtPanCardImg === '.txt' && KYC_Details.PANCARDIMG !== null) {
      const l = readFirstLine(MemberURL + KYC_Details.PANCARDIMG);
      if (l !== null) ViewBag.PANCARDIMG = l;
    }
    if (IMG_EXT.includes(ExtPanCardImg) && KYC_Details.PANCARDIMG !== null) ViewBag.PANCARDIMG = urlOf(KYC_Details.PANCARDIMG);
    if (ExtBankImg === '.txt' && KYC_Details.BANKIMG !== null) {
      const l = readFirstLine(MemberURL + KYC_Details.BANKIMG);
      if (l !== null) ViewBag.BANKIMG = l;
    }
    if (IMG_EXT.includes(ExtBankImg) && KYC_Details.BANKIMG !== null) ViewBag.BANKIMG = urlOf(KYC_Details.BANKIMG);
  }
  // if (ds.Tables.Count > 0) { ds.Tables[0].Rows[0]["IMAGENAME"] ... }  (no row => IndexOutOfRangeException like the legacy)
  if (!dsRows.length) throw new Error('There is no row at position 0.');
  const Image = str(col(dsRows[0], 'IMAGENAME'));
  const ExtImage = getExtension(Image);
  if (ExtImage === '.txt') {
    const l = readFirstLine(MemberURL + Image);
    if (l !== null) ViewBag.IMAGENAME = l;
  }
  if (IMG_EXT.includes(ExtImage)) ViewBag.IMAGENAME = urlOf(Image);
  if (KYC_Details !== null) return res.json({ view: '~/Views/V4Admin/UpdateMemberProfile/Index.cshtml', Model: KYC_Details, ...ViewBag });
  return res.json({ view: '~/Views/V4Admin/UpdateMemberProfile/Index.cshtml', ...ViewBag });
}));

function nz(v) { return v === null || v === undefined ? '' : String(v); }

/** shared body of the 4 approve/reject actions: [DBO].[USP_APPROVEANDREJECT_MEMBERKYC] @MODE,@REGNO,@ID,@STATUS,@REMARK,@RESULT OUT */
async function approveReject(res, MODE, idStr, RegNo, Status, Remark, passIdAsString) {
  if (idStr !== '' && RegNo !== '') {
    const ConId = cvtInt(idStr);
    const ConRegno = cvtInt(RegNo);
    if (Remark === null) Remark = '';
    const params = { MODE, REGNO: ConRegno, ID: passIdAsString ? idStr : ConId, STATUS: Status, REMARK: Remark };
    for (const k of Object.keys(params)) if (params[k] === null || params[k] === undefined) delete params[k]; // null SqlParameter => default
    const row = await db.procOne(DB, 'USP_APPROVEANDREJECT_MEMBERKYC', params);
    const ReturnMgs = outStr(row, 'RESULT');
    return res.json(ReturnMgs);
  }
  return res.json('Member ID Not Fount!');
}

// ---------------------------------------------------------------- JsonResult IDProofApproveRejectKYC(string Pid, string RegNo, string PhotoStatus, string PhotoRemark)
// auth (no session check in the legacy; admin KYC action => adminAuth)
router.all(`/admin/${C}/IDProofApproveRejectKYC{/:id}`, adminAuth, asyncHandler(async (req, res) =>
  approveReject(res, 1, nStr(req.p.Pid), nStr(req.p.RegNo), nStr(req.p.PhotoStatus), nStr(req.p.PhotoRemark), false)));

// ---------------------------------------------------------------- JsonResult IdfruntBackApproveRejectKYC(string Idfruntbackimg, string RegNo, string IdfruntStatus, string IdfruntRemark)
// auth
router.all(`/admin/${C}/IdfruntBackApproveRejectKYC{/:id}`, adminAuth, asyncHandler(async (req, res) =>
  approveReject(res, 2, nStr(req.p.Idfruntbackimg), nStr(req.p.RegNo), nStr(req.p.IdfruntStatus), nStr(req.p.IdfruntRemark), false)));

// ---------------------------------------------------------------- JsonResult TaxationDocApproveRejectKYC(string PcId, string RegNo, string PanStatus, string PanRemark)
// auth
router.all(`/admin/${C}/TaxationDocApproveRejectKYC{/:id}`, adminAuth, asyncHandler(async (req, res) =>
  approveReject(res, 3, nStr(req.p.PcId), nStr(req.p.RegNo), nStr(req.p.PanStatus), nStr(req.p.PanRemark), false)));

// ---------------------------------------------------------------- JsonResult BankDetailApproveRejectKYC(string BId, string RegNo, string BankStatus, string BankRemark)
// auth  (legacy passed the raw string BId as @ID, ConBId was only computed)
router.all(`/admin/${C}/BankDetailApproveRejectKYC{/:id}`, adminAuth, asyncHandler(async (req, res) =>
  approveReject(res, 4, nStr(req.p.BId), nStr(req.p.RegNo), nStr(req.p.BankStatus), nStr(req.p.BankRemark), true)));

module.exports = router;
