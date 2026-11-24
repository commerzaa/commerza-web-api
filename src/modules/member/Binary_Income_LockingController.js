'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Binary_Income_LockingController.cs (Common.Controllers.CustomerPanel.Binary_Income_LockingController)
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const DB = 'affiliate';
const Binary_Income_Locking = ['ROWNUMBER', 'PAYDATE', 'TotalBinary', 'ReleasedBinary', 'LockBinary', 'LastReleaseDate'];
const orEmpty = (v) => (v === undefined || v === null ? '' : String(v));

// route-config: referral/lu2P6i7hhQBDAt1DbQfLGA== -> Binary_Income_Locking/Index
// auth (legacy had no explicit session check but reads Session["Plid"])
router.all(['/member/Binary_Income_Locking/Index{/:id}', '/member/referral/lu2P6i7hhQBDAt1DbQfLGA=='], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = orEmpty(p.fromDate);
  const toDate = orEmpty(p.toDate);
  const ddlcustpage = p.ddlcustpage === undefined || p.ddlcustpage === '' ? 100 : parseInt(p.ddlcustpage, 10);
  const MaxRows = ddlcustpage;
  const page = p.page === undefined || p.page === '' ? 1 : parseInt(p.page, 10);
  const Plid = Number(req.user.plid);
  const r = await db.scalar(DB, 'select REGNO from MEMBER_MASTER where REGNO=@plid limit 1', { plid: Plid });
  const Regno = r === null || r === undefined ? 0 : r;
  const rows = await db.proc(DB, 'usp_binaryincomelocking', { regno: Regno, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows });
  const Obj = mapRows(rows, Binary_Income_Locking);
  res.json({ Model: Obj, CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, ddlcustpage });
}));

module.exports = router;
