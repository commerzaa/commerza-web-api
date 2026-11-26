// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\KYCCheck.cs (class KYCCheckController => /portal/KYCCheck/...)
'use strict';
// Database: shopping (Db_Shopping; legacy DataBaseContext). [CheckResellerTimeout] has a commented-out body => no check.
// String parameters: see the PORT-NOTEs at the top of _shared/batch-19-common.js.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const {
  DB, s, NRE, str, outAny, sqlInt, requiredInt, mapPath, appFolder, legacyKycImgName, deleteIfExists,
  memberMasterByPlid, kycCount, KycCheckSendConfirmationEmail, InsertKYCViaCs,
} = require('./_shared/batch-19-common');

const router = express.Router();
const C = '/portal/KYCCheck';

/** class getdetails */
const GETDETAILS = ['id', 'Regno', 'Type', 'Image'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["PLID"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/kyccheck" -> KYCCheck/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/kyccheck{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  ViewBag.PancardDeails = '/images/uploadkyc.png';
  ViewBag.IDProofDeails = '/images/uploadkyc.png';
  ViewBag.Photograph = '/images/uploadkyc.png';
  ViewBag.Bank_Passbook = '/images/uploadkyc.png';
  ViewBag.PancardMessage = '';
  ViewBag.PancardApprovalStatus = 0;
  ViewBag.PhotographMessage = '';
  ViewBag.PhotographApprovalStatus = 0;
  ViewBag.IDProofMessage = '';
  ViewBag.IDProofApprovalStatus = 0;
  ViewBag.Bank_PassbookMessage = '';
  ViewBag.Bank_PassbookApprovalStatus = 0;
  ViewBag.PancardImageMessage = 'Image Not Uploaded';
  ViewBag.PhotographImageMessage = 'Image Not Uploaded';
  ViewBag.IDProofImageMessage = 'Image Not Uploaded';
  ViewBag.Bank_PassbookImageMessage = 'Image Not Uploaded';
  const Plid = req.user.plid;
  // DbContext._Bank_Details (DBO.bank_accounts).Where(a => a.regNo == Plid && a.active == true).FirstOrDefault()
  const SingleRow = await db.queryOne(DB, `select accountholdername, accountno, bankname, branchname, ifsccode, pancardno
from bank_accounts where regno = @Plid and active = true limit 1`, { Plid });
  if (SingleRow !== null) {
    ViewBag.AcountHolderName = s(SingleRow.accountholdername);
    ViewBag.Acountno = s(SingleRow.accountno);
    ViewBag.Bankname = s(SingleRow.bankname);
    ViewBag.Branchname = s(SingleRow.branchname);
    ViewBag.IFSCCode = s(SingleRow.ifsccode);
    ViewBag.Panno = s(SingleRow.pancardno);
  }
  if (ViewBag.Panno === undefined || ViewBag.Panno === null || ViewBag.Panno === '') {
    // legacy concatenated PLID=" + Plid (parameterised here)
    const r = await db.queryOne(DB, 'select panno from portal_login where plid = @Plid limit 1', { Plid });
    ViewBag.Panno = r ? r.panno : null;
  }
  // Convert(Varchar(100),DOB,110) => mm-dd-yyyy
  const ObjGetFueDetails = await db.queryOne(DB, `select to_char(dob, 'MM-DD-YYYY') as dob, idtype, idrefno
from portal_login where plid = @Plid limit 1`, { Plid });
  if (ObjGetFueDetails !== null) {
    ViewBag.DOB = ObjGetFueDetails.dob;
    ViewBag.IdType = ObjGetFueDetails.idtype;
    ViewBag.IdRefNo = ObjGetFueDetails.idrefno;
  }
  return res.json({ view: '~/Views/CustomerPanel/KYCCheck/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- string InsertKYCViaCs(string Typetext, string MemberImg, int Mode, int Id, string Get_This, double Plid)
// auth
// PORT-NOTE: this public helper (called in-process by My_Profile.Insert_BankDetail) was also reachable as an MVC action with no
// session check and a client-supplied Plid. The port requires a logged-in customer (auth) but keeps the legacy Plid parameter
// and the ContentResult (text/html string) response.
router.all(`${C}/InsertKYCViaCs{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const sig = 'System.String InsertKYCViaCs(System.String, System.String, Int32, Int32, System.String, Double)';
  const Mode = requiredInt(req.p.Mode, 'Mode', sig);
  const Id = requiredInt(req.p.Id, 'Id', sig);
  const pl = str(req.p.Plid);
  if (pl === null || pl.trim() === '' || Number.isNaN(Number(pl))) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter 'Plid' of non-nullable type 'System.Double' for method '${sig}'.`);
    e.status = 500;
    throw e;
  }
  const ret = await InsertKYCViaCs(str(req.p.Typetext), str(req.p.MemberImg), Mode, Id, str(req.p.Get_This), Number(pl));
  return res.type('text/html').send(s(ret));
}));

