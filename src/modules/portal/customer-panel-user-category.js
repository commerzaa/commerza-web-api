// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/User_Category.cs (class User_CategoryController; DB: Db_Shopping)
// The Merchant Panel User_Category.cs is a different page (business listing keywords), so this module is ported from the portal C# directly.
// Proc: Usp_MerchantCat_SubCat_KeywordMaster; CategoryDAL.GetSelectedCategory
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const CategoryDAL = require('../../lib/portal/CategoryDal');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/User_Category';

// auth ([SessionExpireCheck])
// route-config: merchant/my-category -> User_Category/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/my-category'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  // Redirecting Merchant to the dashboard if It is not the ATCShopping Id
  if (c.toInt64(req.user.plid) !== 1) {
    // Response.Redirect("dashBoard") ends the request
    return res.json({ redirect: 'dashBoard' });
  }
  const ViewBag = {};
  const Success = ps.tempDataGet(req, 'Success');
  if (Success !== null && Success !== undefined) ViewBag.Success = Success;
  const Error_ = ps.tempDataGet(req, 'Error');
  if (Error_ !== null && Error_ !== undefined) ViewBag.Error = Error_;
  let objModel = { BranchId: Number(req.user.plid) };
  const dal = new CategoryDAL();
  objModel = await dal.GetSelectedCategory(objModel.BranchId);
  return c.viewJson(res, '~/Views/CustomerPanel/User_Category/Index.cshtml', objModel, ViewBag);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/SelectedCategory{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const Category = b.trimChar(b.mvcStr(req, 'Category'), ',');
  const SubCategory = b.trimChar(b.mvcStr(req, 'SubCategory'), ',');
  let StrOutPut = '';
  const rows = await db.proc(DB, 'usp_merchantcat_subcat_keywordmaster', {
    mode: '1', plid: Plid, tmcskmid: '0', category: Category, subcategory: SubCategory, keyword: '',
  });
  // PORT-NOTE: ExecuteSqlCommand returned the affected-row count (result > 0); the PostgreSQL function does not report it,
  // so "the procedure returned a result row" is used as result > 0.
  const result = rows.length;
  if (result > 0) StrOutPut = 'ok';
  else StrOutPut = 'NotOk';
  res.json(StrOutPut);
}));

module.exports = router;
