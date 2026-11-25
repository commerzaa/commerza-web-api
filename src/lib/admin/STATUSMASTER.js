/** Exports: class STATUSMASTER (table tbl_statusmaster; props ID, NAME, STATUS)
 *   async categorymasterList() : STATUSMASTER[]  (STATUS == 1, by ID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('STATUSMASTER', 'tbl_statusmaster', { ID: 0, NAME: null, STATUS: 0 });

class STATUSMASTER extends Base {
  async categorymasterList() {
    return Base.mapAll(await query(DB, 'select * from tbl_statusmaster where status=1 order by id'));
  }
}

module.exports = STATUSMASTER;
