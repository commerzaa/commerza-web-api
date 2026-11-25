'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\PaymentMethods.cs (class PaymentMethodsController => /portal/PaymentMethods/...)
// Database: shopping (Db_Shopping). Start: src/modules/merchant/payment-methods.js (Merchant C# differs only in the view path).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, NRE, nStr, cvtInt, cvtDouble } = require('./_shared/batch-07-common');

const router = express.Router();
const C = '/portal/PaymentMethods';

/** public string CheckpmidyesNo(double pmid) */
async function CheckpmidyesNo(pmid) {
  let PTMID = '';
  if (pmid !== 0) {
    const row = await db.queryOne(DB, 'select ptmid from portal_master where pmid = @pmid limit 1', { pmid });
    if (!row) throw NRE(); // ((Portal_Master)null).PTMID
    PTMID = row.ptmid;
    if (PTMID === null || PTMID === undefined || PTMID === '') PTMID = '';
  }
  return PTMID;
}

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/paymentmethods" -> PaymentMethods/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/paymentmethods'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Math.round(Number(req.user.plid));
  const v = await db.scalar(DB, 'select pmid from portal_master where plid = @plid and active = true limit 1', { plid: Plid });
  const Pmid = v === null || v === undefined ? 0 : v;
  res.json({ view: '~/Views/CustomerPanel/PaymentMethods/Index.cshtml', PMID: Pmid });
}));

// ---------------------------------------------------------------- CheckpmidyesNo(double pmid)  (public string action)
// public (no session check in legacy; reads the payment-method ids of a business listing)
router.all(`${C}/CheckpmidyesNo{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const v = req.p.pmid;
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) {
    throw new Error("The parameters dictionary contains a null entry for parameter 'pmid' of non-nullable type 'System.Double'.");
  }
  res.type('text/html').send(await CheckpmidyesNo(Number(v)));
}));

// ---------------------------------------------------------------- paymentMethods(string pmidParam)
// public (no session check in legacy)
router.all(`${C}/paymentMethods{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const pmidParam = nStr(req.p.pmidParam);
  let pmid = 0;
  if (pmidParam !== null && pmidParam !== '') pmid = cvtDouble(pmidParam);
  const Collectionofptmid = await CheckpmidyesNo(pmid);
  const Collectionofptmidsplit = String(Collectionofptmid).split(',');
  const DetailList = [];
  const tblpaymentmaster = await db.query(DB, 'select * from tbl_paymentmaster where status = 1 order by paymentmathod', {});
  for (const item of tblpaymentmaster) {
    let yesNo = 0;
    const ptmids = String(item.ptmid);
    if (ptmids.trim() !== '') {
      for (const splitsptid of Collectionofptmidsplit) {
        if (splitsptid.trim() !== '') {
          if (splitsptid.trim() === ptmids.trim()) yesNo = 1;
        }
      }
    }
    if (item.paymentmathod === null || item.paymentmathod === undefined) throw NRE();
    if (item.paymentlogo === null || item.paymentlogo === undefined) throw NRE();
    // class GetAllRecords { matchptmid, paymentmathod, ptmid, PAYMENTLOGO } (declaration order)
    DetailList.push({
      matchptmid: yesNo === 1 ? 1 : 0,
      paymentmathod: String(item.paymentmathod),
      ptmid: String(item.ptmid),
      PAYMENTLOGO: String(item.paymentlogo),
    });
  }
  res.json(DetailList);
}));

// ---------------------------------------------------------------- UpdateMethods(string methodid, string pmidParam, string Status)
// auth (legacy had no session check but updates Portal_Master.PTMID of the given PMID) - "expired" when pmidParam <= 0 kept
router.all(`${C}/UpdateMethods{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const pmidParam = nStr(req.p.pmidParam);
  const methodid = nStr(req.p.methodid);
  let pmid = 0;
  if (pmidParam !== null && pmidParam !== '') pmid = cvtInt(pmidParam);
  if (pmid <= 0) return res.json('expired');
  try {
    const row = await db.queryOne(DB, 'select pmid from portal_master where pmid = @pmid limit 1', { pmid });
    if (!row) throw NRE();
    if (methodid === null) throw NRE();
    await db.exec(DB, 'update portal_master set ptmid = @ptmid where pmid = @pmid', { ptmid: methodid.trim(), pmid });
  } catch (e) {
    return res.json('1');
  }
  return res.json('1');
}));

module.exports = router;
