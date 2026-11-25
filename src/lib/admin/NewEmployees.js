/** Exports: class NewEmployees (table tbl_employee_master; props Emp_ID, Emp_Code, Emp_LoginID, Emp_Password, Current_Balance, Emp_Name, Emp_Email, Emp_Mobile, Emp_PanNo, Emp_Image, TotalRoles, isDelete, Active, WHITELIST_IP, LOGINAVALIABLE_FROMTIME, LOGINAVALIABLE_TOTIME, LOGINAVALIABLE_ALLWAYS, MaxLlimit)
 *          class NewEployeeSendMailDetails (no table; props Emp_ID, Emp_Code, Emp_LoginID, Emp_Password, Emp_Name, Emp_Mobile, Emp_Email)
 *   async EmployeeList() : NewEmployees[]  (Active, by Emp_Name)
 *   async AddEmployeeDetail(string TotalRoles, int Emp_ID, string Emp_Password, string Emp_Name, string Emp_Email, string Emp_Mobile, string Emp_PanNo,
 *         string Emp_Image, string intflag, string ext, decimal Maxlimit, string TotalDashboardRoles, string Emp_IP, string Emp_FromTime, string Emp_ToTime,
 *         int LoginAllways, string Emp_Code, int status, int CreatedByid) : string
 *       (proc dbo.usp_Add_Update_Delete_Employee ... @STRRESULT out; on "success^Added New^<EmpCode>^<EncPassword>" sends the welcome e-mail
 *        (tbl_emailaction EID 1) and SMS (TBL_SMSACTION ID 1) in the background; returns @STRRESULT or the exception message)
 *   NewEmployees.NewEployeeSendMailDetails : model class (also ./NewEployeeSendMailDetails)
 *   Config key: AdminLoginUrl (legacy hard-coded admin login URL used in the welcome mail, not copied)
 */
'use strict';
const config = require('../../config');
const { query, queryOne, scalar, procOne, proc } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr, fire } = require('../_libhelpers');
const UtilityClass = require('./UtilityClass');

const Base = defineModel('NewEmployees', 'tbl_employee_master', { Emp_ID: 0, Emp_Code: null, Emp_LoginID: null, Emp_Password: null, Current_Balance: 0, Emp_Name: null, Emp_Email: null, Emp_Mobile: null, Emp_PanNo: null, Emp_Image: null, TotalRoles: null, isDelete: false, Active: false, WHITELIST_IP: null, LOGINAVALIABLE_FROMTIME: null, LOGINAVALIABLE_TOTIME: null, LOGINAVALIABLE_ALLWAYS: 0, MaxLlimit: null });
const NewEployeeSendMailDetails = defineModel('NewEployeeSendMailDetails', null, { Emp_ID: 0, Emp_Code: null, Emp_LoginID: null, Emp_Password: null, Emp_Name: null, Emp_Mobile: null, Emp_Email: null });

const trimCaret = (v) => v.replace(/^\^+|\^+$/g, ''); // C# Trim('^')
function at(arr, i) {
  if (i >= arr.length) throw new RangeError('Index was outside the bounds of the array.');
  return arr[i];
}

class NewEmployees extends Base {
  async EmployeeList() {
    return Base.mapAll(await query(DB, 'select * from tbl_employee_master where active::int=1 order by emp_name'));
  }

