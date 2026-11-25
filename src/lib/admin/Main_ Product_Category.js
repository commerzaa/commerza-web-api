/** Exports: class Main_Product_Category (table tbl_main_category; props AdminCharge, ImageName, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, main_cat_code, main_cat_imgname, maincatId, maincatname, sequence, status ; [NotMapped] IsSelected)
 *          class Main_Product_CategoryList (no table; props AdminCharge, ImageName, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, main_cat_code, main_cat_imgname, maincatId, maincatname, sequence, status)
 *   (file "Models/Main_ Product_Category.cs", class Main_Product_Category; also available as ./Main_Product_Category)
 *   async AddCategory(string categryname) : string ("" - legacy builds the object but never saves it)
 *   async mainProduct_Category_List() : Main_Product_Category[]  (status && !isDelete, by sequence)
 *   async MainProductCategory(int Id) : Main_Product_Category | null  (status && !isDelete && maincatId == Id)
 *   Main_Product_Category.Main_Product_CategoryList : model class (also ./Main_Product_CategoryList)
 * Same C# as ../franchise/Main_ Product_Category.js, but the admin DataBaseContext is Db_Affiliate => database 'affiliate'.
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Main_Product_Category', 'tbl_main_category', { AdminCharge: null, ImageName: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, main_cat_code: null, main_cat_imgname: null, maincatId: 0, maincatname: null, sequence: 0, status: false }, ['IsSelected']);
const Main_Product_CategoryList = defineModel('Main_Product_CategoryList', null, { AdminCharge: null, ImageName: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, main_cat_code: null, main_cat_imgname: null, maincatId: 0, maincatname: null, sequence: 0, status: false });

class Main_Product_Category extends Base {
  async AddCategory(categryname) {
    const Pcat = new Main_Product_Category();
    Pcat.maincatname = categryname;
    return '';
  }

  async mainProduct_Category_List() {
    return Base.mapAll(await query(DB, 'select * from tbl_main_category where status::int=1 and isdelete::int=0 order by sequence')).map((o) => ({ ...o, IsSelected: false }));
  }

  async MainProductCategory(Id) {
    const o = Base.map(await queryOne(DB, 'select * from tbl_main_category where status::int=1 and isdelete::int=0 and maincatid=@Id limit 1', { Id }));
    return o ? { ...o, IsSelected: false } : o;
  }
}

module.exports = Main_Product_Category;
module.exports.Main_Product_Category = Main_Product_Category;
module.exports.Main_Product_CategoryList = Main_Product_CategoryList;
