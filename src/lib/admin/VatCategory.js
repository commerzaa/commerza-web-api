/** Exports: class VatCategory (table tbl_vat_categories; props vcid, vatTitle, vatPercValue, active, prodCount, vatNewTitle)
 *   async Vat_Category() : VatCategory[]  (proc usp_vat_category_list)
 *   async Vat_Categories_List() : VatCategory[]  (proc usp_get_category_prodcut_count)
 *   async Vat_Categories_OnVCID(int vcid) : VatCategory | null  (usp_get_category_prodcut_count filtered in memory by vcid)
 *   async AddVatCategories(int vcid, string vatTitle, decimal vatPercValue, string mode) : string  (proc usp_tbl_AddVatCategory ... @strResult out)
 *   async VatCategorydelete(int vcid) : string  (same proc, vatTitle "", vatPercValue "", mode "Delete")
 * Not reused from ../franchise/VatCategory.js / API: different C# and database.
 */
'use strict';
const { proc, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('VatCategory', 'tbl_vat_categories', { vcid: 0, vatTitle: null, vatPercValue: 0, active: false, prodCount: 0, vatNewTitle: null });

class VatCategory extends Base {
  async Vat_Category() {
    return Base.mapAll(await proc(DB, 'usp_vat_category_list', {}));
  }

  async Vat_Categories_List() {
    return Base.mapAll(await proc(DB, 'usp_get_category_prodcut_count', {}));
  }

  async Vat_Categories_OnVCID(vcid) {
    const list = Base.mapAll(await proc(DB, 'usp_get_category_prodcut_count', {}));
    return list.find((c) => c.vcid === vcid) || null;
  }

  async AddVatCategories(vcid, vatTitle, vatPercValue, mode) {
    const row = await procOne(DB, 'usp_tbl_addvatcategory', { vcid, vattitle: vatTitle, vatpercvalue: vatPercValue, mode });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }

  async VatCategorydelete(vcid) {
    // PORT-NOTE: legacy passes "" for the decimal @vatPercValue (kept as-is).
    const row = await procOne(DB, 'usp_tbl_addvatcategory', { vcid, vattitle: '', vatpercvalue: '', mode: 'Delete' });
    const OutputResult = toStr(out(row, 'strResult'));
    return OutputResult.toString();
  }
}

module.exports = VatCategory;
