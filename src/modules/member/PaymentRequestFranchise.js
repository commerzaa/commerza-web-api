'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\PaymentRequestFranchise.cs (PaymentRequestFranchiseController) - 2 actions: Index, TopupRequest */
const express = require('express');
const { queryOne, proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/PaymentRequestFranchise';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const dec = (v) => {
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(String(v).trim()))) throw new Error('The parameters dictionary contains a null or invalid entry for parameter of non-nullable type System.Decimal.');
  return Number(String(v).trim());
};

// route-config: referral/CBvEI781cQDLrvAUespdMg=PRF=
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/CBvEI781cQDLrvAUespdMg=PRF='], auth, asyncHandler(async (req, res) => {
  let { FRID, MRP } = req.p;
  const ViewBag = {};
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_franchiserequest_byMember', { regno: Plid });
  const Pending = rows && rows[0] ? rows[0] : null; // PendingRequest { FRID:int, MRP:decimal, ... }
  if (FRID != null && MRP != null) {
    FRID = await UtilityClass.Decryptword(FRID);
    ViewBag.FRID = FRID;
    MRP = await UtilityClass.Decryptword(MRP);
    ViewBag.MRP = MRP;
  } else if (Pending != null) {
    ViewBag.FRID = String(Pending.frid);
    const amount = Number(Pending.mrp);
    ViewBag.MRP = amount.toFixed(8); // amount.ToString("0.00000000")
  }
  res.json(ViewBag);
}));

// auth ([SessionExpireCheck])
// PORT-NOTE: OUT parameter @STRRESULT of USP_Franchise_Payement_Request_INSERT is read from the "strresult" column of the first result row.
router.all(`${P}/TopupRequest{/:id}`, auth, asyncHandler(async (req, res) => {
  const Amount = dec(req.p.Amount);
  const { PaymentMode, ModeName, CommentORRemark, ChallanImage, BankName, BranchName, ReferenceDate, ReferenceNumber, IFSCCode } = req.p;
  const frid = req.p.FRID;
  let SpOutPut; // undefined until the stored procedure ran (legacy: SqlParameter.Value == null => NullReferenceException on ToString())
  const Plid = Number(req.user.plid);
  if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
    return res.json('error^Mandatory fields are required.');
  }
  let ImageName = '';
  let FullUrlWithFolder = '';
  try {
    const m = await queryOne(DB, 'select regno from member_master where regno = @plid', { plid: Plid });
    const RegNo = m ? m.regno : 0;
    if (ChallanImage !== '') {
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(RegNo));
      FullUrlWithFolder += ImageName;
    }
    const rows = await proc(DB, 'usp_franchise_payement_request_insert', {
      amount: Amount, frid, modename: ModeName, modeid: PaymentMode, bank: BankName, branch: BranchName, ifsc: IFSCCode, refrence: ReferenceNumber,
      request_date: ReferenceDate, attachment: ImageName, remark: CommentORRemark, plid: Plid, status: '1',
    });
    SpOutPut = outv(rows, 'strresult');
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_Fund_Request', 0, req.path); } catch (_) { /* ignore */ }
    // legacy set ReturnOutput = "error^Some exception occured while making the request." but never returned it
  }
  if (SpOutPut === undefined || SpOutPut === null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(String(SpOutPut));
}));

module.exports = router;
