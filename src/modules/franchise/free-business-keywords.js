'use strict';
// Ported from Franchise\Controllers\CustomerPanel\FreeBusinessKeywords.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const DAL_BusinessListing = require('../../lib/franchise/DAL_BusinessListing');

const router = express.Router();
const P = '/franchise/FreeBusinessKeywords';

const PORTAL_MASTER = ['PMID', 'COMPANYNAME', 'HeaderImage', 'MOBILENO', 'CATID', 'CID', 'SID', 'CTID', 'ADDRESS', 'PINCODE', 'ACTIVE', 'ACCOUNTTYPE', 'KEYID', 'TITLE', 'URL', 'AREANAME', 'BUSINESS_STATUS', 'COMPANYDESC', 'PRICE', 'PMTID', 'ISMANNUAL', 'PTMID', 'LANKMARK', 'COMEMAILID', 'YEAROFESTABLE', 'ANNUALTURNOVER', 'NOOFEMPLOYEE', 'COMPANYIMAGE', 'DOC', 'COMPANYPROFILEIMAGE', 'OPTID', 'ISVERIFIED', 'SUBCATID', 'AID', 'PLID', 'SELLER_NAME', 'AD_ID', 'Seller_Address', 'SCATID', 'YourAre', 'AD_TITLE', 'AD_PRICE', 'Ad_Currency', 'Ad_Type', 'YouWantTo'];

const str = (v) => (v === undefined || v === null ? '' : String(v));
const appSetting = (k) => (config.app && config.app[k] !== undefined ? config.app[k] : process.env[k]);
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^~?[\\/]*/, ''));
const rnd = (a, b) => Math.floor(Math.random() * (b - a)) + a;
const sanitize = (s) => String(s).trim().replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');

// PORT-NOTE: legacy resized images > 10 KB with System.Drawing (GetThumbnailImage, max 300px) and re-encoded as JPEG.
// No image library is installed, so the decoded bytes are stored unchanged.
function saveBase64Image(base64String, fullPath) {
  const idx = base64String.indexOf(',') + 1;
  const b = Buffer.from(base64String.substring(idx), 'base64');
  if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, b);
}

// AddTicketController.ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend)
function AddTicket_ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    const Image = String(rnd(100000, 1000000)).trim().replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
    RealImageName = Image + '-' + IdForAppend + '.jpg';
    const full = path.join(mapPath(SavePaths), RealImageName);
    if (ImageBase64Code.includes('base64,')) saveBase64Image(ImageBase64Code, full);
    else RealImageName = ImageBase64Code.replace(/^\/+/, '');
  }
  return RealImageName;
}

// public (returns the Portal_Master entity)
router.all(P + '/GetBusinessDetails{/:id}', asyncHandler(async (req, res) => {
  const PLID = parseInt(req.p.PLID, 10);
  const row = await db.queryOne('shopping', 'select * from distributor_master where plid = @plid limit 1', { plid: PLID });
  res.json(mapRow(row, PORTAL_MASTER));
}));

// public (session optional: Cid defaults to 0)
router.all(P + '/GetAutoCompleteDataArea{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (req.user) Cid = parseInt(req.user.cid, 10);
  const Result = await DAL_BusinessListing.GetAreaList(req.p.AreaName, Cid);
  res.json(Result);
}));

// public (session optional)
router.all(P + '/GetAutoCompleteDataPincode{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (req.user) Cid = parseInt(req.user.cid, 10);
  const Result = await DAL_BusinessListing.GetPinCodeList(req.p.Pincode, Cid);
  res.json(Result);
}));

// public (session optional)
async function Index(req, res) {
  let CountryId = 0;
  if (req.user) CountryId = Number(req.user.cid);
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ Model: Obj });
}
router.all(P + '/Index{/:id}', optionalAuth, asyncHandler(Index));
// route-config: franchisee/freebusinesskeywords
router.all('/franchise/franchisee/freebusinesskeywords{/:id}', optionalAuth, asyncHandler(Index));

// public
router.all(P + '/Pinverified{/:id}', asyncHandler(async (req, res) => {
  const { Pincode, StateName } = req.p;
  let result;
  const r = await db.procOne('shopping', 'usp_pinverification', { pincode: Pincode });
  const State = str(r ? (('strresult' in r) ? r.strresult : r[Object.keys(r)[0]]) : null);
  if (State === StateName) result = 'Ok';
  else result = 'Pincode Not valid';
  res.json(result);
}));

// auth
router.all(P + '/SaveOrUpdateBusinessListing{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName, Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode,
    NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, CompanyImage, CompanyHeaderImage, ScatId, Pick_State, Pick_City, Pick_Area,
    Pick_Pincode, Pick_Address, Pick_LandMark, GST, TAN, CIN, CompanyFavicon, COMPANYINFONAME, COMPANYGST, COMPANYTAN, COMPANYCIN,
    COMPANYSTATEID, COMPANYCITYID, COMPANYADDRESS, COMPANYPINCODE, Contactpersondesig, CONTACTPERSONAME, Country, CompanyCountry } = p;
  const Plid = Number(req.user.did);
  if (Country === '' || Country === '--Select Country--') return res.json('Country');
  if (CompanyCountry === '' || CompanyCountry === '--Select Country--') return res.json('Country1');

  // Company Logo
  let imgname = '';
  if (CompanyImage.trim() !== '') {
    const SavePaths = appSetting('CompanyLogoPath');
    imgname = sanitize(CompanyName) + '-' + Plid + '.jpg';
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    if (CompanyImage.includes('base64,')) saveBase64Image(CompanyImage, strValidFullName);
    else imgname = CompanyImage.replace(/^\/+/, '');
  }

  // Company Favicon
  let imgname1 = '';
  if (CompanyFavicon.trim() !== '') {
    const SavePaths = appSetting('CompanyLogoPath');
    imgname1 = sanitize(CompanyName) + '-Favicon' + '-' + Plid + '.jpg';
    const strValidFullName = path.join(mapPath(SavePaths), imgname1);
    if (CompanyFavicon.includes('base64,')) saveBase64Image(CompanyFavicon, strValidFullName);
    else imgname1 = CompanyFavicon.replace(/^\/+/, '');
  }

  // Company Header
  const HeaderImageName = AddTicket_ImageUploadMasterMethod(CompanyHeaderImage, String(appSetting('CompanyHeaderPath')), String(Plid + CompanyName.split(' ').join('')));

  const UserName = req.user.username;
  const LoginID = req.user.loginid;
  const Pmid = parseInt(req.user.pmid, 10);

  const Result = await DAL_BusinessListing.SaveBusinessListing(CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName,
    Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode, NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, imgname, String(req.user.did), HeaderImageName, UserName, LoginID, ScatId,
    Pick_State, Pick_City, Pick_Area, Pick_Pincode, Pick_Address, Pick_LandMark, GST, TAN, CIN, Pmid, imgname1, COMPANYINFONAME, COMPANYGST, COMPANYTAN, COMPANYCIN, COMPANYSTATEID, COMPANYCITYID, COMPANYADDRESS, COMPANYPINCODE, Contactpersondesig, CONTACTPERSONAME, Country, CompanyCountry);
  res.json(Result);
}));

module.exports = router;
