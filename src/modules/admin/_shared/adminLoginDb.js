'use strict';
/**
 * EF6 LINQ used by the admin login controllers, as parameterised PostgreSQL (database: affiliate / Db_Affiliate).
 * Exports: EMP_COLS, findEmployee(filter), firstActiveBranch(), branchType(brtid), saveEmployeeLastLogin(emp),
 *          insertAdminLoginLog(fields), establishAdminSession(req, res, emp, opts)
 * Not a router (lives in _shared/).
 */
const db = require('../../../db');
const { mapRow } = require('../../../utils/shape');
const sessionStore = require('../../../utils/sessionStore');
const { ADMIN_USER_PROPS, adminStoreReq, issueAdminToken } = require('./adminSession');

const DB = 'affiliate';

const EMP_COLS = 'emp_id, emp_code, emp_loginid, emp_password, emp_name, current_balance, emp_email, emp_mobile, emp_panno, '
  + 'emp_image, totalroles, createdate, emp_lastlogin, active, isdelete, whitelist_ip, loginavaliable_fromtime, '
  + 'loginavaliable_totime, loginavaliable_allways';

/**
 * db._Employee_Master.Where(...).FirstOrDefault()
 * filter: { loginID?, password?, active?, empCode? }  (only the given members are part of the WHERE, like the LINQ calls)
 * PORT-NOTE: SQL Server's default CI collation made Emp_LoginID / Emp_Code comparisons case-insensitive -> lower() = lower().
 *            Emp_Password is compared exactly (case-sensitive) on purpose.
 */
async function findEmployee(filter) {
  const has = (k) => Object.prototype.hasOwnProperty.call(filter, k);
  // LINQ .Equals(null) never matches a row
  for (const k of ['loginID', 'empCode', 'password']) if (has(k) && (filter[k] === null || filter[k] === undefined)) return null;
  const where = [];
  const params = {};
  if (has('loginID')) { where.push('lower(emp_loginid) = lower(@loginID)'); params.loginID = String(filter.loginID); }
  if (has('empCode')) { where.push('lower(emp_code) = lower(@empCode)'); params.empCode = String(filter.empCode); }
  if (has('password')) { where.push('emp_password = @password'); params.password = String(filter.password); }
  if (has('active')) { where.push('active = @active'); params.active = !!filter.active; }
  if (!where.length) return null;
  const row = await db.queryOne(DB, `select ${EMP_COLS} from tbl_employee_master where ${where.join(' and ')} limit 1`, params);
  if (!row) return null;
  const emp = mapRow(row, ADMIN_USER_PROPS);
  emp.LoginAs = null;
  emp.IsStore = false;
  return emp;
}

/** db._Branch_Master.Where(a => a.Active == true).FirstOrDefault() */
async function firstActiveBranch() {
  const row = await db.queryOne(DB, 'select brid, brcode, brtid from tbl_branch_master where active = true limit 1', {});
  return row ? mapRow(row, ['BRID', 'BrCode', 'brtid']) : null;
}

/** db._Branch_Type.Where(a => a.brtid == brtid).FirstOrDefault() */
async function branchType(brtid) {
  const row = await db.queryOne(DB, 'select brtid, brtype, brtype_name, isstore from tbl_branch_type where brtid = @brtid limit 1', { brtid });
  return row ? mapRow(row, ['brtid', 'BrType', 'BrType_Name', 'IsStore']) : null;
}

/** db.SaveChanges() after v.Emp_LastLogin = UtilityClass.GetCurrentDate() (LoginAs / IsStore are [NotMapped]). */
async function saveEmployeeLastLogin(emp) {
  await db.exec(DB, 'update tbl_employee_master set emp_lastlogin = @d where emp_id = @id', { d: emp.Emp_LastLogin, id: emp.Emp_ID });
}

/**
 * insert into ADMINLOGINLOG(LOGINDATETIME,EMPID,PASSWORDATTEMPT,OTP,EMAIL,MOBILE,IPADDRESS,ISSUCCESS) values(getdate(), ...)
 * (legacy concatenated the values into the SQL; parameterised here)
 */
async function insertAdminLoginLog(f) {
  const s = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concat turns null into ''
  await db.exec(DB, 'insert into adminloginlog(logindatetime, empid, passwordattempt, otp, email, mobile, ipaddress, issuccess) '
    + 'values (now(), @EMPID, @PASSWORDATTEMPT, @OTP, @EMAIL, @MOBILE, @IPADDRESS, @ISSUCCESS)', {
    EMPID: s(f.EMPID), PASSWORDATTEMPT: s(f.PASSWORDATTEMPT), OTP: s(f.OTP), EMAIL: s(f.EMAIL), MOBILE: s(f.MOBILE),
    IPADDRESS: s(f.IPADDRESS), ISSUCCESS: s(f.ISSUCCESS),
  });
}

/**
 * Session["Admin_User"] = emp  (+ optional Session["Admin_User_Menu"], Session["API_Menu"], Response.Cookies["User"])
 * => returns the JWT that replaces the ASP.NET session. opts: { menu?, apiMenu?, cookie? ('Admin'|'Store') }
 * A menu/apiMenu of `undefined` means the legacy action did not write that session key.
 */
function establishAdminSession(req, res, emp, opts = {}) {
  const sreq = adminStoreReq(emp, req);
  if (opts.menu !== undefined) sessionStore.set(sreq, 'Admin_User_Menu', opts.menu);
  if (opts.apiMenu !== undefined) sessionStore.set(sreq, 'API_Menu', opts.apiMenu);
  if (opts.cookie) {
    // HttpCookie("User") { Value = ..., Expires = DateTime.Now.AddHours(1) }
    res.cookie('User', opts.cookie, { expires: new Date(Date.now() + 60 * 60 * 1000) });
  }
  return issueAdminToken(emp);
}

module.exports = { EMP_COLS, findEmployee, firstActiveBranch, branchType, saveEmployeeLastLogin, insertAdminLoginLog, establishAdminSession };
