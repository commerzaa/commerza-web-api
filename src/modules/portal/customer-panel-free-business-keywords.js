// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\FreeBusinessKeywords.cs (class FreeBusinessKeywordsController => /portal/FreeBusinessKeywords/...)
'use strict';
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const DAL_BusinessListing = require('../../lib/portal/DAL_BusinessListing');
const { nullRef, mvcStr, mvcInt, toInt32, toStr } = require('./_shared/batch-03-common');
const { view, content } = require('./_shared/batch-06-common');
const { mapPath } = require('./_shared/batch-02-common');
const { ImageUploadMasterMethod: AddTicketImageUploadMasterMethod } = require('./_shared/batch-08-common');
const { csSubstring, safeJoin, saveThumbProfileImage } = require('./_shared/batch-22-common');

const DB = 'shopping';
const router = express.Router();
const C = '/portal/FreeBusinessKeywords';

// ---------------------------------------------------------------- Portal_Master GetBusinessDetails(Int64 PLID)
// public (no session check). PORT-NOTE: the method returns an entity, not an ActionResult, so MVC wrapped it in a ContentResult
//   (Convert.ToString(value) = the class name "Portal_Master", or an empty body for null); reproduced, the DB read is kept.
router.all(`${C}/GetBusinessDetails{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const PLID = mvcInt(req, 'PLID');
  const ObjPortal_Master = await db.queryOne(DB, 'select * from portal_master where plid = @PLID limit 1', { PLID });
  return content(res, ObjPortal_Master === null ? null : 'Portal_Master');
}));

// ---------------------------------------------------------------- JsonResult GetAutoCompleteDataArea(string AreaName)
// public (Session["Plid"] optional: Cid of the login, else 0)
router.all(`${C}/GetAutoCompleteDataArea{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (ps.isCustomer(req)) Cid = toInt32(req.user.cid);
  const Result = await DAL_BusinessListing.GetAreaList(mvcStr(req, 'AreaName'), Cid);
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult GetAutoCompleteDataPincode(string Pincode)
// public (Session["Plid"] optional)
router.all(`${C}/GetAutoCompleteDataPincode{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (ps.isCustomer(req)) Cid = toInt32(req.user.cid);
  const Result = await DAL_BusinessListing.GetPinCodeList(mvcStr(req, 'Pincode'), Cid);
  return res.json(Result);
}));

// ---------------------------------------------------------------- ActionResult Index()
// public (Session["Plid"] optional: CountryId of the login, else 0)
// route-config: "merchant/freebusinesskeywords" -> FreeBusinessKeywords/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/freebusinesskeywords'], ps.portalSession, asyncHandler(async (req, res) => {
  let CountryId = 0;
  if (ps.isCustomer(req)) CountryId = Number(req.user.cid) || 0;
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  return view(res, '~/Views/CustomerPanel/FreeBusinessKeywords/Index.cshtml', Obj);
}));

// ---------------------------------------------------------------- JsonResult SaveOrUpdateBusinessListing(...)
// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all(`${C}/SaveOrUpdateBusinessListing{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const g = (n) => mvcStr(req, n);
  const CompanyName = g('CompanyName'); const PhoneNo = g('PhoneNo'); const Building = g('Building'); const LandMark = g('LandMark');
  const ComemailId = g('ComemailId'); const StateName = g('StateName'); const CityName = g('CityName'); const Aid = g('Aid');
  const YearOfEstable = g('YearOfEstable'); const CperWebSite = g('CperWebSite'); const CatId = g('CatId'); const KeyId = g('KeyId');
  const Pincode = g('Pincode'); const NoOfEmployee = g('NoOfEmployee'); const Mode = g('Mode'); const ComDesc = g('ComDesc');
  const Ismannual = g('Ismannual'); const PmidParam = g('PmidParam'); const CompanyImage = g('CompanyImage');
  const CompanyHeaderImage = g('CompanyHeaderImage'); const ScatId = g('ScatId');
  let Result = '';
  const Plid = Number(req.user.plid);

  // #region Company Logo
  let imgname = '';
  if (CompanyImage === null) nullRef();
  if (CompanyImage.trim() !== '') {
    let SavePaths = '';
    let base64String = '';
    SavePaths = (config.app && config.app.CompanyLogoPath) || '';
    if (CompanyImage !== '') {
      base64String = CompanyImage;
      if (CompanyName === null) nullRef();
      let ProfileImage = CompanyName;
      ProfileImage = ProfileImage.trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + Plid + '.jpg';
    } else {
      imgname = ' ';
    }
    const strValidFullName = safeJoin(mapPath(SavePaths), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      csSubstring(base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt
      const IndexNo1 = base64String.indexOf(',') + 1;
      const Pathlength1 = base64String.length;
      base64String = csSubstring(base64String, IndexNo1, Pathlength1 - IndexNo1);
      // > 10 KB => 300px thumbnail (JPEG), else saved as is
      await saveThumbProfileImage(base64String, strValidFullName, 10);
    } else {
      imgname = CompanyImage.replace(/^\/+/, '');
    }
  }
  // #endregion Company Logo

  // #region Company Header (new AddTicketController().ImageUploadMasterMethod(...))
  let HeaderImageName = '';
  if (CompanyName === null) nullRef();
  HeaderImageName = await AddTicketImageUploadMasterMethod(CompanyHeaderImage, toStr(config.app && config.app.CompanyHeaderPath),
    toStr(Plid + CompanyName.split(' ').join('')));
  // #endregion Company Header

  const UserName = req.user.username;
  const LoginID = req.user.loginid;
  Result = await DAL_BusinessListing.SaveBusinessListing(CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName,
    Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode, NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, imgname, toStr(req.user.plid),
    HeaderImageName, UserName, LoginID, ScatId);
  return res.json(Result);
}));

module.exports = router;
