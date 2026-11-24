/** Exports: class VatCategory (table tbl_vat_categories; props active, BranchId, vatPercValue, vatTitle, vcid, prodCount[not mapped], vatNewTitle[not mapped])
 *   async GetVatCategory(int vcid, long BranchId) : VatCategory | null
 */
'use strict';
const { queryOne } = require('../db');
const { mapRow } = require('../utils/shape');

const PROPS = ['active', 'BranchId', 'vatPercValue', 'vatTitle', 'vcid'];

class VatCategory {
  async GetVatCategory(vcid, BranchId) {
    const row = mapRow(await queryOne('affiliate', 'select * from tbl_vat_categories where vcid=@vcid and branchid=@BranchId limit 1', { vcid, BranchId }), PROPS);
    return row ? { ...row, prodCount: 0, vatNewTitle: null } : null;
  }
}

module.exports = VatCategory;
