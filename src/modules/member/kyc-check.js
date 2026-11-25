'use strict';
/** Port of Member/Controllers/CustomerPanel/KYCCheck.cs (KYCCheckController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { queryOne, proc, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const paramsMw = require('../../middleware/params');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const QuickoKYCAPI = require('../../lib/member/QuickoKYCAPI');

const router = express.Router();
const DB = 'affiliate';
const upload = multer({ storage: multer.memoryStorage() });

// MemberKYC_details / AadhaarVerfication / VerifyPan / VerifyBankAccount / VerifyIfsc / AadhaarPanLinkStatus (bottom of KYCCheck.cs)
const KYC_PROPS = ['PHOTOIMAGE', 'IDFRUNTIMGTYPE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'PCIDTYPE', 'PCIDNO', 'DOB', 'PANCARDIMG', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO',
  'IFSCCODE', 'BANKNAME', 'BRANCHNAME', 'BANKIMG', 'PHOTOSTATUS', 'IDFRUNTIMGSTATUS', 'PANSTATUS', 'BANKSTATUS', 'ALLSTATUS', 'PHOTOREMARK', 'IDFRUNTIMGREMARK',
  'PANREMARK', 'BANKREMARK', 'KycMode', 'ISPROFILESTATUS'];
const AADHAAR_PROPS = ['aadhaar_number', 'age_band', 'gender', 'state', 'mobile'];
const PAN_PROPS = ['entity', 'pan', 'first_name', 'middle_name', 'last_name', 'full_name', 'status', 'category', 'last_updated'];
const BANKACC_PROPS = ['reference_id', 'account_exists', 'amount_deposited', 'message', 'name_at_bank'];
const IFSC_PROPS = ['CITY', 'STATE', 'BRANCH', 'CENTRE', 'DISTRICT', 'ADDRESS', 'BANK', 'BANKCODE', 'IFSC'];
const LINK_PROPS = ['status'];

const str = (v) => (v === undefined || v === null ? '' : String(v));
const blank2null = (v) => (v === undefined || v === '' ? null : v); // MVC DefaultModelBinder ConvertEmptyStringToNull
const convInt = (v) => { // Convert.ToInt32(string)
  if (v === undefined || v === null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(v))) throw new Error('Input string was not in a correct format.');
  return parseInt(v, 10);
};
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };
/** Convert.ToString(JToken) */
const jstr = (v) => (v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v)));
/** Path.GetExtension */
const getExt = (p) => { if (p === undefined || p === null) return null; const b = String(p).split(/[\\/]/).pop(); const i = b.lastIndexOf('.'); return i < 0 || i === b.length - 1 ? '' : b.substring(i); };
const IMG_EXT = ['.jpg', '.png', '.gif', '.jpeg', '.bmp'];
const urlPath = (req) => req.originalUrl.split('?')[0];
/** SqlQuery<T>().FirstOrDefault(): the mapped row, or null when the proc returned no data columns (OUT-only row) */
function firstMapped(row, props) {
  if (!row) return null;
  const m = mapRow(row, props);
  return props.every((p) => m[p] === null || m[p] === undefined) ? null : m;
}
/** SqlQuery<scalar>().FirstOrDefault(): first column of the first row */
const firstScalar = (rows) => { const r = rows && rows[0]; if (!r) return null; const v = Object.values(r)[0]; return v === undefined ? null : v; };
/** TempData values written by InsertKYC, consumed once read */
const kycTempData = (req) => {
  const TempData = {};
  for (const k of ['Failed', 'Success', 'Error']) {
    const v = sessionStore.get(req, 'TempData.' + k);
    if (v !== undefined) { TempData[k] = v; sessionStore.set(req, 'TempData.' + k, null); }
  }
  return TempData;
};

