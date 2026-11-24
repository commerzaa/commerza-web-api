/** Exports: class Tbl_Product_Category (table tbl_category)
 *   async AddCategory(string categryname) : string ("") ; async Product_Category_List() : Tbl_Product_Category[]  (status && !isDelete, by sequence)
 *   async Product_Category_Listonmaincategory(int maincatid) : Tbl_Product_Category[] ; async Product_Category_OnCatid(int catid) : Tbl_Product_Category|null
 *   async ProductCategory(string PrId) : Tbl_Product_Category|null  (cat_code == PrId && status; note: C# returns null when not found)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['AdminCharge', 'DelieveryCharge', 'HandlingCharge', 'FixedFee', 'cat_code', 'cat_imgname', 'catId', 'catname', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'maincatId', 'sequence', 'status'];
const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped]

class Tbl_Product_Category {
  async AddCategory(categryname) {
    const Pcat = { catname: categryname }; // never saved in the legacy code
    return '';
  }

  async Product_Category_List() {
    return mapRows(await query('shopping', 'select * from tbl_category where status::int=1 and isdelete::int=0 order by sequence'), PROPS).map(nm);
  }

  async Product_Category_Listonmaincategory(maincatid) {
    return mapRows(await query('shopping', 'select * from tbl_category where maincatid=@maincatid and status::int=1 and isdelete::int=0 order by sequence', { maincatid }), PROPS).map(nm);
  }

  async Product_Category_OnCatid(catid) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_category where status::int=1 and isdelete::int=0 and catid=@catid limit 1', { catid }), PROPS));
  }

  async ProductCategory(PrId) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_category where cat_code=@PrId and status::int=1 limit 1', { PrId }), PROPS));
  }
}

module.exports = Tbl_Product_Category;
