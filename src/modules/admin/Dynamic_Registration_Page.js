'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Dynamic_Registration_Page.cs (class Dynamic_Registration_PageController => /Dynamic_Registration_Page/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, USP_MEMBERREGISTRATION_CSS, USP_AUTOGENRATEDLOGINPASSSETTING,
// USP_INSERTCAPTCHAKEY, Usp_AddOrRemoveField, USP_USERDEFINED, USP_MEMBERALLOWED_COUNTING; tables tbl_memberofuser_allowed, settings,
// tbl_detailspagemasterforregistration, tbl_systemtype, tbl_user_defined, tbl_matrixsettings, tbl_companymaster.
// Config: VhostsRoot (optional; legacy hard-coded "C://inetpub//vhosts//").
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const Master_RegistrationPage = require('../../lib/admin/Master_RegistrationPage');
const { adminAuth, legacyUrl, isAdmin, errorInsert } = require('./_shared/adminSession');
const { nStr, reqInt, col, str, cvtInt, nullRef, decodeBase64Image } = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Dynamic_Registration_Page';

/** Models/Master_RegistrationPage.cs */
const MASTER_REG_PROPS = ['TDPMFRID', 'FIELDNAME', 'DISPLAYSHOW', 'SHOWACTIVE', 'VALIDATIONACTIVE', 'ISEDIT', 'STATUS', 'ACTIVE', 'ISADVANCE',
  'ISSETTINGS', 'CONTROLNAME'];
