'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\binary_tree3.cs (class binary_tree3Controller => /binary_tree3/...)
const express = require('express');
const { adminAuth } = require('./_shared/admin-session');

const router = express.Router();
const C = 'binary_tree3';

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/binary-tree3" -> binary_tree3/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/binary-tree3'], adminAuth, (req, res) => {
  res.json({ view: '~/Views/AdminPanel/binary_tree3/Index.cshtml' });
});

module.exports = router;
