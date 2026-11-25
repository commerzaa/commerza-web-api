/** Exports: class Wish_List (table tbl_wishlist; props wlid, RegNo, Sprid, date, status)
 *   Source Models/Wish_List.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Wish_List = defineModel('Wish_List', 'tbl_wishlist', { wlid: 0, RegNo: 0, Sprid: 0, date: null, status: 0 });

module.exports = Wish_List;
