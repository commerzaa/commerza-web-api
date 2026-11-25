'use strict';
/**
 * Helpers private to admin port batch10 part D (New_Order / New_Pending_Order) - not a router (lives in _shared/).
 * Exports: ORDER_MGMT_PROPS, INVOICE_MASTER_PROPS, GetTimestamp(d), interopOrderExport(opts), GetDetailsByOMID(req,res),
 *          UpdatePendingDetails(req,res,{convertInvoiceDate}), CancelProduct(req,res)
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { errorInsert } = require('./admin-session');
const { DB, nStr, reqInt, cvtInt, col, cellStr, netFormat, outStr, nullRef } = require('./batch10-common');

/** class OrderManagement (New_Order.cs) */
const ORDER_MGMT_PROPS = ['ROWNUMBER', 'OMID', 'ORDERID', 'REGNO', 'TOTALAMOUNT', 'BV', 'RBV', 'DISCOUNT', 'DP', 'PAYMODE', 'ISORDERCANCEL',
  'ALLPRODUCTID', 'HANDLINGFEE', 'TAXABLEAMOUNT', 'ORDERDATE', 'BRANCHID', 'DELIVERYSTATUS', 'ISCOUNTEDTOPACKAGE', 'STATUS', 'POMID', 'TKPMID',
  'PRODUCTNAME', 'MRP', 'GSTID', 'GSTAMOUNT', 'GST', 'IMID', 'CUSTOMERNAME', 'EMAILID', 'MOBILE', 'INVOICENAME', 'DATE', 'ADDRESS', 'COUNTRY',
  'STATE', 'CITY', 'PINCODE', 'Amount', 'STATUST', 'WalletTypeName', 'USERNAME', 'IMAGENAME', 'GSTPER', 'FNAME', 'FADDRESS', 'QUANTITY',
  'OrderStatusT', 'OrderStatus', 'TRACKINGNO', 'INVOICEDATE', 'SHIPBY', 'PRODUCTCODE', 'Type', 'ReferenceDate', 'ReferenceNumber', 'TotalPayable',
  'ShippingCharge', 'DDAmount', 'DDNO', 'Customermobile', 'DocketNo'];
/** class InvoiceMaster (New_Order.cs) */
const INVOICE_MASTER_PROPS = ['CUSTOMERNAME', 'EMAILID', 'MOBILE'];

/** public static String GetTimestamp(DateTime value) => value.ToString("yyyyMMdd") */
const GetTimestamp = (value) => netFormat(value, 'yyyyMMdd');

const trimCell = (item, name) => cellStr(item, name).trim();

/**
 * Microsoft.Office.Interop.Excel export to ~/AllExcelSheets/OrderDetails.xls (New_Order.ExportReport / New_Pending_Order.ExportReport).
 * PORT-NOTE: COM Excel replaced by exceljs (lazy require); the workbook is written in .xlsx format under the legacy .xls name (Excel's
 * SaveAs without FileFormat also wrote the default OpenXML format). Cell/row Locked flags have no effect (sheet never protected) and are
 * set via exceljs protection.locked. Validation.Add with an empty list (Type1 not 1/3/4) threw a COMException in Excel => reproduced.
 * opts: { req, rows, Type1, pending (true => New_Pending_Order column set), ViewBag }
 */
