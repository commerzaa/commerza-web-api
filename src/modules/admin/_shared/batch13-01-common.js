'use strict';
/**
 * Helpers private to admin port batch13-01 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: excelLinkBlank(url), cvtDecOut(rows, name), gaKeyActive(empId), PACKAGE_BINARY_SETTING_PROPS, PENDING_REQUEST_PROPS,
 *          FRANCHISE_DETAILS_PROPS, ORDER_MANAGEMENT_PROPS, OVERALL_EARNING_REPORT_PROPS, PAYIT_FORWORD_LIST_PROPS, PACKAGE_DELIVERY_SLIP_PROPS
 */
const db = require('../../../db');
const { DB, col, str, outStr, cvtIntStrict } = require('./batch11-common');

/** Inline USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "" ? "0" : v)  (variant used by Pending_Payout) */
async function excelLinkBlank(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = outStr(row, 'isactive');
  return cvtIntStrict(v === '' ? '0' : v);
}

/** Convert.ToDecimal(OUT.Value.ToString()) on a row-returning proc (DBNull => "" => FormatException).
 *  PORT-NOTE: with no rows PG cannot return the OUT value => 0 (its declared default). */
function cvtDecOut(rows, name) {
  if (!rows || !rows[0]) return 0;
  const s = str(col(rows[0], name)).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}

/** Db.Database.SqlQuery<bool>("select isnull(Status,0) from Admin_Security_Key where Emp_Id=" + Empid + "and Status=1").FirstOrDefault() */
async function gaKeyActive(empId) {
  const v = await db.scalar(DB, 'select coalesce(status::int, 0) from admin_security_key where emp_id = @empId and status::int = 1 limit 1', { empId });
  return v === null || v === undefined ? false : Number(v) !== 0;
}

/** Package_Binary_Setting.cs class PackageBinarySetting */
const PACKAGE_BINARY_SETTING_PROPS = ['BBSID', 'FROMBV', 'TOBV', 'BINARYPERCENTAGE', 'FROMRBV', 'TORBV', 'RBINARYPERCENTAGE', 'CAPPINGPERCENTAGE',
  'MODIFYBY', 'MODIFYDATE'];
/** Pending_RequestController.cs class PendingRequest */
const PENDING_REQUEST_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region', 'StoreType',
  'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode', 'Paymentdate',
  'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];
/** Pending_RequestController.cs class FranchiseDetails */
const FRANCHISE_DETAILS_PROPS = ['LOGINID', 'PASSWORD', 'EMAILID', 'MOBILE', 'NAME', 'FRCode'];
/** New_Order.cs class OrderManagement */
const ORDER_MANAGEMENT_PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL',
  'ALLPRODUCTID', 'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID',
  'PRODUCTNAME', 'MRP', 'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY',
  'STATE', 'CITY', 'PINCODE', 'Amount', 'STATUST', 'WalletTypeName', 'USERNAME', 'IMAGENAME', 'GSTPER', 'FNAME', 'FADDRESS', 'QUANTITY',
  'OrderStatusT', 'OrderStatus', 'TRACKINGNO', 'INVOICEDATE', 'SHIPBY', 'PRODUCTCODE', 'Type', 'ReferenceDate', 'ReferenceNumber', 'TotalPayable',
  'ShippingCharge', 'DDAmount', 'DDNO', 'Customermobile', 'DocketNo'];
/** OverallEarning_Report.cs class OverallEarning_Report */
const OVERALL_EARNING_REPORT_PROPS = ['ROWNUMBER', 'RegNo', 'USERNAME', 'EmailId', 'PHONE', 'PAIRINCOME', 'BinaryLevelIncome', 'ROI', 'ROI_GROWTHLEVEL',
  'DIRECTINCOME', 'RollupIncome', 'LEVELINCOME', 'WITHDRAWALAMOUNT', 'AvailableCommissionWallet'];
/** Payit_Forword_List.cs class PayitForword_list */
const PAYIT_FORWORD_LIST_PROPS = ['TFLID', 'PURCHASEDATE', 'BYUSER', 'FORUSER', 'ALLPACKAGENAME', 'INR', 'ATC', 'MODENAME', 'REFNUM', 'STATUS', 'REMARK'];
/** PackageDeliverySlip.cs class PACKAGEDELIVERYSLIP */
const PACKAGE_DELIVERY_SLIP_PROPS = ['CDSID', 'CSID', 'Name', 'SENDTYPE', 'USERNAME', 'MOBILE', 'EMAILID', 'ADDRESS', 'SENDATE', 'REMARK', 'DOCKETNO',
  'PRODUCTCODE', 'PACKAGEID', 'ProductName', 'COMPANY_NAME', 'Shipment_Address'];

module.exports = {
  excelLinkBlank, cvtDecOut, gaKeyActive, PACKAGE_BINARY_SETTING_PROPS, PENDING_REQUEST_PROPS, FRANCHISE_DETAILS_PROPS, ORDER_MANAGEMENT_PROPS,
  OVERALL_EARNING_REPORT_PROPS, PAYIT_FORWORD_LIST_PROPS, PACKAGE_DELIVERY_SLIP_PROPS,
};
