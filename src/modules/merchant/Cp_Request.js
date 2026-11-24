'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/Cp_Request.cs (Cp_RequestController) - 3 actions: Index, Generatehash512, TopupRequest
 * DB: Db_Shopping => 'shopping'
 */
const crypto = require('crypto');
const express = require('express');
const config = require('../../config');
const { scalar, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const C = 'Cp_Request';

/** SHA512 of the UTF-8 text as lower-case hex */
const Generatehash512 = (text) => crypto.createHash('sha512').update(Buffer.from(String(text), 'utf8')).digest('hex');

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/cp-request
// auth (legacy: reads Session["plid"])
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/cp-request', '/merchant/merchant/cp-request'], auth, asyncHandler(async (req, res) => {
  let { type } = req.p;
  if (type == null) type = '1';
  const Plid = Number(req.user.plid);
  const v = await scalar(DB, 'SELECT coalesce(available_fund,0) FROM portal_master WHERE plid=@plid LIMIT 1', { plid: Plid });
  const TotalAvaliableCP = v === null || v === undefined ? 0 : Number(v);
  res.json({ view: '~/Views/Cp_Request/Index.cshtml', ViewBag: { TotalCPPoint: TotalAvaliableCP, Type: type } });
}));

// ---- Generatehash512 (public string action) ------------------------------------------------------------
// auth
router.all(`/merchant/${C}/Generatehash512{/:id}`, auth, asyncHandler(async (req, res) => {
  if (req.p.text === undefined || req.p.text === null) throw new TypeError('Value cannot be null.');
  res.send(Generatehash512(req.p.text));
}));

// ---- TopupRequest --------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
router.all(`/merchant/${C}/TopupRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const { PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, IFSCCode } = p;
  const Amount = Number(p.Amount);
  const BANKID = parseInt(p.BANKID, 10);
  const CPPOINT = Number(p.CPPOINT);
  let ReferenceNumber = p.ReferenceNumber;
  if (ReferenceNumber === '') {
    // Random().ToString() is "System.Random"; the hash input is made unique per call
    const StrHash = Generatehash512('System.Random' + new Date().toString() + new Date().getMilliseconds() + crypto.randomBytes(4).toString('hex'));
    ReferenceNumber = StrHash.substring(0, 20);
  }
  let TransactionId = '';
  if (PaymentMode === '14') {
    try {
      const t = sessionStore.get(req, 'TransactionId'); // TempData["TransactionId"]
      TransactionId = t === undefined || t === null ? '' : String(t);
      if (TransactionId === '') return res.json('error^Invalid Transaction Id.');
    } catch (ExpObj) {
      return res.json('error^Invalid Transaction Id.' + ExpObj.message);
    }
  }
  if (PaymentMode === '3') TransactionId = ReferenceNumber;

  if (PaymentMode === '2') {
    // legacy: empty block ("ReferenceNumber = BTCAddress" commented out)
  }

  const Plid = Number(req.user.plid);
  if (!(Amount > 0) || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = '';
  let ReturnOutput = '';
  try {
    if (ChallanImage !== '') {
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, 'ChallenImg');
    }
    const row = await procOne(DB, 'usp_merchant_fund_request', {
      mode: 1, regno: Plid, type: 'Cr', amount: Amount, remark: CommentORRemark, paymentmode: PaymentMode, paymentmodename: ModeName,
      challanimage: ImageName, bankname: BankName, branchname: BranchName, referencenumber: ReferenceNumber, referencedate: ReferenceDate,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100', ifsccode: IFSCCode, transactionid: TransactionId, bankid: BANKID, cppoint: CPPOINT,
    });
    // PORT-NOTE: @StrResult OUT read from the "strresult" column of the result row
    const out = row && row.strresult !== null && row.strresult !== undefined ? String(row.strresult) : null;
    if (out === null) throw new TypeError('Object reference not set to an instance of an object.');
    if (out.toLowerCase() === 'success') {
      ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.^/referral/do-not-refresh-payment?CommentORRemark=' + CommentORRemark + '&Amount=' + Amount + '&OrderId=' + ReferenceNumber + '';
      sessionStore.set(req, 'SessionOTP', null); // Session.Remove("SessionOTP")
    } else {
      ReturnOutput = out;
    }
  } catch (ExpObj) {
    ReturnOutput = 'error^Some exception occured while making the request.';
  }
  return res.json(ReturnOutput);
}));

void config;
module.exports = router;
