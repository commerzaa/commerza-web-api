/** Exports: class Title (table title; props TITLEID, TITLE)   async AllTitle() : Title[] */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Title {
  async AllTitle() {
    return mapRows(await query('shopping', 'select * from title'), ['TITLEID', 'TITLE']);
  }
}

module.exports = Title;
