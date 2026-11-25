'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/Add_Item.cs (Add_ItemController, 2 actions). DB: 'shopping' */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();
const DB = 'shopping';
const ITEM_PROPS = ['RowNumber', 'TOILID', 'ItemName', 'ItemCode', 'SellingPrice', 'CPoints', 'Status'];
// PORT-NOTE: stored-proc OUT parameters (@StrResult, @TotalCount) come back as same-named lower-case columns of the result row.
const num = (v) => { const n = Number(v); if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(n)) throw new Error('Invalid numeric parameter'); return n; };

// route-config: merchant/add-item -> Index
// auth (legacy cast Session["Plid"] with no null check)
router.all(['/merchant/Add_Item/Index{/:id}', '/merchant/add-item'], auth, asyncHandler(async (req, res) => {
  let TOILID = req.p.TOILID;
  if (TOILID === undefined || TOILID === null) TOILID = '0';
  const BranchId = Number(req.user.plid);
  const rows = await proc(DB, 'usp_manage_add_item', {
    mode: 1, plid: BranchId, fromdate: '', todate: '', startrowindex: 1, maxrows: 100, toilid: TOILID,
  });
  const Model = mapRow(rows[0] || null, ITEM_PROPS);
  res.json({ view: '~/Views/Add_Item/Index.cshtml', Model, TOILID });
}));

// auth ([SessionExpireCheck])
router.all('/merchant/Add_Item/AddItem{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  let ReturnOutput = '';
  try {
    const { TOILID, ItemCode, ItemName } = req.p;
    const r = await procOne(DB, 'usp_add_item', {
      plid: Plid, itemcode: ItemCode, itemname: ItemName,
      sellingprice: num(req.p.SellingPrice), cpoint: num(req.p.CPoint), status: parseInt(num(req.p.Status), 10),
      toilid: TOILID,
    });
    const out = r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '';
    if (out.toLowerCase() === 'success') ReturnOutput = 'success';
    else ReturnOutput = out;
  } catch (ExpObj) {
    ReturnOutput = 'error^' + ExpObj.message;
  }
  res.json(ReturnOutput);
}));

module.exports = router;
