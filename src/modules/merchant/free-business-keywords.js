'use strict';
/**
 * Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/FreeBusinessKeywords.cs (FreeBusinessKeywordsController)
 * Prefix: /merchant   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const DAL_BusinessListing = require('../../lib/merchant/DAL_BusinessListing');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/FreeBusinessKeywords';

// Portal_Master entity (table portal_master)
const PORTAL_MASTER = ['PMID', 'COMPANYNAME', 'HeaderImage', 'MOBILENO', 'CATID', 'CID', 'SID', 'CTID', 'ADDRESS', 'PINCODE', 'ACTIVE', 'ACCOUNTTYPE', 'KEYID',
  'TITLE', 'URL', 'AREANAME', 'BUSINESS_STATUS', 'COMPANYDESC', 'PRICE', 'PMTID', 'SUBSCRIPTIONDATE', 'ISMANNUAL', 'CANONICALURL', 'PTMID', 'LANKMARK',
  'COMEMAILID', 'YEAROFESTABLE', 'ANNUALTURNOVER', 'NOOFEMPLOYEE', 'COMPANYIMAGE', 'DOC', 'COMPANYPROFILEIMAGE', 'OPTID', 'ISVERIFIED', 'SUBCATID',
  'SUBKEYID', 'SUBCTID', 'SUBAID', 'EXPIRYDATE', 'AUTOCATID', 'SUBAUTOCATID', 'AID', 'PLID', 'SELLER_CTID', 'SELLER_CID', 'SELLER_CONTACTNO', 'SELLER_EMAIL',
  'SELLER_NAME', 'AD_ID', 'Seller_Address', 'SCATID', 'YourAre', 'AD_TITLE', 'AD_PRICE', 'Ad_Currency', 'Ad_Type', 'YouWantTo', 'IsCertifiedAd',
  'Certified_Image_Name', 'IsFeaturedAd', 'Condition', 'Ad_Images', 'Ad_Description', 'Ad_CID', 'Ad_State', 'Ad_City', 'Ad_Area', 'Ad_Pincode', 'Ad_CTID',
  'Ad_AID', 'AdPost_Date', 'IsVerfied', 'IsActive', 'Pr_Type', 'Brand', 'Model', 'Featured_days', 'Expired_Date', 'PICK_State', 'PICK_CITY', 'PICK_AREA',
  'PICK_PINCODE', 'PICK_ADDRESS', 'PICK_LANDMARK', 'GSTNO', 'TANNO', 'CINNO', 'Country', 'State', 'City', 'Pick_Country', 'ClassificationTypeID',
  'ClassificationDescription', 'StoreTypeID', 'AllDeliveryPinCode', 'Facebook', 'Twitter', 'Youtube', 'Linkdin', 'Telegram', 'WhatsappGroupLink',
  'Instagram', 'WeChat', 'DistributorId'];
const DISTRIBUTOR_PROPS = ['pmId', 'CompanyName', 'MOBILENO', 'ADDRESS', 'TITLE', 'AREANAME', 'PINCODE', 'LANKMARK'];
const POSTAL_PROPS = ['Name', 'Description', 'BranchType', 'DeliveryStatus', 'Taluk', 'Circle', 'District', 'Division', 'Region', 'State', 'Country'];

const str = (v) => (v === undefined || v === null ? '' : String(v));
const appSetting = (k) => (config.app && config.app[k] !== undefined ? config.app[k] : process.env[k]);
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^~?[\\/]*/, ''));
const rnd = (a, b) => Math.floor(Math.random() * (b - a)) + a;
const sanitize = (s) => String(s).trim().replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

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
  if (ImageBase64Code === null || ImageBase64Code === undefined) throw NRE();
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

// ---- GetBusinessDetails (public, returns the Portal_Master entity) -------------------------------------------
// public
router.all(P + '/GetBusinessDetails{/:id}', asyncHandler(async (req, res) => {
  const PLID = parseInt(req.p.PLID, 10);
  const row = await db.queryOne(DB, 'select * from portal_master where plid = @plid limit 1', { plid: PLID });
  res.json(mapRow(row, PORTAL_MASTER));
}));

// ---- CheckPinCode ---------------------------------------------------------------------------------------
// public
router.all(P + '/CheckPinCode{/:id}', asyncHandler(async (req, res) => {
  try {
    const baseurl = 'http://postalpincode.in/api/pincode/' + str(req.p.PinCode);
    const resp = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x });
    const Result = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    const Obj = JSON.parse(Result);
    if (Obj === null || typeof Obj !== 'object' || Array.isArray(Obj)) throw new Error('Error reading JObject from JsonReader.');
    for (const name of Object.keys(Obj)) {
      if (name === 'PostOffice') {
        const v = Obj[name];
        if (v === null || v === undefined) return res.json(null);
        return res.json((Array.isArray(v) ? v : [v]).map((x) => mapRow(x, POSTAL_PROPS)));
      }
    }
    return res.json(Result);
  } catch (ExpObj) {
    return res.json(' Not Found');
  }
}));

// ---- GetSelectedFrenchiesDetail --------------------------------------------------------------------------
// public
router.all(P + '/GetSelectedFrenchiesDetail{/:id}', asyncHandler(async (req, res) => {
  try {
    const Id = parseInt(req.p.Id, 10);
    if (Number.isNaN(Id)) throw new Error('The parameters dictionary contains a null entry for parameter \'Id\'.');
    const row = await db.queryOne(DB, 'select cast(pmid as int) as pmid, companyname, mobileno, address, title, areaname, pincode, lankmark from distributor_master where pmid = @pmid limit 1', { pmid: Id });
    res.json(row ? mapRow(row, DISTRIBUTOR_PROPS) : null);
  } catch (ExpObj) {
    res.json(' Not Found');
  }
}));

