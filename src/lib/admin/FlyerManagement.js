/** Exports: class FlyerManagement (no table; props FileUploader, TFMID, rownumber, ContentType, Title, Name, Status, IsActive, Active, TYPE)
 *   Source Models/FlyerManagement.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const FlyerManagement = defineModel('FlyerManagement', null, { FileUploader: null, TFMID: 0, rownumber: 0, ContentType: 0, Title: null, Name: null, Status: 0, IsActive: 0, Active: false, TYPE: null });

module.exports = FlyerManagement;
