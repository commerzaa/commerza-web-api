'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\New_Employee.cs (class New_EmployeeController => /New_Employee/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Roll_master = require('../../lib/admin/Roll_master');
const Branch_Master = require('../../lib/admin/Branch_Master');
const NewEmployees = require('../../lib/admin/NewEmployees');
const Admin_Security_Key = require('../../lib/admin/Admin_Security_Key');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const {
  DB, nStr, reqInt, trimS, cvtInt, cvtDec, firstCol, mapPath, decodeBase64Image, saveScaledImage, nullRef,
} = require('./_shared/batch10-common');

const router = express.Router();
const C = 'New_Employee';

/** class EployeeDetails */
const EMP_PROPS = ['Emp_ID', 'Emp_Code', 'Emp_LoginID', 'Emp_Password', 'Emp_Name', 'Emp_Mobile', 'Emp_Email', 'Emp_PanNo', 'TotalRoles',
  'Dashboard_Role', 'Active', 'isDelete', 'WHITELIST_IP', 'LOGINAVALIABLE_FROMTIME', 'LOGINAVALIABLE_TOTIME', 'LOGINAVALIABLE_ALLWAYS',
  'QRCODEISACTIVE'];
/** class DashboardRoleList (Controllers/AdminPanel/DashboardRoleList.cs) */
const DASHROLE_PROPS = ['DBRID', 'ROLENAME', 'DESCRIPTION', 'CREATEDDATE', 'UPDATEDATE', 'STATUS', 'EMP_LOGINID'];

