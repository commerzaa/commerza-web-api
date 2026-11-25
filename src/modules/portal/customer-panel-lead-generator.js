'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/LeadGenerator .cs (LeadGeneratorController)
// Actions: Index (1)
const express = require('express');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, toInt32 } = require('./_shared/batch-04-common');

const router = express.Router();
const BindEnquiryList = ['MAILDATE', 'TYPE', 'CCEMAILID', 'CCNAME', 'MOBILE', 'SUBJECT', 'MESSAGE'];

// auth (legacy had no null check but casts (Login)Session["Plid"])
// route-config: merchant/Enquiry-List -> LeadGenerator/Index
router.all(['/portal/LeadGenerator/Index{/:id}', '/portal/LeadGenerator', '/portal/merchant/Enquiry-List{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = toInt32(Number(req.user.plid));
  const PMID = toInt32(Number(req.user.pmid || 0));
  // [Usp_ShowEnquiryList] @PLID,@PMID
  const rows = await db.proc(DB, 'usp_showenquirylist', { plid: PLID, pmid: PMID });
  res.json({ view: '~/Views/CustomerPanel/LeadGenerator/Index.cshtml', Model: mapRows(rows, BindEnquiryList) });
}));

module.exports = router;
