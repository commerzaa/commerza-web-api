'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/PaymentMethods.cs (PaymentMethodsController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query, queryOne, scalar, exec } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

/** PaymentMethodsController.CheckpmidyesNo */
async function CheckpmidyesNo(pmid) {
  let PTMID = '';
  if (pmid !== 0) {
    const row = await queryOne(DB, 'SELECT ptmid FROM distributor_master WHERE pmid = @pmid LIMIT 1', { pmid });
    if (!row) throw NRE();
    PTMID = row.ptmid;
    if (PTMID === null || PTMID === undefined || PTMID === '') PTMID = '';
  }
  return PTMID;
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all('/franchise/PaymentMethods/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.did, 10);
  const v = await scalar(DB, 'SELECT pmid FROM distributor_master WHERE plid = @plid AND active = true LIMIT 1', { plid: Plid });
  const Pmid = v === null || v === undefined ? 0 : v;
  return res.json({ view: '~/Views/PaymentMethods/Index.cshtml', ViewBag: { PMID: Pmid } });
}));

// ---- CheckpmidyesNo (public string action) ---------------------------------------------------------------
// auth
router.all('/franchise/PaymentMethods/CheckpmidyesNo{/:id}', auth, asyncHandler(async (req, res) => {
  const pmid = Number(req.p.pmid);
  if (req.p.pmid === undefined || req.p.pmid === null || req.p.pmid === '' || Number.isNaN(pmid)) {
    throw new Error('The parameters dictionary contains a null entry for parameter \'pmid\' of non-nullable type \'System.Double\'.');
  }
  return res.type('text/plain').send(await CheckpmidyesNo(pmid));
}));

// ---- paymentMethods ------------------------------------------------------------------------------------
// auth
router.all('/franchise/PaymentMethods/paymentMethods{/:id}', auth, asyncHandler(async (req, res) => {
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  if (pmidParam !== undefined && pmidParam !== null && pmidParam !== '') {
    pmid = Number(pmidParam);
    if (Number.isNaN(pmid)) throw new Error('Input string was not in a correct format.');
  }
  const Collectionofptmid = await CheckpmidyesNo(pmid);
  const Collectionofptmidsplit = String(Collectionofptmid).split(',');
  const DetailList = [];
  const tblpaymentmaster = await query(DB, 'SELECT * FROM tbl_paymentmaster WHERE status = 1 ORDER BY paymentmathod');
  for (const Item of tblpaymentmaster) {
    let yesNo = 0;
    const ptmids = String(Item.ptmid);
    if (ptmids.trim() !== '') {
      for (const splitsptid of Collectionofptmidsplit) {
        if (splitsptid.trim() !== '') {
          if (splitsptid.trim() === ptmids.trim()) yesNo = 1;
        }
      }
    }
    if (Item.paymentmathod === null || Item.paymentmathod === undefined || Item.paymentlogo === null || Item.paymentlogo === undefined) throw NRE();
    const details = {
      matchptmid: yesNo === 1 ? 1 : 0,
      paymentmathod: String(Item.paymentmathod),
      ptmid: String(Item.ptmid),
      PAYMENTLOGO: String(Item.paymentlogo),
    };
    DetailList.push(details);
  }
  return res.json(DetailList);
}));

// ---- UpdateMethods -------------------------------------------------------------------------------------
// auth
router.all('/franchise/PaymentMethods/UpdateMethods{/:id}', auth, asyncHandler(async (req, res) => {
  const { methodid, pmidParam } = req.p;
  let pmid = 0;
  if (pmidParam !== undefined && pmidParam !== null && pmidParam !== '') {
    pmid = parseInt(pmidParam, 10);
    if (Number.isNaN(pmid)) throw new Error('Input string was not in a correct format.');
  }
  if (pmid <= 0) return res.json('expired');
  try {
    const row = await queryOne(DB, 'SELECT pmid FROM distributor_master WHERE pmid = @pmid LIMIT 1', { pmid });
    if (!row) throw NRE();
    if (methodid === undefined || methodid === null) throw NRE();
    await exec(DB, 'UPDATE distributor_master SET ptmid = @ptmid WHERE pmid = @pmid', { ptmid: String(methodid).trim(), pmid });
  } catch (e) {
    return res.json('1');
  }
  return res.json('1');
}));

module.exports = router;
