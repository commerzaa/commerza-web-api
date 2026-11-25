/** Exports: class Employee_Master (table tbl_employee_master; props Emp_ID, Emp_Code, Emp_LoginID, Emp_Password, Emp_Name, Current_Balance, Emp_Email, Emp_Mobile, Emp_PanNo, Emp_Image, TotalRoles, CreateDate, Emp_LastLogin, Active, isDelete, WHITELIST_IP, LOGINAVALIABLE_FROMTIME, LOGINAVALIABLE_TOTIME, LOGINAVALIABLE_ALLWAYS, LoginAs, IsStore ; [NotMapped] LoginAs, IsStore)
 *   static async Employee_Row_EmpCode(string EmpCode) : Employee_Master | null  (Active && !isDelete && Emp_Code)
 */
'use strict';
const { queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Employee_Master', 'tbl_employee_master', { Emp_ID: 0, Emp_Code: null, Emp_LoginID: null, Emp_Password: null, Emp_Name: null, Current_Balance: 0, Emp_Email: null, Emp_Mobile: null, Emp_PanNo: null, Emp_Image: null, TotalRoles: null, CreateDate: null, Emp_LastLogin: null, Active: false, isDelete: false, WHITELIST_IP: null, LOGINAVALIABLE_FROMTIME: null, LOGINAVALIABLE_TOTIME: null, LOGINAVALIABLE_ALLWAYS: null, LoginAs: null, IsStore: false }, ['LoginAs', 'IsStore']);

class Employee_Master extends Base {
  static async Employee_Row_EmpCode(EmpCode) {
    return Base.map(await queryOne(DB, 'select * from tbl_employee_master where active::int=1 and isdelete::int=0 and emp_code=@EmpCode limit 1', { EmpCode }));
  }
}

module.exports = Employee_Master;
