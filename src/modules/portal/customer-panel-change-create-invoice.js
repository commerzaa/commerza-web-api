// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Change_Create_Invoice.cs
'use strict';
/**
 * Change_Create_InvoiceController (merchant invoice view / print / update). DB: Db_Shopping => 'shopping'.
 * Actions: Index(InvoiceNo), PrintInvoice(InvoiceNo), UpdateInvoice(...).
 * Index / PrintInvoice had no session check in legacy (no filter, no Session access) => kept public.
 */
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { s, outVal, viewJson, urlReferrer, multiResult, NRE } = require('./_shared/batch-21-common');

const DB = 'shopping';
const C = '/portal/Change_Create_Invoice';
const router = express.Router();

// C# model property lists (Change_Create_Invoice.cs)
const INVOICEDETAIL = ['CarrierBy', 'CarrierContact', 'carrierID', 'Create_Date', 'Deliverydate', 'DispatchedDate', 'Inv_DAP', 'Inv_netamt',
  'invNo', 'invoiceProduct', 'NoofBoxes', 'OrderID', 'Paymode', 'RecievedBy', 'Remark', 'shipMethod', 'status', 'total_ship_ch', 'total_vat', 'WeightInKg'];
const INVOICEPRODUCT = ['invNo', 'prodImages', 'Product_Name', 'OrderQty', 'Product_qty', 'Single_Dap', 'SPRID', 'SubPrCode', 'Total_cost',
  'Total_DAP', 'Total_Ship_ch', 'Total_vat'];
const PRINTINVOICE = ['Order_Qty', 'Address', 'BPinCode', 'BrAddress', 'BrCode', 'BrName', 'City', 'cityName', 'Create_Date', 'EmailID', 'Fname',
  'Inv_DAP', 'Inv_netamt', 'InvNo', 'invoiceProducts', 'merchantinfo', 'Lname', 'MobileNo', 'orderDate', 'orderID', 'Paymode', 'PinCode',
  'Sh_Address', 'Sh_City', 'Sh_EmailID', 'Sh_Fname', 'Sh_Lname', 'Sh_MobileNo', 'Sh_PinCode', 'StateName', 'total_ship_ch', 'total_vat'];
const MERCHANTINFO = ['MaayasMobile', 'MaayasEmail', 'CompanyTitle', 'BusinessName', 'RegNo', 'VATNo', 'PANNo', 'GSTNo', 'CSTNO', 'MerchantCode',
  'MerchantName', 'MerchantLogo', 'MerchantEmail', 'MerchantMobile', 'PinCode', 'ShortAddress', 'LandMark', 'CityName', 'CountryName',
  'PhoneNo1', 'PhoneNo2', 'Email1', 'Email2', 'FaxNo1', 'FaxNo2'];

/** foreach (var item in Translate<T>(reader)) obj = item;  => last row, or `new T()` (all defaults) when the set is empty */
function lastOrNew(rows, props) {
  let o = mapRow({}, props);
  for (const item of mapRows(rows || [], props)) o = item;
  return o;
}

// ---- Index ------------------------------------------------------------------------------------------------
// public (legacy: no session check)
// route-config: merchant/Show-Invoice/{InvoiceNo} -> Change_Create_Invoice/Index
router.all([`${C}/Index{/:id}`, C, '/portal/merchant/Show-Invoice/:InvoiceNo'], ps.portalSession, asyncHandler(async (req, res) => {
  const InvoiceNo = req.p.InvoiceNo;
  if (InvoiceNo === '' || InvoiceNo === null || InvoiceNo === undefined) {
    return viewJson(res, '~/Views/CustomerPanel/Dashboard/Index.cshtml');
  }
  const ViewBag = {};
  const UrlReferrer = urlReferrer(req);
  // [DBO].[USP_INVOICE_DETAILS] @INVOICENO : set 0 = Invoicedetail, set 1 = InvoiceProduct
  const sets = await multiResult('usp_invoice_details', { invoiceno: InvoiceNo });
  const objinvDetails = lastOrNew(sets[0], INVOICEDETAIL);
  objinvDetails.invoiceProduct = mapRows(sets[1] || [], INVOICEPRODUCT);
  ViewBag.InvoiceNo = InvoiceNo;
  ViewBag.UrlReferrer = UrlReferrer;
  return viewJson(res, '~/Views/CustomerPanel/Change_Create_Invoice/Index.cshtml', objinvDetails, ViewBag);
}));

