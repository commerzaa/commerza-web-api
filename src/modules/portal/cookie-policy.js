'use strict';
// Ported from ClusterofferShopingPortal\Controllers\COOKIE_POLICY.cs (class COOKIE_POLICYController => /portal/COOKIE_POLICY/...)
// No database access.
const express = require('express');
const { view } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/COOKIE_POLICY';

// ---------------------------------------------------------------- Index()
// public
// route-config: "COOKIE-POLICY/{action}" (action default Index) -> COOKIE_POLICY/Index
router.all([`${C}/Index{/:id}`, C, '/portal/COOKIE-POLICY', '/portal/COOKIE-POLICY/Index'], (req, res) => view(res, '~/Views/COOKIE_POLICY/Index.cshtml'));

module.exports = router;
