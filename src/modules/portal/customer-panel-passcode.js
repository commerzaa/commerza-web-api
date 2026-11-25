'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PasscodeController.cs (class PasscodeController => /portal/Passcode/...)
// Database: shopping (Db_Shopping). [CheckResellerTimeout] has a commented-out body => no check.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const { DB, s, defInt, nStr, masterpageshow } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/Passcode';

// ---------------------------------------------------------------- Index()
// public (portalSession): legacy returned the Home view (not a redirect) when Session["Plid"] == null
// route-config: "customer/passcode" -> Passcode/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/passcode'], ps.portalSession, asyncHandler(async (req, res) => {
  if (!ps.isCustomer(req)) return res.json({ view: '~/Views/Home/Index.cshtml' });
  const ViewBag = {};
  try {
    ViewBag.masterpageshow = masterpageshow(req);
    const Plid = Number(req.user.plid);
    if (Plid !== 0) {
      const r = await db.procOne(DB, 'usp_getcustomerkycstatus', { CLID: Plid });
      const spOutPut = s(r && r.stroutput);
      const u = spOutPut.toUpperCase();
      if (u === 'INVALID CUSTOMER') return res.json('Session Expired!');
      else if (u === 'KYC NOT SUBMITTED') ViewBag.KYCStatus = 0;
      else if (u === 'APPROVED') ViewBag.KYCStatus = 1;
      else if (u === 'NOT APPROVED') ViewBag.KYCStatus = 2;
      else if (u === 'ERROR') ViewBag.KYCStatus = 3;
      ViewBag.PasscodeStatus = await CutomerWalletProcess.CheckUserPassCode(Math.round(Plid));
    }
    return res.json({ view: '~/Views/CustomerPanel/Passcode/Index.cshtml', ...ViewBag });
  } catch (ex) {
    return res.json({ view: '/' });
  }
}));

// ---------------------------------------------------------------- ManagePasscode(Int64 passCode = 0, int mode = 0)
// public (portalSession): legacy returned Json("") when Session["Plid"] == null
router.all(`${C}/ManagePasscode{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let outputResult = '';
  try {
    const passCode = defInt(req.p.passCode, 0);
    const mode = defInt(req.p.mode, 0);
    if (ps.isCustomer(req)) {
      if (passCode !== 0 && passCode > 999) {
        const r = await db.procOne(DB, 'usp_customerpasscode', { CLID: req.user.plid, PASSCODE: passCode, MODE: mode });
        outputResult = s(r && r.stroutput);
      } else {
        outputResult = 'Invalid Passcode';
      }
    }
    return res.json(outputResult);
  } catch (ex) {
    return res.json(outputResult);
  }
}));

// ---------------------------------------------------------------- VerifyPasscode(Int64 passCode = 0)
// public (portalSession): legacy returned Json(0) when Session["Plid"] == null
router.all(`${C}/VerifyPasscode{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let chkStatus = 0;
  try {
    const passCode = defInt(req.p.passCode, 0);
    if (ps.isCustomer(req)) {
      const Plid = Number(req.user.plid);
      chkStatus = await CutomerWalletProcess.VerifyUserPasscodeByCLID(Math.round(Plid), passCode);
    }
    return res.json(chkStatus);
  } catch (ex) {
    return res.json(chkStatus);
  }
}));

// ---------------------------------------------------------------- VerifyAadhaarNo(string aadhaarNo = "")
// public (portalSession): legacy returned Json(0) when Session["Plid"] == null
router.all(`${C}/VerifyAadhaarNo{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let existAadhaar = '';
  let aadhaarStatus = 0;
  try {
    const aadhaarNo = nStr(req.p.aadhaarNo) === null ? '' : req.p.aadhaarNo;
    if (ps.isCustomer(req)) {
      const Plid = Number(req.user.plid);
      existAadhaar = await CutomerWalletProcess.GetAadhaarNoByCLID(Math.round(Plid));
      if (existAadhaar !== '' && existAadhaar === aadhaarNo) aadhaarStatus = 1;
    }
    return res.json(aadhaarStatus);
  } catch (ex) {
    return res.json(aadhaarStatus);
  }
}));

module.exports = router;
