/** Exports: class categorymaster (table categorymaster; props catid, categoryname, status)
 *   async categorymasterList() : categorymaster[]  (status "1", by catid)
 *  Methods reused from ../member/categorymaster.js (admin Models/categorymaster.cs is identical to the Member one, same database 'affiliate');
 *  this subclass only adds the model statics (PROPS, TABLE, map, mapAll) and C# property defaults.
 */
'use strict';
const Reused = require('../member/categorymaster');
const { defineModel } = require('./_models');

const M = defineModel('categorymaster', 'categorymaster', { catid: 0, categoryname: null, status: null });

class categorymaster extends Reused {
  constructor(init) {
    super();
    Object.assign(this, new M(init));
  }
}
Object.assign(categorymaster, { PROPS: M.PROPS, TABLE: M.TABLE, NOT_MAPPED: M.NOT_MAPPED, map: M.map, mapAll: M.mapAll });

module.exports = categorymaster;
