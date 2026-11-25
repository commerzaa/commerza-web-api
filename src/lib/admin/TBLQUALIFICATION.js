/** Exports: class TBLQUALIFICATION (table tblqualification; props QID, NAME, STATUS)
 *   async GetQualification() : TBLQUALIFICATION[]  (STATUS == 1)
 *  Methods reused from ../member/TBLQUALIFICATION.js (admin Models/TBLQUALIFICATION.cs is identical to the Member one, same database 'affiliate');
 *  this subclass only adds the model statics (PROPS, TABLE, map, mapAll) and C# property defaults.
 */
'use strict';
const Reused = require('../member/TBLQUALIFICATION');
const { defineModel } = require('./_models');

const M = defineModel('TBLQUALIFICATION', 'tblqualification', { QID: 0, NAME: null, STATUS: 0 });

class TBLQUALIFICATION extends Reused {
  constructor(init) {
    super();
    Object.assign(this, new M(init));
  }
}
Object.assign(TBLQUALIFICATION, { PROPS: M.PROPS, TABLE: M.TABLE, NOT_MAPPED: M.NOT_MAPPED, map: M.map, mapAll: M.mapAll });

module.exports = TBLQUALIFICATION;
