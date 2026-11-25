/** Exports: class Settings (table settings; props SID, caption, CLUBDESC, Limits, Active, EDITABLE, CID, SYMBOL, CLUBCOND)
 *   Source Models/Settings.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Settings = defineModel('Settings', 'settings', { SID: 0, caption: null, CLUBDESC: null, Limits: 0, Active: false, EDITABLE: false, CID: 0, SYMBOL: null, CLUBCOND: null });

module.exports = Settings;
