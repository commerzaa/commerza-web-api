'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };

// Port of Franchise\Controllers\TransferToBank.cs (2 actions)
// route-config: franchisee/Wallet-Summary -> Index
// auth
router.all(['/franchise/TransferToBank/Index{/:id}', '/franchise/franchisee/Wallet-Summary'], auth, asyncHandler(async (req, res) => {
  const DID = req.user.did;
  const r = await db.procOne('shopping', 'usp_reseller_comission_available', { DID });
  res.json({
    TOTALBALNACE: r ? r.totalbalance : null,
    WITHDRWAl: r ? r.withdrwal : null,
    BALANCE: r ? r.balance : null,
    CREDIT: r ? r.credit : null,
  });
}));

// auth
router.all('/franchise/TransferToBank/TransferToBankRequest{/:id}', auth, asyncHandler(async (req, res) => {
  const { Transferid, Amount, AVAILABLEAMOUNT, Withdrawl } = req.p;
  let result = 0;
  const DID = req.user.did;
  const r = await db.procOne('shopping', 'usp_reseller_comission_transfertobank', {
    MODE: 1, DID, AVAILABLEAMOUNT, WITHDRWAL: Withdrawl, TRANSFERID: Transferid, AMOUNT: Amount,
  });
  const ret = r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '';
  if (ret === 'INSERT') result = 1;
  res.json(result);
}));

module.exports = router;
