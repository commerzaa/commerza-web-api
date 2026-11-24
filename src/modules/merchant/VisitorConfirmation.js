'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/CustomerPanel/VisitorConfirmation.cs
const express = require('express');
const path = require('path');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const RegistrationConfirmation = require('../../lib/merchant/RegistrationConfirmation');

// public (email verification link)
// route-config: Regisrtration-Confirmation/{action}
router.all(['/merchant/VisitorConfirmation/Index{/:id}', '/merchant/VisitorConfirmation', '/merchant/Regisrtration-Confirmation{/:action}'], asyncHandler(async (req, res) => {
  const emailid = req.p.emailid;
  const vmid = req.p.vmid;
  const PageUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  const out = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '', Message: '' };
  if (emailid !== undefined && emailid !== null && emailid !== '' && vmid !== undefined && vmid !== null && vmid !== '') {
    // Server.MapPath("visitor_confirm.html")
    out.Message = await RegistrationConfirmation.Verification(String(req.query.vmid !== undefined ? req.query.vmid : vmid), String(req.query.emailid !== undefined ? req.query.emailid : emailid), path.resolve('visitor_confirm.html'));
  } else {
    out.Message = "Please Don't Play With URL.!!!";
  }
  res.json(out);
}));

module.exports = router;
