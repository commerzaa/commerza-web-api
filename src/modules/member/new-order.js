'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/New_Order.cs (New_OrderController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL', 'ALLPRODUCTID', 'HANDLINGFEE',
  'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID', 'PRODUCTNAME', 'MRP', 'GSTID', 'GSTAMOUNT', 'GST',
  'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY', 'STATE', 'CITY', 'PINCODE', 'Amount', 'STATUST', 'WalletTypeName',
  'USERNAME', 'IMAGENAME', 'GSTPER'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return '';
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || f[k] === null || f[k] === undefined ? '' : String(f[k]);
};

// ---- Index ---------------------------------------------------------------------------------------------
// auth (legacy cast Session["plid"] without a null check)
router.all('/member/New_Order/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Type = req.p.Type;
  const ViewBag = {};
  let Stauts = '';
  if (Type === '1') {
    ViewBag.Title = 'New Order';
    Stauts = 'Pending';
  } else if (Type === '2') {
    ViewBag.Title = 'Complete Order';
    Stauts = 'Delivered';
  } else if (Type === '3') {
    ViewBag.Title = 'Cancel Order';
    Stauts = 'Cancel';
  }
  const Plid = Number(req.user.plid);
  let objAllOrderList = [];
  try {
    const SearchField = '';
    const SearchValue = '';
    const status = '';
    const fromDate = nn(req.p.fromDate);
    const toDate = nn(req.p.toDate);
    const UserName = nn(req.p.UserName);
    ViewBag.Status = status;
    const MaxRows = 100;
    const page = toInt(req.p.page, 1);
    // PORT-NOTE: @TotalCount OUT is read from the first result row (column totalcount); 0 when no rows.
    const rows = await proc(DB, 'usp_fran_orderdeatils', {
      fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, status: SearchField, username: UserName, plid: Plid,
    });
    objAllOrderList = mapRows(rows, PROPS).filter((s) => {
      if (s.STATUST === null || s.STATUST === undefined) throw new Error('Object reference not set to an instance of an object.');
      return s.STATUST === Stauts;
    });
    const tc = parseInt(outOf(rows, 'totalcount'), 10);
    const TotalRecord = Number.isNaN(tc) ? 0 : tc;
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField, SearchValue, fromDate, toDate,
    });
  } catch (e) {
    console.error(e);
    // legacy: Response.Redirect("/page-not-found") ended the request before the ErrorInsert block was reached
    return res.json({ redirect: '/page-not-found' });
  }
  return res.json({ view: '~/Views/CustomerPanel/OrderManagement/Index.cshtml', Model: objAllOrderList, ViewBag });
}));

// ---- GetDetailsByOMID ----------------------------------------------------------------------------------
// auth
router.all('/member/New_Order/GetDetailsByOMID{/:id}', auth, asyncHandler(async (req, res) => {
  const comid = toInt(req.p.comid, 0);
  const rows = await proc(DB, 'usp_getinvicehistory', { imid: comid });
  return res.json(mapRows(rows, PROPS));
}));

// ---- UpdatePendingDetails ------------------------------------------------------------------------------
// auth
router.all('/member/New_Order/UpdatePendingDetails{/:id}', auth, asyncHandler(async (req, res) => {
  const { productCode, InvoieDate, Sendby, trackNo } = req.p;
  const POMIDPP = toInt(req.p.POMIDPP, 0);
  const IMID = toInt(req.p.IMID, 0);
  const Warrenty = toInt(req.p.Warrenty, 0);
  const Plid = Number(req.user.plid);
  const inv = new Date(InvoieDate); // Convert.ToDateTime
  if (Number.isNaN(inv.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  // PORT-NOTE: @StrResult OUT is read from the first result row (column strresult).
  const rows = await proc(DB, 'usp_updatependinginvoicedetails', {
    loginid: Plid, pomid: POMIDPP, imid: IMID, warranty: Warrenty, ship_by: Sendby, tracking_no: trackNo, invoice_date: inv, product_code: productCode,
  });
  return res.json(outOf(rows, 'strresult'));
}));

module.exports = router;
