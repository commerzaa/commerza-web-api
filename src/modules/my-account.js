'use strict';
/** Port of Controllers/MemberPanelCntrl/MyAccountController.cs (7 routes). */
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../config');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { query, queryOne, proc, procOne } = require('../db');
const { mapRow, mapRows, netDate } = require('../utils/shape');
const { Encryptword } = require('../utils/crypto');
const UtilityClass = require('../lib/UtilityClass');
const DataUtility = require('../lib/DataUtility');
const QuickoKYCAPI = require('../lib/QuickoKYCAPI');

const router = express.Router();
const formOnly = multer({ storage: multer.memoryStorage() }).none(); // legacy read HttpContext.Request.Form

const npe = () => new TypeError('Object reference not set to an instance of an object.');
const badFormat = () => new Error('Input string was not in a correct format.');
const isNull = (v) => v === undefined || v === null;
const str = (v) => (v === undefined ? null : v);
const form = (req, k) => {
  const b = req.body && typeof req.body === 'object' ? req.body : {};
  const key = Object.keys(b).find((x) => x.toLowerCase() === k.toLowerCase());
  return key === undefined || b[key] === undefined ? null : String(b[key]);
};
const toInt = (s) => { // Convert.ToInt32 / ToInt64 (string)
  if (isNull(s)) return 0;
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw badFormat();
  return Number(t);
};
const toDouble = (s) => { // Convert.ToDouble (string)
  if (isNull(s)) return 0;
  const t = String(s).trim();
  if (t === '' || Number.isNaN(Number(t))) throw badFormat();
  return Number(t);
};
const col = (row, name) => { if (!row) return undefined; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : row[k]; };
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : undefined);
// OUT parameter value as .Value.ToString() (DBNull => "")
const outStr = (row, name) => {
  let v = col(row, name);
  if (v === undefined && row && Object.keys(row).length === 1) v = firstCol(row);
  return v === null || v === undefined ? '' : String(v);
};

const MemberProfileProps = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId', 'Password', 'ImageName',
  'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender', 'HighestQualification', 'CID', 'SID', 'CTID',
  'Atc_WalletAddress', 'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE', 'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB',
  'NOMINEECONTACT', 'FACEBOOKLINK', 'maritalstatus', 'Address', 'SponsorUsername', 'STATENAME'];
const MemberKycProps = ['PHOTOIMAGE', 'IDFRUNTIMGTYPE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'PCIDTYPE', 'PCIDNO', 'DOB', 'PANCARDIMG',
  'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'IFSCCODE', 'BANKNAME', 'BRANCHNAME', 'BANKIMG', 'PHOTOSTATUS', 'IDFRUNTIMGSTATUS', 'PANSTATUS', 'BANKSTATUS',
  'ALLSTATUS', 'PHOTOREMARK', 'IDFRUNTIMGREMARK', 'PANREMARK', 'BANKREMARK', 'KycMode', 'ISPROFILESTATUS'];

// legacy MyAccountController.SaveImage (base64 images => UtilityClass.ImageUploadMasterMethodECommNew, otherwise keep file name)
async function SaveImage(imgecode) {
  if (isNull(imgecode)) throw npe();
  const OriginalImageFolder = config.app.kycimage;
  let returnfilename = '';
  for (const items of String(imgecode).split('^')) {
    const IdForAppend = 'KYC_Images';
    if (items.trim() !== '' && items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(items, OriginalImageFolder, IdForAppend);
      if (getnewfilename.trim() !== '') {
        returnfilename = returnfilename.trim() === '' ? getnewfilename : returnfilename + '^' + getnewfilename;
      }
    } else if (items.trim() !== '' && !items.includes('base64,')) {
      const fn = items.split(/[\\/]/).pop();
      returnfilename = returnfilename.trim() === '' ? fn : returnfilename + '^' + fn;
    }
  }
  return returnfilename;
}

// Shared USP_MEMBER_KYC_DETAILS call. p = already-computed per-parameter values (OUT @RESULT returned as column).
async function callMemberKycDetails(p) {
  const row = await procOne('affiliate', 'usp_member_kyc_details', {
    mode: p.MODE, regno: p.REGNO, photoimage: p.PHOTOIMAGE, fruntimg: p.FRUNTIMG, backimg: p.BACKIMG, pancardimg: p.PANCARDIMG,
    bankimg: p.BANKIMG, idno: p.IDNO, idtype: p.IDTYPE, pcidtype: p.PCIDTYPE, pcidno: p.PCIDNO, dob: p.DOB, accountno: p.ACCOUNTNO,
    accountholdername: p.ACCOUNTHOLDERNAME, ifsccode: p.IFSCCODE, branchname: p.BRANCHNAME, bankname: p.BANKNAME, kyctype: 'OFFLINE',
  });
  return outStr(row, 'result');
}

