/** Exports: class KYCdType (table tbl_idtype; props IDTID, TITLE, IMAGE_TYPE, STATUS)   async KYCdTypeDropDowen() : KYCdType[] (STATUS true) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['IDTID', 'TITLE', 'IMAGE_TYPE', 'STATUS'];

class KYCdType {
  async KYCdTypeDropDowen() {
    return mapRows(await query('affiliate', 'select * from tbl_idtype where status::int=1'), PROPS);
  }
}

module.exports = KYCdType;
