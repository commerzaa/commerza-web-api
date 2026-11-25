/** Exports: class SUBMENUROLE (table tbl_submenurole; props ID, RID, MID, SID, CreateDate, UpdateDate, Status, ISEDIT, ISDELETE, ACTIVE)
 *   Source Models/SUBMENUROLE.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const SUBMENUROLE = defineModel('SUBMENUROLE', 'tbl_submenurole', { ID: 0, RID: 0, MID: 0, SID: 0, CreateDate: null, UpdateDate: null, Status: 0, ISEDIT: 0, ISDELETE: 0, ACTIVE: 0 });

module.exports = SUBMENUROLE;
