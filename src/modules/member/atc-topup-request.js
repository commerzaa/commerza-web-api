'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\ATC_Topup_Request.cs (ATC_Topup_RequestController) */
const express = require('express');
const axios = require('axios');
const { scalar, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/ATC_Topup_Request';

const str = (v) => (v === null || v === undefined ? '' : String(v));
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}

// route-config: referral/coin-topup-requests
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/coin-topup-requests'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth ([SessionExpireCheck])
router.all(`${P}/TopupRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const ATC = Number(p.ATC); const Amount = Number(p.Amount);
  const { PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceNumber, Username, AmountINR, OTP } = p;
  let ReferenceDate = p.ReferenceDate;
  let APIResponseForSave = ''; let TransactionId = '';
  const Plid = Number(req.user.plid);

  // Same member cannot top up the coin wallet more than once within 3 hours by ATC coin
  const chk = await procOne(DB, 'usp_atccointrasferhistoryfromatcwallettoatcwallet', {
    plid: Plid, fromatcuserid: '', fromatcwallet: '', toatcwallet: '', noofcoins: '0.00000000', transcationid: '', apiresponse: '', mode: '2',
  });
  const chkVal = str(chk && chk.strresult);
  if (chkVal.toLowerCase() !== 'success') return res.json('error^' + chkVal);

  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') return res.json('error^Mandatory fields are required.');
  if (Amount <= 0 && PaymentMode === '13') {
    if (ReferenceNumber === '' || ReferenceDate === '') return res.json('error^Mandatory fields are required.');
  }

  // BluefoxMovie API
  let Return = '';
  if (Username === '') Return = 'Error^Please Enter Username';
  if (OTP === '') Return = 'Error^Please Enter OTP';
  if (Amount < 0) {
    Return = 'Error^Insufficient Balance!';
  } else {
    const url = 'http://walletapi.bluefoxmovie.com/api/APIMaster?UserName=' + Username + '&APITokenKey=BFMWDAPIOUT&WalletForRedeem=' + AmountINR + '&OTP=' + OTP;
    const r = await axios.post(url, { UserName: null, APITokenKey: null, WalletForRedeem: null, OTP: null }, { headers: { 'Content-Type': 'application/json' }, validateStatus: () => true });
    Return = String(r.data.Data);
    const WordObj = Return.split('^');
    if (WordObj[0] === 'Success') TransactionId = WordObj[1];
    Return = WordObj[0];
    if (Return !== 'Success') {
      if (WordObj.length < 2) throw new RangeError('Index was outside the bounds of the array.');
      return res.json('error^' + WordObj[1]);
    }
  }

  ReferenceDate = '';
  let ImageName = ''; let FullUrlWithFolder = '';
  let RegNo = 0;
  let ReturnOutput = '';
  try {
    RegNo = Number(await scalar(DB, 'select regno from member_master where regno = @p limit 1', { p: Plid })) || 0;
    if (ChallanImage !== '') {
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    // @StrResult / @TotalCount are OUT params (read from result columns)
    const out = await procOne(DB, 'usp_atc_fund_request', {
      mode: '1', regno: RegNo, type: 'Cr', atc: ATC, amountininr: Amount, remark: CommentORRemark, paymentmode: PaymentMode,
      paymentmodename: ModeName, challanimage: FullUrlWithFolder, bankname: BankName, branchname: BranchName, referencenumber: ReferenceNumber,
      referencedate: ReferenceDate, fromdate: '', todate: '', startrowindex: '1', maxrows: '100', atctransactionid: TransactionId,
      apiresponse: APIResponseForSave,
    });
    const so = str(out && out.strresult);
    if (so.toLowerCase() === 'success') ReturnOutput = 'success^Your  Wallet Top Request successfully sent.';
    else ReturnOutput = so;
  } catch (Exp) {
    ReturnOutput = 'error^Some exception occured while making the request.';
    await ErrorInsert(Exp, 'Usp_ATC_Fund_Request', req);
  }
  sessionStore.set(req, 'SessionOTP', null);
  res.json(ReturnOutput);
}));

module.exports = router;
