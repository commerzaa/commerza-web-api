'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Software_Updation.cs (class Software_UpdationController, no namespace => /admin/Software_Updation/...)
// Database: affiliate (Db_Affiliate). Procs USP_Software_Updation, USP_Auto_Obj_Search; table tbl_softwareversion.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, reqInt, col, str, outOf } = require('./_shared/batch11-common');
const { outIntStrictOf } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Software_Updation';

/** public class SoftwareUpdation */
const SOFTWARE_UPDATION_PROPS = ['ROWNUMBERS', 'WSID', 'NAME', 'DATE', 'WORKDETAILS', 'BYASSING', 'STATUS', 'TYPE', 'OBJECT', 'FullWORKDETAILS', 'Version_Name'];
/** public class AutoCompleteObjectName */
const AUTO_COMPLETE_PROPS = ['name', 'type'];
/** public class Selectversion */
const SELECT_VERSION_PROPS = ['TSVID', 'Version_Name'];

// PORT-NOTE: legacy passed "" for INT params (@STARTROWINDEX, @MAXROWS, @TSVID) - SQL Server converts '' to 0 => 0 is passed; and "" for the
// DATETIME param @Date - SQL Server converts '' to 1900-01-01 00:00:00 => that value is passed.
const EMPTY_DATETIME = '1900-01-01 00:00:00';

// ---------------------------------------------------------------- ActionResult Index(string fromDate, string toDate, string SearchField, string SearchValue, int? page, string txt_Object)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/Software-Updation" -> Software_Updation/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Software-Updation'], adminAuth, asyncHandler(async (req, res) => {
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let page = nInt(req.p.page);
  let txt_Object = nStr(req.p.txt_Object);
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (txt_Object === null) txt_Object = '';
  const MaxRows = 50;
  if (page === null) page = 1;
  const ViewBag = {};
  // [USP_Software_Updation] @MODE,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@Name,@Date,@WorkingDatail,@Object,@Status,@Assign,
  //   @WSID,@TSVID,@STRINRESULT out,@TotalCount out
  const rows = await db.proc(DB, 'USP_Software_Updation', {
    MODE: 1, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromDate, TODATE: toDate,
    Name: '', Date: EMPTY_DATETIME, WorkingDatail: '', Object: txt_Object, Status: '', Assign: '', WSID: 0, TSVID: 0,
  });
  const _ObjFlyerManagement = mapRows(rows, SOFTWARE_UPDATION_PROPS);
  ViewBag.message = outOf(rows, 'STRINRESULT');
  const TotalRecord = outIntStrictOf(rows, 'TotalCount'); // int.Parse(Totalcount.Value.ToString())
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  return res.json({ view: '~/Views/AdminPanel/Software_Updation/Index.cshtml', Model: _ObjFlyerManagement, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult insertstatus(string Name, string WorkingDatail, string Object, string Status, string Assign, int TSVID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/insertstatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Name = nStr(req.p.Name);
  const WorkingDatail = nStr(req.p.WorkingDatail);
  const Obj = nStr(req.p.Object);
  const Status = nStr(req.p.Status);
  const Assign = nStr(req.p.Assign);
  const TSVID = reqInt(req.p.TSVID, 'TSVID');
  // [USP_Software_Updation] ... @STRINRESULT out   (ExecuteSqlCommand)
  const row = await db.procOne(DB, 'USP_Software_Updation', {
    MODE: 2, STARTROWINDEX: 0, MAXROWS: 0, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', Name, Date: EMPTY_DATETIME,
    WorkingDatail, Object: Obj, Status, Assign, WSID: 0, TSVID,
  });
  const result = str(col(row, 'STRINRESULT'));
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult updateStatus(string Name, string WorkingDatail, string Object, string Status, string Assign, int WSID, int TSVID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/updateStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Name = nStr(req.p.Name);
  const WorkingDatail = nStr(req.p.WorkingDatail);
  const Obj = nStr(req.p.Object);
  const Status = nStr(req.p.Status);
  const Assign = nStr(req.p.Assign);
  const WSID = reqInt(req.p.WSID, 'WSID');
  const TSVID = reqInt(req.p.TSVID, 'TSVID');
  const row = await db.procOne(DB, 'USP_Software_Updation', {
    MODE: 3, STARTROWINDEX: 0, MAXROWS: 0, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', Name, Date: EMPTY_DATETIME,
    WorkingDatail, Object: Obj, Status, Assign, WSID, TSVID,
  });
  const result = str(col(row, 'STRINRESULT'));
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult Objectserch(string Object, int? page)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Objectserch{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Obj = nStr(req.p.Object);
  let page = nInt(req.p.page);
  const MaxRows = 50;
  if (page === null) page = 1;
  const _ObjFlyerManagement = mapRows(await db.proc(DB, 'USP_Software_Updation', {
    MODE: 1, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', Name: '', Date: EMPTY_DATETIME,
    WorkingDatail: '', Object: Obj, Status: '', Assign: '', WSID: 0, TSVID: 0,
  }), SOFTWARE_UPDATION_PROPS);
  return res.json(_ObjFlyerManagement);
}));

// ---------------------------------------------------------------- JsonResult SearchautoComplit(string Object)
// auth (PORT-NOTE: legacy had no session check; lists database object names => adminAuth)
// PORT-NOTE: USP_Auto_Obj_Search selected from SQL Server sys.objects; the PostgreSQL function must list the equivalent catalog objects.
router.all(`/admin/${C}/SearchautoComplit{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const AutoCompleteObjectName = mapRows(await db.proc(DB, 'USP_Auto_Obj_Search', { Object: nStr(req.p.Object) }), AUTO_COMPLETE_PROPS);
  return res.json(AutoCompleteObjectName);
}));

// ---------------------------------------------------------------- JsonResult SelectVersion()
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/SelectVersion{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SelectVersioname = mapRows(await db.query(DB, 'select tsvid, version_name from tbl_softwareversion where status = 1', {}), SELECT_VERSION_PROPS);
  return res.json(SelectVersioname);
}));

module.exports = router;
