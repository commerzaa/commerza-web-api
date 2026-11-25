'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Challan_Purchase_Bill.cs (class Challan_Purchase_BillController => /admin/Challan_Purchase_Bill/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/adminSession');
const { s } = require('./_shared/batch04A_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Challan_Purchase_Bill';

/** class PurchaseChallan (Controllers/AdminPanel/Purchase_Bill.cs) */
const PURCHASE_CHALLAN_PROPS = ['ref_no', 'ExpiredOn', 'challanNo', 'challanDate', 'SubPrCode', 'ProductName', 'Cost', 'qty', 'amount', 'vatPerc',
  'vatAmount', 'netTotal', 'vendorId', 'vendorName', 'stateName', 'other', 'totalamt', 'totalvatAmount', 'tAmount', 'brcode', 'BrName', 'BrAddress',
  'BrState', 'BrCity', 'ShipChg', 'totalshipping', 'batchNo', 'MRP', 'BV', 'PV', 'DAP', 'total_cortage', 'freeQty', 'total_PuchaseCost', 'Remarks',
  'vcid', 'GCost', 'DAP_T', 'pfvid', 'Wunit', 'GCost_T', 'netTotal_T', 'Disc_After_Vat_T', 'IsVatInc', 'Disc_After_Vat', 'Gst_vat',
  'unitpricewithoutcartage', 'FRID', 'FRNAME', 'FRADDRESS', 'FRSTATE', 'FRCITY', 'TAXTYPE', 'TAXVALUE', 'MANUALPURCHASECOST', 'Totalgstamount'];

/**
 * new Purchase_BillController().PurchaseChallanDetails(refno)  (other controller's public method; logic reproduced here)
 * dbo.usp_PurchaseChallan_ForEdit @refNO, @TotalCount out
 */
async function PurchaseChallanDetails(refno) {
  return mapRows(await db.proc(DB, 'usp_PurchaseChallan_ForEdit', { refNO: refno }), PURCHASE_CHALLAN_PROPS);
}

/** Shared tail of Index / PrintDoneNow */
async function challanView(res, refno) {
  const challan = await PurchaseChallanDetails(refno);
  const rr = challan.length ? challan[0] : null;
  const ViewBag = {};
  if (rr !== null) {
    if (challan.length > 0) ViewBag.RefId = refno;
    ViewBag.other = rr.other;
    ViewBag.Totalamount = rr.totalamt;
  } else {
    ViewBag.RefId = refno;
    ViewBag.other = 0;
    ViewBag.Totalamount = 0;
  }
  return res.json({ view: '~/Views/AdminPanel/Challan_Purchase_Bill/Index.cshtml', Model: challan, ...ViewBag });
}

// ---------------------------------------------------------------- ActionResult Index(string refno)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Purchase-Bill-Challan" -> Challan_Purchase_Bill/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Purchase-Bill-Challan'], adminAuth, asyncHandler(async (req, res) => {
  let refno = s(req.p.refno);
  if (refno === null || refno === '') return res.json({ redirect: '/Purchase_Bill/Index' });
  try {
    refno = await UtilityClass.Decryptword(refno);
    if (refno === '' || refno === null || refno === undefined) return res.json({ redirect: '/Purchase_Bill/Index' });
    sessionStore.set(req, 'RefNo', refno); // Session["RefNo"] = refno
  } catch (_) {
    return res.json({ redirect: '/Purchase_Bill/Index' });
  }
  return challanView(res, refno);
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult PrintDoneNow()
// auth (reads the admin's Session["RefNo"]; legacy had no Admin_User check)
router.post(`/admin/${C}/PrintDoneNow{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const RefNo = sessionStore.get(req, 'RefNo');
  if (RefNo === undefined || RefNo === null) throw new Error('Object reference not set to an instance of an object.'); // Session["RefNo"].ToString()
  return challanView(res, String(RefNo));
}));

module.exports = router;
