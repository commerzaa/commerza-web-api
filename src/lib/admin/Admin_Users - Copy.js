/** Exports: class Admin_Users (table tbl_users; props uid, brid, userName, loginID, password, Tpassword, role, roleName, createDate, lastLogin, isEditable, imageName, status, isLogin, isDeleted, Vcode, Emp_Email, Emp_Mobile ; [NotMapped] Vcode, Emp_Email, Emp_Mobile)
 *   Source Models/Admin_Users - Copy.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Admin_Users = defineModel('Admin_Users', 'tbl_users', { uid: 0, brid: 0, userName: null, loginID: null, password: null, Tpassword: null, role: null, roleName: null, createDate: null, lastLogin: null, isEditable: false, imageName: null, status: false, isLogin: false, isDeleted: false, Vcode: null, Emp_Email: null, Emp_Mobile: null }, ['Vcode', 'Emp_Email', 'Emp_Mobile']);

module.exports = Admin_Users;
