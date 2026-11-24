/** Exports: class Main_Product_Category (table tbl_main_category; file Models/Main_ Product_Category.cs, also available as ./Main_Product_Category)
 *   async AddCategory(string categryname) : string ("")
 *   async mainProduct_Category_List() : Main_Product_Category[]  (status && !isDelete, by sequence)
 *   async MainProductCategory(int Id) : Main_Product_Category | null
 *  (Main_Product_CategoryList is a plain property bag and is not ported)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['AdminCharge', 'ImageName', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'main_cat_code', 'main_cat_imgname', 'maincatId', 'maincatname', 'sequence', 'status'];
const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped]

class Main_Product_Category {
  async AddCategory(categryname) {
    const Pcat = { maincatname: categryname }; // legacy builds the object but never saves it
    return '';
  }

  async mainProduct_Category_List() {
    return mapRows(await query('shopping', 'select * from tbl_main_category where status::int=1 and isdelete::int=0 order by sequence'), PROPS).map(nm);
  }

  async MainProductCategory(Id) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_main_category where status::int=1 and isdelete::int=0 and maincatid=@Id limit 1', { Id }), PROPS));
  }
}

module.exports = Main_Product_Category;
