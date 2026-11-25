'use strict';
const DB = 'shopping';
// Ported from Merchant Panel Controllers/CustomerPanel/StatisticalReport.cs (database: shopping - Db_Shopping)
const express = require('express');
const { auth, requireType } = require('../../middleware/auth');

const router = express.Router();
const guard = [auth, requireType('merchant')];

// auth (legacy had no session check; view only, no data)
// route-config: merchant/statistical-report
router.all(['/merchant/StatisticalReport/Index{/:id}', '/merchant/merchant/statistical-report{/:id}'], ...guard, (req, res) => res.json({}));

module.exports = router;
