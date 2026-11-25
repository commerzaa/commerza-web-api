'use strict';
/** Ported from Member\Common\Controllers\EthereumTransactionController.cs (EthereumTransactionController) */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/EthereumTransaction';

// public (no session check in legacy; view only, no server-side data)
router.all([`${P}/Index{/:id}`, P], asyncHandler(async (req, res) => {
  res.json({});
}));

// route-config: url "ether-scan-transaction" -> EthereumTransaction/Index
// public
router.all('/member/ether-scan-transaction', asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
