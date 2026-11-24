'use strict';
// Ported from Franchise\Controllers\CustomerPanel\StatisticalReport.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const { auth, requireType } = require('../../middleware/auth');

const router = express.Router();
const guard = [auth, requireType('franchise')];

// auth (legacy had no session check; view only, no data)
router.all('/franchise/StatisticalReport/Index{/:id}', ...guard, (req, res) => res.json({}));

module.exports = router;
