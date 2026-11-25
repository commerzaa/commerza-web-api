'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/TransferToBankController.cs (TransferToBankController)
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const CS = require('../../lib/portal/CompanySettings');
const ps = require('./_shared/portal-session');
const { masterpageshow, outCol, toDecimal, decimalText, bankersRound } = require('./_shared/batch-08-common');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const DB = 'shopping';
const P = '/portal/TransferToBank';
const nz = (v) => (v === undefined || v === '' ? null : v); // MVC binds "" to null for string parameters
const isNullOrEmpty = (v) => v === undefined || v === null || v === '';

// public ([DistributerSessionExpireCheck] is a no-op; `Session["Plid"] == null` -> View("/"))
// route-config: customer/transfer-to-bank -> TransferToBank/Index
router.all([`${P}/Index{/:id}`, P, '/portal/customer/transfer-to-bank{/:id}'], ps.DistributerSessionExpireCheck, asyncHandler(async (req, res) => {
  if (!ps.isCustomer(req)) return res.json({ view: '/' });
  const out = { view: '~/Views/CustomerPanel/TransferToBank/Index.cshtml' };
  try {
    out.masterpageshow = masterpageshow(req);
    const Plid = Number(req.user.plid);
    if (Plid !== 0) {
      out.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(Math.round(Plid));
      const row = await db.procOne(DB, 'usp_getcustomerkycstatus', { clid: Plid });
      const v = outCol(row, 'stroutput');
      const spOutPut = v === null || v === undefined ? '' : String(v);
      const up = spOutPut.toUpperCase();
      if (up === 'INVALID CUSTOMER') return res.json('Session Expired!');
      else if (up === 'KYC NOT SUBMITTED') out.KYCStatus = 0;
      else if (up === 'APPROVED') out.KYCStatus = 1;
      else if (up === 'NOT APPROVED') out.KYCStatus = 2;
      else if (up === 'ERROR') out.KYCStatus = 3;
      else if (up === 'PENDING') out.KYCStatus = 5;
      else if (up === 'REJECTED') out.KYCStatus = 6;
      out.CLID = Plid;
    }
    return res.json(out);
  } catch (ex) {
    return res.json({ view: '/' });
  }
}));

// auth ([HttpGet] [SessionExpireCheck])
router.get(`${P}/CheckUserWallet{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let chkResult = ''; let redirectURL = '';
  try {
    const rawAmount = req.p.amount;
    let amount = 0;
    if (!isNullOrEmpty(rawAmount)) amount = toDecimal(rawAmount);
    const accountNo = req.p.accountNo === undefined ? '' : nz(req.p.accountNo);
    const accountHolderName = req.p.accountHolderName === undefined ? '' : nz(req.p.accountHolderName);
    const IFSCCode = req.p.IFSCCode === undefined ? '' : nz(req.p.IFSCCode);
    const bankName = req.p.bankName === undefined ? '' : nz(req.p.bankName);
    const branchName = req.p.branchName === undefined ? '' : nz(req.p.branchName);
    const Plid = Number(req.user.plid);
    let userWallet = 0;
    if (Plid !== 0) {
      userWallet = Number(await CutomerWalletProcess.GetUserWalletBalance(Math.round(Plid))) || 0;
      if (userWallet > 0) {
        if (amount <= userWallet) {
          chkResult = 'Valid';
          // TempData[...] = ... ; TempData.Keep(...)
          ps.tempDataSet(req, 'Amount', amount);
          ps.tempDataSet(req, 'AccountNo', accountNo);
          ps.tempDataSet(req, 'AccountHolderName', accountHolderName);
          ps.tempDataSet(req, 'IFSCCode', IFSCCode);
          ps.tempDataSet(req, 'BankName', bankName);
          ps.tempDataSet(req, 'BranchName', branchName);
          if (!isNullOrEmpty(accountNo) && !isNullOrEmpty(accountHolderName) && !isNullOrEmpty(IFSCCode) && !isNullOrEmpty(bankName) && !isNullOrEmpty(branchName)) {
            redirectURL = '/TransferToBank/ConfirmBankTransfer?amount=' + UtilityClass.Encryptword(decimalText(rawAmount, amount))
              + '&accountNo=' + UtilityClass.Encryptword(accountNo) + '&accountHolderName=' + UtilityClass.Encryptword(accountHolderName)
              + '&IFSCCode=' + UtilityClass.Encryptword(IFSCCode) + '&bankName=' + UtilityClass.Encryptword(bankName)
              + '&branchName=' + UtilityClass.Encryptword(branchName) + '';
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

// public (legacy: no session check; writes Session["OTP"])
router.all(`${P}/SendOTP{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const mobileNo = nz(req.p.mobileNo);
  //#region Send OTP section
  const Vcode = 100000 + Math.floor(Math.random() * (555555 - 100000));
  ps.sessionSet(req, 'OTP', Vcode);
  // background thread in legacy: fire-and-forget
  setImmediate(() => {
    if (mobileNo !== '') {
      Promise.resolve(UtilityClass.SendMsgOnMobile(mobileNo, '' + Vcode + ' is your verification code for Transfer to Bank.Thank you.\r\nThe ' + CompanySettings.CompanyName + ' Team'))
        .catch((e) => console.error('TransferToBank.SendOTP', e.message));
    }
  });
  //#endregion
  res.json('SUCCESS');
}));