// ---------------------------------------------------------------- Index(string Emp_Code)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/new-employee" -> New_Employee/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/new-employee'], adminAuth, asyncHandler(async (req, res) => {
  const Emp_Code = nStr(req.p.Emp_Code);
  let Obj_Empdetails = {}; // new EployeeDetails() (Emp_Code == null)
  const ViewBag = { Type: null };
  if (Emp_Code !== null) {
    ViewBag.Type = 'Update';
    const EmpCode = await UtilityClass.Decryptword(Emp_Code);
    // [DBO].[USP_NEWREGISTERED_MEMBERDETAILS] @MODE,@EMP_ID,@STRRESULT OUT  .FirstOrDefault()
    const row = await db.procOne(DB, 'USP_NEWREGISTERED_MEMBERDETAILS', { MODE: '2', EMP_ID: EmpCode });
    Obj_Empdetails = row ? mapRow(row, EMP_PROPS) : null;
  } else {
    ViewBag.Type = 'Add';
    ViewBag.RoleList = await new Roll_master().AllRoleList(req);
    const Empid = req.user.emp_id;
    // SELECT ISNULL(MAX(EMP_ID),0)+1 FROM TBL_EMPLOYEE_MASTER
    const EmpId = firstCol(await db.query(DB, 'select coalesce(max(emp_id),0)+1 from tbl_employee_master', {}));
    if (ViewBag.AutoEmpCode === undefined || ViewBag.AutoEmpCode === null) ViewBag.AutoEmpCode = '50000' + EmpId;
    const _DashboardRole = mapRows(await db.proc(DB, 'USP_GET_DASHBOARDROLLROLEDETAIL', { EMPID: Empid }), DASHROLE_PROPS);
    if (_DashboardRole.length > 0) ViewBag.dashboardrole = _DashboardRole;
  }
  if (Obj_Empdetails === null) throw nullRef(); // Obj_Empdetails.Emp_Code on FirstOrDefault() == null
  if (Obj_Empdetails.Emp_Code !== null && Obj_Empdetails.Emp_Code !== undefined) {
    // PORT-NOTE: Emp_Password (encrypted, reversible) is removed from the JSON model; the legacy view never rendered it.
    const Model = { ...Obj_Empdetails };
    delete Model.Emp_Password;
    return res.json({ view: '~/Views/AdminPanel/New_Employee/Index.cshtml', Model, ...ViewBag });
  }
  return res.json({ view: '~/Views/AdminPanel/New_Employee/Index.cshtml', Model: null, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult GetBranchType(string brid)
// auth (PORT-NOTE: legacy had no session check; admin branch data => adminAuth per coordinator auth rule)
router.all(`/admin/${C}/GetBranchType{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const brid = nStr(req.p.brid);
  let retvalue = '';
  const getbranchu = await Branch_Master.Attributes_With_branchcode(brid);
  if (getbranchu === null || getbranchu === undefined || String(getbranchu).trim() === '') {
    return res.json(retvalue);
  }
  // db._Branch_Type.Where(a => a.brtid == getbranchu.brtid && a.isActive == true && a.IsStore == true).FirstOrDefault()
  const row = await db.queryOne(DB,
    'select brtid from tbl_branch_type where brtid = @brtid and isactive = true and isstore = true limit 1', { brtid: getbranchu.brtid });
  if (row) retvalue = 'IsStore';
  return res.json(retvalue);
}));

/** #region EmployeeImages (shared body of AddEmployeeDetails / UpdateEmployeeDetails) */
async function saveEmployeeImage(Emp_Image, imgname) {
  let base64String = Emp_Image;
  const SavePaths = config.app.EmployeeImagePath || '';
  // Path.Combine(Server.MapPath(SavePaths) + "/" + imgname)  (imgname is always "image": legacy quirk, kept)
  const strValidFullName = path.join(mapPath(SavePaths), imgname);
  if (base64String.includes('base64,')) {
    const IndexNo = base64String.indexOf('/') + 1;
    const lastIndexNo = base64String.indexOf(';');
    if (lastIndexNo - IndexNo < 0) throw new Error('Length cannot be less than zero.\r\nParameter name: length'); // Substring
    base64String = base64String.substring(base64String.indexOf(',') + 1);
  }
  const b = decodeBase64Image(base64String); // Convert.FromBase64String
  const sharp = require('sharp');
  await sharp(b).metadata(); // Image.FromStream (throws on an invalid image before anything is deleted)
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  // oldimage = "" => no old-image delete
  await saveScaledImage(b, strValidFullName); // > 10 KB => 300px JPEG thumbnail, else original
}

async function addOrUpdate(req, res, intflag) {
  const TotalRolesIn = nStr(req.p.TotalRoles);
  const Emp_ID = reqInt(req.p.Emp_ID, 'Emp_ID');
  let Emp_Password = nStr(req.p.Emp_Password);
  const Emp_Name = nStr(req.p.Emp_Name);
  const Emp_Email = nStr(req.p.Emp_Email);
  const Emp_Mobile = nStr(req.p.Emp_Mobile);
  const Emp_PanNo = nStr(req.p.Emp_PanNo);
  const Emp_Image = nStr(req.p.Emp_Image);
  const ext = nStr(req.p.ext);
  const Maxlimit = nStr(req.p.Maxlimit);
  const TotalDashboardRoles = nStr(req.p.TotalDashboardRoles);
  const Emp_IP = nStr(req.p.Emp_IP);
  const Emp_FromTime = nStr(req.p.Emp_FromTime);
  const Emp_ToTime = nStr(req.p.Emp_ToTime);
  const LoginAllways = nStr(req.p.LoginAllways);
  const Emp_Code = nStr(req.p.Emp_Code);
  const Status = nStr(req.p.Status);
  let LoginTime = 0;
  let status = 0;
  let Limit = 0;
  if (Status === null) status = 0; else status = cvtInt(Status);
  if (Maxlimit === null || Maxlimit === '') Limit = 0; else Limit = cvtDec(Maxlimit);
  const TotalRoles = TotalRolesIn === null ? '' : TotalRolesIn;
  if (TotalRoles === '' || TotalRoles === '0') return res.json('Please select at least one employee.');
  if (trimS(Emp_Name) === '' || Emp_Name === null) return res.json('Please enter employee name.');
  let imgname = '';
  let returnmess = '';
  if (trimS(Emp_Image) !== '') imgname = 'image';
  if (LoginAllways !== null) LoginTime = cvtInt(LoginAllways);
  const createdBy = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID  (Emp_Code read but unused)
  Emp_Password = await UtilityClass.Encryptword(Emp_Password);
  returnmess = await new NewEmployees().AddEmployeeDetail(TotalRoles, Emp_ID, Emp_Password, Emp_Name, Emp_Email, Emp_Mobile, Emp_PanNo, imgname,
    intflag, ext, Limit, TotalDashboardRoles, Emp_IP, Emp_FromTime, Emp_ToTime, LoginTime, Emp_Code, status, createdBy);
  const retrunv = String(returnmess).split('^');
  if (retrunv[0].trim() !== 'success') return res.json(returnmess);
  if (Emp_Image.trim() !== '') await saveEmployeeImage(Emp_Image, imgname);
  // PORT-NOTE: legacy returned @STRRESULT verbatim ("success^Added New^<EmpCode>^<EncPassword>" on add) - kept as is.
  return res.json(returnmess);
}

// ---------------------------------------------------------------- JsonResult AddEmployeeDetails(string TotalRoles, int Emp_ID, string Emp_Password, ...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/AddEmployeeDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => addOrUpdate(req, res, '')));

// ---------------------------------------------------------------- JsonResult UpdateEmployeeDetails(...)  (same body, intflag "1")
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/UpdateEmployeeDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => addOrUpdate(req, res, '1')));

// private static bool ThumbnailCallback() { throw new NotImplementedException(); } - GDI+ abort callback, never invoked (sharp has none).

// ---------------------------------------------------------------- JsonResult GetRandomPassword()
// auth (PORT-NOTE: legacy had no session check; admin employee-form password generator => adminAuth per coordinator auth rule)
router.all(`/admin/${C}/GetRandomPassword{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const _allowedChars = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ';
  const chars = [];
  for (let i = 0; i < 6; i++) chars.push(_allowedChars[Math.floor(_allowedChars.length * Math.random())]);
  res.json(chars.join(''));
}));

// ---------------------------------------------------------------- JsonResult DisableGoogleAuthentication(string Emp_ID)
// auth (PORT-NOTE: legacy had NO session check - anyone could reset any admin's Google-Authenticator key; protected with adminAuth)
router.all(`/admin/${C}/DisableGoogleAuthentication{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Emp_ID = nStr(req.p.Emp_ID);
  let RetOutPutResult = '';
  try {
    if (Emp_ID !== null) {
      const ConvEmp_Id = cvtInt(Emp_ID); // Convert.ToInt64
      if (ConvEmp_Id > 1) {
        await new Admin_Security_Key().Manage_Security_Key(ConvEmp_Id, 'reset', '', 0, '', '', '');
        RetOutPutResult = 'SUCCESS';
      }
    }
    return res.json(RetOutPutResult);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'DisableGoogleAuthentication');
    return res.json('Invalid Details!');
  }
}));

module.exports = router;
