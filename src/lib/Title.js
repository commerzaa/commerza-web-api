/** Exports: class Title (table title; props TITLEID, TITLE)   async AllTitle() : Title[] */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['TITLEID', 'TITLE'];

class Title {
  async AllTitle() {
    return mapRows(await query('affiliate', 'select * from title'), PROPS);
  }
}

module.exports = Title;