// auth
router.post('/api/ReferralIndex', auth, asyncHandler(async (req, res) => {
  const profile_type = str(req.p.profile_type);
  const plid = str(req.p.plid);
  let responseData = [];
  let PROCEDURENAME = '';
  try {
    if (plid === null) return res.json({ status: 'false', message: 'Invalid user' }); // Ok(...)
    const Plid = toDouble(plid);
    let regno = 0;
    PROCEDURENAME = 'Usp_check_kyc';
    await procOne('affiliate', 'usp_check_kyc', { plid: Plid }); // @strResult OUT (result unused)

    const row = await queryOne('affiliate', 'select * from member_master where regno = @plid limit 1', { plid: Plid });
    if (row) regno = Number(row.regno);
    // bank details were read into locals only (never returned)
    await queryOne('affiliate', "select * from bank_accounts where regno = @regno and active = '1' limit 1", { regno });

    PROCEDURENAME = 'USP_GETCONTACTDETAILS';
    const memdetails = mapRow(await procOne('affiliate', 'usp_getcontactdetails', { plid: Plid }), MemberProfileProps);
    // ProfileDetails (unused in response)
    await query('affiliate', "SELECT coalesce(FIELDNAME,'') AS FIELDNAME FROM TBL_DETAILSPAGEMASTERFORPROFILEUPDATION ORDER BY DISPLAYSHOW ASC");

    // Member_Master.Get_member_details
    const memberdata = await queryOne('affiliate', 'select * from member_master where regno = @plid limit 1', { plid: Math.trunc(Plid) });
    // SendSMSStatus (unused)
    await queryOne('affiliate', 'Select Sms_Send_Status from TBL_SMSACTION Where ID=21 limit 1');

    if (memdetails !== null) {
      if (!memberdata) throw npe();
      responseData.push({
        status: 'true',
        message: 'Success',
        memberdata: memdetails,
        ismobileverified: memberdata.ismobileselfverified === undefined ? null : memberdata.ismobileselfverified,
        sendsms: memberdata.isemailselfverified === undefined ? null : memberdata.isemailselfverified,
      });
    } else {
      responseData.push({ status: 'false', message: 'data no found', memberdata: memdetails });
    }
    return res.json(responseData);
  } catch (ExpObj) {
    const code = 0; // no Win32Exception equivalent
    const line = 0;
    await new DataUtility().ErrorInsert(code, ExpObj.message, PROCEDURENAME, line, req.path);
    responseData = [{ status: 'false', message: 'error found', _error: ExpObj.message }];
    return res.json(responseData);
  }
}));

// first line of a legacy ".txt" KYC image file (File.OpenText + ReadLine; throws when the file is missing, like legacy)
function readFirstLine(file) {
  const content = fs.readFileSync(file, 'utf8');
  const nl = content.search(/\r?\n/);
  return content.length === 0 ? null : (nl === -1 ? content : content.slice(0, nl));
}

