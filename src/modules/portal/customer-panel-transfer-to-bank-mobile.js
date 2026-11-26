// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/TransferToBank_mobileController.cs (TransferToBank_mobileController)
'use strict';
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { DB, s, outCol, mvcStrDef, defDecimal, cvtDecimal, toInt32, background } = require('./_shared/batch-24-common');
const { decimalText } = require('./_shared/batch-08-common');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const P = '/portal/TransferToBank_mobile';
const isNullOrEmpty = (v) => v === undefined || v === null || v === '';

// ---------------------------------------------------------------- Index()
// public (legacy: `Session["Plid"] == null` -> View("/"))
// route-config: customer/TransferToBank-mobile -> TransferToBank_mobile/Index
router.all([`${P}/Index{/:id}`, P, '/portal/customer/TransferToBank-mobile{/:id}'], ps.portalSession, asyncHandler(async (req, res) => {
  if (!ps.isCustomer(req)) return res.json({ view: '/' });
  try {
    const bag = {};
    let customerBankAccount = {}; // new CustomerBankAccount()
    const Plid = Number(req.user.plid);
    if (Plid !== 0) {
      bag.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid));
      const row = await db.procOne(DB, 'usp_getcustomerkycstatus', { CLID: Plid });
      const spOutPut = s(outCol(row, 'stroutput'));
      const up = spOutPut.toUpperCase();
      if (up === 'INVALID CUSTOMER') {
        return res.json('Session Expired!');
      } else if (up === 'KYC NOT SUBMITTED') {
        bag.KYCStatus = 0;
      } else if (up === 'APPROVED') {
        bag.KYCStatus = 1;
      } else if (up === 'NOT APPROVED') {
        bag.KYCStatus = 2;
      } else if (up === 'ERROR') {
        bag.KYCStatus = 3;
      }
      customerBankAccount = await CutomerWalletProcess.GetCustomerBankAccountDetails(toInt32(Plid));
      if (customerBankAccount != null) {
        bag.MobileNo = customerBankAccount.MOBILENO;
      }
    }
    return res.json({ view: '~/Views/CustomerPanel/TransferToBank_mobile/Index.cshtml', Model: customerBankAccount === undefined ? null : customerBankAccount, ...bag });
  } catch (ex) {
    return res.json({ view: '/' });
  }
}));

// ---------------------------------------------------------------- CheckUserWallet(decimal amount = 0, string accountNo = "", ...)
// auth ([HttpGet] [SessionExpireCheck])
router.get(`${P}/CheckUserWallet{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let chkResult = ''; let redirectURL = '';
  const rawAmount = req.p.amount;
  const amount = defDecimal(rawAmount, 0);
  const accountNo = mvcStrDef(req, 'accountNo', '');
  const accountHolderName = mvcStrDef(req, 'accountHolderName', '');
  const IFSCCode = mvcStrDef(req, 'IFSCCode', '');
  const bankName = mvcStrDef(req, 'bankName', '');
  const branchName = mvcStrDef(req, 'branchName', '');
  try {
    const Plid = Number(req.user.plid);
    let userWallet = 0;
    if (Plid !== 0) {
      userWallet = Number(await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid))) || 0;
      if (userWallet > 0) {
        if (amount <= userWallet) {
          chkResult = 'Valid';
          if (!isNullOrEmpty(accountNo) && !isNullOrEmpty(accountHolderName) && !isNullOrEmpty(IFSCCode) && !isNullOrEmpty(bankName) && !isNullOrEmpty(branchName)) {
            const amountText = amount === defDecimal(rawAmount, NaN) ? decimalText(rawAmount, amount) : String(amount); // Convert.ToString(decimal)
            redirectURL = '/TransferToBank/ConfirmBankTransfer?amount=' + await UtilityClass.Encryptword(amountText)
              + '&accountNo=' + await UtilityClass.Encryptword(accountNo) + '&accountHolderName=' + await UtilityClass.Encryptword(accountHolderName)
              + '&IFSCCode=' + await UtilityClass.Encryptword(IFSCCode) + '&bankName=' + await UtilityClass.Encryptword(bankName)
              + '&branchName=' + await UtilityClass.Encryptword(branchName) + '';
          }
        } else {
          chkResult = 'Insufficient Balance';
        }
      } else if (userWallet === 0) {
        chkResult = 'Insufficient Balance';
      }
      return res.json(chkResult + '^' + redirectURL);
    }
    return res.json('Session Expired!');
  } catch (ex) {
    return res.json('Problem in request!');
  }
}));

// ---------------------------------------------------------------- SendOTP(string mobileNo)
// public (legacy: no session check; writes Session["OTP"], the OTP is never returned)
router.all(`${P}/SendOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const mobileNo = req.p.mobileNo === undefined || req.p.mobileNo === '' ? null : req.p.mobileNo;
  // #region Send OTP section
  const Vcode = 100000 + Math.floor(Math.random() * (555555 - 100000)); // Random.Next(100000, 555555)
  ps.sessionSet(req, 'OTP', Vcode);
  background(async () => {
    if (mobileNo !== '') {
      await UtilityClass.SendMsgOnMobile(mobileNo, '' + Vcode + ' is your verification code for Transfer to Bank.Thank you.\r\nThe ' + s(CompanySettings.CompanyName) + ' Team');
    }
  });
  // #endregion Send OTP section
  res.json('SUCCESS');
}));

