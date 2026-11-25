'use strict';
/**
 * Port of Merchant Panel Controllers/PhotoGallery.cs (PhotoGalleryController) - 4 public actions:
 * Index, GetImageName, UploadPic, SaveUploadImages. DB: Db_Shopping => 'shopping'
 * Derived from src/modules/franchise/PhotoGallery.js; merchant differences: Index reads Session Plid (not DID) and
 * EF _Portal_Master maps to table PORTAL_MASTER (Franchise mapped it to DISTRIBUTOR_MASTER).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CS = require('../../lib/merchant/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;
const PG = require('../../lib/merchant/PhotoGallery');
const PhotoGallary = PG.PhotoGallary || PG;

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/PhotoGallery';
const VIEW = '~/Views/PhotoGallery/Index.cshtml';

const app = (k) => (config.app && config.app[k]) || '';
// private fields of the controller (AppSettings); portalgalleryfolder is declared but never used in the C#
const strValidOriginalName = () => app('OriginalImage');
const strValidThumbnailName = () => app('ThumbNailImage');
// Server.MapPath("<folder>") equivalent: folder under the upload dir
const mapPath = (p) => path.join(config.uploadDir, path.basename(String(p || '')));
const rep = (s, a, b) => s.split(a).join(b); // C# string.Replace (all occurrences)
const isNullOrEmpty = (s) => s === null || s === undefined || s === '';
const trimChar = (s, c) => { let a = 0; let b = s.length; while (a < b && s[a] === c) a++; while (b > a && s[b - 1] === c) b--; return s.slice(a, b); };
const toInt32 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.'); return parseInt(t, 10); };
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// public void GetImageName(Int64 pmidstr) - fills ViewBag
async function getImageNameData(pmidstr) {
  const ViewBag = {};
  const g = await db.queryOne(DB, 'select imagename from portalmember_photogallery where pmid=@pmid limit 1', { pmid: pmidstr });
  const m = await db.queryOne(DB, 'select companyimage, companyname from portal_master where pmid=@pmid limit 1', { pmid: pmidstr });
  let imageName = g ? g.imagename : null;
  const companyImage = m ? m.companyimage : null;
  const companyname = m ? m.companyname : null;
  if (isNullOrEmpty(imageName)) imageName = '';
  if (imageName.trim() === '.' || imageName.trim() === '^' || imageName.trim() === ',') imageName = '';
  if (imageName.trim() !== '') {
    imageName = '../PortalPictureGallery/' + imageName;
    imageName = rep(imageName, ',', '^../PortalPictureGallery/');
  }
  ViewBag.TXTIMAGES = imageName;
  ViewBag.COMPANYIMAGE = companyImage;
  ViewBag.LBLBUSINESSNAME = companyname;
  return ViewBag;
}

// route-config: merchant/photogallery -> PhotoGallery/Index
// public/optional auth: legacy returned the (empty) view when Session["Plid"] == null instead of redirecting
router.all([P + '/Index{/:id}', '/merchant/photogallery{/:id}', '/merchant/merchant/photogallery{/:id}'], optionalAuth, asyncHandler(async (req, res) => {
  if (!req.user) return res.json({ view: VIEW, ViewBag: {} });
  const Plid = parseInt(req.user.plid, 10);
  const r = await db.queryOne(DB, 'select pmid from portal_master where plid=@plid and active=true limit 1', { plid: Plid });
  const Pmid = r ? r.pmid : 0;
  const ViewBag = { PMID: Pmid };
  Object.assign(ViewBag, await getImageNameData(Pmid));
  ViewBag.TITLE = 'Edit Businesslisiting Details | ' + CompanySettings.CompanyURL + '';
  res.json({ view: VIEW, ViewBag, ...ViewBag });
}));

// auth (public void action in legacy, no session check; reads business-listing data)
router.all(P + '/GetImageName{/:id}', auth, asyncHandler(async (req, res) => {
  const v = req.p.pmidstr;
  if (v === undefined || v === null || v === '') throw new Error("The parameters dictionary contains a null entry for parameter 'pmidstr'");
  const ViewBag = await getImageNameData(toInt32(v));
  res.json({ ViewBag, ...ViewBag });
}));

async function SaveUploadImages(imageData, SavePaths, IMAGEFOR, CompanyName) {
  if (imageData === null || imageData === undefined) throw NRE();
  if (IMAGEFOR === null || IMAGEFOR === undefined) IMAGEFOR = '';
  if (CompanyName === null || CompanyName === undefined) CompanyName = '';
  let imgname = ''; let pmids = ''; let i = 0; let forDelete = '';
  let strFileName = ''; let OldDataImages = ''; let deleteimage = ''; let forTitleUpdate = ''; let updateImages = ''; let strTitle = '';
  let imageType = ''; let originalimage = '';
  const getname = String(imageData).split('^');
  pmids = String(getname[0]);
  if (pmids.includes('D')) {
    if (getname[1] === undefined) throw new RangeError('Index was outside the bounds of the array.');
    deleteimage = String(getname[1]);
    deleteimage = rep(deleteimage, '../PortalPictureGallery/', '');
    deleteimage = rep(deleteimage, '&amp;', '');
    deleteimage = rep(deleteimage, '-&-;', '-');
    deleteimage = deleteimage.trim();
    const getsplit = pmids.split('D');
    pmids = String(getsplit[1]);
    forDelete = String(getsplit[0]);
  } else if (pmids.includes('TU')) {
    if (getname[1] === undefined || getname[2] === undefined) throw new RangeError('Index was outside the bounds of the array.');
    updateImages = String(getname[1]);
    updateImages = rep(updateImages, '../PortalPictureGallery/', '');
    updateImages = updateImages.trim();
    strTitle = String(getname[2]).trim();
    pmids = rep(pmids, 'TU', '');
    pmids = pmids.trim();
    forTitleUpdate = pmids;
  } else {
    forDelete = '';
    forTitleUpdate = '';
  }

  imgname = pmids;
  const pmid = toInt32(pmids);
  if (String(IMAGEFOR).trim() === 'companyImages') {
    const g = await db.queryOne(DB, 'select imagename from portalmember_photogallery where pmid=@pmid limit 1', { pmid });
    OldDataImages = g ? g.imagename : null;
    if (isNullOrEmpty(OldDataImages)) OldDataImages = '';
    if (OldDataImages.trim() === ',' || OldDataImages.trim() === '.' || OldDataImages.trim() === '^') OldDataImages = '';
    OldDataImages = rep(OldDataImages, ',,', '');
    strFileName = OldDataImages;
  }
  if (forDelete.trim() !== '') {
    if (deleteimage.trim() !== '') {
      OldDataImages = rep(OldDataImages, '&amp;', '');
      OldDataImages = rep(OldDataImages, '-&-;', '-');
      OldDataImages = rep(OldDataImages, deleteimage, '');
      OldDataImages = rep(OldDataImages, ',,', ',');
    }
    if (deleteimage.includes('!')) {
      deleteimage = deleteimage.split('!')[0];
    }
    const strValidFullName = mapPath(strValidOriginalName()) + '/' + deleteimage;
    const strValidFullName1 = mapPath(strValidThumbnailName()) + '/' + deleteimage;
    if (fs.existsSync(strValidFullName) && fs.statSync(strValidFullName).isFile()) fs.unlinkSync(strValidFullName);
    if (fs.existsSync(strValidFullName1) && fs.statSync(strValidFullName1).isFile()) fs.unlinkSync(strValidFullName1);
    strFileName = OldDataImages;
    return OldDataImages;
  } else if (forTitleUpdate.trim() !== '') {
    let oldData = updateImages;
    if (updateImages.trim() !== '') {
      if (updateImages.includes('!')) {
        updateImages = updateImages.split('!')[0];
      }
      let newImagewithTitle = '';
      if (strTitle.trim() !== '') newImagewithTitle = updateImages + '!' + strTitle; else newImagewithTitle = updateImages;
      if (oldData.includes('-&-')) oldData = rep(oldData, '-&-', '-&amp;-');
      const getsplitdate = OldDataImages.split(',');
      newImagewithTitle = '';
      for (const items of getsplitdate) {
        if (items.trim() !== '') {
          if (items.includes(updateImages)) {
            if (newImagewithTitle.trim() === '') newImagewithTitle = updateImages + '!' + strTitle;
            else newImagewithTitle = newImagewithTitle + ',' + updateImages + '!' + strTitle;
          } else if (newImagewithTitle.trim() === '') newImagewithTitle = items.trim();
          else newImagewithTitle = newImagewithTitle + ',' + items.trim();
        }
      }
      OldDataImages = newImagewithTitle;
      OldDataImages = rep(OldDataImages, ',,', ',');
    }
    strFileName = OldDataImages;
    return OldDataImages;
  } else {
    OldDataImages = trimChar(OldDataImages.trim(), ',').trim();
    if (OldDataImages.trim() !== '') {
      if (OldDataImages.includes(',')) {
        const lastindex = OldDataImages.lastIndexOf(',');
        OldDataImages = OldDataImages.slice(lastindex + 1);
      }
      if (pmids === '') throw new Error('String cannot be of zero length.');
      OldDataImages = rep(OldDataImages, pmids, '');
      OldDataImages = rep(OldDataImages, '_', '-');
      OldDataImages = rep(OldDataImages, CompanyName + '-', '');
      OldDataImages = rep(OldDataImages, '.jpg', '');
      if (OldDataImages.includes('!')) {
        OldDataImages = OldDataImages.split('!')[0];
        originalimage = OldDataImages;
      }
      if (OldDataImages.includes('.')) {
        const lastindex = OldDataImages.lastIndexOf('.');
        OldDataImages = OldDataImages.substring(0, lastindex);
      }
      if (isNullOrEmpty(OldDataImages)) OldDataImages = '0';
      i = i + 1;
      imageType = '';
    } else {
      imageType = '';
      i = 0;
    }
    let k = 0;
    for (const Items of getname) {
      if (Items.trim() !== '') {
        if (k === 0) {
          k = 1;
        } else if (i > 200) {
          return strFileName;
        } else {
          let ImageId = '';
          if (imageType.trim() === '') ImageId = CompanyName + '-' + imgname + String(i);
          else ImageId = CompanyName + '-' + originalimage + String(i);
          ImageId = await UtilityClass.ImageUploadMasterMethod(Items, strValidOriginalName(), strValidThumbnailName(), UtilityClass.ImageMode.Both, ImageId);
          let imagetitel = rep(CompanyName, '-', ' ');
          imagetitel = imagetitel.trim() + ' photo ' + i;
          if (strFileName.trim() === '') strFileName = ImageId + '!' + imagetitel.trim();
          else strFileName = strFileName + ',' + ImageId + '!' + imagetitel.trim();
        }
        i = i + 1;
      }
    }
  }
  return strFileName;
}

// auth (legacy: no session check; mutates the merchant's photo gallery)
router.all(P + '/UploadPic{/:id}', auth, asyncHandler(async (req, res) => {
  let { IMAGEDATA } = req.p;
  const { PMIDPARAM } = req.p;
  let pmid = 0;
  if (PMIDPARAM != null && PMIDPARAM !== '') pmid = toInt32(PMIDPARAM);
  if (pmid <= 0) return res.json('expired');
  if (IMAGEDATA === null || IMAGEDATA === undefined) throw NRE();
  let companyName = '';
  const splitcompanyName = String(IMAGEDATA).split('~');
  if (splitcompanyName.length > 1) {
    companyName = splitcompanyName[0];
    companyName = rep(companyName, ' ', 'UQQU');
    companyName = rep(companyName, '&amp;', ' And ');
    companyName = rep(companyName, '&', ' And ');
    companyName = companyName.replace(/[^\w\d]/g, ' ');
    companyName = rep(companyName, 'UQQU', ' ');
    companyName = rep(companyName, ' ', '-');
    IMAGEDATA = splitcompanyName[1];
  }
  // companyName is computed but (as in legacy) SaveUploadImages is called with CompanyName ""
  const SavePaths = app('FolderPath');
  let GetAllImagesNames = await SaveUploadImages(IMAGEDATA, SavePaths, 'companyImages', '');
  if (GetAllImagesNames.trim() === '' || GetAllImagesNames.trim() === ',' || GetAllImagesNames.trim() === '^') GetAllImagesNames = '';
  // legacy: empty if-block on GetAllImagesNames.Substring(0, 1) == ","
  GetAllImagesNames = rep(GetAllImagesNames, ',,', '');
  const obj = new PhotoGallary();
  const str = await obj.InsertPhoto(String(GetAllImagesNames), pmid);
  res.json(str);
}));

// auth (public string action in the legacy controller; returned as text/plain like an MVC string action)
router.all(P + '/SaveUploadImages{/:id}', auth, asyncHandler(async (req, res) => {
  const { imageData, SavePaths, IMAGEFOR, CompanyName } = req.p;
  const r = await SaveUploadImages(imageData, SavePaths, IMAGEFOR, CompanyName);
  res.type('text/plain').send(r);
}));

module.exports = router;
