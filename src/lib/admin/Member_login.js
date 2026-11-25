/** Exports: class Member_login (table member_login; props Regno, loginid, Password, TPassword, Secret_Qid, Secret_ANS, lastLogin, islogin, Status)
 *   Source Models/Member_login.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Member_login = defineModel('Member_login', 'member_login', { Regno: 0, loginid: null, Password: null, TPassword: null, Secret_Qid: 0, Secret_ANS: null, lastLogin: null, islogin: false, Status: false });

module.exports = Member_login;
