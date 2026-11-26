'use strict';
// Ported from ClusterofferShopingPortal\Controllers\RESTRICTED_AND_PROHIBITEDITEMS.cs (class RESTRICTED_AND_PROHIBITEDITEMSController)
// Database: shopping (Db_Shopping) - not used (static view).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const C = 'RESTRICTED_AND_PROHIBITEDITEMS';

// ---------------------------------------------------------------- Index() => return View()
// public (static outer page)
// route-config: "RESTRICTED-AND-PROHIBITEDITEMS/{action}" (action default Index)
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/RESTRICTED-AND-PROHIBITEDITEMS', '/portal/RESTRICTED-AND-PROHIBITEDITEMS/Index'],
  asyncHandler(async (req, res) => res.json({ view: `~/Views/${C}/Index.cshtml` })));

module.exports = router;