const UPDATE_KYC_DEFAULTS = {
  aadhaarnumber: '', agebetween: '', gender: '', aadharstate: '', registeredmobile: '', panno: '', firstname: '', middlename: '', lastname: '', fullname: '', status: '',
  category: '', lastupdatedon: '', panaadharlinkresponse: '', ifsccode: '', city: '', bankstate: '', district: '', branch: '', centre: '', address: '', bank: '',
  bankcode: '', accountholdername: '', accountnumber: '', ifsccodebank: '', bankname: '', branchname: '', referenceid: '', accountexists: '', amountdeposited: '',
  message: '', nameatbank: '',
};
/** [Usp_UpdateKycDetails] (@StrResult OUT is not used by the action) */
const updateKycDetails = (Plid, mode, o) => proc(DB, 'usp_updatekycdetails', { plid: Plid, ...UPDATE_KYC_DEFAULTS, ...o, mode });
/** [USP_MEMBER_KYC_DETAILS]; returns @RESULT (OUT, read from the result row) */
async function memberKycDetails(o) {
  const p = {
    photoimage: '', fruntimg: '', backimg: '', pancardimg: '', bankimg: '', idno: '', idtype: 0, pcidtype: 0, pcidno: '', dob: '', accountno: '', accountholdername: '',
    ifsccode: '', branchname: '', bankname: '', kyctype: '', ...o,
  };
  // PORT-NOTE: SQL Server converts '' to 1900-01-01 for the @DOB DATETIME parameter; PostgreSQL does not, so the same value is passed.
  if (p.dob === '') p.dob = '1900-01-01';
  return outCol(await proc(DB, 'usp_member_kyc_details', p), 'result');
}
/** [DBO].[USP_KYCLOGATTEMPTDETAILS] */
const kycLog = (mode, Plid, o) => proc(DB, 'usp_kyclogattemptdetails', {
  mode, regno: Plid, aadhaar: '', panno: '', panstatus: '', accountholdername: '', accountno: '', bankname: '', branchname: '', ifsc: '', ...o,
});
/** [Usp_CheckOnlineKycDetails] */
const checkOnline = (Plid, o, mode) => procOne(DB, 'usp_checkonlinekycdetails', {
  plid: Plid, aadhaarnumber: '', panno: '', ifsccode: '', accountnumber: '', ifsccodebank: '', ...o, mode,
});
const getAccessToken = async () => {
  const r = await queryOne(DB, 'SELECT access_token FROM tbl_getaccesstoken WHERE status=1 AND active=1 LIMIT 1');
  return r ? r.access_token : null;
};

