/** Exports: class Tbl_Product_Category (table tbl_category; props AdminCharge, cat_code, cat_imgname, catId, catname, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status ; [NotMapped] IsSelected)
 *          class Product_CategoryList (no table; props AdminCharge, cat_code, cat_imgname, catId, catname, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status)
 *   (file Models/Product_Category.cs, class Tbl_Product_Category; also available as ./Tbl_Product_Category)
 *   async AddCategory(string categryname) : string  ("" - legacy builds the object but never saves it)
 *   async Product_Category_List() : Tbl_Product_Category[]  (status && !isDelete, by sequence)
 *   async Product_Category_Listonmaincategory(int maincatid) : Tbl_Product_Category[]  (maincatId && status && !isDelete, by sequence)
 *   async Product_Category_OnCatid(int catid) : Tbl_Product_Category | null  (status && !isDelete && catId)
 *   async ProductCategory(string PrId) : Tbl_Product_Category | null  (cat_code == PrId && status)
 *   Tbl_Product_Category.Product_CategoryList : model class (also ./Product_CategoryList)
 * PORT-NOTE: Models/Product_Category.cs is NOT in Common.csproj (it uses db._Product_Category, a DbSet that is commented out in
 *   DataBaseContext, so it never compiled). Ported anyway; every query targets tbl_category (the table of both DbSets).
 * Not reused from ../franchise/Tbl_Product_Category.js: different C# and database ('affiliate' here).
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Tbl_Product_Category', 'tbl_category', { AdminCharge: null, cat_code: null, cat_imgname: null, catId: 0, catname: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false }, ['IsSelected']);
const Product_CategoryList = defineModel('Product_CategoryList', null, { AdminCharge: null, cat_code: null, cat_imgname: null, catId: 0, catname: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false });

const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped] IsSelected

class Tbl_Product_Category extends Base {
  async AddCategory(categryname) {
    const Pcat = new Tbl_Product_Category();
    Pcat.catname = categryname;
    return '';
  }

  async Product_Category_List() {
    return Base.mapAll(await query(DB, 'select * from tbl_category where status::int=1 and isdelete::int=0 order by sequence')).map(nm);
  }

  async Product_Category_Listonmaincategory(maincatid) {
    return Base.mapAll(await query(DB, 'select * from tbl_category where maincatid=@maincatid and status::int=1 and isdelete::int=0 order by sequence', { maincatid })).map(nm);
  }

  async Product_Category_OnCatid(catid) {
    return nm(Base.map(await queryOne(DB, 'select * from tbl_category where status::int=1 and isdelete::int=0 and catid=@catid limit 1', { catid })));
  }

  async ProductCategory(PrId) {
    return nm(Base.map(await queryOne(DB, 'select * from tbl_category where cat_code=@PrId and status::int=1 limit 1', { PrId })));
  }
}

module.exports = Tbl_Product_Category;
module.exports.Tbl_Product_Category = Tbl_Product_Category;
module.exports.Product_CategoryList = Product_CategoryList;
