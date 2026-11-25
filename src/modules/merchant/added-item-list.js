'use strict';
/** Port of Shoping Portal Merchant Panel/Controllers/CustomerPanel/Added_Item_List.cs (Added_Item_ListController). DB: 'shopping' (Db_Shopping) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/Added_Item_List';
const guard = [auth, requireType('merchant')];
const PROPS = ['RowNumber', 'TOILID', 'ItemName', 'ItemCode', 'SellingPrice', 'CPoints', 'Status'];

// ---- Index ---------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck])
const indexHandler = asyncHandler(async (req, res) => {
  let { fromDate, toDate, page } = req.p;
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  const BranchId = req.user.plid;
  const ViewBag = { BranchId };
  const MaxRows = await UtilityClass.GridPageSize();
  page = page === undefined || page === null || page === '' ? 1 : parseInt(page, 10);
  const rows = await proc(DB, 'usp_manage_add_item', {
    mode: 2, plid: BranchId, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
  });
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const f = rows && rows[0];
  const tk = f ? Object.keys(f).find((k) => k.toLowerCase() === 'totalcount') : undefined;
  const TotalRecord = f && tk !== undefined ? (parseInt(f[tk], 10) || 0) : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.BranchId = BranchId;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  res.json({ Model: mapRows(rows, PROPS), ViewBag });
});
router.all([`${P}/Index{/:id}`, P], ...guard, indexHandler);
// route-config: merchant/added-item-list
router.all('/merchant/merchant/added-item-list', ...guard, indexHandler);

module.exports = router;