// auth-ish ([HttpPost]; legacy cast the session inside try: no session -> "Problem in request^")
router.post(`${P}/ValidateOTPTransferFund{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let chkResult = ''; let transactionId = '';
  let userPasscode = 0;
  const OTP = req.p.OTP === undefined ? '123456' : nz(req.p.OTP);
  try {
    if (!ps.isCustomer(req)) throw new Error('Object reference not set to an instance of an object.');
    const Plid = Number(req.user.plid);
    if (OTP !== '' && Plid !== 0) {
      userPasscode = 1; // CutomerWalletProcess.VerifyUserPasscodeByCLID(...) commented out in legacy: OTP is NOT verified
      if (userPasscode > 0) {
        const AccountNo = ps.tempDataGet(req, 'AccountNo');
        const BankName = ps.tempDataGet(req, 'BankName');
        const BranchName = ps.tempDataGet(req, 'BranchName');
        const IFSCCode = ps.tempDataGet(req, 'IFSCCode');
        const AccountHolderName = ps.tempDataGet(req, 'AccountHolderName');
        const Amount = ps.tempDataGet(req, 'Amount');
        if (AccountNo !== null && BankName !== null && BranchName !== null && IFSCCode !== null && AccountHolderName !== null && Amount !== null) {
          // Convert.ToInt32(TempData["Amount"]) (decimal -> banker's rounding) is passed as the decimal Amount
          const r = await CutomerWalletProcess.CompleteBankTransfer(Math.round(Plid), String(AccountNo), String(BankName), String(BranchName),
            String(IFSCCode), String(AccountHolderName), bankersRound(Number(Amount)));
          chkResult = r && r.TransResult !== undefined && r.TransResult !== null ? String(r.TransResult) : '';
          transactionId = r && r.TransRefNo !== undefined && r.TransRefNo !== null ? String(r.TransRefNo) : '';
        } else {
          chkResult = 'Something went wrong with this transaction please try after sometime';
        }
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

// public-ish (legacy cast the session inside try; no session -> View())
// route-config: customer/Confirm-bank-transfer -> TransferToBank/ConfirmBankTransfer
router.all([`${P}/ConfirmBankTransfer{/:id}`, '/portal/customer/Confirm-bank-transfer{/:id}'], ps.portalSession, asyncHandler(async (req, res) => {
  const out = { view: 'ConfirmBankTransfer' };
  const g = (k) => (req.p[k] === undefined ? '' : nz(req.p[k]));
  const amount = g('amount'); const accountNo = g('accountNo'); const accountHolderName = g('accountHolderName');
  const IFSCCode = g('IFSCCode'); const bankName = g('bankName'); const branchName = g('branchName');
  try {
    if (!ps.isCustomer(req)) throw new Error('Object reference not set to an instance of an object.');
    const Plid = Number(req.user.plid);
    let userWallet = 0; let transactionAmount = 0;
    if (Plid !== 0) {
      userWallet = Number(await CutomerWalletProcess.GetUserWalletBalance(Math.round(Plid))) || 0;
      out.UserWallet = userWallet;
      transactionAmount = toDecimal(UtilityClass.Decryptword(amount));
      if (transactionAmount <= userWallet) {
        if (transactionAmount !== 0 && !isNullOrEmpty(accountNo) && !isNullOrEmpty(accountHolderName) && !isNullOrEmpty(IFSCCode) && !isNullOrEmpty(bankName) && !isNullOrEmpty(branchName)) {
          ps.tempDataSet(req, 'Amount', transactionAmount);
          ps.tempDataSet(req, 'AccountNo', UtilityClass.Decryptword(accountNo));
          ps.tempDataSet(req, 'AccountHolderName', UtilityClass.Decryptword(accountHolderName));
          ps.tempDataSet(req, 'IFSCCode', UtilityClass.Decryptword(IFSCCode));
          ps.tempDataSet(req, 'BankName', UtilityClass.Decryptword(bankName));
          ps.tempDataSet(req, 'BranchName', UtilityClass.Decryptword(branchName));
          const customerBankAccount = await CutomerWalletProcess.GetCustomerBankAccountDetails(Math.round(Plid));
          if (customerBankAccount != null) out.MobileNo = customerBankAccount.MOBILENO;
        }
      } else {
        return res.json({ view: '~/Views/CustomerPanel/TransferToBank/Index.cshtml', UserWallet: out.UserWallet });
      }
    }
  } catch (ex) { /* swallowed as legacy */ }
  return res.json(out);
}));

module.exports = router;
