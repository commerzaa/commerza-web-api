/** Exports: class TBL_SMSAPI (table tbl_smsapi; props SAID, Prom_API, Tran_API, UPDATEDON, UPDATEDBY, ACTIVE)
 *   Source Models/TBL_SMSAPI.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const TBL_SMSAPI = defineModel('TBL_SMSAPI', 'tbl_smsapi', { SAID: 0, Prom_API: null, Tran_API: null, UPDATEDON: null, UPDATEDBY: 0, ACTIVE: 0 });

module.exports = TBL_SMSAPI;