// ---- GetDistributorsBySearch ------------------------------------------------------------------------------
// public
router.all(P + '/GetDistributorsBySearch{/:id}', asyncHandler(async (req, res) => {
  try {
    const search = req.p.search;
    if (search === null || search === undefined) throw NRE();
    const sv = String(search).trim();
    let rows;
    if (sv.trim() === '') {
      rows = await db.query(DB, 'select cast(pmid as int) as pmid,companyname from distributor_master where active = true');
    } else {
      rows = await db.query(DB, "select cast(pmid as int) as pmid,companyname from distributor_master where active = true and companyname like '%' || @search || '%'", { search: sv });
    }
    res.json(mapRows(rows, DISTRIBUTOR_PROPS));
  } catch (ExpObj) {
    res.json(' Not Found');
  }
}));

// ---- GetAutoCompleteDataArea ------------------------------------------------------------------------------
// public (session optional: Cid defaults to 0)
router.all(P + '/GetAutoCompleteDataArea{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (req.user) Cid = parseInt(req.user.cid, 10);
  const Result = await DAL_BusinessListing.GetAreaList(req.p.AreaName, Cid);
  res.json(Result);
}));

// ---- GetAutoCompleteDataPincode ----------------------------------------------------------------------------
// public (session optional)
router.all(P + '/GetAutoCompleteDataPincode{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  let Cid = 0;
  if (req.user) Cid = parseInt(req.user.cid, 10);
  const Result = await DAL_BusinessListing.GetPinCodeList(req.p.Pincode, Cid);
  res.json(Result);
}));

// ---- Index -------------------------------------------------------------------------------------------------
// auth (legacy dereferences Session["Plid"] without a null check => fails without a session)
const Index = asyncHandler(async (req, res) => {
  let CountryId = 0;
  CountryId = Number(req.user.cid);
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword(req.user.plid);
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  const ViewBag = { Country: Math.trunc(CountryId) };
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ Model: Obj, ViewBag });
});
router.all(P + '/Index{/:id}', auth, Index);
// route-config: merchant/freebusinesskeywords
router.all('/merchant/merchant/freebusinesskeywords{/:id}', auth, Index);

// ---- Pinverified -------------------------------------------------------------------------------------------
// public
router.all(P + '/Pinverified{/:id}', asyncHandler(async (req, res) => {
  const { Pincode, StateName } = req.p;
  let result;
  const r = await db.procOne(DB, 'usp_pinverification', { pincode: Pincode });
  const State = str(r ? (('strresult' in r) ? r.strresult : r[Object.keys(r)[0]]) : null);
  await db.queryOne(DB, 'SELECT name FROM pay_mode WHERE active = true LIMIT 1');
  if (State === StateName) result = 'Ok';
  else result = 'Pincode Not valid';
  res.json(result);
}));

// ---- SaveOrUpdateBusinessListing ---------------------------------------------------------------------------
// auth
router.all(P + '/SaveOrUpdateBusinessListing{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const { CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName, Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode,
    NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, CompanyImage, CompanyHeaderImage, ScatId, Pick_State, Pick_City, Pick_Area,
    Pick_Pincode, Pick_Address, Pick_LandMark, GST, TAN, CIN, Country, Pick_Country, ClassificationTypeID, ClassificationDescription,
    AllDeliveryPinCode, Facebook, Twitter, Youtube, Linkdin, Telegram, WhatsappGroupLink, Instagram, WeChat } = p;
  const StoreTypeID = parseInt(p.StoreTypeID, 10);
  let DistributorId = p.DistributorId === undefined || p.DistributorId === null || p.DistributorId === '' ? null : parseInt(p.DistributorId, 10);
  const Plid = Number(req.user.plid);
  if (DistributorId === null || DistributorId === undefined) DistributorId = 0;

  // Company Logo
  let imgname = '';
  if (CompanyImage === null || CompanyImage === undefined) throw NRE();
  if (CompanyImage.trim() !== '') {
    const SavePaths = appSetting('CompanyLogoPath');
    imgname = sanitize(CompanyName) + '-' + Plid + '.jpg';
    const strValidFullName = path.join(mapPath(SavePaths), imgname);
    if (CompanyImage.includes('base64,')) saveBase64Image(CompanyImage, strValidFullName);
    else imgname = CompanyImage.replace(/^\/+/, '');
  }

  // Company Header
  const HeaderImageName = AddTicket_ImageUploadMasterMethod(CompanyHeaderImage, String(appSetting('CompanyHeaderPath')), String(Plid + str(CompanyName).split(' ').join('')));

  const UserName = req.user.username;
  const LoginID = req.user.loginid;

  const Result = await DAL_BusinessListing.SaveBusinessListing(CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName,
    Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode, NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, imgname, String(req.user.plid), HeaderImageName, UserName, LoginID, ScatId,
    Pick_State, Pick_City, Pick_Area, Pick_Pincode, Pick_Address, Pick_LandMark, GST, TAN, CIN, Country, Pick_Country, ClassificationTypeID, ClassificationDescription,
    StoreTypeID, AllDeliveryPinCode, Facebook, Twitter, Youtube, Linkdin, Telegram, WhatsappGroupLink, Instagram, WeChat, DistributorId);
  res.json(Result);
}));

// ---- GetState ---------------------------------------------------------------------------------------------
// public
router.all(P + '/GetState{/:id}', asyncHandler(async (req, res) => {
  let _state = [];
  try {
    _state = mapRows(await db.query(DB, 'select sid,statename from state where cid=96'), ['sid', 'statename']);
  } catch (ex) { /* swallowed in legacy */ }
  res.json(_state);
}));

module.exports = router;
