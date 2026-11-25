/** Exports: class Media (table tbl_media; props id, Heading, Title, description, Url, date, status)
 *   async MediaDetails() : Media[]  (status == 1)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Media', 'tbl_media', { id: 0, Heading: null, Title: null, description: null, Url: null, date: null, status: 0 });

class Media extends Base {
  async MediaDetails() {
    return Base.mapAll(await query(DB, 'select * from tbl_media where status=1'));
  }
}

module.exports = Media;