async function interopOrderExport({ req, rows, Type1, pending, ViewBag }) {
  try {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    const heads = ['S.No', 'OrderNo', 'OrderDate', 'Name', 'Amount', 'Paymode', 'ReferenceNo', 'ReferenceDate', 'ProductCode', 'DocketNo', 'shipby', 'Status'];
    heads.forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
    let row = 2;
    for (const item of rows) {
      worksheet.getCell(row, 1).value = trimCell(item, 'ROWNUMBER');
      worksheet.getCell(row, 2).value = trimCell(item, 'ORDERID');
      worksheet.getCell(row, 3).value = netFormat(col(item, 'ORDERDATE'), 'dd-MM-yyyy').trim();
      worksheet.getCell(row, 4).value = trimCell(item, 'CUSTOMERNAME');
      worksheet.getCell(row, 5).value = trimCell(item, 'TOTALAMOUNT');
      worksheet.getCell(row, 6).value = trimCell(item, 'PAYMODE');
      worksheet.getCell(row, 7).value = pending ? trimCell(item, 'DDNO') : trimCell(item, 'ReferenceNumber');
      const rd = netFormat(col(item, 'ReferenceDate'), 'dd-MM-yyyy');
      // PORT-NOTE: legacy compared the dd-MM-yyyy string with "1900-01-01" (never equal) - kept.
      if (rd === '1900-01-01') worksheet.getCell(row, 8).value = '';
      else worksheet.getCell(row, 8).value = rd.trim();
      if (pending) {
        worksheet.getCell(row, 9).value = trimCell(item, 'PRODUCTCODE');
        worksheet.getCell(row, 10).value = '';
        worksheet.getCell(row, 11).value = '';
      }
      const list2 = [];
      if (Type1 === '1') { list2.push('Packed'); list2.push('Cancelled'); }
      if (Type1 === '3') { list2.push('Dispatched'); list2.push('Cancelled'); }
      if (Type1 === '4') { list2.push('Delivered'); }
      const FlatList2 = list2.join(',');
      const Cell = worksheet.getCell(row, 12);
      worksheet.getColumn(12).protection = { locked: true };
      worksheet.getRow(row).protection = { locked: true };
      if (FlatList2 === '') throw new Error('Exception from HRESULT: 0x800A03EC'); // Validation.Add with an empty list
      Cell.dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, errorStyle: 'information', formulae: [`"${FlatList2}"`] };
      row++;
    }
    // EntireColumn.AutoFit() (approximation) + heading A1:Z1 bold / Arial Narrow / gray / size 12
    worksheet.columns.forEach((c) => {
      let w = 8;
      c.eachCell({ includeEmpty: false }, (cell) => { w = Math.max(w, String(cell.value === null ? '' : cell.value).length + 2); });
      c.width = w;
    });
    for (let i = 1; i <= 26; i++) {
      const h = worksheet.getCell(1, i);
      h.font = { bold: true, name: 'Arial Narrow', size: 12 };
      h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF808080' } };
    }
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'OrderDetails.xls');
    if (fs.existsSync(p)) fs.unlinkSync(p);
    await workbook.xlsx.writeFile(p);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'LiUserWiseIWalletStatementsController_Report');
    ViewBag.filepath = ExpObj.message;
  }
}

/** JsonResult GetDetailsByOMID(int OMID): USP_GetInviceHistory @OMID */
async function GetDetailsByOMID(req, res) {
  const OMID = reqInt(req.p.OMID, 'OMID');
  const rows = await db.proc(DB, 'USP_GetInviceHistory', { OMID });
  return res.json(mapRows(rows, ORDER_MGMT_PROPS));
}

