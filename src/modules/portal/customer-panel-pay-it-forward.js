'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PayItForward.cs (class PayItForwardController => /portal/PayItForward/...)
// Database: shopping (Db_Shopping). KitMasterDetails is a model class only (no routes).
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, s, nStr, rep, mapPath, replaceNonWord, saveChallanImage } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/PayItForward';

/** class OnlinePaymentForPackage (Controllers/CustomerPanel/MakePaymentForPackageController.cs) */
const OnlinePaymentForPackage = ['Regno', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'ChallanImage', 'BankName', 'BranchName',
  'ReferenceDate', 'ReferenceNumber', 'TransactionPassword', 'GoogleAuthenticationCode', 'WalletId', 'AllPackageId', 'AllPackageType', 'AllPackageAmount',
  'AllPackageName'];

const NRE_MSG = 'Object reference not set to an instance of an object.';

/** public string PayByPayYouMoney(string KitId) */
async function PayByPayYouMoney(req, KitId) {
  let ReturnOutput = 'PayYouMoney';
  try {
    if (!ps.isCustomer(req)) throw new TypeError(NRE_MSG); // (Login)Session["Plid"] null
    const rows = await db.proc(DB, 'usp_paybypayumoneypackage', { RegNo: Math.round(Number(req.user.plid)), KitId });
    const Obj = rows && rows[0] ? mapRow(rows[0], OnlinePaymentForPackage) : null;
    ps.sessionSet(req, 'PaymentForOrder', Obj);
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return ReturnOutput;
}

// ---------------------------------------------------------------- Index()
// public (no session check in legacy)
router.all([`${C}/Index{/:id}`, C], ps.portalSession, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/PayItForward/Index.cshtml' });
}));

// ---------------------------------------------------------------- PayItForwardMethod(...)
// auth (legacy cast (Login)Session["Plid"] outside the try => NullReferenceException without a session)
router.all(`${C}/PayItForwardMethod{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = (k) => nStr(req.p[k]);
  const AllRegNo = p('AllRegNo'); const AllLoginId = p('AllLoginId'); const AllKitID = p('AllKitID'); const AllKitName = p('AllKitName');
  const PaymentMode = p('PaymentMode'); const ModeName = p('ModeName'); const CommentORRemark = p('CommentORRemark'); const ChallanImage = p('ChallanImage');
  const Amount = p('Amount'); const BankName = p('BankName'); const BranchName = p('BranchName'); const ReferenceDate = p('ReferenceDate');
  const ReferenceNumber = p('ReferenceNumber');
  let ReturnOutput = 'success';
  let strValidFullName = '';
  const RegNo = Math.round(Number(req.user.plid));
  if (PaymentMode === '2') {
    ReturnOutput = await PayByPayYouMoney(req, AllKitID);
    return res.json(ReturnOutput);
  }
  try {
    const loginid = s(req.user.loginid);
    // #region Challen
    let Imgchallen = '';
    if (ChallanImage === null) throw new TypeError(NRE_MSG);
    if (ChallanImage.trim() !== '') {
      let base64String = '';
      const SavePaths = (config.app.ChallenImagePath || '');
      if (ChallanImage !== '') {
        base64String = ChallanImage;
        let ChallenImage = loginid;
        ChallenImage = ChallenImage.trim();
        ChallenImage = rep(ChallenImage, '&amp;', 'And');
        ChallenImage = rep(ChallenImage, '&', ' And ');
        ChallenImage = replaceNonWord(ChallenImage, '');
        ChallenImage = rep(ChallenImage, ' ', '-');
        Imgchallen = ChallenImage + '-' + RegNo + '_' + s(AllKitName) + '.jpg';
      } else {
        Imgchallen = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + Imgchallen;
      await saveChallanImage(base64String, strValidFullName);
    }
    // #endregion Challen
    // PORT-NOTE: Usp_ManagePayItForward is not in the Db_Shopping schema dump; called with the parameter names of the C# command text.
    const r = await db.procOne(DB, 'usp_managepayitforward', {
      AllRegNo, AllLoginId, AllKitID, AllKitName, PaymentMode, ModeName, CommentORRemark, RegNo, ImageName: Imgchallen, Amount,
      BankName, BranchName, ReferenceDate, ReferenceNumber,
    });
    ReturnOutput = s(r && r.intresult);
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return res.json(ReturnOutput);
}));

// ---------------------------------------------------------------- PayByPayYouMoney(string KitId)  (public string action)
// auth (in-handler): without a session the legacy cast threw inside its try => body "Some Exception Occur : Object reference ..."
router.all(`${C}/PayByPayYouMoney{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const r = await PayByPayYouMoney(req, nStr(req.p.KitId));
  res.type('text/html').send(r);
}));

module.exports = router;
