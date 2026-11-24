/** Exports: class TBLQUALIFICATION (table tblqualification; props QID, NAME, STATUS)   async GetQualification() : TBLQUALIFICATION[] (STATUS 1) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['QID', 'NAME', 'STATUS'];

class TBLQUALIFICATION {
  async GetQualification() {
    return mapRows(await query('affiliate', 'select * from tblqualification where status=1'), PROPS);
  }
}

module.exports = TBLQUALIFICATION;
