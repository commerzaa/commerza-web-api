'use strict';
// Ported from Franchise\Controllers\CustomerPanel\Topup_Request.cs  (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Topup_Request';

// public (view only, legacy had no session check)
// route-config: franchisee/TopUp-Request
router.all([P + '/Index{/:id}', '/franchise/franchisee/TopUp-Request'], asyncHandler(async (req, res) => {
  res.json({});
}));

// auth
router.all(P + '/Reseller_Topup_Request{/:id}', auth, asyncHandler(async (req, res) => {
  const did = parseInt(req.user.pmid, 10);
  const loginid = req.user.loginid;
  const q = req.p;
  const { paymode, bankname, branch_name, ref_id, ref_date, mem_remark, IFSC_Code, Banknameid } = q;
  const image = q.image;
  const amount = Number(q.amount);
  if (Number.isNaN(amount)) throw new Error('Input string was not in a correct format.');
  let ImgName = '';
  if (image.trim() !== '' && image.includes('base64,')) {
    const SavePaths = (config.app && config.app.Challan_Image) || '';
    if (image !== '') {
      const GetRandomNumber = Math.floor(Math.random() * (9999 - 1111)) + 1111;
      let ProfileImage = String(loginid).trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      ImgName = ProfileImage + '-' + did + '-' + GetRandomNumber + '.jpg';
    } else {
      ImgName = ' ';
    }
    const r = await UtilityClass.ImageUploadMasterMethod(image, SavePaths, SavePaths, UtilityClass.ImageMode.Original, 'Topup');
    ImgName = r == null ? '' : String(r);
  }
  const o = await db.procOne('shopping', 'usp_reseller_topup_request', {
    PMID: did, AMOUNT: amount, PAYMODE: paymode, BankName: bankname, Branch_Name: branch_name, REFERANCE_ID: ref_id, REFERANCE_DATE: ref_date,
    IMAGE: ImgName, MEM_REMARK: mem_remark, STATUS: '1', IFSC_Code, Banknameid,
  });
  const k = o && Object.keys(o).find((x) => x.toLowerCase() === 'result');
  const resv = k ? String(o[k]) : (o ? String(o[Object.keys(o)[0]]) : '');
  res.json(resv);
}));

module.exports = router;
