'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\All_Merchant.cs (All_MerchantController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/All_Merchant';
const nz = (v, d) => (v === undefined || v === null ? d : v);
const intOrNull = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));

// auth // route-config: franchisee/All-Merchant
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/All-Merchant'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const MOBILE = nz(p.MOBILE, '');
  const SearchField = nz(p.SearchField, '');
  const SearchValue = nz(p.SearchValue, '');
  const fromDate = nz(p.fromDate, '');
  const toDate = nz(p.toDate, '');
  const Availbalance = nz(p.Availbalance, '');
  const SearchKyc = nz(p.SearchKyc, '-1');
  const SearchBusinessInfo = nz(p.SearchBusinessInfo, '');
  const SearchBusinessType = nz(p.SearchBusinessType, '0');
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc('shopping', 'USP_ALLMERCHANTDETAILS', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, did: DID,
    balance: Availbalance, orderbycrdeit: '0', minamount: '0', maxamount: '0', searchkyc: SearchKyc, searchbusinessinfo: SearchBusinessInfo,
    searchbusinesstype: SearchBusinessType,
  });
  const AllEPinRequestsList = mapRows(rows, ['rownumber', 'CLID', 'UPDATEDDATE', 'ADDMONEY', 'TRANSFERTOBANK', 'TOTALBALANCE', 'AVAILABLEBALANCE', 'DID',
    'NAME', 'EMAILID', 'PHONE', 'LOGINID', 'PackagesName', 'Amount', 'BusinessInfo', 'KycStatusText']);
  const n = parseInt(((rows && rows[0]) || {}).totalcount, 10);
  res.json({
    Model: AllEPinRequestsList,
    QUALIFICATIONlis: '',
    CurrentPage: page,
    MOBILE,
    GridPageSize: MaxRows,
    TotalRecord: Number.isNaN(n) ? 0 : n,
    NoPerPage: UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    QUALIFICATION: intOrNull(p.QUALIFICATION),
    userid: intOrNull(p.userid),
    ORDERBY: p.ORDERBY === undefined ? null : p.ORDERBY,
    Isdownload: intOrNull(p.Isdownload),
  });
}));

module.exports = router;
