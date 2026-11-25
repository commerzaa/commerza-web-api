/** Exports: class Title (table title; props TITLEID, TITLE)
 *   async AllTitle() : Title[]
 *  Methods reused from ../member/Title.js (admin Models/Title.cs is identical to the Member one, same database 'affiliate');
 *  this subclass only adds the model statics (PROPS, TABLE, map, mapAll) and C# property defaults.
 */
'use strict';
const Reused = require('../member/Title');
const { defineModel } = require('./_models');

const M = defineModel('Title', 'title', { TITLEID: 0, TITLE: null });

class Title extends Reused {
  constructor(init) {
    super();
    Object.assign(this, new M(init));
  }
}
Object.assign(Title, { PROPS: M.PROPS, TABLE: M.TABLE, NOT_MAPPED: M.NOT_MAPPED, map: M.map, mapAll: M.mapAll });

module.exports = Title;
