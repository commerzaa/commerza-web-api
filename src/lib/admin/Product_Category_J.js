/** Exports: class Product_Category_J (table tbl_category; props AdminCharge, cat_code, cat_imgname, catId, catname, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status ; [NotMapped] IsSelected)
 *          class Product_CategoryList_j (no table; props AdminCharge, cat_code, cat_imgname, catId, catname, isDelete, IsHot_Links, IsHot_Menu, IsHot_WithItem, IsSelected, maincatId, sequence, status)
 *   (file Models/Product_Category_J.cs, class Product_Category_J; also available as ./Product_Category_J)
 *   async AddCategory(string categryname) : string  ("" - legacy builds the object but never saves it)
 *   async Product_Category() : Product_Category_J[]  (status && !isDelete, by sequence)
 *   async Product_Category_Listonmaincategory(int maincatid) : Product_Category_J[]  (maincatId && status && !isDelete, by sequence)
 *   async Product_Category_OnCatid(int catid) : Product_Category_J | null  (status && !isDelete && catId)
 *   async ProductCategory(string PrId) : Product_Category_J | null  (cat_code == PrId && status)
 *   Product_Category_J.Product_CategoryList_j : model class (also ./Product_CategoryList_j)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Product_Category_J', 'tbl_category', { AdminCharge: null, cat_code: null, cat_imgname: null, catId: 0, catname: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false }, ['IsSelected']);
const Product_CategoryList_j = defineModel('Product_CategoryList_j', null, { AdminCharge: null, cat_code: null, cat_imgname: null, catId: 0, catname: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, IsSelected: false, maincatId: 0, sequence: 0, status: false });

const nm = (o) => (o ? { ...o, IsSelected: false } : o); // [NotMapped] IsSelected

class Product_Category_J extends Base {
  async AddCategory(categryname) {
    const Pcat = new Product_Category_J();
    Pcat.catname = categryname;
    return '';
  }

  async Product_Category() {
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

module.exports = Product_Category_J;
module.exports.Product_Category_J = Product_Category_J;
module.exports.Product_CategoryList_j = Product_CategoryList_j;
