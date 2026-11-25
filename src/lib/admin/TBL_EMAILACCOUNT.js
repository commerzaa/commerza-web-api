/** Exports: class TBL_EMAILACCOUNT (table tbl_emailaccount; props EAID, EMAILID, HOSTNAME, PASSWORD, SMTPPORT, SENDERNAME, SENDEREMAIL, STATUS)
 *   Source Models/TBL_EMAILACCOUNT.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_EMAILACCOUNT = defineModel('TBL_EMAILACCOUNT', 'tbl_emailaccount', { EAID: 0, EMAILID: null, HOSTNAME: null, PASSWORD: null, SMTPPORT: null, SENDERNAME: null, SENDEREMAIL: null, STATUS: 0 });

module.exports = TBL_EMAILACCOUNT;
