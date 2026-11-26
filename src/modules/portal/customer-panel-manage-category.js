'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Manage_Category.cs (class Manage_CategoryController; DB: Db_Shopping)
// EF entities: Main_Product_Category = tbl_main_category, Tbl_Product_Category = tbl_category, Product_Sub_Category = tbl_sub_category.
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const Product_Sub_Category = require('../../lib/portal/Product_Sub_Category');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Manage_Category';

// private string OriginalImageFolder / ThumbNailImageFolder = AppSettings["MainCategoryImage"]
const OriginalImageFolder = () => config.app.MainCategoryImage || '';
const ThumbNailImageFolder = () => config.app.MainCategoryImage || '';

/** C# string.Trim(char) */
const trimChar = (s, ch) => { let x = String(s); while (x.startsWith(ch)) x = x.slice(1); while (x.endsWith(ch)) x = x.slice(0, -1); return x; };

/** Non-nullable bool action parameter (MVC binder: "true"/"false", checkbox "true,false" => first value). */
function bindBool(req, name) {
  let v = req.p[name];
  if (Array.isArray(v)) v = v[0];
  if (c.isNull(v) || String(v).trim() === '') throw c.nullEntry(name, 'System.Boolean');
  const t = String(v).split(',')[0].trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw c.nullEntry(name, 'System.Boolean');
}

const isTrue = (v) => v === true || v === 1 || v === '1' || v === 't' || v === 'true';
const isFalse = (v) => v === false || v === 0 || v === '0' || v === 'f' || v === 'false';

const getMain = (id) => db.queryOne(DB, 'select * from tbl_main_category where maincatid = @id limit 1', { id });
const getCat = (id) => db.queryOne(DB, 'select * from tbl_category where catid = @id limit 1', { id });
const getSub = (id) => db.queryOne(DB, 'select * from tbl_sub_category where subcatid = @id limit 1', { id });