/** JsonResult UpdatePendingDetails(int POMIDPP, int IMID, string productCode, string InvoieDate, int Warrenty, string Sendby, string trackNo, string orderstatus) */
async function UpdatePendingDetails(req, res, { convertInvoiceDate }) {
  const POMIDPP = reqInt(req.p.POMIDPP, 'POMIDPP');
  const IMID = reqInt(req.p.IMID, 'IMID');
  const productCode = nStr(req.p.productCode);
  const InvoieDate = nStr(req.p.InvoieDate);
  const Warrenty = reqInt(req.p.Warrenty, 'Warrenty');
  const Sendby = nStr(req.p.Sendby);
  const trackNo = nStr(req.p.trackNo);
  const orderstatus = nStr(req.p.orderstatus);
  let STRResult = '';
  const loginid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID (outside the try)
  try {
    let invDate = InvoieDate;
    if (convertInvoiceDate) {
      // Convert.ToDateTime(InvoieDate): null => DateTime.MinValue, invalid => FormatException
      if (InvoieDate === null) invDate = new Date(1, 0, 1);
      else {
        invDate = new Date(InvoieDate);
        if (Number.isNaN(invDate.getTime())) throw new Error('String was not recognized as a valid DateTime.');
      }
    }
    // USP_UpdatePendingInvoiceDetails @loginid,@POMID,@IMID,@WARRANTY,@SHIP_BY,@TRACKING_NO,@INVOICE_DATE,@PRODUCT_CODE,@StrResult out,@SaleType,@ORDERSTATUS
    const ORDERSTATUS = cvtInt(orderstatus);
    const out = await db.procOne(DB, 'USP_UpdatePendingInvoiceDetails', {
      loginid, POMID: POMIDPP, IMID, WARRANTY: Warrenty, SHIP_BY: Sendby, TRACKING_NO: trackNo, INVOICE_DATE: invDate,
      PRODUCT_CODE: productCode, SaleType: '1', ORDERSTATUS,
    });
    STRResult = outStr(out, 'strresult');
    // USP_INVOICEMEMBERDETAIL @IMID,@STRRESULT out
    const InvoiceMaster = mapRows(await db.proc(DB, 'USP_INVOICEMEMBERDETAIL', { IMID }), INVOICE_MASTER_PROPS);
    if (STRResult === 'SUCCESS') {
      const SMSVerification = await db.queryOne(DB,
        'select id, sms_content, sms_send_status from tbl_smsaction where id = 26 limit 1', {});
      if (!SMSVerification) throw nullRef();
      const MobileSMS = col(SMSVerification, 'sms_content'); // eslint-disable-line no-unused-vars
      const emailVerificationmsg = await db.queryOne(DB,
        'select eid, email_subject, email_content, email_send_status from tbl_emailaction where eid = 22 limit 1', {});
      if (!emailVerificationmsg) throw nullRef();
      if (InvoiceMaster.length === 0) throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.');
      const im0 = InvoiceMaster[0];
      const DynamicNewOrderMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(im0.CUSTOMERNAME,
        col(emailVerificationmsg, 'email_content'), '', '', 13, '');
      if (Number(col(SMSVerification, 'sms_send_status')) === 1) {
        const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(im0.CUSTOMERNAME, col(SMSVerification, 'sms_content'), '', '', 14);
        // new Thread(...).Start() => fire-and-forget
        Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(im0.MOBILE, messg, '1'))
          .catch((e) => console.error('[New_Order] sms thread:', e.message));
      }
      if (Number(col(emailVerificationmsg, 'email_send_status')) === 1) {
        const fileUploader = null;
        Promise.resolve().then(() => {
          if (im0.EMAILID === null || im0.EMAILID === undefined) throw nullRef();
          return UtilityClass.SendEmailByApiSetting(im0.CUSTOMERNAME, '', '', '', '', '', String(im0.EMAILID).toLowerCase(),
            col(emailVerificationmsg, 'email_subject'), DynamicNewOrderMsg, fileUploader);
        }).catch((e) => console.error('[New_Order] email thread:', e.message));
      }
    }
  } catch (ex) {
    return res.json('');
  }
  return res.json(STRResult);
}

/** JsonResult CancelProduct(string cancelremark, int POMID): USP_CANCEL_SINGLE_PRODUCT @loginid,@CANCELREMARK,@POMID,@StrResult out */
async function CancelProduct(req, res) {
  const cancelremark = nStr(req.p.cancelremark);
  const POMID = reqInt(req.p.POMID, 'POMID');
  let STRResult = '';
  const loginid = req.user.emp_id;
  try {
    const out = await db.procOne(DB, 'USP_CANCEL_SINGLE_PRODUCT', { loginid, CANCELREMARK: cancelremark, POMID });
    STRResult = outStr(out, 'strresult');
  } catch (ex) {
    return res.json('');
  }
  return res.json(STRResult);
}

module.exports = {
  ORDER_MGMT_PROPS, INVOICE_MASTER_PROPS, GetTimestamp, interopOrderExport, GetDetailsByOMID, UpdatePendingDetails, CancelProduct,
};
