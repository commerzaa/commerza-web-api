'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\customer_wallet.cs (customer_walletController)
 * Actions: Index (1)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const CUSTOMER_WALLET_PROPS = ['rownumber', 'CLID', 'UPDATEDDATE', 'ADDMONEY', 'TRANSFERTOBANK', 'TOTALBALANCE', 'AVAILABLEBALANCE', 'DID', 'NAME', 'EMAILID', 'PHONE', 'LOGINID',
  'PackagesName', 'Amount', 'BusinessInfo', 'KycStatusText'];

// route-config: franchisee/customer-wallet
// auth
router.all(['/franchise/customer_wallet/Index{/:id}', '/franchise/franchisee/customer-wallet'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let { SearchField, SearchValue, fromDate, toDate, MOBILE, Availbalance } = p;
  const { ORDERBY } = p;
  const num = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
  let page = num(p.page);
  const QUALIFICATION = num(p.QUALIFICATION), userid = num(p.userid), Isdownload = num(p.Isdownload);
  if (MOBILE == null) MOBILE = '';
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (Availbalance == null) Availbalance = '';
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const rows = await db.proc(DB, 'USP_CUSTOMERWALLET', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate, DID, BALANCE: Availbalance,
  });
  const AllEPinRequestsList = mapRows(rows, CUSTOMER_WALLET_PROPS);
  const f = rows && rows[0];
  const TotalRecord = parseInt(f ? (f.totalcount !== undefined ? f.totalcount : f.recordcount) : 0, 10) || 0;
  const ViewBag = {
    QUALIFICATIONlis: '', CurrentPage: page, MOBILE, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue,
    fromDate, toDate, QUALIFICATION, userid, ORDERBY, Isdownload,
  };
  res.json({ Model: AllEPinRequestsList, ViewBag });
}));

module.exports = router;