  async AddEmployeeDetail(TotalRoles, Emp_ID, Emp_Password, Emp_Name, Emp_Email, Emp_Mobile, Emp_PanNo, Emp_Image, intflag, ext, Maxlimit, TotalDashboardRoles, Emp_IP, Emp_FromTime, Emp_ToTime, LoginAllways, Emp_Code, status, CreatedByid) {
    let MailLoginURl = '';
    let SaperatedWithIP = '';
    if (Emp_IP !== null || Emp_IP !== '') { // legacy condition is always true (NullReferenceException for null Emp_IP)
      SaperatedWithIP = Emp_IP.split(',').join('^');
    } else {
      SaperatedWithIP = '';
    }
    const AdminUrl = String(config.app.AdminLoginUrl || '');
    let DecryptPassword = '';
    const r = await procOne(DB, 'usp_add_update_delete_employee', {
      totalroles: trimCaret(TotalRoles),
      emp_id: Emp_ID,
      emp_password: Emp_Password,
      emp_name: Emp_Name,
      emp_email: Emp_Email,
      emp_mobile: Emp_Mobile,
      emp_panno: Emp_PanNo,
      emp_image: Emp_Image,
      emp_code: Emp_Code,
      intflag,
      ext,
      maxlimit: Maxlimit,
      dashboardroles: trimCaret(TotalDashboardRoles),
      whitelist_ip: SaperatedWithIP,
      loginavaliable_fromtime: Emp_FromTime,
      loginavaliable_totime: Emp_ToTime,
      loginavaliable_allways: LoginAllways,
      status,
      createdbyid: CreatedByid,
    });
    const OutputResult = toStr(out(r, 'STRRESULT'));
    const Array_ = OutputResult.split('^');
    if (at(Array_, 0).toString() === 'success' && at(Array_, 1).toString() === 'Added New') {
      try {
        let EmpCode = '';
        let EncryptPassword = '';
        let EncryptEmpCode = '';
        EmpCode = at(Array_, 2).toString();
        EncryptEmpCode = await UtilityClass.Encryptword(EmpCode);
        EncryptPassword = at(Array_, 3).toString();
        DecryptPassword = await UtilityClass.Decryptword(EncryptPassword);
        const CompanyName = await scalar(DB, 'select name from tbl_companymaster limit 1');
        if (AdminUrl !== null && EncryptEmpCode !== null) {
          MailLoginURl = AdminUrl + '?tempurl=' + EncryptEmpCode;
        }
        if (EmpCode !== null) {
          const objEmp = NewEployeeSendMailDetails.map((await proc(DB, 'usp_newregistered_memberdetails', { mode: 1, emp_id: EmpCode }))[0] || null);
          const WelcomeEmail = await queryOne(DB, 'select * from tbl_emailaction where eid=1 limit 1');
          const WelcomeSMS = await queryOne(DB, 'select * from tbl_smsaction where id=1 limit 1');
          const cn = CompanyName === null || CompanyName === undefined ? '' : CompanyName;
          if (objEmp !== null) {
            // EMAIL
            if (WelcomeEmail === null) throw new TypeError('Object reference not set to an instance of an object.');
            if (Number(WelcomeEmail.email_send_status) === 1) {
              let MAILCONTENT = '';
              MAILCONTENT = WelcomeEmail.email_content; // eslint-disable-line no-unused-vars
              const DynamicMsg = 'Hello,' + toStr(Emp_Name) + '<br/>Your Login credentials here<br/>Employee Code: ' + toStr(Emp_Code) + '<br/>Password: ' + toStr(DecryptPassword) + '<br/>Login Url: ' + MailLoginURl + ' <br/><br/>Regards ' + cn + '';
              const subject = WelcomeEmail.email_subject;
              fire(() => UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', objEmp.Emp_Email.toLowerCase(), subject, DynamicMsg, null));
            }
            // SMS
            if (WelcomeSMS === null) throw new TypeError('Object reference not set to an instance of an object.');
            if (Number(WelcomeSMS.sms_send_status) === 1 && objEmp.Emp_Mobile !== '') {
              const messg = 'Hello,' + toStr(Emp_Name) + '\nYour Login credentials here \nEmployee Code: ' + toStr(Emp_Code) + ' \nPassword: ' + toStr(DecryptPassword) + ' \nYour Login Url send on your registred email.\n\nRegards ' + cn + '';
              fire(() => UtilityClass.SendSMSWithAPI(objEmp.Emp_Mobile, messg, '1'));
            }
          }
        }
      } catch (ex) {
        const message = ex.message;
        return message.toString();
      }
    }
    return OutputResult.toString();
  }
}

module.exports = NewEmployees;
module.exports.NewEployeeSendMailDetails = NewEployeeSendMailDetails;
