/** Exports: class Tbl_Product_Category (table tbl_category; static PROPS, static TABLE) + Product_CategoryList, Tbl_Product_Category1 ({PROPS})
 *   async AddCategory(string categryname) : string ("")                 (never saved in the legacy code)
 *   async Product_Category_List() : Tbl_Product_Category[]             (status && !isDelete, order by sequence)
 *   async Product_Category_List1() : Tbl_Product_Category1[]           (DBO.usp_Bind_maincategory @Mode=2)
 *   async Product_Category_Listonmaincategory(int maincatid) : Tbl_Product_Category[]
 *   async Product_Category_OnCatid(int catid) : Tbl_Product_Category|null
 *   async ProductCategory(string PrId) : Tbl_Product_Category|null      (cat_code == PrId && status)
 *  Differs from ../merchant (franchise) version: no FixedFee, has TOTALACTIVE, adds Product_Category_List1. */
'use strict';
const { query, queryOne, proc } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['AdminCharge', 'DelieveryCharge', 'HandlingCharge', 'cat_code', 'cat_imgname', 'catId', 'catname', 'isDelete', 'IsHot_Links',
  'IsHot_Menu', 'IsHot_WithItem', 'IsSelected', 'maincatId', 'sequence', 'status', 'TOTALACTIVE'];
const Product_CategoryList = { PROPS: ['AdminCharge', 'cat_code', 'cat_imgname', 'catId', 'catname', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'IsSelected', 'maincatId', 'sequence', 'status'] };
const Tbl_Product_Category1 = { PROPS: ['AdminCharge', 'DelieveryCharge', 'HandlingCharge', 'cat_code', 'cat_imgname', 'catId', 'catname', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'maincatId', 'sequence', 'status', 'TotalProduct'] };

const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped] IsSelected defaults to false

class Tbl_Product_Category {
  async AddCategory(categryname) {
    const Pcat = { catname: categryname }; // eslint-disable-line no-unused-vars
    return '';
  }

  async Product_Category_List() {
    return mapRows(await query('shopping', 'select * from tbl_category where status::int=1 and isdelete::int=0 order by sequence'), PROPS).map(nm);
  }

  async Product_Category_List1() {
    return mapRows(await proc('shopping', 'usp_bind_maincategory', { mode: 2 }), Tbl_Product_Category1.PROPS);
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
Tbl_Product_Category.PROPS = PROPS;
Tbl_Product_Category.TABLE = 'tbl_category';
Tbl_Product_Category.Tbl_Product_Category = Tbl_Product_Category;
Tbl_Product_Category.Product_CategoryList = Product_CategoryList;
Tbl_Product_Category.Tbl_Product_Category1 = Tbl_Product_Category1;

module.exports = Tbl_Product_Category;
