'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Payout_Reports.cs (class Payout_ReportsController => /admin/Payout_Reports/...)
// Database: affiliate (Db_Affiliate).
// Note: RouteConfig "AdminPanel/Client-Payout" (name "Payout_Reports") targets Client_Payout, not this controller.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Payment_Mode = require('../../lib/admin/Payment_Mode');
const { adminAuth } = require('./_shared/adminSession');
const { nInt, nStr, col, str, nullRef } = require('./_shared/batch11_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Payout_Reports';

/** class WithdrawalRequestList (this file) */
const WITHDRAWAL_REQUEST_PROPS = ['rowNumber', 'regno', 'wdid', 'IncomeType', 'TDS', 'status', 'LoginId', 'username', 'Name', 'mobile', 'reqdate',
  'TotalWithdrawAmount', 'AdminCharge', 'WithdrawAmount', 'PaybleAmount', 'TransAmount', 'RemainAmount', 'RejAmount', 'TransID',
  'accountHolderName', 'accountNo', 'bankName', 'ifscCode', 'PanNo', 'payid', 'statuslink', 'PayableAmount', 'Binaryincome', 'Directincome',
  'Repurchase'];

/** int.Parse(<decimal OUT>.Value.ToString()) - PORT-NOTE: decimal OUT params without Scale came back with scale 0 => parse ok; DBNull => FormatException */
function parseOutInt(rows, name) {
  const v = col(rows && rows[0], name);
  if (v === undefined) return 0; // no rows: PG cannot return the OUT value
  const s = str(v);
  if (!/^[-+]?\d+(\.\d+)?$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Math.round(Number(s));
}

// ---------------------------------------------------------------- ActionResult Index(int? payid, string SearchField, string SearchValue, string fromDate, string toDate, string withdrawaltype, int? page)
// auth. PORT-NOTE: legacy checked Session["member_master"], which the admin app never sets => it ALWAYS redirected to Home/Index.
// That is reproduced (sessionStore 'member_master' is never set); adminAuth added because the action returns member financial data.
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let payid = nInt(req.p.payid);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let withdrawaltype = nStr(req.p.withdrawaltype);
  let page = nInt(req.p.page);
  const member = sessionStore.get(req, 'member_master');
  if (member === null || member === undefined) return res.json({ redirect: '/Home/Index' });
  if (payid === null) payid = 0;
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (toDate === null) toDate = '';
  if (fromDate === null) fromDate = '';
  const ViewBag = {};
  const TempData = {};
  if (member.regNo === undefined) throw nullRef();
  const RegNo = member.regNo;
  ViewBag.PayList = await Payment_Mode.PayModeList();
  if (withdrawaltype === null) withdrawaltype = '';
  if (payid > 0) {
    ViewBag.payid = payid;
    TempData.show = 'yes';
  }
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_ALL_ADMIN_WITHDRAWREQUEST', {
    STARTROWINDEX: page, MAXROWS: 100, PAYID: payid, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: SearchValue.trim(),
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(), WITHDRAWALTYPE: withdrawaltype.trim(), STATUSTYPE: 'Pending', WDID: '',
    REGNO: Number(RegNo),
  });
  const AllWithdrawRequestsList = mapRows(rows, WITHDRAWAL_REQUEST_PROPS);
  const TotalRecord = 0; // PORT-NOTE: legacy never read @TOTALCOUNT
  const netTDS = parseOutInt(rows, 'tds');
  const netAdminCharge = parseOutInt(rows, 'admincharge');
  const netEWallet = parseOutInt(rows, 'ewallet');
  const netTotalAmountnew = parseOutInt(rows, 'totalamountnew');
  ViewBag.TotalAmount = str(col(rows[0], 'totalamount'));
  ViewBag.tdsnet = netTDS;
  ViewBag.adminchargenet = netAdminCharge;
  ViewBag.ewalletnet = netEWallet;
  ViewBag.totalamountnewnet = netTotalAmountnew;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.withdrawaltype = withdrawaltype;
  ViewBag.payid = payid;
  return res.json({ view: '~/Views/MemberPanel/Payout_Reports/Index.cshtml', Model: AllWithdrawRequestsList, ...ViewBag, TempData });
}));

module.exports = router;
