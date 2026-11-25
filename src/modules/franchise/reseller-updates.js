'use strict';
// Ported from Franchise\Controllers\CustomerPanel\ResellerUpdates.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const COLS = ['TFNID', 'POID', 'TFNTID', 'DID', 'NOTIFICATIONDESCRIPTION', 'REFERENCEID', 'NOTIFICATIONDATE', 'Expecteddelivery', 'Prod_Images', 'ISREAD', 'ACTIVE', 'OrderId', 'STATUS', 'INTSTATUS', 'Product_Name', 'TMID'];

// auth
const indexHandler = asyncHandler(async (req, res) => {
  const DID = Number(req.user.did);
  const Notificationcount = Number(await db.scalar('shopping', 'SELECT COUNT(1) FROM tbl_franchise_notifications WHERE did = @did AND active = true', { did: DID })) || 0;
  const diff = await db.query('shopping',
    `SELECT tfnid, coalesce(floor(extract(epoch from (fun_getcurrentdate() - isreaddate)) / 3600), 0)::int AS hours_difference
     FROM tbl_franchise_notifications WHERE did = @did AND isread = true`, { did: DID });
  const nrows = await db.proc('shopping', 'usp_getnotificationsfranchise', { DID });
  // PORT-NOTE: @MESSAGE OUT read from the 'message' column of the first row
  const StrResult = nrows.length && nrows[0].message !== undefined && nrows[0].message !== null ? String(nrows[0].message) : '';
  for (const it of diff) {
    if (it.hours_difference > 23) {
      await db.exec('shopping', 'UPDATE tbl_franchise_notifications SET active = false, isreaddate = NULL WHERE tfnid = @id', { id: it.tfnid });
    }
  }
  res.json({ Model: mapRows(nrows, COLS), status: StrResult, LoginID: DID, Notificationcount });
});
router.all('/franchise/ResellerUpdates/Index{/:id}', ...guard, indexHandler);
// route-config
router.all('/franchise/franchisee/updates', ...guard, indexHandler);

module.exports = router;
