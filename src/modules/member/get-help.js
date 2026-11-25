'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\Get_Help.cs (Get_HelpController) */
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
const P = '/member/Get_Help';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_GET = ['GetID', 'RequestID', 'Regno', 'Request_Date', 'Request_Amount', 'Remain_Amount', 'Confirm_Amount', 'Confirm_Date', 'Receive_Amount', 'Status'];

// route-config: referral/Get-Help
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/Get-Help'], auth, asyncHandler(async (req, res) => {
  const regno = Number(req.user.plid);
  const AvailableCommissionWallet = Number(await scalar(DB, 'select coalesce(AvailableCommissionWallet,0) from MEMBER_PERFORMANCE where regno=@r limit 1', { r: regno })) || 0;
  const Get_Help_Obj = mapRows(await proc(DB, 'details_get_help', { plid: regno }), P_GET);
  res.json({ Model: Get_Help_Obj, ViewBag: { AvailableCommissionWallet } });
}));

// auth
router.all(`${P}/GetHelp{/:id}`, auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const out = await procOne(DB, 'usp_gethelp', { plid: Plid, amount: Number(req.p.Getamount) });
  res.json(str(out && out.strresult));
}));

module.exports = router;
