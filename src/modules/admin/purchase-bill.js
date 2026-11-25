'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Purchase_Bill.cs (class Purchase_BillController => /admin/Purchase_Bill/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nint, nstr, toInt32, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Purchase_Bill';

/** class GetPurchaseBill */
const GETPURCHASEBILL_PROPS = ['Sfaid', 'rownumber', 'RefNo', 'challanNo', 'VendorId', 'vendorName', 'subTotal', 'vatTotal', 'stateName',
  'challaneDate', 'transDate', 'DumpName', 'Invoicetype', 'ref_no', 'IsVatInc', 'Total_Cortage', 'Gst_vat'];
/** class PurchaseChallan */
const PURCHASECHALLAN_PROPS = ['ref_no', 'ExpiredOn', 'challanNo', 'challanDate', 'SubPrCode', 'ProductName', 'Cost', 'qty', 'amount', 'vatPerc',
  'vatAmount', 'netTotal', 'vendorId', 'vendorName', 'stateName', 'other', 'totalamt', 'totalvatAmount', 'tAmount', 'brcode', 'BrName', 'BrAddress',
  'BrState', 'BrCity', 'ShipChg', 'totalshipping', 'batchNo', 'MRP', 'BV', 'PV', 'DAP', 'total_cortage', 'freeQty', 'total_PuchaseCost', 'Remarks',
  'vcid', 'GCost', 'DAP_T', 'pfvid', 'Wunit', 'GCost_T', 'netTotal_T', 'Disc_After_Vat_T', 'IsVatInc', 'Disc_After_Vat', 'Gst_vat',
  'unitpricewithoutcartage', 'FRID', 'FRNAME', 'FRADDRESS', 'FRSTATE', 'FRCITY', 'TAXTYPE', 'TAXVALUE', 'MANUALPURCHASECOST', 'Totalgstamount'];

/** public List<PurchaseChallan> PurchaseChallanDetails(string refno): dbo.usp_PurchaseChallan_ForEdit @refNO, @TotalCount out */
async function PurchaseChallanDetails(refno) {
  return mapRows(await db.proc(DB, 'usp_PurchaseChallan_ForEdit', { refNO: refno }), PURCHASECHALLAN_PROPS);
}

// ---------------------------------------------------------------- Index(string fromDate, string toDate, string branch, string invoicetype, string State, string VendorName, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let branch = nstr(req.p.branch);
  const invoicetype = nstr(req.p.invoicetype); // ("" tests never match: MVC binds "" as null => Convert.ToInt32(null) = 0, same result)
  const State = nstr(req.p.State);
  let VendorName = nstr(req.p.VendorName);
  let page = nint(req.p.page);
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (branch === null) branch = '';
  if (VendorName === null) VendorName = '';
  const invoicetyp = toInt32(invoicetype === '' ? '0' : invoicetype);
  const sid = toInt32(State === '' ? '0' : State);
  let MaxRows = await UtilityClass.GridPageSize();
  MaxRows = 1000;
  if (page === null) page = 1;
  const PBillList = mapRows(await db.proc(DB, 'usp_GetPurchase_Bill', {
    StartRowIndex: page, MaxRows, fromDate, toDate, branch, invoicetype: invoicetyp, State: sid, vendorName: VendorName,
  }), GETPURCHASEBILL_PROPS);
  return view(res, '~/Views/AdminPanel/Purchase_Bill/Index.cshtml', PBillList, {});
}));

// ---------------------------------------------------------------- Edit(string ID)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Purchase-Bill/Edit/{ID}" -> Purchase_Bill/Edit
router.all([`/admin/${C}/Edit{/:id}`, '/admin/AdminPanel/Purchase-Bill/Edit/:ID'], adminAuth, asyncHandler(async (req, res) => {
  const ID = nstr(req.p.ID);
  const ViewBag = {};
  ViewBag.ref_no = ID;
  const ref_no = await UtilityClass.Decryptword(ID);
  if (ref_no !== '') {
    ViewBag.ref_no = ID;
    return view(res, '~/Views/AdminPanel/Purchase_Bill/EditAddedStock.cshtml', await PurchaseChallanDetails(ref_no), ViewBag);
  }
  return res.json({ redirect: '/Purchase_Bill/Index' });
}));

// ---------------------------------------------------------------- public List<PurchaseChallan> PurchaseChallanDetails(string refno)
// auth (public method => routable in legacy; PORT-NOTE: legacy had no session check)
// MVC wrapped the non-ActionResult return value in a ContentResult => Convert.ToString(list) = the CLR type name (kept).
router.all(`/admin/${C}/PurchaseChallanDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await PurchaseChallanDetails(nstr(req.p.refno));
  return res.type('text/html').send('System.Collections.Generic.List`1[PurchaseChallan]');
}));

module.exports = router;
