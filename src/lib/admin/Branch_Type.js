/** Exports: class Branch_Type (table tbl_branch_type; props brtid, BrType, BrType_Name, isActive, Is_Add_Stock_From_Vendor, IsStore, Discount, Cartage)
 *   async BranchTypeList() : Branch_Type[]  (isActive; legacy .OrderBy(BrType).OrderBy(brtid) => effective order brtid)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Branch_Type', 'tbl_branch_type', { brtid: 0, BrType: null, BrType_Name: null, isActive: false, Is_Add_Stock_From_Vendor: false, IsStore: false, Discount: 0, Cartage: 0 });

class Branch_Type extends Base {
  async BranchTypeList() {
    // PORT-NOTE: the second OrderBy replaces the first in LINQ (ThenBy was not used), so the result is ordered by brtid only.
    return Base.mapAll(await query(DB, 'select * from tbl_branch_type where isactive::int=1 order by brtid'));
  }
}

module.exports = Branch_Type;
