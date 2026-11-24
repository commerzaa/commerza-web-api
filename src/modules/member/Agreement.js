'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Agreement.cs (AgreementController) - 3 actions: Index, saveagreement, AggrementImages */
const express = require('express');
const { proc, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Agreement';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const dec = (v) => { // Convert.ToDecimal / MVC decimal binding
  if (v === undefined || v === null || String(v).trim() === '') throw new Error('Input string was not in a correct format.');
  const n = Number(String(v).trim());
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const AGREEMENT_PROPS = ['TSMID', 'SUBSCRIPTIONHEADING', 'PRICE', 'USERNAME', 'FULLNAME', 'ADDRESS', 'FatherOrMotherName'];

// route-config: referral/_plus_REmfMkcQ_slash_aosdfgtrMq2uJTCWe42ffoxk5VFspk
// auth (uses Session["PLID"])
router.all([`${P}/Index{/:id}`, '/member/referral/_plus_REmfMkcQ_slash_aosdfgtrMq2uJTCWe42ffoxk5VFspk'], auth, asyncHandler(async (req, res) => {
  const PLID = Math.trunc(Number(req.user.plid));
  const rows = await proc(DB, 'usp_agreementdetails', { plid: PLID }); // @STRRESULT is an unused OUT parameter
  const Agreement = mapRows(rows, AGREEMENT_PROPS);
  res.json({ Model: Agreement, AgreementDetails: Agreement });
}));

// auth
router.all(`${P}/saveagreement{/:id}`, auth, asyncHandler(async (req, res) => {
  const { value, name, fathername, address } = req.p;
  const packamt = dec(req.p.packamt);
  const clkamt = dec(req.p.clkamt);
  const PLID = Math.trunc(Number(req.user.plid));
  const rows = await proc(DB, 'usp_add_agreemnnt_distributor', {
    selectvalues: value, updatedate: new Date(), name, fathername, address, regno: PLID, packamt, clkamt, mode: 1, uploadimage: '',
  });
  const o = outv(rows, 'strresult');
  const Results = String(o).trim(); // null => legacy NullReferenceException
  if (o === undefined || o === null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(Results);
}));

// auth
router.all(`${P}/AggrementImages{/:id}`, auth, asyncHandler(async (req, res) => {
  // parameters TMID, ImgPreviewFirst..Fifth are bound but never used by the legacy action
  const Plid = Number(req.user.plid);
  let Pending = await scalar(DB, 'select coalesce(status, 0) from tbl_agreement_details where regno = @plid limit 1', { plid: Plid });
  Pending = Pending === null || Pending === undefined ? 0 : Number(Pending);
  if (Pending === 1) {
    return res.json('Your agreement reruest already pending.');
  }
  const AllImageName = '';
  // PORT-NOTE: SQL Server implicitly converted '' to datetime/int for @UPDATEDATE / @CLKAMT; PostgreSQL cannot, so null / 0 are sent.
  const rows = await proc(DB, 'usp_add_agreemnnt_distributor', {
    selectvalues: '', updatedate: null, name: '', fathername: '', address: '', regno: Plid, packamt: 0, clkamt: 0, mode: 2, uploadimage: AllImageName,
  });
  const o = outv(rows, 'strresult');
  if (o === undefined || o === null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(String(o).trim());
}));

module.exports = router;
