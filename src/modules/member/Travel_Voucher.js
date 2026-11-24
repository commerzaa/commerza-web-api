'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Travel_Voucher.cs (Travel_VoucherController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// decimal.Parse(x.ToString()): throws on null/empty
const parseDec = (v) => {
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) throw new Error('Input string was not in a correct format.');
  return Number(v);
};
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');

const VOUCHER_PROPS = ['ROWNUMBER', 'USERNAME', 'MOBILENO', 'DATE', 'TOTALBV', 'DISTRIBUTEBV', 'TOTALMEMBER', 'TOTALINCOME', 'TDS', 'NETINCOME'];

// auth
// route-config: "referral/Travel-Voucher-income-report" -> Travel_Voucher/Index (id optional)
router.all(['/member/Travel_Voucher/Index{/:id}', '/member/referral/Travel-Voucher-income-report{/:id}'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = optInt(req.p.ddlcustpage);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  let page = optInt(req.p.page);
  // RoleMaster is accepted by the legacy action but never used
  if (ddlcustpage === null) ddlcustpage = 100;

  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let listTravelVoucher = [];
  let ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: OUT params (@TOTALCOUNT,@NETINCOME,@TOTALTDS,@TOTALINCOME) are read from columns of the first result row.
    const rows = await db.proc(DB, 'usp_travelvoucher_report', {
      regno: Plid, vouchertype: '1', startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue.trim(),
      fromdate: fromDate, todate: toDate,
    });
    listTravelVoucher = mapRows(rows, VOUCHER_PROPS);
    const r0 = rows[0];
    const tc = col(r0, 'totalcount');
    const TotalRecord = parseInt(tc === null || String(tc) === '' ? '0' : String(tc), 10);

    const TotalAllIncome = parseDec(col(r0, 'totalincome'));
    const TotalNetAllIncome = parseDec(col(r0, 'netincome'));
    const TotalSumTds = parseDec(col(r0, 'totaltds'));

    ViewBag = {
      CurrentPage: page,
      GridPageSize: MaxRows,
      TotalRecord,
      TotalAllIncome,
      TotalSumTds,
      TotalNetAllIncome,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField,
      SearchValue,
      fromDate,
      toDate,
      ddlcustpage,
    };
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'insert_email_newsletter', 0, legacyPath(req)); } catch (e) { console.error(e); }
  }
  res.json({ view: '~/Views/CustomerPanel/Travel_Voucher/Index.cshtml', Model: listTravelVoucher, ViewBag });
}));

module.exports = router;
