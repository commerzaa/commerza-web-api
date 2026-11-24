'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Totalbtc.cs (TotalbtcController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/Totalbtc';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const BlockChainAPI = require('../../lib/member/BlockChainAPI');

// route-config: total-btc
// public (legacy action had no session check)
router.all([`${P}/Index{/:id}`, '/member/total-btc'], asyncHandler(async (req, res) => {
  const BitCoinAmount = await BlockChainAPI.BitcoinTodollarConvertor();
  const a = Number(await scalar(DB, 'SELECT coalesce(INR,0) FROM TBL_ATC_INR_RATIO_MASTER limit 1')) || 0;
  res.json({ ViewBag: { TotalVBTC: a.toFixed(2), TotalBtc: BitCoinAmount } });
}));

module.exports = router;