// route-config: referral/kyc -> Index (id optional)
// auth
router.all(['/member/KYCCheck/Index{/:id}', '/member/referral/kyc{/:id}'], auth, asyncHandler(async (req, res) => {
  const divMode = blank2null(req.p.divMode);
  const ViewBag = {};
  if (divMode !== null) ViewBag.DivMode = divMode;
  const Plid = Number(req.user.plid);
  const MemberURL = config.app.MemberKYCURL;

  // Check Self Verification Status For Admin Side
  let Status = true;
  const kt = await queryOne(DB, 'SELECT status FROM tbl_kyctype WHERE ktid=5 LIMIT 1');
  if (kt) {
    Status = !!kt.status;
    ViewBag.MasterProfileStatus = Status;
  }
  if (Status === false) {
    await proc(DB, 'usp_memberkyc_statusimg', { mode: 8, regno: Plid });
  }

  // Check Offline KYC Status For Admin Side
  const offV = firstScalar(await proc(DB, 'usp_memberkyc_statusimg', { mode: 10, regno: 0 }));
  ViewBag.OfflineKycReponce = offV === null ? 0 : parseInt(offV, 10);

  // Check Online KYC And Generate API Access Token For Online KYC
  // PORT-NOTE: @OUTSTRRESULT OUT is returned as a column of the result row.
  const onRows = await proc(DB, 'usp_master_onlinekyc', { mode: 4, mokid: 0, apikey: '', secretkey: '', verificationtype: '', status: 0 });
  const OnlineKycResponce = convInt(outCol(onRows, 'outstrresult'));
  if (OnlineKycResponce === 1) {
    try {
      const ApiResponse = await QuickoKYCAPI.Authenticate();
      if (ApiResponse !== undefined && ApiResponse !== null && ApiResponse !== '' && ApiResponse !== 'Unauthorized') {
        const access_token = jstr(JSON.parse(ApiResponse).access_token);
        await proc(DB, 'usp_generateaccesstoken', { access_token, apiresponse: ApiResponse });
      }
    } catch (expobj) { /* legacy swallowed every exception here */ }
  }

  const Session = {
    IDProof: 'ID Proof', ResidentialProof: 'Residential Proof', TaxationDocument: 'Taxation Document ', Bank: 'Bank ',
  };
  for (const k of Object.keys(Session)) sessionStore.set(req, k, Session[k]);

  const ObjKycDetatls = firstMapped(await procOne(DB, 'usp_memberkyc_statusimg', { mode: 6, regno: Plid }), KYC_PROPS);
  if (ObjKycDetatls !== null) {
    const ExtIdProoPhoto = getExt(ObjKycDetatls.PHOTOIMAGE);
    const ExtfruntImg = getExt(ObjKycDetatls.FRUNTIMG);
    const ExtBackPhoto = getExt(ObjKycDetatls.BACKIMG);
    const ExtPanCardImg = getExt(ObjKycDetatls.PANCARDIMG);
    const ExtBankImg = getExt(ObjKycDetatls.BANKIMG);
    // StreamReader(File.OpenText(MemberURL + name)).ReadLine()
    const readFirstLine = (name) => {
      const content = fs.readFileSync(str(MemberURL) + name, 'utf8');
      return content.length === 0 ? null : content.split(/\r?\n/)[0];
    };
    const fromTxt = (name, key) => { const l = readFirstLine(name); if (l !== null) ViewBag[key] = l; };
    if (ExtIdProoPhoto === '.txt') {
      if (ObjKycDetatls.PHOTOIMAGE !== null) fromTxt(ObjKycDetatls.PHOTOIMAGE, 'IdProofPhoto');
    }
    if (IMG_EXT.includes(ExtIdProoPhoto)) {
      if (ObjKycDetatls.PHOTOIMAGE !== null) ViewBag.IdProofPhoto = '/KYC_Images/' + ObjKycDetatls.PHOTOIMAGE;
    }
    if (ExtfruntImg === '.txt' || ExtBackPhoto === '.txt') {
      if (ObjKycDetatls.FRUNTIMG !== null && ExtfruntImg === '.txt') fromTxt(ObjKycDetatls.FRUNTIMG, 'FRUNTIMG');
      if (ObjKycDetatls.BACKIMG !== null && ExtBackPhoto === '.txt') fromTxt(ObjKycDetatls.BACKIMG, 'BACKIMG');
    }
    if (IMG_EXT.includes(ExtfruntImg)) {
      if (ObjKycDetatls.FRUNTIMG !== null) ViewBag.FRUNTIMG = '/KYC_Images/' + ObjKycDetatls.FRUNTIMG;
    }
    if (IMG_EXT.includes(ExtBackPhoto)) {
      if (ObjKycDetatls.BACKIMG !== null) ViewBag.BACKIMG = '/KYC_Images/' + ObjKycDetatls.BACKIMG;
    }
    if (ExtPanCardImg === '.txt') {
      if (ObjKycDetatls.PANCARDIMG !== null) fromTxt(ObjKycDetatls.PANCARDIMG, 'PANCARDIMG');
    }
    if (IMG_EXT.includes(ExtPanCardImg)) {
      if (ObjKycDetatls.PANCARDIMG !== null) ViewBag.PANCARDIMG = '/KYC_Images/' + ObjKycDetatls.PANCARDIMG;
    }
    if (ExtBankImg === '.txt') {
      if (ObjKycDetatls.BANKIMG !== null) fromTxt(ObjKycDetatls.BANKIMG, 'BANKIMG');
    }
    if (IMG_EXT.includes(ExtBankImg)) {
      if (ObjKycDetatls.BANKIMG !== null) ViewBag.BANKIMG = '/KYC_Images/' + ObjKycDetatls.BANKIMG;
    }
  }

  // (every ViewBag value below is unset at this point, so each legacy "== null || == ''" guard is true)
  const km = await queryOne(DB, 'SELECT kycmode FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
  ViewBag.CheckofflineonlineKYC = km ? Number(km.kycmode) || 0 : 0;
  const pn = await queryOne(DB, 'SELECT panno FROM member_master WHERE regno=@plid LIMIT 1', { plid: Plid });
  ViewBag.Panno = pn ? pn.panno : null;
  const cm = await queryOne(DB, 'SELECT 1 AS v FROM tbl_member_kyc_details WHERE regno=@plid LIMIT 1', { plid: Plid });
  ViewBag.ChkeckMember = cm ? 1 : 0;
  const flag = async (ktid) => !!(await queryOne(DB, 'SELECT status FROM tbl_kyctype WHERE status=true AND ktid=@k LIMIT 1', { k: ktid }));
  ViewBag.PHOTO = await flag(1);
  ViewBag.ID = await flag(2);
  ViewBag.PANCARD = await flag(3);
  ViewBag.BANK = await flag(4);
  const title = async (ktid) => { const r = await queryOne(DB, 'SELECT title FROM tbl_kyctype WHERE status=true AND ktid=@k LIMIT 1', { k: ktid }); return r ? r.title : null; };
  ViewBag.TitleIDProof = await title(1);
  ViewBag.TitleResidProof = await title(2);
  ViewBag.TitlePANCARD = await title(3);
  ViewBag.TitleBANK = await title(4);

  const out = { view: '~/Views/CustomerPanel/KYCCheck/Index.cshtml', ViewBag, Session, TempData: kycTempData(req) };
  if (ObjKycDetatls !== null) out.Model = ObjKycDetatls;
  res.json(out);
}));

// auth. multipart: FileUploader / TakeFile / FileUploaderBack (KYC_UploadWithDetail.FileUploader, .TakeFile, .FileUploaderBack)
router.all('/member/KYCCheck/InsertKYC{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  req.p = paramsMw.build(req); // re-bind now that the multipart body is parsed
  const find = (n) => (req.files || []).find((f) => f.fieldname.replace(/^ImageUpload\./i, '').toLowerCase() === n.toLowerCase() && f.size > 0) || null;
  const FileUploader = find('FileUploader');
  const FileUploaderBack = find('FileUploaderBack');
  const ExistFileNameP = blank2null(req.p.ExistFileName);
  const ExistBackNameP = blank2null(req.p.ExistBackName);
  let bankname = blank2null(req.p.bankname);
  let branchname = blank2null(req.p.branchname);
  let Accountholdername = blank2null(req.p.Accountholdername);
  let AccountNo = blank2null(req.p.AccountNo);
  let IFSC = blank2null(req.p.IFSC);
  let ddl_Taxdocument = blank2null(req.p.ddl_Taxdocument);
  let Txt_TaxIdnumber = blank2null(req.p.Txt_TaxIdnumber);
  let Id_Resno = blank2null(req.p.Id_Resno);
  let Residential_ProofType = blank2null(req.p.Residential_ProofType);
  let DOB = blank2null(req.p.DOB);
  let MODE = blank2null(req.p.MODE);

  if (bankname === null && Residential_ProofType === null && ddl_Taxdocument === null) MODE = '1'; // ID PROOF
  if (bankname === null && Residential_ProofType !== null && ddl_Taxdocument === null) MODE = '2'; // Residential Proof
  if (bankname === null && Residential_ProofType === null && ddl_Taxdocument !== null) MODE = '3'; // Taxation Document
  if (bankname !== null && Residential_ProofType === null && ddl_Taxdocument === null) MODE = '4'; // Bank
  const ExistFileName = ExistFileNameP === null ? '' : ExistFileNameP;
  const ExistBackName = ExistBackNameP === null ? '' : ExistBackNameP;
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

  const Plid = Number(req.user.plid);
  // PORT-NOTE: legacy saved under Server.MapPath("~/Kyc_Images/"); the folder name is aligned with the one the Index action reads (KYC_Images).
  const saveDir = path.join(config.uploadDir, str((config.app && config.app.KYC_Images) || 'KYC_Images'));
  const save = (file, name) => { fs.mkdirSync(saveDir, { recursive: true }); fs.writeFileSync(path.join(saveDir, name), file.buffer); };
  const loginid = str(req.user.loginid); // ((Login)Session["Plid"]).LoginID

  let files = '';
  let filesbackid = '';
  if (FileUploader !== null) {
    const base = String(FileUploader.originalname).split(/[\\/]/).pop();
    const extension = getExt(base);
    // (the legacy block that built an unused "Kyc_Images<random><timestamp>.jpeg" name for non-.txt files had no effect and is omitted)
    const filename = loginid + '_' + (await UtilityClass.GetTimestamp(new Date())) + extension;
    save(FileUploader, filename);
    files = filename;
  } else {
    files += ExistFileName;
  }
  if (FileUploaderBack !== null) {
    const base = String(FileUploaderBack.originalname).split(/[\\/]/).pop();
    const extension = getExt(base);
    const filenamebakimg = loginid + '_' + (await UtilityClass.GetTimestamp(new Date())) + extension;
    save(FileUploaderBack, filenamebakimg);
    filesbackid = filenamebakimg;
  } else if ((FileUploader !== null && ExistBackName !== '') || (ExistFileName !== '' && ExistBackName !== '')) {
    files += '~' + ExistBackName;
  }

  const TempData = {};
  // legacy "files != null" is always true, so the "Image Not Selected" branch can never run
  const result = await memberKycDetails({
    mode: convInt(MODE),
    regno: Math.trunc(Plid),
    photoimage: MODE === '1' ? files : '',
    fruntimg: MODE === '2' ? files : '',
    backimg: MODE === '2' ? filesbackid : '',
    pancardimg: MODE === '3' ? files : '',
    bankimg: MODE === '4' ? files : '',
    idno: Id_Resno,
    idtype: convInt(Residential_ProofType),
    pcidtype: convInt(ddl_Taxdocument),
    pcidno: Txt_TaxIdnumber,
    dob: DOB,
    accountno: AccountNo,
    accountholdername: Accountholdername,
    ifsccode: IFSC,
    branchname,
    bankname,
    kyctype: 'OFFLINE',
  });
  if (result === 'Failed') {
    TempData.Failed = result;
    sessionStore.set(req, 'TempData.Failed', result);
  } else {
    TempData.Success = result;
    sessionStore.set(req, 'TempData.Success', result);
  }
  return res.json({ redirect: '/member/KYCCheck/Index', TempData }); // RedirectToAction("Index", "KYCCheck")
}));

