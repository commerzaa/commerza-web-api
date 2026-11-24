'use strict';
/** Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Product_Upload_Image.cs (Product_Upload_ImageController). DB: 'shopping' (Db_Shopping) */
const express = require('express');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Product_Upload_Image';
const upload = multer({ storage: multer.memoryStorage() });
// Web.config: OriginalProductImage=../Product_Images_Large, SemiLargeProductImage=../Product_Images_SemiLarge, ThumbNailProductImage=../Product_Images
const OriginalImageFolder = config.app.OriginalProductImage;
const SemiLargeImageFolder = config.app.SemiLargeProductImage || 'Product_Images_SemiLarge';
const ThumbNailImageFolder = config.app.ThumbNailProductImage;
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** value.ToString("yyyyMMddHHmmssfff") */
function GetTimestamp(d) {
  return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()) + pad(d.getMilliseconds(), 3);
}
/** Convert.ToInt64(string) */
function toInt64(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).trim());
  if (!Number.isInteger(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

async function saveImage(imgecode, titlename, SellerCode) {
  let returnfilename = '';
  const IdForAppend = path.parse(String(titlename).trim()).name; // Path.GetFileNameWithoutExtension
  if (imgecode.trim() !== '' && imgecode.includes('base64,')) {
    const getnewfilename = await UtilityClass.ImageUploadMasterMethodECommNew(imgecode, OriginalImageFolder, SemiLargeImageFolder, ThumbNailImageFolder, UtilityClass.ImageMode.Both, IdForAppend);
    if (String(getnewfilename).trim() !== '') {
      returnfilename = returnfilename.trim() === '' ? getnewfilename : returnfilename + '^' + getnewfilename;
    }
  } else if (imgecode.trim() !== '' && !imgecode.includes('base64,')) {
    const b = path.basename(imgecode.replace(/\\/g, '/'));
    returnfilename = returnfilename.trim() === '' ? b : returnfilename + '^' + b;
  }
  return returnfilename;
}

// ---- Index -------------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  const p = req.p;
  let MAINCATID = p.MAINCATID, CATID = p.CATID, SUBCATID = p.SUBCATID;
  const ViewBag = { MAINCATID: '0', SUBCATID: '0', CATID: '0' };
  if (MAINCATID === '' || MAINCATID == null) MAINCATID = '0'; else ViewBag.MAINCATID = MAINCATID;
  if (CATID === '' || CATID == null) CATID = '0'; else ViewBag.CATID = CATID;
  if (SUBCATID === '' || SUBCATID == null) SUBCATID = '0'; else ViewBag.SUBCATID = SUBCATID;
  const MaxRows = await UtilityClass.GridPageSize();
  let page = p.page === undefined || p.page === null || p.page === '' ? null : parseInt(p.page, 10);
  if (page == null) page = 1;
  void MaxRows;
  sessionStore.set(req, 'Groupid', null);
  // long Groupid = (long)(rand.NextDouble() * 1000000000) + 100000000000000000;
  const Groupid = String(BigInt(Math.floor(Math.random() * 1000000000)) + 100000000000000000n);
  sessionStore.set(req, 'Groupid', Groupid);
  res.json({ ViewBag, Groupid });
});
// auth (the legacy page needs the logged in merchant session)
router.all(P + '/Index{/:id}', auth, indexHandler);
// route-config: merchant/product-upload-image/{MAINCATID}/{CATID}/{SUBCATID}
router.all([
  '/merchant/merchant/product-upload-image',
  '/merchant/merchant/product-upload-image/:MAINCATID',
  '/merchant/merchant/product-upload-image/:MAINCATID/:CATID',
  '/merchant/merchant/product-upload-image/:MAINCATID/:CATID/:SUBCATID',
], auth, indexHandler);

// ---- Upload ------------------------------------------------------------------------------------------------
// auth
router.all(P + '/Upload{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  let isSavedSuccessfully = true;
  let fName = '';
  try {
    const p = req.p;
    const MAINCATID = p.MAINCATID, CATID = p.CATID, SUBCATID = p.SUBCATID;
    for (const file of (req.files || [])) {
      fName = file.originalname;
      const sellercode = String(req.user.plid);
      const bytes = file.buffer;
      let base64String = bytes.toString('base64');
      base64String = 'data:image/png;base64,' + base64String;
      if (file && file.size > 0) {
        const unixTimestamp = GetTimestamp(new Date());
        const Imagename = req.user.loginid + '_' + req.user.plid + '_' + unixTimestamp + '_' + String(file.originalname).replace(/\+/g, '-');
        const Fileimagename = await saveImage(base64String, Imagename, sellercode);
        const gid = sessionStore.get(req, 'Groupid');
        await procOne(DB, 'usp_multipleimageforproduct', {
          startrowindex: '', maxrows: '', searchfield: '', searchvalue: '', fromdate: '', todate: '', imagename: file.originalname, url: Fileimagename,
          mode: '1', maincatid: toInt64(MAINCATID), catid: toInt64(CATID), subcatid: toInt64(SUBCATID),
          groupid: String(gid === null || gid === undefined || gid === '' ? 0 : BigInt(gid)), plid: req.user.plid,
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