/** public class MEMBERREGISTRATIONCSS */
const MEMBERREGISTRATIONCSS_PROPS = ['MRCID', 'CSSNAME', 'ISMANDOTORY', 'INONLINE', 'BACKGROUNDIMAGE', 'status'];
/** public class SysTypeSetting / UserDefined (MemberUserAllowed is declared but unused) */
const SYS_TYPE_SETTING_PROPS = ['Active', 'STID'];
const USER_DEFINED_PROPS = ['ACTIVE', 'TYPEID'];
/** Models/Settings.cs */
const SETTINGS_PROPS = ['SID', 'caption', 'CLUBDESC', 'Limits', 'Active', 'EDITABLE', 'CID', 'SYMBOL', 'CLUBCOND'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

const SESSION_EXPIRED = 'Session Expired. Please login again';
const ERR = 'Error occurred. Please try later';

/** db._Settings.Where(a => a.caption == caption).FirstOrDefault() */
async function settingByCaption(caption) {
  const r = await db.queryOne(DB, 'select * from settings where caption = @caption limit 1', { caption });
  return r ? mapRow(r, SETTINGS_PROPS) : null;
}
/** db._Settings.Single(a => a.caption == caption); s.<fields> = ...; db.SaveChanges() */
async function updateSettingSingle(caption, fields) {
  const rows = await db.query(DB, 'select sid from settings where caption = @caption limit 2', { caption });
  if (rows.length === 0) throw new Error('Sequence contains no elements');
  if (rows.length > 1) throw new Error('Sequence contains more than one matching element');
  const sets = Object.keys(fields).map((k) => `${k.toLowerCase()} = @${k}`).join(', ');
  await db.exec(DB, `update settings set ${sets} where sid = @sid`, { ...fields, sid: col(rows[0], 'sid') });
}
/** Usp_AddOrRemoveField @id,@value,@mode,@fildname,@displayshow,@intResult out[,@enablecheck] */
async function addOrRemoveField(params) {
  const row = await db.procOne(DB, 'Usp_AddOrRemoveField', params);
  return str(col(row, 'intResult'));
}
/** ExecuteSqlCommand(...) return value.
 *  PORT-NOTE: the SQL Server rows-affected count is not available for a PostgreSQL function call; a `rowsaffected` result column is used
 *  when the migrated function returns one, otherwise -1 (what SQL Server returns for procedures running with SET NOCOUNT ON). */
const affected = (rows) => {
  const v = col(rows && rows[0], 'rowsaffected');
  return v === undefined || v === null ? -1 : Number(v);
};
/** non-nullable bool action parameter */
function reqBool(v, name) {
  if (v === undefined || v === null || v === '') {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Boolean'`);
    e.status = 500;
    throw e;
  }
  const s = String(Array.isArray(v) ? v[0] : v).toLowerCase(); // checkbox "true,false" binds the first value
  if (s === 'true') return true;
  if (s === 'false') return false;
  const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Boolean'`);
  e.status = 500;
  throw e;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/master-registration" -> Dynamic_Registration_Page/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/master-registration'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  const counting = async (id) => {
    const v = await db.scalar(DB, 'select counting from tbl_memberofuser_allowed where mouaid = @id limit 1', { id });
    return v === null || v === undefined ? 0 : Number(v); // SqlQuery<Int64>().FirstOrDefault()
  };
  ViewBag.MobilePermission = await counting(1); // (ViewBag.X == null is always true at this point)
  ViewBag.EmailPermission = await counting(2);
  ViewBag.PANPermission = await counting(3);
  const prow = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const e = str(col(prow, 'EXCELSTATUS'));
  const i = str(col(prow, 'ISEDIT'));
  ViewBag.isactive = cvtInt(e === '' ? '0' : e);
  ViewBag.isedit = cvtInt(i === '' ? '0' : i);
  ViewBag.dynamiccss = mapRows(await db.proc(DB, 'USP_MEMBERREGISTRATION_CSS', { mode: 4 }), MEMBERREGISTRATIONCSS_PROPS);
  const MasterRegistrationTranpass = mapRows(await db.proc(DB, 'USP_AUTOGENRATEDLOGINPASSSETTING', { MODE: 2 }), MASTER_REG_PROPS);
  if (MasterRegistrationTranpass !== null) ViewBag.MasterRegistrationTranpass = MasterRegistrationTranpass;
  const row = await settingByCaption('Transaction Password Campelicity');
  if (row !== null) ViewBag.active = row.Active;
  const Passwrow = await settingByCaption('Password Camplacity');
  if (Passwrow !== null) ViewBag.PasswordComplexity = Passwrow.Active;
  const ag = await db.queryOne(DB, 'select * from tbl_detailspagemasterforregistration where tdpmfrid = 23 limit 1', {});
  const AutoGenratePass = ag ? mapRow(ag, MASTER_REG_PROPS) : null;
  if (AutoGenratePass !== null) ViewBag.AutoGenratePass = AutoGenratePass.SHOWACTIVE;
  const rows = await settingByCaption('Transaction Pin');
  if (rows !== null) {
    ViewBag.Transpin = rows.Active;
    ViewBag.Limit = Math.round(Number(rows.Limits)); // Convert.ToInt32(decimal)
  }
  const SysTypeSetting = mapRows(await db.query(DB, 'select stid, active from tbl_systemtype', {}), SYS_TYPE_SETTING_PROPS);
  if (SysTypeSetting !== null) ViewBag.SysTypeSetting = SysTypeSetting;
  ViewBag.ActiveUser = mapRows(await db.query(DB, 'select active, typeid from tbl_user_defined where active = 1', {}), USER_DEFINED_PROPS);
  const Totalcount = await db.scalar(DB, 'select count(1) from tbl_user_defined', {});
  ViewBag.count = Totalcount === null || Totalcount === undefined ? 0 : Number(Totalcount);
  const rm = new Master_RegistrationPage();
  const Model = await rm.AllRoleList();
  res.json({ view: '~/Views/AdminPanel/Dynamic_Registration_Page/Index.cshtml', Model, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult InsertBackgroundImage(string Image)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/InsertBackgroundImage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Image = nStr(req.p.Image);
  let LoginURl = '';
  let MainURl = '';
  let SavePaths = '';
  let base64String = '';
  let ImageExt = ''; // eslint-disable-line no-unused-vars
  let imgname = '';
  const regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  LoginURl = await db.scalar(DB, "select coalesce(software_url,'') as software_url from tbl_companymaster limit 1", {});
  MainURl = await db.scalar(DB, "select coalesce(main_url,'') as software_url from tbl_companymaster limit 1", {});
  if (LoginURl === null || LoginURl === undefined || MainURl === null || MainURl === undefined) throw nullRef();
  LoginURl = String(LoginURl).replace(/http:\/\//g, '').replace(/https:\/\//g, '');
  MainURl = String(MainURl).replace(/http:\/\//g, '').replace(/https:\/\//g, '');
  // PORT-NOTE: "C://inetpub//vhosts//" + MainURl + "//" + LoginURl + "//images//Background-image" => (config.app.VhostsRoot || <uploadDir>/vhosts)/...
  SavePaths = path.join(config.app.VhostsRoot || path.join(config.uploadDir, 'vhosts'), MainURl, LoginURl, 'images', 'Background-image');
  if (Image === null) throw nullRef(); // Image.Trim() (outside the try)
  // `if (Image.Trim() != null)` is always true
  try {
    if (Image !== '') {
      base64String = Image;
      let ProfileImage = loginid;
      if (ProfileImage === null || ProfileImage === undefined) throw nullRef();
      ProfileImage = String(ProfileImage).trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.replace(/ /g, '-');
      imgname = ProfileImage + 'BackGroundImage-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    base64String = Image;
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0) throw new Error('Length cannot be less than zero.');
      ImageExt = base64String.substring(IndexNo, lastIndexNo);
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const strValidFullName = path.join(SavePaths, imgname);
    const b = decodeBase64Image(base64String);
    const sharp = require('sharp');
    await sharp(b).metadata(); // System.Drawing.Image.FromStream (throws on invalid image data)
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      // unreachable in legacy (oldimage is always "")
    } else {
      // img.Save(strValidFullName)  PORT-NOTE: System.Drawing re-encoded in the image's own format; the decoded bytes are written as-is.
      fs.mkdirSync(SavePaths, { recursive: true });
      fs.writeFileSync(strValidFullName, b);
    }
    // USP_MEMBERREGISTRATION_CSS @MODE,@STATUS,@MRCID,@Regstrationimage
    await db.proc(DB, 'USP_MEMBERREGISTRATION_CSS', { MODE: 2, STATUS: 2, MRCID: '0', Regstrationimage: imgname });
    return res.json('success');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_AddOrRemoveProfileField');
    return res.json(ERR);
  }
  // (the else branch "Please Choose file" is unreachable: `Image.Trim() != null` is always true)
}));

// ---------------------------------------------------------------- JsonResult RoleUpdate(string status, string mrcid)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/RoleUpdate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  // USP_MEMBERREGISTRATION_CSS @MODE,@STATUS,@MRCID
  await db.proc(DB, 'USP_MEMBERREGISTRATION_CSS', { MODE: 2, STATUS: nStr(req.p.status), MRCID: nStr(req.p.mrcid) });
  return res.json('');
}));