// auth (legacy had no session check; the PAN usage check belongs to the member KYC form)
router.all('/member/KYCCheck/AllowPANNoPermission{/:id}', auth, asyncHandler(async (req, res) => {
  const PANNo = req.p.PANNo;
  let AllowedPanRes = '';
  try {
    // PORT-NOTE: in the legacy code Parms[17] (@KYCTYPE) was never assigned (Parms[16] was overwritten instead), so the SqlParameter[] held a null entry
    // and ExecuteSqlCommand threw (caught below, result ""). The stored procedure is called here with the evident intent: @BANKNAME '' and @KYCTYPE ''.
    // @RESULT OUT is returned as a column of the result row.
    AllowedPanRes = await memberKycDetails({ mode: 5, regno: 0, idtype: -1, pcidtype: 1, pcidno: PANNo });
  } catch (ex) {
    await new DataUtility().ErrorInsert(0, ex.message, 'USP_COUNTNUMBEROFUSEDPANNUMBER', 0, urlPath(req));
  }
  res.json(AllowedPanRes);
}));

// auth
router.all('/member/KYCCheck/ErasePreviouslyKycDataAndUpdatedNewKycMode{/:id}', auth, asyncHandler(async (req, res) => {
  const Mode = blank2null(req.p.Mode);
  const Plid = Number(req.user.plid);
  if (Mode !== '' && Plid > 0) {
    const rows = await proc(DB, 'usp_memberchange_kycmode', { regno: Plid, mode: convInt(Mode) });
    return res.json(outCol(rows, 'outresult'));
  }
  return res.json('some error has occurred');
}));

