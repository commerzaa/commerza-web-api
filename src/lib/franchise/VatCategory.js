/** Exports: class VatCategory (table tbl_vat_categories; props active, BranchId, vatPercValue, vatTitle, vcid, prodCount[not mapped], vatNewTitle[not mapped])
 *   async GetVatCategory(int vcid, Int64 BranchId) : VatCategory | null
 *   async GetVatCategoryCharges(int vcid, Int64 BranchId) : string   (vatPercValue.ToString("0.00"); throws when no row, like the C# NullReference)
 *  (VatCategoriesDetail / VatCat in the same C# file are plain property bags and are not ported)
 */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['active', 'BranchId', 'vatPercValue', 'vatTitle', 'vcid'];

class VatCategory {
  async GetVatCategory(vcid, BranchId) {
    const row = mapRow(await queryOne('shopping', 'select * from tbl_vat_categories where vcid=@vcid and branchid=@BranchId limit 1', { vcid, BranchId }), PROPS);
    return row ? { ...row, prodCount: 0, vatNewTitle: null } : null;
  }

  async GetVatCategoryCharges(vcid, BranchId) {
    const obj = await this.GetVatCategory(vcid, BranchId);
    if (obj === null) throw new TypeError('Object reference not set to an instance of an object.');
    const n = Number(obj.vatPercValue);
    const a = Math.round((Math.abs(n) + Number.EPSILON) * 100) / 100;
    return (n < 0 && a !== 0 ? '-' : '') + a.toFixed(2);
  }
}

module.exports = VatCategory;
