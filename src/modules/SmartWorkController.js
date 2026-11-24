'use strict';
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { proc, queryOne } = require('../db');
const { mapRows, netDate } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');

const router = express.Router();

const TREE_PROPS = ['PARENTREGNO', 'CHILDREGNO', 'side', 'loginID', 'NAME', 'regNo', 'spID', 'SPNAME', 'RegDate', 'DOC', 'Title',
  'leftMembers', 'rightMembers', 'directMembers', 'totalMember', 'leftIncome', 'rightIncome', 'parentID', 'childID', 'Active', 'ImageName',
  'PBV', 'DLBV', 'DRBV', 'TOTAL_LBV', 'TOTAL_RBV', 'CURRENT_LBV', 'CURRENT_RBV', 'PAIDBV', 'FLUSHBV', 'PPV', 'TOTAL_LPV', 'TOTAL_RPV',
  'CURRENT_LPV', 'CURRENT_RPV', 'PAIDPV', 'USERNAME', 'FLUSHPV', 'LCOUNT', 'LROUNT', 'ActivationDate', 'SPUSERNAME', 'FLUSHINCOME', 'GENDER',
  'TOTALLEFTCOUNT', 'TOTALRIGHTCOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALRIGHTACTIVECOUNT', 'memStatus', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER', 'KID'];
const INCOME_PROPS = ['ROWNUMBER', 'USERNAME', 'Name', 'MOBILE', 'DATE', 'ADMINCHARGE', 'TDS', 'NetIncome', 'MatchCount', 'TotalIncome'];

function toInt64(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

// auth
router.post('/api/TreeView', auth, asyncHandler(async (req, res) => {
  const RegNo = Number(req.p.RegNo);
  if (req.p.RegNo === undefined || req.p.RegNo === '' || Number.isNaN(RegNo)) {
    return res.status(400).json({ Message: 'The request is invalid.' });
  }
  // legacy CommandTimeout = 10000s
  const rows = await proc('affiliate', 'Usp_CreateTreeView', { regno: RegNo, maxlevel: 3 });
  res.json(mapRows(rows, TREE_PROPS));
}));

// auth
router.post('/api/SmartWorkIncome', auth, asyncHandler(async (req, res) => {
  let { plid, SearchField, SearchValue, fromdate, todate, page, ddlcustpage } = req.p;
  page = (page === undefined || page === null || page === '') ? null : Number(page);
  ddlcustpage = (ddlcustpage === undefined || ddlcustpage === null || ddlcustpage === '') ? null : Number(ddlcustpage);
  if (plid == null) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  if (ddlcustpage == null) ddlcustpage = 100;
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromdate == null) fromdate = '';
  if (todate == null) todate = '';

  const Plid = toInt64(plid);
  let loginid = '';
  const row = await queryOne('affiliate', 'select loginid from member_master where regno = @regno limit 1', { regno: Plid });
  if (row != null) loginid = row.loginid;
  const MaxRows = 1000; // UtilityClass.GridPageSize();
  if (page == null) page = 1;

  const rows = await proc('affiliate', 'USP_SMARTWORKINCOME', {
    startrowindex: page,
    maxrows: MaxRows,
    regno: Plid, // Convert.ToInt32(Plid)
    searchfield: String(SearchField).trim(),
    searchvalue: String(SearchValue).trim(),
    fromdate: String(fromdate).trim(),
    todate: String(todate).trim(),
  });
  // PORT-NOTE: @TOTALCOUNT OUT was only parsed into an unused local (TotalRecord); not re-parsed here.
  const AllFreeList = mapRows(rows, INCOME_PROPS).map((r) => ({ ...r, DATE: netDate(r.DATE) }));
  await UtilityClass.GridNumbersPerPage();
  res.json([{ status: 'true', message: 'success', data: AllFreeList }]);
}));

module.exports = router;
