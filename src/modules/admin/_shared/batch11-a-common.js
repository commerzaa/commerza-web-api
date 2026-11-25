'use strict';
/**
 * Helpers private to admin port batch11A (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: ORDER_PAYMENT_CONFORMATION_PROPS, GetTimestamp(d), orderPaymentRouter({ C, viewDir, friendly }), toInt32Out(rows, name),
 *          styleHeading(worksheet, argb, size), autoFit(worksheet), ensureDir(p), affectedOrCount(...)
 *
 * OrderPaymentConformation.cs and OrderPaymentPending.cs are byte-identical apart from the view path, so both routers are built here:
 *   Index, ExportReport, ApprovePaymentInBulk, UpdatePaymentStatus, GetTimestamp (static helper).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../../config');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const sessionStore = require('../../../utils/sessionStore');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, issueAdminToken, errorInsert } = require('./admin-session');
const {
  DB, nInt, nStr, reqInt, col, str, cellStr, netFormat, nowStamp, cvtInt, nullRef, outOf, excelHistory,
} = require('./batch11-common');

/** class OrderPaymentConformation (OrderPaymentConformation.cs) */
const ORDER_PAYMENT_CONFORMATION_PROPS = ['RowNumber', 'OMID', 'ORDERID', 'ORDERDATE', 'REGNO', 'USERNAME', 'FNAME', 'PAYMODE', 'TOTALAMOUNT',
  'BankName', 'BranchName', 'ReferenceDate', 'ReferenceNumber', 'IFSCCode', 'PaymentStatus', 'ChallanImage'];

/** public static String GetTimestamp(DateTime value) => value.ToString("yyyyMMdd") */
const GetTimestamp = (value) => netFormat(value, 'yyyyMMdd');

/** Convert.ToInt32(SpOutputCount.Value) on a row-returning proc (DBNull => InvalidCastException).
 *  PORT-NOTE: with no rows PostgreSQL cannot return the OUT value => 0. */
function toInt32Out(rows, name) {
  if (!rows || rows.length === 0) return 0;
  const v = col(rows[0], name);
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  return Math.round(Number(v));
}

/** worksheet.get_Range("A1","ZZ1").EntireColumn.AutoFit() (approximation) */
function autoFit(worksheet) {
  worksheet.columns.forEach((c) => {
    let w = 8;
    c.eachCell({ includeEmpty: false }, (cell) => { w = Math.max(w, String(cell.value === null ? '' : cell.value).length + 2); });
    c.width = w;
  });
}
/** range_heading A1:Z1 Font.Bold / Arial Narrow / Interior.Color / Font.Size */
function styleHeading(worksheet, argb, size) {
  for (let i = 1; i <= 26; i++) {
    const h = worksheet.getCell(1, i);
    h.font = { bold: true, name: 'Arial Narrow', size };
    h.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  }
}
const ensureDir = (p) => fs.mkdirSync(path.dirname(p), { recursive: true });

const v = (req, k) => nStr(req.p[k]);

/**
 * Builds the router of OrderPaymentConformationController / OrderPaymentPendingController.
 * @param {{C:string, viewDir:string, friendly:{url:string, Type:number}}} o
 */
