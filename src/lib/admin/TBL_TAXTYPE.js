/** Exports: class TBL_TAXTYPE (table tbl_taxtype; props TTTID, TAXTYPE, ACTIVE)
 *   async TaxList() : TBL_TAXTYPE[]  (ACTIVE == 1)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('TBL_TAXTYPE', 'tbl_taxtype', { TTTID: 0, TAXTYPE: null, ACTIVE: 0 });

class TBL_TAXTYPE extends Base {
  async TaxList() {
    return Base.mapAll(await query(DB, 'select * from tbl_taxtype where active=1'));
  }
}

module.exports = TBL_TAXTYPE;