// ---------------------------------------------------------------- JsonResult InsertKYCViaJquery(string Typetext, string MemberImg, int Mode, int Id, string GetThisId, string FirstValue, string SecondValue)
// auth ((Login)Session["Plid"] cast without null check)
router.all(`${C}/InsertKYCViaJquery{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const sig = 'System.Web.Mvc.JsonResult InsertKYCViaJquery(System.String, System.String, Int32, Int32, System.String, System.String, System.String)';
  const Typetext = str(req.p.Typetext);
  const MemberImg = str(req.p.MemberImg);
  const Mode = requiredInt(req.p.Mode, 'Mode', sig);
  const Id = requiredInt(req.p.Id, 'Id', sig);
  const GetThisId = str(req.p.GetThisId);
  const FirstValue = str(req.p.FirstValue);
  const SecondValue = str(req.p.SecondValue);
  let ret = '';
  const Plid = req.user.plid;
  if (Typetext === 'Pancard-Details') {
    // (bank details check commented out in legacy)
  }
  if (Typetext === 'bank-passbook') {
    // (bank details check commented out in legacy)
  }
  let strValidFullName = '';
  try {
    let ImgName = '';
    if (MemberImg === null) throw NRE(); // MemberImg.Trim()
    if (MemberImg.trim() !== '' && MemberImg.includes('base64,')) {
      const SavePaths = appFolder('KYC_Images');
      if (MemberImg !== '') {
        ImgName = legacyKycImgName('', Plid); // private string loginid = ""
      } else {
        ImgName = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + ImgName;
      ImgName = s(await UtilityClass.ImageUploadMasterMethod(MemberImg, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'KYC'));
    }
    const sp = await db.procOne(DB, 'USP_INSERTKYC', { PLID: Plid, TYPE: GetThisId, IMAGE: ImgName, ID: Id, MODE: Mode });
    ret = outAny(sp, 'STRRESULT').toLowerCase();
    if (s(ret) === 'ok') {
      if (Typetext === 'Pancard-Details' || Typetext === 'IDProof') {
        const r = await db.procOne(DB, 'USP_EDITCONTACTDETAILS', {
          PLID: Plid,
          CPERTITLE: '',
          CPERDESIGNATION: '',
          CPERMOBILENO: '',
          CPEREMAILID: '',
          FIRSTNAME: '',
          LASTNAME: '',
          USERNAME: '',
          DOB: (Typetext === 'Pancard-Details' ? SecondValue : ''),
          FatherOrMotherName: '',
          Gender: sqlInt(''),
          HighestQualification: sqlInt(''),
          Mode: sqlInt('0'),
          IsVerified: sqlInt(''),
          IdType: (Typetext === 'IDProof' ? FirstValue : ''),
          IdRefNo: (Typetext === 'IDProof' ? SecondValue : ''),
          PANNO: (Typetext === 'Pancard-Details' ? FirstValue : ''),
        });
        const ResValue = outAny(r, 'INTRESULT');
        if (ResValue === '3') {
          ret = ResValue;
        }
      }
    }
    let emailid = ''; let username = ''; let regno = 0;
    const row = await memberMasterByPlid(Plid);
    if (row !== null) {
      emailid = row.emailid;
      username = row.username;
      regno = row.regno;
      const kyc_count = await kycCount(regno);
      if (kyc_count === 4) {
        await KycCheckSendConfirmationEmail(emailid, username, 'Thank you accepting the referral program.');
      }
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message
    deleteIfExists(strValidFullName);
    return res.json(Exp.message);
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult getdetails(int newid)
// auth
// PORT-NOTE: legacy had no session check (any KYC row by id, KYCTYPE=1); the port requires a logged-in customer because the
// response exposes KYC documents. No ownership check (kept as legacy).
router.all(`${C}/getdetails{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const newid = requiredInt(req.p.newid, 'newid', 'System.Web.Mvc.JsonResult getdetails(Int32)');
  const rows = await db.query(DB, 'select id, regno, type, image from kyc where kyctype = 1 and id = @newid', { newid });
  const getdetails = mapRows(rows, GETDETAILS);
  return res.json(getdetails);
}));

module.exports = router;
