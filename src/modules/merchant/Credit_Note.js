'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/Credit_Note.cs (Credit_NoteController, 1 action). DB: 'shopping' */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();
const s = (v) => (v === null || v === undefined ? '' : String(v));

// route-config: merchant/B2O18mbSW3C9ZPt9rWVOsQ== -> Index
// auth ([SessionExpireCheck])
router.all(['/merchant/Credit_Note/Index{/:id}', '/merchant/B2O18mbSW3C9ZPt9rWVOsQ=='], auth, asyncHandler(async (req, res) => {
  let fromDate = s(req.p.fromDate);
  let toDate = s(req.p.toDate);
  if (fromDate.trim() !== '') {
    const dates = fromDate.split('-');
    fromDate = s(dates[2]) + '-' + s(dates[1]) + '-' + s(dates[0]);
  }
  if (toDate.trim() !== '') {
    const dates = toDate.split('-');
    toDate = s(dates[2]) + '-' + s(dates[1]) + '-' + s(dates[0]);
  }
  let page = req.p.page;
  if (page === undefined || page === null || page === '') page = 1;
  // Legacy: USP_GET_MERCHANTALLINVOICES call is commented out, the model list is always empty.
  const merchnatInvoiceDetails = [];
  res.json({ view: '~/Views/Credit_Note/Index.cshtml', Model: merchnatInvoiceDetails });
}));

module.exports = router;