// auth ([SessionExpireCheck])
router.all(`${P}/addNewCatSubCat{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const typeid = c.bindInt(req, 'typeid');
  let newitems = req.p.newitems;
  const addType = req.p.addType;
  try {
    if (c.isNull(newitems)) throw c.NRE();
    newitems = trimChar(newitems, '~');
    const psc = new Product_Sub_Category();
    const returnmess = await psc.insertalltypecategoryAtOnce(typeid, addType, newitems);
    return res.json(returnmess);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth ([SessionExpireCheck])
router.all(`${P}/deleteAllTypeofItems{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const editid = c.bindInt(req, 'editid');
  const edittype = req.p.edittype;
  try {
    if (edittype === 'maincategory') {
      const mpc = await getMain(editid);
      if (!mpc) return res.json('No record updated');
      await db.exec(DB, 'update tbl_main_category set isdelete = true where maincatid = @id', { id: mpc.maincatid });
      const cats = await db.query(DB, 'select catid from tbl_category where maincatid = @id', { id: mpc.maincatid });
      for (const cat of cats) await db.exec(DB, 'update tbl_category set isdelete = true where catid = @id', { id: cat.catid });
      const subs = await db.query(DB, 'select subcatid from tbl_sub_category where maincatid = @id', { id: mpc.maincatid });
      for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set isdelete = true where subcatid = @id', { id: sub.subcatid });
    }
    if (edittype === 'category') {
      const cat = await getCat(editid);
      if (!cat) return res.json('No record updated');
      await db.exec(DB, 'update tbl_category set isdelete = true where catid = @id', { id: cat.catid });
      const subs = await db.query(DB, 'select subcatid from tbl_sub_category where catid = @id', { id: cat.catid });
      for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set isdelete = true where subcatid = @id', { id: sub.subcatid });
    }
    if (edittype === 'subcategory') {
      const subcat = await getSub(editid);
      if (!subcat) return res.json('No record updated');
      await db.exec(DB, 'update tbl_sub_category set isdelete = true where subcatid = @id', { id: subcat.subcatid });
    }
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth ([SessionExpireCheck])
router.all(`${P}/DisabledCategories{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/Manage_Category/Index.cshtml' });
}));

// auth ([SessionExpireCheck])
router.all(`${P}/enableAllTypeofItems{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const enableid = c.bindInt(req, 'enableid');
  const enabletype = req.p.enabletype;
  try {
    if (enabletype === 'maincategory') {
      const mpc = await getMain(enableid);
      if (!mpc) return res.json('No record updated');
      if (isTrue(mpc.status)) return res.json('Already Enabled');
      await db.exec(DB, 'update tbl_main_category set status = true where maincatid = @id', { id: mpc.maincatid });
      const cats = await db.query(DB, 'select catid from tbl_category where maincatid = @id', { id: mpc.maincatid });
      for (const cat of cats) await db.exec(DB, 'update tbl_category set status = true where catid = @id', { id: cat.catid });
      const subs = await db.query(DB, 'select subcatid from tbl_sub_category where maincatid = @id', { id: mpc.maincatid });
      for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set status = true where subcatid = @id', { id: sub.subcatid });
    }
    if (enabletype === 'category') {
      const cat = await getCat(enableid);
      if (!cat) return res.json('No record updated');
      if (isTrue(cat.status)) return res.json('Already Enabled');
      await db.exec(DB, 'update tbl_category set status = true where catid = @id', { id: cat.catid });
      const mpc = await getMain(cat.maincatid);
      if (!mpc) throw c.NRE(); // mpc.status = true on null
      await db.exec(DB, 'update tbl_main_category set status = true where maincatid = @id', { id: mpc.maincatid });
      const subs = await db.query(DB, 'select subcatid from tbl_sub_category where catid = @id', { id: cat.catid });
      for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set status = true where subcatid = @id', { id: sub.subcatid });
    }
    if (enabletype === 'subcategory') {
      const subcat = await getSub(enableid);
      if (!subcat) return res.json('No record updated');
      if (isTrue(subcat.status)) return res.json('Already Enabled');
      await db.exec(DB, 'update tbl_sub_category set status = true where subcatid = @id', { id: subcat.subcatid });
      const cat = await getCat(subcat.catid);
      if (!cat) throw c.NRE();
      await db.exec(DB, 'update tbl_category set status = true where catid = @id', { id: cat.catid });
      const mpc = await getMain(cat.maincatid);
      if (!mpc) throw c.NRE();
      await db.exec(DB, 'update tbl_main_category set status = true where maincatid = @id', { id: mpc.maincatid });
    }
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

/** new commonidtitlestatus() with C# defaults */
const newCommon = () => ({ admincharge: null, commonid: 0, commonImage: null, commonstatus: false, commontitle: null, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null });
const bool = (v) => (c.isNull(v) ? v : isTrue(v));

// auth ([SessionExpireCheck])
router.all(`${P}/getTitleandStatusforEdit{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const editid = c.bindInt(req, 'editid');
  const edittype = req.p.edittype;
  const coomobj = newCommon();
  try {
    if (edittype === 'maincategory') {
      const mpc = await getMain(editid);
      if (!mpc) { coomobj.commontitle = 'invalid^No Record Found'; return res.json(coomobj); }
      coomobj.commonid = mpc.maincatid;
      coomobj.commontitle = mpc.maincatname;
      coomobj.admincharge = mpc.admincharge;
      coomobj.IsHot_Links = bool(mpc.ishot_links);
      coomobj.IsHot_Menu = bool(mpc.ishot_menu);
      coomobj.IsHot_WithItem = bool(mpc.ishot_withitem);
      coomobj.commonstatus = !!bool(mpc.status);
      coomobj.commonImage = mpc.imagename;
    }
    if (edittype === 'category') {
      const cat = await getCat(editid);
      if (!cat) { coomobj.commontitle = 'invalid^No Record Found'; return res.json(coomobj); }
      coomobj.commonid = cat.catid;
      coomobj.commontitle = cat.catname;
      coomobj.admincharge = cat.admincharge;
      coomobj.IsHot_Links = bool(cat.ishot_links);
      coomobj.IsHot_Menu = bool(cat.ishot_menu);
      coomobj.IsHot_WithItem = bool(cat.ishot_withitem);
      coomobj.commonstatus = !!bool(cat.status);
      coomobj.commonImage = cat.cat_imgname;
    }
    if (edittype === 'subcategory') {
      const subcat = await getSub(editid);
      if (!subcat) { coomobj.commontitle = 'invalid^No Record Found'; return res.json(coomobj); }
      coomobj.commonid = subcat.subcatid;
      coomobj.commontitle = subcat.subcatname;
      coomobj.admincharge = subcat.admincharge;
      coomobj.IsHot_Links = bool(subcat.ishot_links);
      coomobj.IsHot_Menu = bool(subcat.ishot_menu);
      coomobj.IsHot_WithItem = bool(subcat.ishot_withitem);
      coomobj.commonstatus = !!bool(subcat.status);
      coomobj.commonImage = subcat.sub_cat_imgname;
    }
    return res.json(coomobj);
  } catch (ex) {
    coomobj.commontitle = 'invalid^Something went wrong. Please try later';
    return res.json(coomobj);
  }
}));

// auth ([SessionExpireCheck])
router.all(`${P}/Index{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/merchant/Manage_Category/NewIndex.cshtml' });
}));

// Title uniqueness checks (EF: x.Trim().ToLower() == editvalue.Trim().ToLower() && isDelete == false)
const dupMain = (v, exceptId) => db.queryOne(DB, `select maincatid from tbl_main_category
   where lower(trim(maincatname)) = lower(trim(@v)) and isdelete = false ${exceptId === undefined ? '' : 'and maincatid <> @x'} limit 1`, { v, x: exceptId });
const dupCat = (v, exceptId) => db.queryOne(DB, `select catid from tbl_category
   where lower(trim(catname)) = lower(trim(@v)) and isdelete = false ${exceptId === undefined ? '' : 'and catid <> @x'} limit 1`, { v, x: exceptId });
const dupSub = (v, exceptId) => db.queryOne(DB, `select subcatid from tbl_sub_category
   where lower(trim(subcatname)) = lower(trim(@v)) and isdelete = false ${exceptId === undefined ? '' : 'and subcatid <> @x'} limit 1`, { v, x: exceptId });

// auth ([SessionExpireCheck])
router.all(`${P}/updatecommonTitleandstatus{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const editid = c.bindInt(req, 'editid');
  const edittype = req.p.edittype;
  const editvalue = req.p.editvalue;
  const editstatus = bindBool(req, 'editstatus');
  const IsHot_Links = bindBool(req, 'IsHot_Links');
  const IsHot_Menu = bindBool(req, 'IsHot_Menu');
  const IsHot_WithItem = bindBool(req, 'IsHot_WithItem');
  const Image = req.p.Image;
  try {
    let returnmess = '';
    if (!(c.isNull(Image) || Image === '')) {
      returnmess = await UtilityClass.ImageUploadMasterMethod(Image, OriginalImageFolder(), ThumbNailImageFolder(), UtilityClass.ImageMode.Original, 'Category');
    }
    const ut = UtilityClass;
    const imageValue = (c.isNull(returnmess) || returnmess === '') ? (c.isNull(Image) ? null : Image) : returnmess;
    const needValue = () => { if (c.isNull(editvalue)) throw c.NRE(); return String(editvalue); };
    if (edittype === 'maincategory') {
      const mpc = await getMain(editid);
      if (!mpc) return res.json('No record updated');
      if (isFalse(mpc.status)) return res.json('Already disabled');
      const v = needValue();
      if (await dupMain(v, editid)) return res.json('Already a Main Category present with same title');
      if (await dupCat(v)) return res.json('Already a Category present with same title');
      if (await dupSub(v)) return res.json('Already a Sub Category present with same title');
      await db.exec(DB, `update tbl_main_category set maincatname = @name, main_cat_code = @code, status = @status, ishot_links = @l,
          ishot_menu = @m, ishot_withitem = @w, imagename = @img where maincatid = @id`, {
        name: v, code: await ut.removeSpacesAndSpecialChars(v), status: editstatus, l: IsHot_Links, m: IsHot_Menu, w: IsHot_WithItem, img: imageValue, id: mpc.maincatid,
      });
      if (editstatus === false) {
        const cats = await db.query(DB, 'select catid from tbl_category where maincatid = @id', { id: mpc.maincatid });
        for (const cat of cats) await db.exec(DB, 'update tbl_category set status = false where catid = @id', { id: cat.catid });
        const subs = await db.query(DB, 'select subcatid from tbl_sub_category where maincatid = @id', { id: mpc.maincatid });
        for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set status = false where subcatid = @id', { id: sub.subcatid });
      }
    }
    if (edittype === 'category') {
      const cat = await getCat(editid);
      if (!cat) return res.json('No record updated');
      if (isFalse(cat.status)) return res.json('Already disabled');
      const v = needValue();
      if (await dupMain(v)) return res.json('Already a Main Category present with same title');
      if (await dupCat(v, editid)) return res.json('Already a Category present with same title');
      if (await dupSub(v)) return res.json('Already a Sub Category present with same title');
      await db.exec(DB, `update tbl_category set catname = @name, ishot_links = @l, ishot_menu = @m, ishot_withitem = @w,
          cat_code = @code, status = @status, cat_imgname = @img where catid = @id`, {
        name: v, l: IsHot_Links, m: IsHot_Menu, w: IsHot_WithItem, code: await ut.removeSpacesAndSpecialChars(v), status: editstatus, img: imageValue, id: cat.catid,
      });
      if (editstatus === false) {
        const subs = await db.query(DB, 'select subcatid from tbl_sub_category where catid = @id', { id: cat.catid });
        for (const sub of subs) await db.exec(DB, 'update tbl_sub_category set status = false where subcatid = @id', { id: sub.subcatid });
      }
    }
    if (edittype === 'subcategory') {
      const subcat = await getSub(editid);
      if (!subcat) return res.json('No record updated');
      if (isFalse(subcat.status)) return res.json('Already disabled');
      const v = needValue();
      if (await dupMain(v)) return res.json('Already a Main Category present with same title');
      if (await dupCat(v)) return res.json('Already a Category present with same title');
      if (await dupSub(v, editid)) return res.json('Already a Sub Category present with same title');
      await db.exec(DB, `update tbl_sub_category set subcatname = @name, ishot_links = @l, ishot_menu = @m, ishot_withitem = @w,
          sub_cat_code = @code, status = @status, sub_cat_imgname = @img where subcatid = @id`, {
        name: v, l: IsHot_Links, m: IsHot_Menu, w: IsHot_WithItem, code: await ut.removeSpacesAndSpecialChars(v), status: editstatus, img: imageValue, id: subcat.subcatid,
      });
    }
    return res.json('ok');
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

// auth ([SessionExpireCheck])
router.all(`${P}/updatesequenceofallItems{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let allids = req.p.allids;
  try {
    const empcode = String(req.user.plid);
    const BranchId = req.user.plid;
    void empcode; void BranchId; // only used by the commented-out Maintain_Manipulation call
    if (c.isNull(allids)) throw c.NRE();
    allids = trimChar(allids, '~');
    const psc = new Product_Sub_Category();
    const returnmess = await psc.stringForUpdateallidsinsequence(allids);
    return res.json(returnmess);
  } catch (ex) {
    return res.json('Something went wrong. Please try later');
  }
}));

module.exports = router;
