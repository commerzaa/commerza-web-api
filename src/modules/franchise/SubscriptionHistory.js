'use strict';
/** Port of Franchise/Controllers/CustomerPanel/SubscriptionHistory.cs. DB: 'shopping' */
const express = require('express');
const { query, scalar, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pint = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, name = 'totalcount') => { const f = rows && rows[0]; if (!f) return 0; const k = Object.keys(f).find((x) => x.toLowerCase() === name); return k === undefined ? 0 : (parseInt(f[k], 10) || 0); };
const PROPS = ['SNO', 'PuchaseDate', 'AllPackageName', 'ModeName', 'TotalPayableAmount', 'CommentORRemark', 'Status', 'TASMID'];

// auth
router.all('/franchise/SubscriptionHistory/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const rows = await proc(DB, 'usp_managesubscriptionmaster', { mode: '2', plid: Plid });
  res.json({ Model: mapRows(rows, PROPS) });
}));

module.exports = router;
