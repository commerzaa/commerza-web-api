'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/SubscriptionHistory.cs. DB: 'shopping' */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();
const DB = 'shopping';
const PROPS = ['SNO', 'PuchaseDate', 'AllPackageName', 'ModeName', 'TotalPayableAmount', 'CommentORRemark', 'Status', 'TASMID'];

// route-config: merchant/subscription-history -> Index
// auth
router.all(['/merchant/SubscriptionHistory/Index{/:id}', '/merchant/subscription-history'], auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await proc(DB, 'usp_managesubscriptionmaster', { mode: '2', plid: Plid });
  res.json({ view: '~/Views/SubscriptionHistory/Index.cshtml', Model: mapRows(rows, PROPS) });
}));

module.exports = router;
