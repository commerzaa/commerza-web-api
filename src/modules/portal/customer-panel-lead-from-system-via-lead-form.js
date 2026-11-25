'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/LeadFromSystemViaLeadForm.cs (LeadFromSystemViaLeadFormController)
// Actions: Index (1)
const express = require('express');

const router = express.Router();

// public (legacy had no session check; view only, no server-side data)
// route-config: none active (the "LeadFromSystemViaLeadForm" MapRoute is commented out in RouteConfig.cs)
router.all(['/portal/LeadFromSystemViaLeadForm/Index{/:id}', '/portal/LeadFromSystemViaLeadForm'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/LeadFromSystemViaLeadForm/Index.cshtml' });
});

module.exports = router;
