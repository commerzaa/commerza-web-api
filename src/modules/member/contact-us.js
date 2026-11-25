'use strict';
/**
 * Port of Member/Common/Controllers/ContactUsController.cs (contact_usController)
 * Prefix: /member   DB: affiliate (error log only)
 */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();

// ---- ContactUsEamilSms ---------------------------------------------------------------------------------
// public
// route-config: contact-us/{action} with action = ContactUsEamilSms
router.all(['/member/contact_us/ContactUsEamilSms{/:id}', '/member/contact-us/ContactUsEamilSms'], (req, res) => {
  res.json('success');
});

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: contact-us/{action}  (contact_us / Index)
// public
router.all(['/member/contact_us/Index{/:id}', '/member/contact-us{/:action}'], asyncHandler(async (req, res) => {
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return res.json({
    view: '~/Views/contact_us/Index.cshtml',
    ViewBag: { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' },
  });
}));

module.exports = router;