// ---------------------------------------------------------------- JsonResult Savesecretkey(string sitekey, string secretkey)
// auth (PORT-NOTE: legacy had no session check; stores the captcha secret key => adminAuth)
router.all(`/admin/${C}/Savesecretkey{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let results = '';
  try {
    // USP_INSERTCAPTCHAKEY @SECRETKEY,@SITEKEY, @result out
    const row = await db.procOne(DB, 'USP_INSERTCAPTCHAKEY', { SECRETKEY: nStr(req.p.secretkey), SITEKEY: nStr(req.p.sitekey) });
    const v = str(col(row, 'result'));
    results = v === '' ? '' : v;
    return res.json(results);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_AddOrRemoveProfileField');
    return res.json(ERR);
  }
}));

// ---------------------------------------------------------------- JsonResult Show_Hide(string id, int value, int mode, int enablecheck)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Show_Hide{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const id = nStr(req.p.id);
  const value = reqInt(req.p.value, 'value');
  const mode = reqInt(req.p.mode, 'mode');
  const enablecheck = reqInt(req.p.enablecheck, 'enablecheck');
  let stringret = '';
  if (id === null) throw nullRef(); // id.Split(',') before the session check
  const allids = id.split(',');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    for (let i = 0; i < allids.length; i++) {
      stringret = await addOrRemoveField({ id: allids[i], value, mode, fildname: '', displayshow: cvtInt('0'), enablecheck });
    }
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_AddOrRemoveProfileField');
    return res.json(ERR);
  }
}));

// ---------------------------------------------------------------- JsonResult Edit_Data(int RID)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Edit_Data{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = reqInt(req.p.RID, 'RID');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    let stringret = '';
    let FIELDNAME = '';
    let DISPLAYSHOW = 0;
    // db._Master_RegistrationPage.Where(a => a.TDPMFRID == RID).FirstOrDefault()
    const r = await db.queryOne(DB, 'select * from tbl_detailspagemasterforregistration where tdpmfrid = @RID limit 1', { RID });
    const row = r ? mapRow(r, MASTER_REG_PROPS) : null;
    if (row !== null) {
      FIELDNAME = row.FIELDNAME;
      DISPLAYSHOW = row.DISPLAYSHOW;
    }
    stringret = stringret + '^' + 'Success' + '^' + (FIELDNAME === null ? '' : FIELDNAME) + '^' + DISPLAYSHOW;
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Edit_Data');
    return res.json(ERR);
  }
}));

// ---------------------------------------------------------------- JsonResult Updatefeildname(int RID, string fildname, int displayshow, int mode)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/Updatefeildname{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const RID = reqInt(req.p.RID, 'RID');
  const fildname = nStr(req.p.fildname);
  const displayshow = reqInt(req.p.displayshow, 'displayshow');
  const mode = reqInt(req.p.mode, 'mode');
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    // Usp_AddOrRemoveField @id,@value,@mode,@fildname,@displayshow,@intResult out   (no @enablecheck here)
    const stringret = await addOrRemoveField({ id: RID, value: cvtInt('0'), mode, fildname, displayshow });
    return res.json(stringret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_AddOrRemoveField');
    return res.json(ERR);
  }
}));

/** ChangePassword / ChangePasswordforCampelicity / ChangePasswordLimit share this shape */
function settingsAction(name, caption, errName, withLimit) {
  // auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
  router.all(`/admin/${C}/${name}{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
    const active = reqBool(req.p.active, 'active');
    const Limit = withLimit ? reqInt(req.p.Limit, 'Limit') : undefined;
    if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
    try {
      let stringret = 'invalid'; // eslint-disable-line no-unused-vars
      await updateSettingSingle(caption, withLimit ? { Active: active, Limits: Limit } : { Active: active });
      stringret = 'Success';
      return res.json(stringret);
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, errName);
      return res.json(ERR);
    }
  }));
}
// ---------------------------------------------------------------- JsonResult ChangePassword(bool active)
settingsAction('ChangePassword', 'Transaction Password Campelicity', 'ChangePassword', false);
// ---------------------------------------------------------------- JsonResult ChangePasswordforCampelicity(bool active)
settingsAction('ChangePasswordforCampelicity', 'Password Camplacity', 'ChangePassword', false);
// ---------------------------------------------------------------- JsonResult ChangePasswordLimit(bool active, int Limit)
settingsAction('ChangePasswordLimit', 'Transaction Pin', 'ChangePasswordLimit', true);

