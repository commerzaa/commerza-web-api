'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/StatisticalReport.cs (StatisticalReportController)
const express = require('express');

const router = express.Router();
const DB = 'shopping'; // eslint-disable-line no-unused-vars

// public (legacy had no session check; view only, no data)
// route-config: merchant/statistical-report -> StatisticalReport/Index
router.all(['/portal/StatisticalReport/Index{/:id}', '/portal/StatisticalReport', '/portal/merchant/statistical-report{/:id}'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/StatisticalReport/Index.cshtml' });
});

module.exports = router;
