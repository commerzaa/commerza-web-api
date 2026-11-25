'use strict';
/** Port of Franchise/Controllers/CustomerPanel/Product_Upload_Image.cs. DB: 'shopping' */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const upload = multer({ storage: multer.memoryStorage() });
const OriginalImageFolder = config.app.OriginalProductImages;
const ThumbNailImageFolder = config.app.ThumbNailProductImages;
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** value.ToString("yyyyMMddHHmmssfff") */
function GetTimestamp(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + pad(d.getMilliseconds(), 3);
}

async function saveImage(imgecode, titlename, SellerCode) {
  titlename = String(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  const getcolltionimage = String(imgecode).split('^');
  for (const Items of getcolltionimage) {
    const IdForAppend = SellerCode + '_' + titlename.trim();
    if (Items.trim() !== '' && Items.includes('base64,')) {
      const getnewfilename = await UtilityClass.ImageUploadMasterMethodEComm(Items, OriginalImageFolder, ThumbNailImageFolder, UtilityClass.ImageMode.Both, IdForAppend);
      if (String(getnewfilename).trim() !== '') {
        returnfilename = returnfilename.trim() === '' ? getnewfilename : returnfilename + '^' + getnewfilename;
      }
    } else if (Items.trim() !== '' && !Items.includes('base64,')) {
      const b = path.basename(Items.replace(/\\/g, '/'));
      returnfilename = returnfilename.trim() === '' ? b : returnfilename + '^' + b;
    }
  }
  return returnfilename;
}

// auth (legacy action had no explicit check but reads Session["Plid"] in Upload; Index is a page action)
router.all('/franchise/Product_Upload_Image/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let MAINCATID = p.MAINCATID, CATID = p.CATID, SUBCATID = p.SUBCATID;
  const ViewBag = { MAINCATID: '0', SUBCATID: '0', CATID: '0' };
  if (MAINCATID === '' || MAINCATID == null) MAINCATID = '0'; else ViewBag.MAINCATID = MAINCATID;
  if (CATID === '' || CATID == null) CATID = '0'; else ViewBag.CATID = CATID;
  if (SUBCATID === '' || SUBCATID == null) SUBCATID = '0'; else ViewBag.SUBCATID = SUBCATID;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  if (page == null) page = 1;
  sessionStore.set(req, 'Groupid', null);
  const Groupid = Math.floor(Math.random() * 1000000000) + 100000000000000000;
  sessionStore.set(req, 'Groupid', String(Groupid));
  res.json({ ViewBag, Groupid: String(Groupid) });
}));

// auth
router.all('/franchise/Product_Upload_Image/Upload{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  let isSavedSuccessfully = true;
  let fName = '';
  try {
    const p = req.p;
    const MAINCATID = p.MAINCATID, CATID = p.CATID, SUBCATID = p.SUBCATID;
    for (const file of (req.files || [])) {
      fName = file.originalname;
      fName = await saveImage(fName, '', '');
      if (file && file.size > 0) {
        const unixTimestamp = GetTimestamp(new Date());
        const Imagename = req.user.loginid + '_' + req.user.did + '_' + unixTimestamp + '_' + file.originalname;
        const pathString = path.join(config.uploadDir, 'Product_Images_Large');
        fs.mkdirSync(pathString, { recursive: true });
        fs.writeFileSync(path.join(pathString, Imagename), file.buffer);
        const pathString1 = path.join(config.uploadDir, 'Product_Images');
        fs.mkdirSync(pathString1, { recursive: true });
        fs.writeFileSync(path.join(pathString1, Imagename), file.buffer);

        await procOne(DB, 'usp_multipleimageforproduct', {
          startrowindex: '', maxrows: '', searchfield: '', searchvalue: '', fromdate: '', todate: '', imagename: file.originalname, url: Imagename,
          mode: '1', maincatid: parseInt(MAINCATID, 10), catid: parseInt(CATID, 10), subcatid: parseInt(SUBCATID, 10),
          groupid: String(parseInt(sessionStore.get(req, 'Groupid'), 10) || 0), plid: req.user.did,
        });
      }
    }
  } catch (ex) {
    isSavedSuccessfully = false;
  }
  if (isSavedSuccessfully) return res.json({ Message: fName });
  return res.json({ Message: 'Error in saving file' });
}));

module.exports = router;