// ---- PrintInvoice -----------------------------------------------------------------------------------------
// public (legacy: no session check)
// route-config: merchant/Show-Invoice/Print-Invoice/{InvoiceNo} -> Change_Create_Invoice/PrintInvoice
router.all([`${C}/PrintInvoice{/:id}`, '/portal/merchant/Show-Invoice/Print-Invoice/:InvoiceNo'], ps.portalSession, asyncHandler(async (req, res) => {
  const InvoiceNo = req.p.InvoiceNo;
  if (InvoiceNo === '' || InvoiceNo === null || InvoiceNo === undefined) {
    return viewJson(res, '~/Views/CustomerPanel/Dashboard/Index.cshtml');
  }
  const ViewBag = {};
  const UrlReferrer = urlReferrer(req);
  // DBO.USP_INVOICE_DETAILS_FOR_PRINT @INVOICENO : set 0 = PrintInvoice, set 1 = MerchantInfo, set 2 = InvoiceProduct
  const sets = await multiResult('usp_invoice_details_for_print', { invoiceno: InvoiceNo });
  const objinvDetails = lastOrNew(sets[0], PRINTINVOICE);
  const objMerchantInfo = lastOrNew(sets[1], MERCHANTINFO);
  objinvDetails.merchantinfo = objMerchantInfo;
  objinvDetails.invoiceProducts = mapRows(sets[2] || [], INVOICEPRODUCT);
  ViewBag.InvoiceNo = InvoiceNo;
  ViewBag.UrlReferrer = UrlReferrer;
  return viewJson(res, '~/Views/CustomerPanel/Change_Create_Invoice/PrintInvoice.cshtml', objinvDetails, ViewBag);
}));

/** DispatchedDate / DeliverryDate "dd-MM-yyyy" => "yyyy-MM-dd"; any exception (null, too few parts) => null */
function flipDate(v) {
  try {
    if (v === null || v === undefined) throw NRE(); // .Trim() on null
    let out = v;
    if (String(v).trim() !== '') {
      const arrdob = String(v).split('-');
      if (arrdob.length < 3) throw new RangeError('Index was outside the bounds of the array.');
      out = arrdob[2] + '-' + arrdob[1] + '-' + arrdob[0];
    }
    return out;
  } catch (ex) {
    return null;
  }
}

// ---- UpdateInvoice ----------------------------------------------------------------------------------------
// auth (legacy: unguarded ((Login)Session["Plid"]).Plid => NullReferenceException without a session)
router.all(`${C}/UpdateInvoice{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const DispatchedDate = flipDate(p.DispatchedDate);
  const DeliverryDate = flipDate(p.DeliverryDate);
  let result = '';
  const EMPID = req.user.plid;
  const BranchId = req.user.plid;
  const row = await db.procOne(DB, 'usp_update_invoice_details', {
    smethod: p.SMethod, scarrier: p.SCarrier, noofboxes: p.NoOfBoxes, weight: p.Weight, carrierby: p.CarrierBy,
    carriercontactno: p.CarrierContactno, paymode: p.Paymode, status: p.Status, dispatcheddate: DispatchedDate,
    deliverrydate: DeliverryDate, remark: p.Remark, recievedby: p.RecievedBy, invoiceno: p.InvoiceNo, empcode: EMPID, brcode: BranchId,
  });
  result = s(outVal(row, 'result')); // spOutput.Value.ToString(): DBNull => ''
  return res.json(result);
}));

module.exports = router;