// auth
router.post('/api/KYC', auth, asyncHandler(async (req, res) => {
  const plid = str(req.p.plid);
  const responsedata = [];
  if (plid === null) return res.json({ status: 'false', message: 'Invalid user' }); // Ok(...)
  const Plid = toInt(plid);
  Encryptword('KYC_UploadWithDetail'); // legacy: variable `kyc` (unused)
  // PORT-NOTE: legacy AppSettings["MemberKYCURL"] (directory prefix of the .txt image files). Falls back to <uploadDir>/<kycimage>/.
  const MemberURL = config.app.MemberKYCURL || (path.join(config.uploadDir, config.app.kycimage) + path.sep);

  // Check Self Verification Status For Admin Side
  let Status = true;
  const kt5 = await queryOne('affiliate', 'select * from tbl_kyctype where ktid = 5 limit 1');
  if (kt5) Status = kt5.status === true || Number(kt5.status) === 1;
  if (Status === false) {
    await proc('affiliate', 'usp_memberkyc_statusimg', { mode: 8, regno: Plid });
  }
  // Offline KYC status (SqlQuery<int>().FirstOrDefault())
  await procOne('affiliate', 'usp_memberkyc_statusimg', { mode: 10, regno: 0 });

  // Online KYC check
  const okRow = await procOne('affiliate', 'usp_master_onlinekyc', {
    mode: 4, mokid: 0, apikey: '', secretkey: '', verificationtype: '', status: 0,
  });
  const OnlineKycResponce = toInt(outStr(okRow, 'outstrresult') === '' ? '' : outStr(okRow, 'outstrresult'));
  if (OnlineKycResponce === 1) {
    try {
      const ApiResponse = await QuickoKYCAPI.Authenticate();
      if (ApiResponse && ApiResponse !== 'Unauthorized') {
        const obj = JSON.parse(ApiResponse);
        const tokenVal = obj ? obj.access_token : undefined;
        const access_token = tokenVal === undefined || tokenVal === null ? '' : String(tokenVal);
        await procOne('affiliate', 'usp_generateaccesstoken', { access_token, apiresponse: ApiResponse }); // @STRESULT OUT
      }
    } catch (expobj) { /* swallowed, as legacy */ }
  }

  const ObjKycDetatls = mapRow(await procOne('affiliate', 'usp_memberkyc_statusimg', { mode: 6, regno: Plid }), MemberKycProps);
  if (ObjKycDetatls) {
    // Legacy resolved image paths into local variables that were never returned; the only observable effect is that
    // ".txt" image files are opened (throws if missing). Reproduced in the same order.
    const ext = (s) => (isNull(s) ? null : path.extname(s));
    for (const f of ['PHOTOIMAGE', 'FRUNTIMG', 'BACKIMG', 'PANCARDIMG', 'BANKIMG']) {
      if (!isNull(ObjKycDetatls[f]) && ext(ObjKycDetatls[f]) === '.txt') readFirstLine(MemberURL + ObjKycDetatls[f]);
    }
  }
  // Remaining lookups (results were unused in the response)
  await queryOne('affiliate', 'SELECT KycMode FROM MEMBER_MASTER WHERE REGNO = @plid limit 1', { plid: Plid });
  await queryOne('affiliate', 'Select PANNO From MEMBER_MASTER Where REGNO = @plid limit 1', { plid: Plid });
  await queryOne('affiliate', 'Select 1 from TBL_MEMBER_KYC_DETAILS where REGNO = @plid limit 1', { plid: Plid });
  for (const k of [1, 2, 3, 4]) await queryOne('affiliate', "SELECT STATUS FROM TBL_KYCTYPE WHERE STATUS = '1' AND KTID = @k limit 1", { k });
  for (const k of [1, 2, 3, 4]) await queryOne('affiliate', "SELECT TITLE FROM TBL_KYCTYPE WHERE STATUS = '1' AND KTID = @k limit 1", { k });

  if (ObjKycDetatls) ObjKycDetatls.DOB = netDate(ObjKycDetatls.DOB); // .NET DateTime JSON style
  responsedata.push({ status: 'true', message: 'success', data: ObjKycDetatls });
  return res.json(responsedata);
}));

// auth
router.post('/api/InsertKYC', auth, asyncHandler(async (req, res) => {
  const g = (k) => str(req.p.get(k));
  let MODE = g('MODE');
  const plid = g('plid');
  let bankname = g('bankname'), branchname = g('branchname'), Accountholdername = g('Accountholdername'), AccountNo = g('AccountNo'),
    IFSC = g('IFSC'), ddl_Taxdocument = g('ddl_Taxdocument'), Txt_TaxIdnumber = g('Txt_TaxIdnumber'), Id_Resno = g('Id_Resno'),
    Residential_ProofType = g('Residential_ProofType'), DOB = g('DOB');
  const res_ = [];
  if (bankname === null && Residential_ProofType === null && ddl_Taxdocument === null) MODE = '1'; // ID PROOF
  if (bankname === null && Residential_ProofType !== null && ddl_Taxdocument === null) MODE = '2'; // Residential Proof
  if (bankname === null && Residential_ProofType === null && ddl_Taxdocument !== null) MODE = '3'; // Taxation Document
  if (bankname !== null && Residential_ProofType === null && ddl_Taxdocument === null) MODE = '4'; // Bank
  // ExistFileName / ExistBackName only fed the (commented-out) file handling
  if (bankname === null) bankname = '';
  if (branchname === null) branchname = '';
  if (Accountholdername === null) Accountholdername = '';
  if (AccountNo === null) AccountNo = '';
  if (IFSC === null) IFSC = '';
  if (ddl_Taxdocument === null) ddl_Taxdocument = '0';
  if (Residential_ProofType === null) Residential_ProofType = '0';
  if (Id_Resno === null) Id_Resno = '';
  if (Txt_TaxIdnumber === null) Txt_TaxIdnumber = '';
  if (DOB === null) DOB = '';

  const Plid = toDouble(plid);
  // File handling is commented out in legacy => files / filesbackid are always ""
  const files = '';
  const filesbackid = '';
  const p = {};
  p.MODE = toInt(MODE);
  p.REGNO = Math.round(Plid);
  p.PHOTOIMAGE = MODE === '1' ? files : '';
  if (MODE === '2') { p.FRUNTIMG = files; p.BACKIMG = filesbackid; } else { p.FRUNTIMG = ''; p.BACKIMG = ''; }
  p.PANCARDIMG = MODE === '3' ? files : '';
  p.BANKIMG = MODE === '4' ? files : '';
  p.IDNO = Id_Resno;
  p.IDTYPE = toInt(Residential_ProofType);
  p.PCIDTYPE = toInt(ddl_Taxdocument);
  p.PCIDNO = Txt_TaxIdnumber;
  p.DOB = DOB;
  p.ACCOUNTNO = AccountNo;
  p.ACCOUNTHOLDERNAME = Accountholdername;
  p.IFSCCODE = IFSC;
  p.BRANCHNAME = branchname;
  p.BANKNAME = bankname;
  const result = await callMemberKycDetails(p);
  if (result === 'Failed') res_.push({ status: 'false', message: result });
  else res_.push({ status: 'true', message: result });
  return res.json(res_);
}));

