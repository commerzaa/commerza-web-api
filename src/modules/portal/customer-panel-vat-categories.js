// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Vat_Categories.cs (class Vat_CategoriesController; DB: Db_Shopping, via VatCategoryDal)
'use strict';
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const VatCategoryDal = require('../../lib/portal/VatCategoryDal');

const router = express.Router();
const P = '/portal/Vat_Categories';

// auth ([SessionExpireCheck])
router.all(`${P}/AddUpdateShippingMethod{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let vcid = b.mvcStr(req, 'vcid');
  const vatTitle = b.mvcStr(req, 'vatTitle');
  const vatPercValue = b.bindDecimal(req, 'vatPercValue');
  const mode = b.mvcStr(req, 'mode');
  const Status = b.bindChar(req, 'Status');
  if (vcid === '') vcid = '0';
  const vcids = c.toInt32(vcid);
  const Plid = Number(req.user.plid);
  const da = new VatCategoryDal();
  const returnmess = await da.AddVatCategories(vcids, vatTitle, vatPercValue, mode, Plid, Status);
  res.json(returnmess);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/DeleteVatCatdetail{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const vcid = c.bindInt(req, 'vcid');
  const dal = new VatCategoryDal();
  const ret = await dal.VatCategorydelete(vcid);
  res.json(ret);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/EditVatCatdetails{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const vcid = b.mvcStr(req, 'vcid');
  const dal = new VatCategoryDal();
  const vat = await dal.GetVatCategory(c.toInt32(vcid));
  res.json(vat);
}));

// auth ([SessionExpireCheck])
// route-config: merchant/vat-category -> Vat_Categories/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/vat-category'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  // Redirecting Merchant to the dashboard if It is not the ATCShopping Id
  if (c.toInt64(req.user.plid) !== 1) {
    // Response.Redirect("dashBoard") ends the request
    return res.json({ redirect: 'dashBoard' });
  }
  return c.viewJson(res, '~/Views/CustomerPanel/Vat_Categories/Index.cshtml', undefined, {});
}));

// auth ([SessionExpireCheck])
router.all(`${P}/IsActive{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const VCID = b.mvcStr(req, 'VCID');
  let pb = { Message: null, ReturnValue: null, Success: null };
  if (VCID !== null && VCID !== '') {
    const Plid = Number(req.user.plid);
    const dal = new VatCategoryDal();
    const e = { active: false, BranchId: 0, Rownumber: 0, StateName: null, ToUserId: null, ToUserType: 0, vatPercValue: 0, vatTitle: null, vcid: 0 };
    e.vcid = c.toInt32(VCID);
    e.ToUserId = Plid;
    e.ToUserType = UtilityClass.SeclectUserType.Employee; // enum value (3) is sent as the SqlParameter value
    pb = await dal.IsActive_VatCategory(e, '101.102.10.2');
  } else {
    pb.Message = ' IsActivation Failed';
    pb.Success = false;
  }
  res.json(pb);
}));

// auth ([SessionExpireCheck])
router.all(`${P}/VatCategoriessDetails{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let VatDetail = [];
  const dal = new VatCategoryDal();
  const Plid = Number(req.user.plid);
  VatDetail = await dal.GetAllVatCategory(Plid);
  res.json(VatDetail);
}));

// class EditVatCategory (nested model, unused) - not an action.

module.exports = router;
