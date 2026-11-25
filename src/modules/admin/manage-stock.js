'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\ManageStock.cs (class ManageStockController => /ManageStock/...)
// Database: affiliate (Db_Affiliate). Procs: USP_GetStockDetails, USP_AddInStock, UPS_GetUserName, USP_ADDTRANSFERSTOCK, UPS_GetDetailsByUserName,
// USP_DELIVERYCHALLANMASTER, USP_DELIVERYCHALLANDETAILS, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, reqInt, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outStr, outIntOf, at, splitCsv,
} = require('./_shared/batch09-common');

const router = express.Router();
const C = 'ManageStock';

/** class StockDetails */
const PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'EMAILID', 'MRP', 'COUNTRY', 'STATE',
  'ADDRESS', 'CITY', 'PINCODE', 'Prname', 'Code', 'Name', 'PRcode', 'TKPID', 'TransferStock', 'ATTRIBUTE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(string ProductName, string PRCode, string OutStock)
async function ExportReport(req, res, ProductName, PRCode, OutStock, ViewBag) {
  if (OutStock === 'false' || OutStock === null) OutStock = '';
  if (OutStock === 'true') OutStock = '0';
  const userid = req.user.emp_id;
  const Filename = 'In_House_Stock_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  // [DBO].[USP_GetStockDetails] @OutStock,@ProductName,@STARTROWINDEX,@MAXROWS,@SpOutputCount out,@Prcode   (no @FRID)
  const Obj = mapRows(await db.proc(DB, 'USP_GetStockDetails', { OutStock, ProductName, STARTROWINDEX: 1, MAXROWS: 9999999, Prcode: PRCode }), PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'In_House_Stock.xls', Filename,
      headers: ['S.No.', 'Product', 'IN Stock', 'Out Stock', 'Available'],
      rows: Obj, innerProc: 'LiUserWiseIWalletStatementsController_Report', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'RowNumber')) + ' \t');
        w(tab(cellStr(item, 'PRODUCTLIST')) + ' \t');
        w(tab(cellStr(item, 'INSTOCK')) + ' \t');
        w(tab(cellStr(item, 'OUTSTOCK')) + ' \t');
        w(tab(cellStr(item, 'AVAILABLE')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// public void GenerateDeliveryChallan(string FRID, string stock, string Remarks, string FromFRID)
async function GenerateDeliveryChallan(req, FRID, stock, Remarks, FromFRID) {
  let OutputResult = '';
  const loginid = req.user.emp_id;
  try {
    if (FRID === '') FRID = '0';
    // DBO.USP_DELIVERYCHALLANMASTER @FROMID,@TOID,@CHALLANTYPE,@STROUTPUT OUT,@FromFRID
    const row = await db.procOne(DB, 'USP_DELIVERYCHALLANMASTER', { FROMID: loginid, TOID: cvtInt(FRID), CHALLANTYPE: 'Manage Stock', FromFRID });
    OutputResult = outStr(row, 'stroutput');
    if (OutputResult !== '' && OutputResult !== null) {
      const a1 = splitCsv(stock, '^');
      for (let i = 0; i < a1.length; i++) {
        const p = a1[i].split('~');
        const ID = cvtInt(at(p, 0));
        const QNTY = at(p, 1);
        if (QNTY !== '') {
          if (FRID === '') FRID = '0';
          // DBO.USP_DELIVERYCHALLANDETAILS @DCID,@TKPMID,@QTY,@STROUTPUT OUT
          await db.procOne(DB, 'USP_DELIVERYCHALLANDETAILS', { DCID: cvtInt(OutputResult), TKPMID: ID, QTY: cvtInt(QNTY) });
        }
      }
    }
  } catch (ex) {
    // (legacy swallowed every error)
  }
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string ProductName, string PRCode, string OutStock, int? page, string btnexel, string FRID)
// auth (reads Session["Admin_User"].Emp_ID first => NullReferenceException without a session)
// route-config: "AdminPanel/Manage-Stock" -> ManageStock/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Manage-Stock'], (req, res, next) => {
  url1 = legacyUrl(req).slice(1); // (static set before the session dereference, like legacy)
  url = '~' + url1;
  next();
}, adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Employeeid = req.user.emp_id;
  let FRID = nStr(req.p.FRID);
  if (FRID !== null) {
    FRID = await UtilityClass.Decryptword(FRID);
    ViewBag.FRID = FRID;
  }
  const p = await inlinePerms(Employeeid, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  let ProductName = nStr(req.p.ProductName); if (ProductName === null) ProductName = '';
  let PRCode = nStr(req.p.PRCode); if (PRCode === null) PRCode = '';
  let page = nInt(req.p.page); if (page === null) page = 1;
  let OutStock = nStr(req.p.OutStock);
  if (OutStock === 'false' || OutStock === null) OutStock = '';
  if (OutStock === 'true') OutStock = '0';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let Obj = [];
  try {
    const MaxRows = dynamicpagging;
    const empId = req.user.emp_id;
    ViewBag.EmpId = empId;
    // [DBO].[USP_GetStockDetails] @OutStock,@ProductName,@STARTROWINDEX,@MAXROWS,@SpOutputCount out,@Prcode,@FRID
    const rows = await db.proc(DB, 'USP_GetStockDetails', {
      OutStock, ProductName, Prcode: PRCode, STARTROWINDEX: page, MAXROWS: MaxRows, FRID: cvtInt(FRID),
    });
    Obj = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'spoutputcount');
    Object.assign(ViewBag, {
      GridPageSize: MaxRows, TotalRecord, dynamicpagging, NoPerPage: await UtilityClass.GridNumbersPerPage(), CurrentPage: page,
    });
    OutStock = 'false';
  } catch (Exp) {
    // PORT-NOTE: legacy called Response.Redirect("/page-not-found") FIRST (ThreadAbortException), so its ErrorInsert block never ran.
    console.error('[admin] ManageStock/Index:', Exp.message);
    return res.json({ redirect: '/page-not-found' });
  }
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ProductName, PRCode, OutStock, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/ManageStock/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string ProductName, string PRCode, string OutStock)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.ProductName), nStr(req.p.PRCode), nStr(req.p.OutStock), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult AddStock(string TKPMID, string InStock, string FRID)
// auth (reads Session["Admin_User"].Emp_ID)
router.all(`/admin/${C}/AddStock{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const loginid = req.user.emp_id;
  // DBO.USP_AddInStock @TKPMID,@InStock,@lastAddededBy,@StrResult OUT,@FRID
  const row = await db.procOne(DB, 'USP_AddInStock', {
    TKPMID: cvtInt(nStr(req.p.TKPMID)), InStock: cvtInt(nStr(req.p.InStock)), lastAddededBy: loginid, FRID: cvtInt(nStr(req.p.FRID)),
  });
  return res.json(outStr(row, 'strresult'));
}));

// ---------------------------------------------------------------- JsonResult GetUserName(string prefix, string Type = "", string FRID = "")
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/GetUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Type = req.p.Type === undefined ? '' : nStr(req.p.Type);
  const FRID = req.p.FRID === undefined ? '' : nStr(req.p.FRID);
  if (FRID === '') throw new Error('Input string was not in a correct format.'); // Convert.ToInt32("") (default value "")
  const rows = await db.proc(DB, 'UPS_GetUserName', { UserName: nStr(req.p.prefix), Type, FRID: cvtInt(FRID) });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- JsonResult stocktransfer(string FRID, string stock, string Remarks, string FRCODE, string FromFRID, string Type)
// auth (reads Session["Admin_User"].Emp_ID inside the try - legacy without a session returned Json(""))
router.all(`/admin/${C}/stocktransfer{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let FRID = nStr(req.p.FRID);
  const stock = nStr(req.p.stock);
  const Remarks = nStr(req.p.Remarks);
  const FRCODE = nStr(req.p.FRCODE);
  const FromFRID = nStr(req.p.FromFRID);
  const Type = nStr(req.p.Type);
  let OutputResult = '';
  try {
    const a = splitCsv(stock, '^');
    for (let i = 0; i < a.length; i++) {
      const p = a[i].split('~');
      const ID = cvtInt(at(p, 0));
      const QNTY = at(p, 1);
      if (QNTY !== '') {
        if (FRID === '') FRID = '0';
        const loginid = req.user.emp_id;
        // DBO.USP_ADDTRANSFERSTOCK @FRID,@ID,@QNTY,@loginid,@StrResult OUT,@REMARK,@FRCODE,@FromFRID,@Type
        const row = await db.procOne(DB, 'USP_ADDTRANSFERSTOCK', {
          FRID: cvtInt(FRID), ID, QNTY: cvtInt(QNTY), loginid, REMARK: Remarks, FRCODE, FromFRID: cvtInt(FromFRID), Type: cvtInt(Type),
        });
        OutputResult = outStr(row, 'strresult');
      }
    }
    if (OutputResult.toUpperCase() === 'SUCCESS') {
      await GenerateDeliveryChallan(req, FRID, stock, Remarks, FromFRID);
    }
    return res.json(OutputResult);
  } catch (ex) {
    return res.json(OutputResult);
  }
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByUserName(string username, int itemid, string Type)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/GetDetailsByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const itemid = reqInt(req.p.itemid, 'itemid');
  const rows = await db.proc(DB, 'UPS_GetDetailsByUserName', { UserName: nStr(req.p.username), itemid, Type: nStr(req.p.Type) });
  return res.json(mapRows(rows, PROPS));
}));

// ---------------------------------------------------------------- public void GenerateDeliveryChallan(string FRID, string stock, string Remarks, string FromFRID)
// auth (public method => routable in legacy; reads Session["Admin_User"].Emp_ID outside its try)
router.all(`/admin/${C}/GenerateDeliveryChallan{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await GenerateDeliveryChallan(req, nStr(req.p.FRID), nStr(req.p.stock), nStr(req.p.Remarks), nStr(req.p.FromFRID));
  res.send('');
}));

module.exports = router;