function orderPaymentRouter({ C, viewDir, friendly }) {
  const router = express.Router();
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests/admins (ExportReport logs the url of the last Index).
  let url = '';
  let url1 = '';
  const VIEW = `~/Views/AdminPanel/${viewDir}/Index.cshtml`;

  /** public void ExportReport(int? Page, string fromDate, string toDate, string SearchField, string SearchValue, int? Conformtype) */
  async function ExportReport(req, ViewBag, Page, fromDate, toDate, SearchField, SearchValue, Conformtype) {
    const userid = req.user.emp_id; // ((Employee_Master)Session["Admin_User"]).Emp_ID
    const Filename = `Order_Payment_Conformation_${userid}_${nowStamp()}`;
    await excelHistory(userid, url, Filename);
    const MaxRows = await UtilityClass.GridPageSize(); // (unused, like the C#)
    void MaxRows;
    if (Page === null) Page = 1;
    // Convert.ToInt32(Session["OrderPaymentStatus"]) (null => 0, invalid => FormatException)
    const PaymentStatus = cvtInt(sessionStore.get(req, 'OrderPaymentStatus') === undefined ? null : sessionStore.get(req, 'OrderPaymentStatus'));
    const rows = await db.proc(DB, 'USP_OrderPaymentDetails', {
      fromDate, toDate, MAXROWS: 100000, STARTROWINDEX: 1, SearchValue, orderbydate: '', SearchField, PaymentStatus,
    });
    const obj1 = mapRows(rows, ORDER_PAYMENT_CONFORMATION_PROPS);
    if (obj1.length > 0) {
      try {
        if (Conformtype === null) Conformtype = 0;
        // PORT-NOTE: Microsoft.Office.Interop.Excel replaced by exceljs (lazy require); workbook saved in OpenXML format under the legacy
        // .xls name (Excel SaveAs without FileFormat also wrote the default format). Locked flags have no effect (sheet never protected).
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');
        const heads = ['S.No', 'OrderNo', 'OrderDate', 'Name', 'TotalAmount', 'Paymode', 'ReferenceNo', 'ReferenceDate', 'OrderStatus', 'PaymentStatus'];
        heads.forEach((h, i) => { worksheet.getCell(1, i + 1).value = h; });
        if (Conformtype !== 0) {
          worksheet.getCell(1, 11).value = 'Confirmation Date';
          worksheet.getCell(1, 12).value = 'Remark';
        }
        let row = 2;
        for (const item of obj1) {
          worksheet.getCell(row, 1).value = cellStr(item, 'RowNumber').trim();
          worksheet.getCell(row, 2).value = cellStr(item, 'ORDERID').trim();
          worksheet.getCell(row, 3).value = netFormat(item.ORDERDATE, 'dd-MM-yyyy').trim();
          worksheet.getCell(row, 4).value = cellStr(item, 'FNAME').trim();
          worksheet.getCell(row, 5).value = cellStr(item, 'TOTALAMOUNT').trim();
          worksheet.getCell(row, 6).value = cellStr(item, 'PAYMODE').trim();
          worksheet.getCell(row, 7).value = cellStr(item, 'ReferenceNumber').trim();
          if (item.ReferenceDate === null || item.ReferenceDate === undefined) throw nullRef();
          worksheet.getCell(row, 8).value = String(item.ReferenceDate).trim();
          worksheet.getCell(row, 9).value = cellStr(item, 'PaymentStatus').trim();
          const list2 = [];
          if (Conformtype === 0) list2.push('Payment Request');
          else { list2.push('Verify'); list2.push('Rejected'); }
          const FlatList2 = list2.join(',');
          const Cell = worksheet.getCell(row, 10);
          worksheet.getColumn(10).protection = { locked: true };
          worksheet.getRow(row).protection = { locked: true };
          Cell.dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, errorStyle: 'information', formulae: [`"${FlatList2}"`] };
          row++;
        }
        autoFit(worksheet);
        styleHeading(worksheet, 'FFFFFF00', 15); // Color.Yellow, size 15
        const p = path.join(config.uploadDir, 'AllExcelSheets', 'OrderPaymentConformation.xls');
        ensureDir(p);
        if (fs.existsSync(p)) fs.unlinkSync(p);
        await workbook.xlsx.writeFile(p);
      } catch (ExpObj) {
        await errorInsert(req, ExpObj, '');
        ViewBag.filepath = ExpObj.message;
      }
    }
  }

  // ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side, int? Type, int? hdnordertype)
  async function Index(req, res, routeType) {
    let dynamicpagging = nInt(req.p.dynamicpagging);
    const orderbydate = v(req, 'orderbydate');
    let SearchField = v(req, 'SearchField');
    let SearchValue = v(req, 'SearchValue');
    let fromDate = v(req, 'fromDate');
    let toDate = v(req, 'toDate');
    let ByStatus = v(req, 'ByStatus');
    let page = nInt(req.p.page);
    let OrderBy = v(req, 'OrderBy');
    const btnexel = v(req, 'btnexel');
    let Userdownlinemember = v(req, 'Userdownlinemember');
    let Side = nInt(req.p.Side);
    // route-config default Type: MVC RouteData beats the query string but not the posted form
    let Type = routeType !== undefined
      ? (req.body && req.body.Type !== undefined && req.body.Type !== '' ? nInt(req.body.Type) : routeType)
      : nInt(req.p.Type);
    const hdnordertype = nInt(req.p.hdnordertype);

    url1 = legacyUrl(req).slice(1);
    url = '~' + url1;
    const ViewBag = {};
    const out = {};
    if (Type === null) Type = 0;
    if (hdnordertype !== null) Type = hdnordertype;
    const os = sessionStore.get(req, 'OrderStatus');
    if (os !== undefined && os !== null && os !== '') {
      Type = cvtInt(os);
      sessionStore.set(req, 'OrderStatus', '');
    }
    sessionStore.set(req, 'OrderPaymentStatus', String(Type));
    ViewBag.OrderPaymentStatus = Type;
    if (SearchField === null || SearchValue === null) {
      SearchField = '';
      SearchValue = '';
    }
    // (else-branch: loginid/phone/accountno/... = SearchValue.Trim() - locals never used afterwards in the C#)
    if (Userdownlinemember === null) Userdownlinemember = '';
    if (OrderBy === null) OrderBy = '';
    if (fromDate === null) fromDate = '';
    if (toDate === null) toDate = '';
    if (ByStatus === null) ByStatus = '';
    if (page === null) page = 1;
    if (Side === null) Side = 0;
    if (dynamicpagging === null) dynamicpagging = cvtInt(config.app.DynamicPagging === undefined ? null : config.app.DynamicPagging);
    const MaxRows = Number(dynamicpagging);
    let obj1 = [];
    try {
      let TotalRecord = 0;
      const Empid = req.user.emp_id;
      const EM = await new UtilityClass().UpdateAdminUserSession(Empid); // Session["Admin_User"] = ...
      if (!EM) throw nullRef(); // EM.Emp_ID on a null session object
      out.token = issueAdminToken(EM);
      const rows = await db.proc(DB, 'USP_OrderPaymentDetails', {
        fromDate, toDate, MAXROWS: MaxRows, STARTROWINDEX: page, SearchValue, orderbydate: '', SearchField, PaymentStatus: Type,
      });
      obj1 = mapRows(rows, ORDER_PAYMENT_CONFORMATION_PROPS);
      const tc = outOf(rows, 'totalcount');
      TotalRecord = parseInt(tc === '' ? '0' : tc, 10);
      if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
      ViewBag.dynamicpagging = dynamicpagging;
      ViewBag.orderbydate = orderbydate;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
      ViewBag.CurrentPage = page;
      ViewBag.Userdownlinemember = Userdownlinemember;
      ViewBag.GridPageSize = MaxRows;
      ViewBag.TotalRecord = TotalRecord;
      ViewBag.SearchField = SearchField;
      ViewBag.fromDate = fromDate;
      ViewBag.toDate = toDate;
      ViewBag.SearchValue = SearchValue;
      ViewBag.ByStatus = ByStatus;
      ViewBag.OrderBy = OrderBy;
      if (btnexel === 'Export Excel') {
        await ExportReport(req, ViewBag, page, fromDate, toDate, SearchField, SearchValue, Type);
        const DownloadFile = path.join(config.uploadDir, 'AllExcelSheets', 'OrderPaymentConformation.xls');
        const CorrectTimeStamp = GetTimestamp(new Date());
        if (!fs.existsSync(DownloadFile)) throw new Error(`Could not find file '${DownloadFile}'.`);
        const fileBytes = fs.readFileSync(DownloadFile);
        const Time = netFormat(new Date(), 'HH:mm:ss tt');
        const fileName = `Payment_Status_${CorrectTimeStamp}_${Time}.xls`;
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(fileBytes);
      }
      ViewBag.APIerror = 1;
      return res.json({ view: VIEW, Model: obj1, ...ViewBag, ...out });
    } catch (ExpObj) {
      if (res.headersSent) return undefined;
      await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
      ViewBag.ErrorMessage = ExpObj.message;
      ViewBag.APIerror = 0;
      return res.json({ view: VIEW, Model: obj1, ...ViewBag, ...out });
    }
  }

  // auth (reads Session["Admin_User"])
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler((req, res) => Index(req, res)));
  // auth; route-config: "AdminPanel/<url>" -> <C>/Index with default Type
  router.all(`/admin/${friendly.url}`, adminAuth, asyncHandler((req, res) => Index(req, res, friendly.Type)));

  // ---------------------------------------------------------------- public void ExportReport(...)
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const ViewBag = {};
    await ExportReport(req, ViewBag, nInt(req.p.Page), v(req, 'fromDate'), v(req, 'toDate'), v(req, 'SearchField'), v(req, 'SearchValue'),
      nInt(req.p.Conformtype));
    res.send(''); // void action => empty response
  }));

  // ---------------------------------------------------------------- JsonResult ApprovePaymentInBulk(string wdid, string type)
  // auth (approves payments; PORT-NOTE: legacy had no session check)
  router.all(`/admin/${C}/ApprovePaymentInBulk{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const wdid = v(req, 'wdid');
    const type = v(req, 'type');
    let ret = '';
    let Ordertype = 1;
    Ordertype += cvtInt(type);
    if (wdid === null) throw nullRef(); // wdid.Split('^')
    const WdidArray = wdid.split('^');
    try {
      for (let i = 0; i < WdidArray.length - 1; i++) {
        const Regno = cvtInt(WdidArray[i]);
        // PORT-NOTE: legacy concatenated the values into the SQL; parameterised here.
        await db.exec(DB, 'update tbl_ordermaster set paymentstatus=@Ordertype, paymentdate=fun_getcurrentdate() where omid=@Regno',
          { Ordertype, Regno });
      }
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, '');
      ret = ExpObj.message;
    }
    return res.json(ret);
  }));

  // ---------------------------------------------------------------- JsonResult UpdatePaymentStatus(string status, string Remark, int OMID, string Date)
  // auth (writes order payment status; PORT-NOTE: legacy had no session check)
  router.all(`/admin/${C}/UpdatePaymentStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const status = v(req, 'status');
    const Remark = v(req, 'Remark');
    const OMID = reqInt(req.p.OMID, 'OMID');
    const Date = v(req, 'Date');
    void Date; // PORT-NOTE: @Date was added as a SqlParameter but not named in the command text => the proc ran with its default ''.
    const STATUS = cvtInt(status);
    // PORT-NOTE: x = ExecuteSqlCommand(...) rows affected (proc has no SET NOCOUNT: UPDATE count of TBL_ORDERMASTER). PostgreSQL does not
    // report it for a function call, so the matching row count is read before the call (a `rowsaffected` result column wins if present).
    const n = Number(await db.scalar(DB, 'select count(*) from tbl_ordermaster where omid=@OMID', { OMID }));
    const rows = await db.proc(DB, 'USP_UPDATEPAYMENTSTATUS', { OMID, STATUS, REMARK: Remark });
    const ra = col(rows && rows[0], 'rowsaffected');
    const x = ra === undefined || ra === null ? n : Number(ra);
    return res.json(x);
  }));

  return router;
}

module.exports = {
  ORDER_PAYMENT_CONFORMATION_PROPS, GetTimestamp, orderPaymentRouter, toInt32Out, styleHeading, autoFit, ensureDir, str,
};