// ----- ONLINE KYC (checks whether the value is already used: first column of the first row as int) -----
async function alreadyExists(req, res, o, mode) {
  const rows = await proc(DB, 'usp_checkonlinekycdetails', {
    plid: Number(req.user.plid), aadhaarnumber: '', panno: '', ifsccode: '', accountnumber: '', ifsccodebank: '', ...o, mode,
  });
  const r = firstScalar(rows);
  res.json(r === null ? 0 : parseInt(r, 10));
}
// auth
router.all('/member/KYCCheck/AadhaarAllRedyExist{/:id}', auth, asyncHandler((req, res) => alreadyExists(req, res, { aadhaarnumber: req.p.Aadhaar }, '6')));
// auth
router.all('/member/KYCCheck/PanAllRedyExist{/:id}', auth, asyncHandler((req, res) => alreadyExists(req, res, { panno: req.p.PanNo }, '7')));
// auth
router.all('/member/KYCCheck/AccountNoAllRedyExist{/:id}', auth, asyncHandler((req, res) => alreadyExists(req, res, { accountnumber: req.p.AccountNo }, '8')));

// auth
router.all('/member/KYCCheck/MAadhaarVerfication{/:id}', auth, asyncHandler(async (req, res) => {
  const Aadhaar = req.p.Aadhaar;
  const Plid = Number(req.user.plid);
  const access_token = await getAccessToken();
  const cached = firstMapped(await checkOnline(Plid, { aadhaarnumber: Aadhaar }, '1'), AADHAAR_PROPS);
  if (cached === null) {
    const ApiResponse = await QuickoKYCAPI.AadhaarVerfication(access_token, Aadhaar);
    if (ApiResponse === 'GatewayTimeout' || ApiResponse === '429' || ApiResponse === null || ApiResponse === undefined || ApiResponse === 'InternalServerError') {
      return res.json('error');
    }
    const o = JSON.parse(ApiResponse);
    const aadhaar_number = jstr(o.aadhaar_number);
    const age_band = jstr(o.age_band);
    const gender = jstr(o.gender);
    const state = jstr(o.state);
    const mobile = jstr(o.mobile);
    await updateKycDetails(Plid, '1', { aadhaarnumber: aadhaar_number, agebetween: age_band, gender, aadharstate: state, registeredmobile: mobile });
    // AADHAAR Number Save In OFFLINE KYC Table
    await memberKycDetails({ mode: 2, regno: Math.trunc(Plid), fruntimg: 'uploadkyc.png', backimg: 'uploadkyc.png', idno: Aadhaar, idtype: 7, pcidtype: 0, kyctype: 'ONLINE' });
    // INSERT DATA IN KYCLOG TABLE
    await kycLog(1, Plid, { aadhaar: aadhaar_number });
    return res.json({ aadhaar_number, age_band, gender, state, mobile });
  }
  return res.json(cached);
}));