// ---------------------------------------------------------------- JsonResult SystemTypeSetting(int STID, string MatrixWidth)
// auth-by-check (legacy returned Json("Session Expired. Please login again") without a session - contract kept)
router.all(`/admin/${C}/SystemTypeSetting{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const STID = reqInt(req.p.STID, 'STID');
  const MatrixWidth = nStr(req.p.MatrixWidth);
  if (!isAdmin(req)) return res.json(SESSION_EXPIRED);
  try {
    if (STID !== 1) {
      await addOrRemoveField({ id: 4, value: '0', mode: 4, fildname: '', displayshow: cvtInt('0'), enablecheck: '0' });
    }
    if (MatrixWidth !== '') { // MVC binds "" as null => this branch is taken for an empty value too (legacy behaviour)
      // Update tbl_SystemType set ACTIVE=0;Update tbl_SystemType set ACTIVE=1 where STID=<STID>  (one batch => one transaction)
      await db.tx(DB, async (t) => {
        await t.exec('update tbl_systemtype set active = 0', {});
        await t.exec('update tbl_systemtype set active = 1 where stid = @STID', { STID });
      });
      return res.json('1');
    }
    await db.tx(DB, async (t) => {
      await t.exec('update tbl_systemtype set active = 0', {});
      await t.exec('update tbl_systemtype set active = 1 where stid = @STID', { STID });
      await t.exec('update tbl_matrixsettings set matrixwidth = 0, isautofillmatrix = 0, isactive = 0, isforcedmatrix = 0, ismannualforcedmatrix = 0', {});
    });
    return res.json('1');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SystemTypeSetting');
    return res.json(ERR);
  }
}));

/** USP_USERDEFINED @TYPEID,@TYPNAME,@PREFIX,@MAXSIZE,@USERSTATUS,@ACTIVE,@RESULT OUT => Convert.ToInt32(spOutput.Value) (DBNull => InvalidCastException) */
async function userDefined(params) {
  const row = await db.procOne(DB, 'USP_USERDEFINED', params);
  const v = col(row, 'RESULT');
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return Math.round(Number(v));
}
const showActiveOf2 = async () => {
  const v = await db.scalar(DB, 'select showactive from tbl_detailspagemasterforregistration where tdpmfrid = 2 limit 1', {});
  return v === null || v === undefined ? 0 : Number(v);
};

// ---------------------------------------------------------------- JsonResult ManageUser(int Typeid, string Typename, string Prefix, int NoofNumericValue, int Active)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/ManageUser{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Typeid = reqInt(req.p.Typeid, 'Typeid');
  const Typename = nStr(req.p.Typename);
  const Prefix = nStr(req.p.Prefix);
  const NoofNumericValue = reqInt(req.p.NoofNumericValue, 'NoofNumericValue');
  const Active = reqInt(req.p.Active, 'Active');
  let UserStatus = 0;
  const showActive = await showActiveOf2();
  if (showActive === 1) UserStatus = 0;
  const stringret = await userDefined({
    TYPEID: Typeid, TYPNAME: Typename, PREFIX: Prefix, MAXSIZE: NoofNumericValue, USERSTATUS: UserStatus, ACTIVE: Active,
  });
  return res.json(stringret);
}));

// ---------------------------------------------------------------- JsonResult ManageManualUser(int Typeid, string Typename, string Manual, int Active, string NoofNumericValue)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/ManageManualUser{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Typeid = reqInt(req.p.Typeid, 'Typeid');
  const Typename = nStr(req.p.Typename);
  const Manual = nStr(req.p.Manual);
  const Active = reqInt(req.p.Active, 'Active');
  let UserStatus = 0;
  const showActive = await showActiveOf2();
  if (showActive === 0) UserStatus = 1;
  await addOrRemoveField({ id: 2, value: '0', mode: 4, fildname: '', displayshow: cvtInt('0'), enablecheck: '0' });
  const stringret = await userDefined({
    TYPEID: Typeid, TYPNAME: Typename, PREFIX: '', MAXSIZE: Manual, USERSTATUS: UserStatus, ACTIVE: Active,
  });
  return res.json(stringret);
}));

// ---------------------------------------------------------------- JsonResult Savemembercountdetails(int counting, int mouaid)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/Savemembercountdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const counting = reqInt(req.p.counting, 'counting');
  const mouaid = reqInt(req.p.mouaid, 'mouaid');
  // USP_MEMBERALLOWED_COUNTING @MODE,@COUNTING,@MOUAID,@ISUNLIMITED,@PAN,@RESULT  (@RESULT not marked OUT in the batch text)
  const rows = await db.proc(DB, 'USP_MEMBERALLOWED_COUNTING', { mode: 2, counting, mouaid, ISUNLIMITED: '0', PAN: '', RESULT: null });
  return res.json(affected(rows));
}));

// ---------------------------------------------------------------- JsonResult Savemembercheck(int isunlimited, int mouaid)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/Savemembercheck{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const isunlimited = reqInt(req.p.isunlimited, 'isunlimited');
  const mouaid = reqInt(req.p.mouaid, 'mouaid');
  const rows = await db.proc(DB, 'USP_MEMBERALLOWED_COUNTING', { mode: 3, counting: '0', mouaid, ISUNLIMITED: isunlimited, PAN: '', RESULT: null });
  return res.json(affected(rows));
}));

// ---------------------------------------------------------------- JsonResult UpdateSideClickOnLebel(int BothbinaryandLevel)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/UpdateSideClickOnLebel{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const BothbinaryandLevel = reqInt(req.p.BothbinaryandLevel, 'BothbinaryandLevel');
  let IntResult = 0;
  try {
    if (BothbinaryandLevel === 2) {
      IntResult = await db.exec(DB, 'update tbl_detailspagemasterforregistration set showactive = 0 where tdpmfrid = 4', {});
    } else if (BothbinaryandLevel === 1) {
      IntResult = await db.exec(DB, 'update tbl_detailspagemasterforregistration set showactive = 1 where tdpmfrid = 4', {});
    }
  } catch (ex) { /* swallowed (legacy empty catch) */ }
  return res.json(IntResult);
}));

module.exports = router;
