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
// Port of Franchise\Controllers\CustomerPanel\APIDocsGet.cs (1 action)
// route-config: franchisee/APIDocsGet -> Index
// auth
router.all(['/franchise/APIDocsGet/Index{/:id}', '/franchise/franchisee/APIDocsGet'], auth, asyncHandler(async (req, res) => {
  const DID = Number(req.user.pmid);
  const out = { pmid: DID };
  if (DID !== 0) {
    const url = await db.scalar('shopping', 'select APIURL from TBL_COMPANYSETTINGS where PMID=@did limit 1', { did: DID });
    out.url = url === undefined ? null : url;
  }
  res.json(out);
}));

module.exports = router;