// auth
router.all('/member/KYCCheck/MVerifyPAN{/:id}', auth, asyncHandler(async (req, res) => {
  const Pan = req.p.Pan;
  const Plid = Number(req.user.plid);
  const access_token = await getAccessToken();
  const cached = firstMapped(await checkOnline(Plid, { panno: Pan }, '2'), PAN_PROPS);
  if (cached === null) {
    const ApiResponse = await QuickoKYCAPI.FetchPAN(access_token, 'y', 'Need to do Kyc in kreazlife shopping portal', Pan);
    if (ApiResponse === 'InternalServerError' || ApiResponse === '429' || ApiResponse === null || ApiResponse === undefined) {
      return res.json('error' + '^' + 'api');
    }
    const o = JSON.parse(ApiResponse);
    const pan = jstr(o.pan);
    const first_name = jstr(o.first_name);
    const middle_name = jstr(o.middle_name);
    const last_name = jstr(o.last_name);
    const full_name = jstr(o.full_name);
    const status = jstr(o.status);
    const category = jstr(o.category);
    const last_updated = jstr(o.last_updated);
    // INSERT DATA IN KYCLOG TABLE
    await kycLog(2, Plid, { panno: pan, panstatus: status });
    if (status.toUpperCase() === 'INVALID') return res.json('WorngPanNo' + '^' + 'api');
    await updateKycDetails(Plid, '2', {
      panno: pan, firstname: first_name, middlename: middle_name, lastname: last_name, fullname: full_name, status, category, lastupdatedon: last_updated,
    });
    // PANCARD Number Save In OFFLINE KYC Table
    await memberKycDetails({ mode: 3, regno: Math.trunc(Plid), pancardimg: 'uploadkyc.png', idtype: 0, pcidtype: 1, pcidno: Pan, dob: '1999-01-01', kyctype: 'ONLINE' });
    return res.json('Verify' + '^' + pan + '^' + first_name + '^' + middle_name + '^' + last_name + '^' + full_name + '^' + status + '^' + category + '^' + last_updated);
  }
  return res.json('Verify' + '^' + str(cached.pan) + '^' + str(cached.first_name) + '^' + str(cached.middle_name) + '^' + str(cached.last_name) + '^' + str(cached.full_name)
    + '^' + str(cached.status) + '^' + str(cached.category) + '^' + str(cached.last_updated));
}));

// auth
router.all('/member/KYCCheck/MPANAadhaarLinkStatus{/:id}', auth, asyncHandler(async (req, res) => {
  const Aadhaar = req.p.Aadhaar;
  const Pan = req.p.Pan;
  const Plid = Number(req.user.plid);
  const access_token = await getAccessToken();
  const cached = firstMapped(await checkOnline(Plid, { aadhaarnumber: Aadhaar, panno: Pan }, '3'), LINK_PROPS);
  if (cached === null) {
    const ApiResponse = await QuickoKYCAPI.PANAadhaarLinkStatus(access_token, Pan, Aadhaar);
    const status = jstr(JSON.parse(ApiResponse).status);
    await updateKycDetails(Plid, '3', { aadhaarnumber: Aadhaar, panno: Pan, panaadharlinkresponse: status });
    return res.json({ status });
  }
  return res.json(cached);
}));

