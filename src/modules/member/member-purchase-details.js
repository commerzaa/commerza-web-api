'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/MemberPurchaseDetails.cs (MemberPurchaseDetailsController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['RowNumber', 'ORDERDATE', 'ORDERNO', 'ORDERAMOUNT', 'BV', 'PV', 'CashBack', 'Mobile', 'MERCHANTNAME', 'ADDRESS', 'MERCHANTMOBILE'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const totalOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/self-shopping-details  (MemberPurchaseDetails / Index)
// auth
router.all(['/member/MemberPurchaseDetails/Index{/:id}', '/member/referral/self-shopping-details'], auth, asyncHandler(async (req, res) => {
  const ViewBag = { mobile: req.user.mobile }; // ((Login)Session["plid"]).MOBILE
  const ddlcustpage = toInt(req.p.ddlcustpage, 100);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const RoleMaster = nn(req.p.RoleMaster);
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  let AllFreeEpinList = [];
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @TotalCount OUT is read from the first result row (column totalcount); 0 when no rows.
    const rows = await proc(DB, 'sp_userrepurchase_details', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      rolename: RoleMaster.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    });
    AllFreeEpinList = mapRows(rows, PROPS);
    const TotalRecord = totalOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField, SearchValue, fromDate, toDate, ddlcustpage,
    });
  } catch (e) {
    console.error(e);
    try { await new DataUtility().ErrorInsert(0, e.message, 'insert_email_newsletter', 0, req.path); } catch (e2) { console.error(e2); }
  }
  return res.json({ view: '~/Views/CustomerPanel/MemberPurchaseDetails/Index.cshtml', Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
