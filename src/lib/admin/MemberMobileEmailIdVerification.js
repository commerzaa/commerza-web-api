/** Exports: class MemberMobileEmailIdVerification (table tbl_membermobileemailidverification; props TMEVID, MobileNo, MobileVerificationCode, IsMobileVerified, EmailId, IsEmailIDVerified, IsActive, Status, RegNo, EmailIdVerificationCode)
 *   Source Models/MemberMobileEmailIdVerification.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const MemberMobileEmailIdVerification = defineModel('MemberMobileEmailIdVerification', 'tbl_membermobileemailidverification', { TMEVID: 0, MobileNo: null, MobileVerificationCode: null, IsMobileVerified: 0, EmailId: null, IsEmailIDVerified: 0, IsActive: 0, Status: 0, RegNo: 0, EmailIdVerificationCode: null });

module.exports = MemberMobileEmailIdVerification;
