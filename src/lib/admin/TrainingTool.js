/** Exports: class TrainingTool (table training_tool; props TLID, Type, Title, Desp, VUrl, Active, Date)
 *   async VideosFileCollection() : TrainingTool[]  (Active, TLID desc) ; async DeleteT(int TLID) : int
 *  Methods reused from ../member/TrainingTool.js (admin Models/TrainingTool.cs is identical to the Member one, same database 'affiliate');
 *  this subclass only adds the model statics (PROPS, TABLE, map, mapAll) and C# property defaults.
 */
'use strict';
const Reused = require('../member/TrainingTool');
const { defineModel } = require('./_models');

const M = defineModel('TrainingTool', 'training_tool', { TLID: 0, Type: null, Title: null, Desp: null, VUrl: null, Active: false, Date: null });

class TrainingTool extends Reused {
  constructor(init) {
    super();
    Object.assign(this, new M(init));
  }
}
Object.assign(TrainingTool, { PROPS: M.PROPS, TABLE: M.TABLE, NOT_MAPPED: M.NOT_MAPPED, map: M.map, mapAll: M.mapAll });

module.exports = TrainingTool;
