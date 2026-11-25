/** Exports: class Tbl_News (table tbl_news; props nid, title, descriptions, date, type, status)
 *   Source Models/Tbl_News.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Tbl_News = defineModel('Tbl_News', 'tbl_news', { nid: 0, title: null, descriptions: null, date: null, type: null, status: 0 });

module.exports = Tbl_News;
