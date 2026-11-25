/** Exports: class Portal_Login (table portal_login; props PLID, CommunitySide, PMID, LOGINID, PASSWORD, LASTLOGIN, ACTIVE, QPAYREGNO, REFRAL_ID, INTRO_REFID, DOC, CURRENCYSYMBOL, CID, USERNAME, IPADDRESS, TITLE, FNAME, LNAME, PHONE, DESIGNATION, CPER_EMAILID, LASTMAILDATE, SUBSCRIPTION_MASTER, TBL_NEWSLETTEREMAILID, EMAILID, USERID, TPASSWORD, CURRENCY, INTRO_PLID, IsActive, ReferalCode, DefaultLandingUrl, MultiLandingUrl, IMAGENAME, TLPMID, DOB, IsReferralAccepted, IdType, IdRefNo, PANNO)
 *   Source Models/Portal_Login.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Portal_Login = defineModel('Portal_Login', 'portal_login', { PLID: 0, CommunitySide: null, PMID: null, LOGINID: null, PASSWORD: null, LASTLOGIN: null, ACTIVE: false, QPAYREGNO: null, REFRAL_ID: null, INTRO_REFID: null, DOC: null, CURRENCYSYMBOL: null, CID: null, USERNAME: null, IPADDRESS: null, TITLE: null, FNAME: null, LNAME: null, PHONE: null, DESIGNATION: null, CPER_EMAILID: null, LASTMAILDATE: null, SUBSCRIPTION_MASTER: null, TBL_NEWSLETTEREMAILID: null, EMAILID: null, USERID: 0, TPASSWORD: null, CURRENCY: null, INTRO_PLID: null, IsActive: null, ReferalCode: null, DefaultLandingUrl: 0, MultiLandingUrl: null, IMAGENAME: null, TLPMID: 0, DOB: null, IsReferralAccepted: 0, IdType: null, IdRefNo: null, PANNO: null });

module.exports = Portal_Login;
