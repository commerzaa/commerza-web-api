'use strict';
// Ported from Franchise/Controllers/CustomerPanel/Aggregate_Wallet_Statement.cs  (DB: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const config = require('../../config');
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const PROPS = ['ROWNUMBER', 'DID', 'NAME', 'Email_Id', 'Contact', 'DPSID', 'credit_wallet', 'Used_wallet', 'Available_wallet', 'CreatedDate', 'Status', 'Emp_ID'];
const tab = (s) => String(s).replace(/\t/g, '    ');
const f2 = (v) => Number(v).toFixed(2);

// ExportReport: writes a tab separated .xls next to the app (legacy wrote ~/Aggregate_Wallet_Statement.xls); errors swallowed
async function ExportReport(user, SearchField, SearchValue, fromdate, todate, page, ddlcustpage) {
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  try {
    const MaxRows = 100;
    if (page == null || page === '') page = 1;
    // SQL text of the export call has no @DID
    const rows = await proc('shopping', 'usp_distributorprepaid_setting', {
      startrowindex: Number(page), maxrows: MaxRows, fromdate, todate,
      searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(),
    });
    const list = mapRows(rows, PROPS);
    const filepath = path.join(config.uploadDir, 'Aggregate_Wallet_Statement.xls');
    fs.mkdirSync(config.uploadDir, { recursive: true });
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let s = '';
    s += 'Sr No \t';
    s += 'Name \t';
    s += 'Credit Wallet \t';
    s += 'Used Wallet  \t';
    s += 'Available Wallet \t';
    for (const Item of list) {
      s += '\n';
      s += tab(Item.ROWNUMBER) + ' \t';
      s += tab(Item.NAME) + ' \t';
      s += tab(f2(Item.credit_wallet)) + ' \t';
      s += tab(f2(Item.Used_wallet)) + ' \t';
      s += tab(f2(Item.Available_wallet)) + ' \t';
    }
    fs.writeFileSync(filepath, s);
  } catch (ex) { /* swallowed like the legacy catch */ }
}

// auth
router.all(['/franchise/Aggregate_Wallet_Statement/Index{/:id}', '/franchise/Aggregate_Wallet_Statement'], auth, asyncHandler(async (req, res) => {
  const did = Number(req.user.did);
  let { SearchField, btnexel, SearchValue, fromdate, todate, ddlcustpage } = req.p;
  let page = req.p.page;
  if (ddlcustpage == null || ddlcustpage === '') ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';
  const MaxRows = 100;
  if (page == null || page === '') page = 1;
  const rows = await proc('shopping', 'usp_distributorprepaid_setting', {
    startrowindex: Number(page), maxrows: MaxRows, fromdate, todate,
    searchfiel: SearchField.trim(), searchvalue: SearchValue.trim(), did,
  });
  // PORT-NOTE: @TOTALCOUNT OUT read from "totalcount" column of first row (0 if none)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  if (btnexel === 'Export Excel') {
    await ExportReport(req.user, SearchField, SearchValue, fromdate, todate, page, ddlcustpage);
  }
  res.json({
    Model: mapRows(rows, PROPS),
    ViewBag: { QUALIFICATIONlis: '', CurrentPage: page, GridPageSize: MaxRows, TotalRecord, SearchField: '', SearchValue: '' },
  });
}));

// auth - public ExportReport (void action)
router.all('/franchise/Aggregate_Wallet_Statement/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  await ExportReport(req.user, req.p.SearchField, req.p.SearchValue, req.p.fromdate, req.p.todate, req.p.page, req.p.ddlcustpage);
  res.status(200).end();
}));

module.exports = router;
