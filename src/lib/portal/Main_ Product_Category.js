/** Exports: class Main_Product_Category (table tbl_main_category; file Models/Main_ Product_Category.cs, also available as ./Main_Product_Category)
 *   async AddCategory(string categryname) : string ("")
 *   async mainProduct_Category_List() : Main_Product_Category[]   (status && !isDelete, by sequence)
 *   async mainProduct_Category_List1() : Main_Product_Category1[] (DBO.usp_Bind_maincategory @Mode = 1)
 *   async MainProductCategory(int Id) : Main_Product_Category | null
 *   static PROPS / TABLE ; static Main_Product_CategoryList = { PROPS } ; static Main_Product_Category1 = { PROPS }  (C# property bags in the same file)
 * Differs from ../merchant/Main_ Product_Category: extra entity columns Category_Icon, TOTALACTIVE and the mainProduct_Category_List1 method.
 */
'use strict';
const { query, queryOne, proc } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['AdminCharge', 'ImageName', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'main_cat_code', 'main_cat_imgname', 'maincatId', 'maincatname', 'sequence', 'status', 'Category_Icon', 'TOTALACTIVE'];
const LIST_PROPS = ['AdminCharge', 'ImageName', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'IsSelected', 'main_cat_code', 'main_cat_imgname', 'maincatId', 'maincatname', 'sequence', 'status'];
const CAT1_PROPS = [...LIST_PROPS, 'TotalProduct', 'Category_ICON'];
const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped] IsSelected

class Main_Product_Category {
  async AddCategory(categryname) {
    const Pcat = { maincatname: categryname }; // legacy builds the object but never saves it
    void Pcat;
    return '';
  }

  async mainProduct_Category_List() {
    return mapRows(await query('shopping', 'select * from tbl_main_category where status::int=1 and isdelete::int=0 order by sequence'), PROPS).map(nm);
  }

  async mainProduct_Category_List1() {
    return mapRows(await proc('shopping', 'usp_bind_maincategory', { mode: 1 }), CAT1_PROPS);
  }

  async MainProductCategory(Id) {
    return nm(mapRow(await queryOne('shopping', 'select * from tbl_main_category where status::int=1 and isdelete::int=0 and maincatid=@Id limit 1', { Id }), PROPS));
  }
}
Main_Product_Category.PROPS = PROPS;
Main_Product_Category.TABLE = 'tbl_main_category';
Main_Product_Category.Main_Product_CategoryList = { PROPS: LIST_PROPS };
Main_Product_Category.Main_Product_Category1 = { PROPS: CAT1_PROPS };

module.exports = Main_Product_Category;
