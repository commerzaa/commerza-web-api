'use strict';
// Ported from Member\Controllers\CustomerPanel\PurchasePackageController.cs (3 actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const DB = 'affiliate';
const P = '/member/PurchasePackage';
const col = (row, name) => { const k = row && Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k !== undefined ? row[k] : undefined; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}
const NRE = () => new Error('Object reference not set to an instance of an object.');

// PayByPayYouMoney is a public method of the controller (an MVC action returning a string); also used internally.
async function PayByPayYouMoney(req, KitId) {
  let ReturnOutput = 'PayYouMoney';
  try {
    const Obj = await db.procOne(DB, 'Usp_PayByPayuMoneyPackage', { RegNo: parseInt(req.user.plid, 10), KitId });
    const mapped = Obj ? mapRows([Obj], ['Regno', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'ChallanImage', 'BankName', 'BranchName',
      'ReferenceDate', 'ReferenceNumber', 'TransactionPassword', 'GoogleAuthenticationCode', 'WalletId', 'AllPackageId', 'AllPackageType', 'AllPackageAmount',
      'AllPackageName', 'NOOFATCCOIN', 'InvestMentInINR', 'UserName'])[0] : null;
    sessionStore.set(req, 'PaymentForOrder', mapped); // Session["PaymentForOrder"] = Obj
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'Usp_PayByPayuMoneyPackage', req);
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return ReturnOutput;
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const PLID = parseInt(req.user.plid, 10);
  const rows = await db.proc(DB, 'Usp_KitBoxManagement', { Mode: 1, RegNo: PLID });
  const LKitDetailsForBind = mapRows(rows, ['RowNumber', 'Kid', 'Image', 'KItCode', 'Title', 'Amount', 'ServiceTax', 'PayableAmount', 'Pv', 'ROI', 'NoOfMonth',
    'AllFeatureList', 'BoxColor']);
  res.json({ PLID, Model: { LKitDetailsForBind } });
}));

// auth (uses the logged-in member session)
router.all(P + '/PurchaseKitOrPackage{/:id}', auth, asyncHandler(async (req, res) => {
  const { PackageIdForRegistration, PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber } = req.p;
  let ReturnOutput = 'success';
  const RegNo = parseInt(req.user.plid, 10);
  if (PaymentMode === '2') {
    const kit = parseInt(PackageIdForRegistration, 10);
    if (Number.isNaN(kit)) throw new Error('Input string was not in a correct format.');
    ReturnOutput = await PayByPayYouMoney(req, kit);
    return res.json(ReturnOutput);
  }
  try {
    const loginid = String(req.user.loginid === undefined || req.user.loginid === null ? '' : req.user.loginid);
    // Challen
    let Imgchallen = '';
    if (ChallanImage === undefined || ChallanImage === null) throw NRE();
    if (String(ChallanImage).trim() !== '') {
      const SavePaths = config.app.ChallenImagePath || '';
      let base64String = String(ChallanImage);
      let ChallenImage = loginid.trim();
      ChallenImage = ChallenImage.split('&amp;').join('And');
      ChallenImage = ChallenImage.split('&').join(' And ');
      ChallenImage = ChallenImage.replace(/[^\w\d]/g, '');
      ChallenImage = ChallenImage.split(' ').join('-');
      Imgchallen = ChallenImage + '-' + RegNo + '.jpg';
      const dir = path.join(config.uploadDir, String(SavePaths).replace(/^(\.\.\/|~\/|\/)+/, ''));
      fs.mkdirSync(dir, { recursive: true });
      const strValidFullName = path.join(dir, Imgchallen);
      if (base64String.includes('base64,')) base64String = base64String.substring(base64String.indexOf(',') + 1);
      const b = Buffer.from(base64String, 'base64');
      const filesize = b.length / 1024;
      if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
      let out = b;
      if (filesize > 10) {
        // PORT-NOTE: legacy halved width/height via System.Drawing GetThumbnailImage and re-saved; needs `sharp` (not installed, required lazily).
        // If sharp is not available the original image bytes are saved unchanged.
        try {
          const sharp = require('sharp');
          const meta = await sharp(b).metadata();
          out = await sharp(b).resize(Math.trunc(meta.width * 0.5), Math.trunc(meta.height * 0.5)).jpeg().toBuffer();
        } catch (e) { out = b; }
      }
      fs.writeFileSync(strValidFullName, out);
    }
    const r = await db.procOne(DB, 'Usp_ManagePackage', {
      PackageIdForRegistration, PaymentMode, ModeName, CommentORRemark, RegNo, ImageName: Imgchallen, IsPayItForward: '0', BankName, BranchName,
      ReferenceDate, ReferenceNumber,
    });
    const v = col(r, 'IntResult');
    ReturnOutput = v === undefined || v === null ? '' : String(v);
  } catch (ExpObj) {
    console.error(ExpObj.message);
    await errorInsert(ExpObj, 'Usp_ManagePackage', req);
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return res.json(ReturnOutput);
}));

// auth (public method in C#, returns string => text/plain)
router.all(P + '/PayByPayYouMoney{/:id}', auth, asyncHandler(async (req, res) => {
  const KitId = parseInt(req.p.KitId, 10);
  if (Number.isNaN(KitId)) return res.status(400).json({ message: "The parameters dictionary contains a null entry for parameter 'KitId'" });
  res.type('text/plain').send(await PayByPayYouMoney(req, KitId));
}));

module.exports = router;
