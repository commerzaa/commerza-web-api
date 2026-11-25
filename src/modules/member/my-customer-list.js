'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/MyCustomerList.cs (MyCustomerListController)
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

const PROPS = ['RowNumber', 'PLID', 'REGNO', 'LOGINID', 'USERNAME', 'FULLNAME', 'FNAME', 'LNAME', 'PHONE', 'EMAILID', 'STATUS', 'REGDATE'];
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
// route-config: referral/my-customer-list  (MyCustomerList / Index)
// auth
router.all(['/member/MyCustomerList/Index{/:id}', '/member/referral/my-customer-list'], auth, asyncHandler(async (req, res) => {
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  const Username = nn(req.p.Username);
  const EmailID = nn(req.p.EmailID);
  const Phone = nn(req.p.Phone);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = toInt(req.p.page, 1);
  let Obj = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @TotalCount OUT is read from the first result row (column totalcount); 0 when no rows.
    const rows = await proc(DB, 'usp_referralcustomerlist', {
      plid: Plid, startrowindex: page, maxrows: MaxRows, fromdate: fromdate.trim(), todate: todate.trim(),
      username: Username.trim(), emailid: EmailID.trim(), phone: Phone.trim(),
    });
    Obj = mapRows(rows, PROPS);
    const TotalRecord = totalOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
      EmailID, Username, Phone, fromDate: fromdate, toDate: todate,
    });
  } catch (e) {
    console.error(e);
    try { await new DataUtility().ErrorInsert(0, e.message, 'insert_email_newsletter', 0, req.path); } catch (e2) { console.error(e2); }
  }
  return res.json({ view: '~/Views/CustomerPanel/MyCustomerList/Index.cshtml', Model: Obj, ViewBag });
}));

module.exports = router;
