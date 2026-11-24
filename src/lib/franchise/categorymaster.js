/** Exports: class categorymaster (table categorymaster; props catid, categoryname, status)   async categorymasterList() : categorymaster[]  (status "1", catid asc) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class categorymaster {
  async categorymasterList() {
    return mapRows(await query('shopping', "select * from categorymaster where status='1' order by catid"), ['catid', 'categoryname', 'status']);
  }
}

module.exports = categorymaster;