// auth
router.all('/member/KYCCheck/MVerifyIfsc{/:id}', auth, asyncHandler(async (req, res) => {
  const IFSCCode = req.p.IFSCCode;
  const Plid = Number(req.user.plid);
  const cached = firstMapped(await checkOnline(Plid, { ifsccode: IFSCCode }, '4'), IFSC_PROPS);
  if (cached === null) {
    const ApiResponse = await QuickoKYCAPI.FetchBankDetailsByIFSC(IFSCCode);
    const o = JSON.parse(ApiResponse);
    const CITY = jstr(o.CITY);
    const STATE = jstr(o.STATE);
    const BRANCH = jstr(o.BRANCH);
    const CENTRE = jstr(o.CENTRE);
    const DISTRICT = jstr(o.DISTRICT);
    const ADDRESS = jstr(o.ADDRESS);
    const BANK = jstr(o.BANK);
    const BANKCODE = jstr(o.BANKCODE);
    const IFSC = jstr(o.IFSC);
    await updateKycDetails(Plid, '4', {
      ifsccode: IFSCCode, city: CITY, bankstate: STATE, district: DISTRICT, branch: BRANCH, centre: CENTRE, address: ADDRESS, bank: BANK, bankcode: BANKCODE,
    });
    return res.json({ CITY, STATE, BRANCH, CENTRE, DISTRICT, ADDRESS, BANK, BANKCODE, IFSC });
  }
  return res.json(cached);
}));

// auth
router.all('/member/KYCCheck/MVerifyBankAccount{/:id}', auth, asyncHandler(async (req, res) => {
  const AccountHolderName = req.p.AccountHolderName;
  const AccountNo = req.p.AccountNo;
  const IFSCCode = req.p.IFSCCode;
  const BankName = req.p.BankName;
  const BranchName = req.p.BranchName;
  const Plid = Number(req.user.plid);
  const access_token = await getAccessToken();
  const cached = firstMapped(await checkOnline(Plid, { accountnumber: AccountNo, ifsccodebank: IFSCCode }, '5'), BANKACC_PROPS);
  if (cached === null) {
    const ApiResponse = await QuickoKYCAPI.FetchBankDetailsByIFSC(access_token, IFSCCode, AccountNo, AccountHolderName, req.user.mobile);
    const o = JSON.parse(ApiResponse); // legacy parsed before the error-text checks below (a non-JSON error text throws here as well)
    if (ApiResponse === 'InternalServerError' || ApiResponse === '429' || ApiResponse === null || ApiResponse === undefined) {
      return res.json('error' + '^' + 'api');
    }
    const reference_id = jstr(o.reference_id);
    const account_exists = jstr(o.account_exists);
    const amount_deposited = jstr(o.amount_deposited);
    const message = jstr(o.message);
    const name_at_bank = jstr(o.name_at_bank);
    await updateKycDetails(Plid, '5', {
      ifsccode: IFSCCode,
      accountholdername: AccountHolderName,
      accountnumber: AccountNo,
      ifsccodebank: IFSCCode,
      bankname: BankName,
      branchname: BranchName,
      referenceid: reference_id,
      accountexists: account_exists,
      amountdeposited: amount_deposited,
      message,
      nameatbank: name_at_bank,
    });
    // BANK ACCOUNT DETAILS Save In OFFLINE KYC Table
    await memberKycDetails({
      mode: 4,
      regno: Math.trunc(Plid),
      bankimg: 'uploadkyc.png',
      idtype: 0,
      pcidtype: 0,
      accountno: AccountNo,
      accountholdername: AccountHolderName,
      ifsccode: IFSCCode,
      branchname: BranchName,
      bankname: BankName,
      kyctype: 'ONLINE',
    });
    // INSERT DATA IN KYCLOG TABLE
    await kycLog(3, Plid, { accountholdername: AccountHolderName, accountno: AccountNo, bankname: BankName, branchname: BranchName, ifsc: IFSCCode });
    return res.json('Verify' + '^' + reference_id + '^' + account_exists + '^' + amount_deposited + '^' + message + '^' + name_at_bank);
  }
  return res.json('Verify' + '^' + str(cached.reference_id) + '^' + str(cached.account_exists) + '^' + str(cached.amount_deposited) + '^' + str(cached.message)
    + '^' + str(cached.name_at_bank));
}));

module.exports = router;