// auth
router.post('/api/KycPhoto', auth, formOnly, asyncHandler(async (req, res) => {
  const res_ = [];
  try {
    // LoginID is read but only used by legacy's dead FileUploader branch (FileUploader is always null)
    const plid = form(req, 'plid');
    const upload = form(req, 'upload');
    const MODE = form(req, 'Mode');
    const Plid = toDouble(plid);
    const files = await SaveImage(upload);
    const p = {};
    p.MODE = toInt(MODE);
    p.REGNO = Math.round(Plid);
    p.PHOTOIMAGE = MODE === '1' ? files : '';
    p.FRUNTIMG = MODE === '2' ? files : '';
    p.BACKIMG = MODE === '5' ? files : '';
    p.PANCARDIMG = MODE === '3' ? files : '';
    p.BANKIMG = MODE === '4' ? files : '';
    p.IDNO = ''; p.IDTYPE = 0; p.PCIDTYPE = 0; p.PCIDNO = ''; p.DOB = ''; p.ACCOUNTNO = ''; p.ACCOUNTHOLDERNAME = '';
    p.IFSCCODE = ''; p.BRANCHNAME = ''; p.BANKNAME = '';
    const result = await callMemberKycDetails(p);
    if (result === 'Failed') res_.push({ status: 'false', message: result });
    else res_.push({ status: 'true', message: result });
  } catch (ex) {
    res_.push({ status: 'false', message: ex.message });
  }
  return res.json(res_);
}));

// auth
router.post('/api/KycIDProof', auth, formOnly, asyncHandler(async (req, res) => {
  const plid = form(req, 'plid');
  const upload1 = form(req, 'FrontImg');
  const upload2 = form(req, 'BackImg');
  const Id_Resno = '';
  const Residential_ProofType = '';
  const MODE = '2';
  const res_ = [];
  const Plid = toDouble(plid);
  const files = await SaveImage(upload1);
  const filesbackid = await SaveImage(upload2);
  const p = {};
  p.MODE = toInt(MODE);
  p.REGNO = Math.round(Plid);
  p.PHOTOIMAGE = '';
  p.FRUNTIMG = files;
  p.BACKIMG = filesbackid;
  p.PANCARDIMG = '';
  p.BANKIMG = '';
  p.IDNO = Id_Resno;
  // PORT-NOTE: legacy does Convert.ToInt32("") here => FormatException (uncaught, HTTP 500) after the images were saved. Reproduced as-is.
  p.IDTYPE = toInt(Residential_ProofType);
  p.PCIDTYPE = 0; p.PCIDNO = ''; p.DOB = ''; p.ACCOUNTNO = ''; p.ACCOUNTHOLDERNAME = ''; p.IFSCCODE = ''; p.BRANCHNAME = ''; p.BANKNAME = '';
  const result = await callMemberKycDetails(p);
  if (result === 'Failed') res_.push({ status: 'false', message: result });
  else res_.push({ status: 'true', message: result });
  return res.json(res_);
}));

// public (master data)
router.get('/api/getTaxationDocumentList', asyncHandler(async (req, res) => {
  const res_ = [];
  try {
    const rows = await query('affiliate', "select * from Tbl_PANCARDMASTER where Status = '1'");
    const data = mapRows(rows, ['PID', 'TITLE', 'Status', 'Active', 'CreadteOn']).map((r) => ({ ...r, CreadteOn: netDate(r.CreadteOn) }));
    res_.push({ status: 'true', message: 'Taxation Document type list', data });
  } catch (ex) {
    res_.push({ status: 'false', message: ex.message });
  }
  return res.json(res_);
}));

// public (master data)
router.get('/api/getResidentialProofList', asyncHandler(async (req, res) => {
  const res_ = [];
  try {
    const rows = await query('affiliate', "select * from TBL_IDTYPE where STATUS = '1'");
    const data = mapRows(rows, ['IDTID', 'TITLE', 'IMAGE_TYPE', 'STATUS']);
    res_.push({ status: 'true', message: 'Taxation Document type list', data });
  } catch (ex) {
    res_.push({ status: 'false', message: ex.message });
  }
  return res.json(res_);
}));

module.exports = router;