// ---------------------------------------------------------------- ValidateOTPTransferFund(string OTP = "")
// public ([HttpPost]; legacy: no session check, only Session["OTP"])
router.post(`${P}/ValidateOTPTransferFund{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let chkResult = ''; let transactionId = '';
  const OTP = mvcStrDef(req, 'OTP', '');
  try {
    if (OTP !== '') {
      const sess = ps.sessionGet(req, 'OTP');
      if (sess === null) throw new TypeError('Object reference not set to an instance of an object.'); // Session["OTP"].ToString()
      if (String(sess) === OTP) {
        chkResult = 'SUCCESS';
        transactionId = '1674859678';
        // Do transaction here
      } else {
        chkResult = 'Invalid OTP';
      }
    }
  } catch (ex) {
    chkResult = 'Problem in request';
  }
  res.json(chkResult + '^' + transactionId);
}));

// ---------------------------------------------------------------- GetBankDetailsByIFSCCode(string IFSCCODE)
// public (legacy: no session check; proxies the Razorpay IFSC lookup)
router.all(`${P}/GetBankDetailsByIFSCCode{/:id}`, asyncHandler(async (req, res) => {
  try {
    const IFSCCODE = req.p.IFSCCODE === undefined || req.p.IFSCCODE === null ? '' : String(req.p.IFSCCODE);
    const Baseurl = 'https://ifsc.razorpay.com/' + IFSCCODE;
    const r = await axios.get(Baseurl, { responseType: 'text', transformResponse: (d) => d });
    const bankdetails = String(r.data);
    return res.json(bankdetails);
  } catch (Ex) {
    const Error_ = 'Not Found';
    return res.json(Error_);
  }
}));

// ---------------------------------------------------------------- ConfirmBankTransfer(string amount = "", ...)
// public (legacy cast the session inside try: no session -> View())
router.all(`${P}/ConfirmBankTransfer{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const out = { view: 'ConfirmBankTransfer' };
  const amount = mvcStrDef(req, 'amount', ''); const accountNo = mvcStrDef(req, 'accountNo', '');
  const accountHolderName = mvcStrDef(req, 'accountHolderName', ''); const IFSCCode = mvcStrDef(req, 'IFSCCode', '');
  const bankName = mvcStrDef(req, 'bankName', ''); const branchName = mvcStrDef(req, 'branchName', '');
  try {
    if (!ps.isCustomer(req)) throw new TypeError('Object reference not set to an instance of an object.');
    const Plid = Number(req.user.plid);
    let userWallet = 0; let transactionAmount = 0;
    if (Plid !== 0) {
      userWallet = Number(await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid))) || 0;
      out.UserWallet = userWallet;
      transactionAmount = cvtDecimal(await UtilityClass.Decryptword(amount));
      if (transactionAmount <= userWallet) {
        if (transactionAmount !== 0 && !isNullOrEmpty(accountNo) && !isNullOrEmpty(accountHolderName) && !isNullOrEmpty(IFSCCode) && !isNullOrEmpty(bankName) && !isNullOrEmpty(branchName)) {
          ps.tempDataSet(req, 'Amount', transactionAmount);
          ps.tempDataSet(req, 'AccountNo', await UtilityClass.Decryptword(accountNo));
          ps.tempDataSet(req, 'AccountHolderName', await UtilityClass.Decryptword(accountHolderName));
          ps.tempDataSet(req, 'IFSCCode', await UtilityClass.Decryptword(IFSCCode));
          ps.tempDataSet(req, 'BankName', await UtilityClass.Decryptword(bankName));
          ps.tempDataSet(req, 'BranchName', await UtilityClass.Decryptword(branchName));
          const customerBankAccount = await CutomerWalletProcess.GetCustomerBankAccountDetails(toInt32(Plid));
          if (customerBankAccount != null) {
            out.MobileNo = customerBankAccount.MOBILENO;
          }
        }
      } else {
        return res.json({ view: '~/Views/CustomerPanel/TransferToBank/Index.cshtml', UserWallet: out.UserWallet });
      }
    }
  } catch (ex) { /* swallowed as legacy */ }
  return res.json(out);
}));

module.exports = router;
