'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/SubscriptionHistory.cs (SubscriptionHistoryController, 2 actions: Index, CancelOrder)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: SubscriptionHistory -> referral/subscription-history (id optional)
 * PORT-NOTE: CancelOrder has no session check in legacy but cancels a member's deposit order => auth.
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const C = 'SubscriptionHistory';

const colOf = (rows, n) => { const r = Array.isArray(rows) ? rows[0] : rows; if (!r) return null; const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? null : r[k]; };
const P_SUBS = ['SNO', 'PuchaseDate', 'AllPackageName', 'ModeName', 'TotalPayableAmount', 'CommentORRemark', 'Status', 'TASMID', 'IsOrderCanCancel'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/subscription-history{/:id}'], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_managesubscriptionmaster', { mode: '2', plid: Plid });
  res.json({ Model: mapRows(rows, P_SUBS) });
}));

// ---- CancelOrder ---------------------------------------------------------------------------------------------------
// auth
router.all(`/member/${C}/CancelOrder{/:id}`, auth, asyncHandler(async (req, res) => {
  // PORT-NOTE: @StrOutPut OUT is the "stroutput" column of the procedure result row
  const out = await proc(DB, 'usp_canceldepositorder', { tasmid: req.p.TASMID });
  const v = colOf(out, 'stroutput');
  if (v === null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(String(v));
}));

module.exports = router;
