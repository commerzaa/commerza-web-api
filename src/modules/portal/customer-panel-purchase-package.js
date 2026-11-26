// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/PurchasePackageController.cs (PurchasePackageController => /portal/PurchasePackage/...)
'use strict';
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, NRE, s, outCol, toInt32, bindInt, rep, saveChallanImage } = require('./_shared/batch-24-common');
const { mapPath, replaceNonWord } = require('./_shared/batch-07-common');

const router = express.Router();
const P = '/portal/PurchasePackage';

/** class KitDetailsForBind */
const KIT_DETAILS = ['RowNumber', 'Kid', 'Image', 'KItCode', 'Title', 'Amount', 'ServiceTax', 'PayableAmount', 'Pv', 'ROI', 'NoOfMonth',
  'AllFeatureList', 'BoxColor'];
/** class OnlinePaymentForPackage (Controllers/CustomerPanel/MakePaymentForPackageController.cs) */
const OnlinePaymentForPackage = ['Regno', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'ChallanImage', 'BankName', 'BranchName',
  'ReferenceDate', 'ReferenceNumber', 'TransactionPassword', 'GoogleAuthenticationCode', 'WalletId', 'AllPackageId', 'AllPackageType', 'AllPackageAmount',
  'AllPackageName'];
const nStr = (v) => (v === undefined || v === '' ? null : v); // MVC string binding

/** public string PayByPayYouMoney(int KitId) */
async function PayByPayYouMoney(req, KitId) {
  let ReturnOutput = 'PayYouMoney';
  try {
    if (!ps.isCustomer(req)) throw NRE(); // (Login)Session["Plid"] null
    const rows = await db.proc(DB, 'usp_paybypayumoneypackage', { RegNo: toInt32(Number(req.user.plid)), KitId });
    const Obj = rows && rows[0] ? mapRow(rows[0], OnlinePaymentForPackage) : null;
    ps.sessionSet(req, 'PaymentForOrder', Obj); // Session["PaymentForOrder"] = (OnlinePaymentForPackage)Obj
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return ReturnOutput;
}

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`${P}/Index{/:id}`, P], ps.customerAuth, asyncHandler(async (req, res) => {
  const LoginId = s(req.user.loginid); // eslint-disable-line no-unused-vars
  const PLID = Number(req.user.plid);
  // PORT-NOTE: the C# text "[DBO].[Usp_KitBoxManagement] @Mode,@RegNo" is positional, so the RegNo value fills the proc's @PLID.
  const rows = await db.proc(DB, 'usp_kitboxmanagement', { Mode: 1, PLID: toInt32(PLID) });
  const Obj = { LKitDetailsForBind: mapRows(rows, KIT_DETAILS) };
  return res.json({ view: '~/Views/CustomerPanel/PurchasePackage/Index.cshtml', Model: Obj, PLID });
}));

// ---------------------------------------------------------------- PurchaseKitOrPackage(...)
// auth (RegNo = (Login)Session["Plid"] cast outside the try)
router.all(`${P}/PurchaseKitOrPackage{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = (k) => nStr(req.p[k]);
  const PackageIdForRegistration = p('PackageIdForRegistration'); const PaymentMode = p('PaymentMode'); const ModeName = p('ModeName');
  const CommentORRemark = p('CommentORRemark'); const ChallanImage = p('ChallanImage'); const BankName = p('BankName');
  const BranchName = p('BranchName'); const ReferenceDate = p('ReferenceDate'); const ReferenceNumber = p('ReferenceNumber');
  let ReturnOutput = 'success';
  let strValidFullName = '';
  const RegNo = toInt32(Number(req.user.plid));
  if (PaymentMode === '2') {
    ReturnOutput = await PayByPayYouMoney(req, toInt32(PackageIdForRegistration)); // Convert.ToInt32(string) outside try
    return res.json(ReturnOutput);
  }
  try {
    const loginid = s(req.user.loginid);
    // #region Challen
    let Imgchallen = '';
    if (ChallanImage === null) throw NRE(); // ChallanImage.Trim()
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
        Imgchallen = ChallenImage + '-' + RegNo + '.jpg';
      } else {
        Imgchallen = ' ';
      }
      strValidFullName = mapPath(SavePaths) + '/' + Imgchallen;
      await saveChallanImage(base64String, strValidFullName);
    }
    // #endregion Challen
    const r = await db.procOne(DB, 'usp_managepackage', {
      PackageIdForRegistration, PaymentMode, ModeName, CommentORRemark, RegNo, ImageName: Imgchallen, IsPayItForward: '0',
      BankName, BranchName, ReferenceDate, ReferenceNumber,
    });
    ReturnOutput = s(outCol(r, 'intresult')); // StrOutPut.Value.ToString()
  } catch (ExpObj) {
    ReturnOutput = 'Some Exception Occur : ' + ExpObj.message;
  }
  return res.json(ReturnOutput);
}));

// ---------------------------------------------------------------- PayByPayYouMoney(int KitId) : string  (public method => MVC action)
// public (legacy cast the session inside its try: no session => "Some Exception Occur : Object reference ...")
router.all(`${P}/PayByPayYouMoney{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const KitId = bindInt(req.p.KitId, 'KitId');
  const r = await PayByPayYouMoney(req, KitId);
  res.type('text/html').send(r);
}));

module.exports = router;
