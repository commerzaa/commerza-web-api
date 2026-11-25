'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Uploded_Image.cs (controller class Product_Upload_ImagesController; database: shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Product_Upload_Images';

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  let { page, GROUPID } = req.p;
  const MaxRows = await UtilityClass.GridPageSize();
  page = (page == null || page === '') ? 1 : parseInt(page, 10);
  if (GROUPID === '' || GROUPID == null) GROUPID = '0';
  const plid = req.user.did;
  if (!/^[+-]?\d+$/.test(String(GROUPID).trim())) throw new Error('Input string was not in a correct format.');
  const rows = await db.proc('shopping', 'usp_multipleimageforproduct', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', IMAGENAME: '', URL: '', MODE: '2',
    GROUPID: parseInt(GROUPID, 10), PLID: plid,
  });
  const ProductUploadImageList = mapRows(rows, ['ROWNUMBER', 'IMAGENAME', 'URL', 'GROUPID']);
  const k = rows[0] && Object.keys(rows[0]).find((x) => x.toLowerCase() === 'totalrecord');
  const TotalRecord = k ? rows[0][k] : null;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, GROUPID, TotalRecord: parseInt(TotalRecord == null ? '0' : String(TotalRecord), 10),
    NoPerPage: await UtilityClass.GridNumbersPerPage(), ProductUploadImageList,
  };
  res.json({ ViewBag, ...ViewBag });
}));

module.exports = router;
