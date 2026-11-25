'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\API_Doc_List.cs (class API_Doc_ListController => /API_Doc_List/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, reqInt, toInt32 } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'API_Doc_List';

/** class API_Doc_List (also used by API_Reference.js) */
const API_DOC_LIST_PROPS = ['ROWNUMBER', 'APIID', 'APIMAINMENU', 'TYPE', 'NAME', 'LINK', 'PARAMETERCONTENT', 'PARAMETERNAME', 'DATATYPE',
  'PARAMETERDESCRIPTION', 'RESPONSE', 'REMARK', 'ACTIVE', 'STATUS', 'CREATEDATE', 'UPDATEDATE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = ''; // eslint-disable-line no-unused-vars
let url1 = '';

/** Json(null) => MVC JsonResult writes nothing (empty body, application/json) */
const jsonOrEmpty = (res, v) => (v === null || v === undefined ? res.type('application/json').send('') : res.json(v));

// ---------------------------------------------------------------- Index(int? dynamicpagging, string fromDate, string toDate, string SearchField, string SearchValue, int? page, int? ddlcustpage, int? Status, string OrderBy)
// auth (Session null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/api-doc-list" -> API_Doc_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/api-doc-list'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let fromDate = sv(req.p.fromDate);
  let toDate = sv(req.p.toDate);
  let SearchField = sv(req.p.SearchField);
  let SearchValue = sv(req.p.SearchValue);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let Status = nint(req.p.Status);
  let OrderBy = sv(req.p.OrderBy);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = toInt32(config.app.DynamicPagging); // Convert.ToInt16(AppSettings["DynamicPagging"])
  if (OrderBy === null) OrderBy = 'DESC';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (ddlcustpage === null) ddlcustpage = 50;
  if (Status === null) Status = 0;
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'USP_APICMS', {
      APIMAINMENU: '', TYPE: '', NAME: '', LINK: '', PARAMETERCONTENT: '', PARAMETERNAME: '', DATATYPE: '', PARAMETERDESCRIPTION: '',
      RESPONSE: '', REMARK: '', ACTIVE: 0, STATUS: 0, MODE: 2, APIID: 0, FROMDATE: fromDate, TODATE: toDate, SEARCHFIELD: SearchField,
      SEARCHVALUE: SearchValue, STARTROWINDEX: page, MAXROWS: MaxRows, ORDERBYFIELD: OrderBy,
    });
    const aPI_Doc_List = mapRows(rows, API_DOC_LIST_PROPS);
    const TotalRecord = toInt32(str(col(rows[0], 'intresult')) || 'x'); // Convert.ToInt32(@INTRESULT.ToString()) (DBNull => FormatException)
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.count = Status;
    ViewBag.OrderBy = OrderBy;
    return res.json({ view: '~/Views/AdminPanel/API_Doc_List/Index.cshtml', Model: aPI_Doc_List, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_APICMS');
    return res.json({ view: '~/Views/AdminPanel/API_Doc_List/Index.cshtml', Model: null, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- JsonResult updatestatus(int active, int apiid)
// auth (PORT-NOTE: legacy had NO session check on this admin data update - protected here)
router.all(`/admin/${C}/updatestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const active = reqInt(req.p.active, 'active');
  const apiid = reqInt(req.p.apiid, 'apiid');
  // update tbl_APICMS set Active = <active> where APIID = <apiid>   (parameterised; SqlQuery on an UPDATE => no row => Json(null))
  await db.exec(DB, 'update tbl_apicms set active = @active where apiid = @apiid', { active, apiid });
  return jsonOrEmpty(res, null);
}));

// ---------------------------------------------------------------- JsonResult deletestatus(int status, int apiid)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/deletestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const status = reqInt(req.p.status, 'status');
  const apiid = reqInt(req.p.apiid, 'apiid');
  await db.exec(DB, 'update tbl_apicms set status = @status where apiid = @apiid', { status, apiid });
  return jsonOrEmpty(res, null);
}));

// ---------------------------------------------------------------- JsonResult getAPIDetailByID(int apiid)
// auth (PORT-NOTE: legacy had NO session check - protected here)
router.all(`/admin/${C}/getAPIDetailByID{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const apiid = reqInt(req.p.apiid, 'apiid');
  const row = await db.queryOne(DB, `select apiid, apimainmenu, type, name, link, parametercontent, parametername, datatype, parameterdescription,
    response, remark, active, status, createdate, updatedate from tbl_apicms where apiid = @apiid limit 1`, { apiid });
  return jsonOrEmpty(res, row ? mapRow(row, API_DOC_LIST_PROPS) : null);
}));

// ---------------------------------------------------------------- JsonResult updateAPI(string apitype, string apiname, string apilink, string pcontent, string pname, string datatype, string pdescription, string response, string remark, int? mode, int active, int status, int apiid)
// auth (PORT-NOTE: legacy had NO session check and concatenated every value into the SQL (injection) - protected + parameterised here)
router.all(`/admin/${C}/updateAPI{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const active = reqInt(req.p.active, 'active');
  const status = reqInt(req.p.status, 'status');
  const apiid = reqInt(req.p.apiid, 'apiid');
  // null strings were concatenated as '' by C#
  const s = (k) => (sv(req.p[k]) === null ? '' : sv(req.p[k]));
  await db.exec(DB, `update tbl_apicms set type = @apitype, name = @apiname, link = @apilink, parametercontent = @pcontent,
    parametername = @pname, datatype = @datatype, parameterdescription = @pdescription, response = @response, remark = @remark,
    active = @active, status = @status where apiid = @apiid`, {
    apitype: s('apitype'), apiname: s('apiname'), apilink: s('apilink'), pcontent: s('pcontent'), pname: s('pname'),
    datatype: s('datatype'), pdescription: s('pdescription'), response: s('response'), remark: s('remark'), active, status, apiid,
  });
  return jsonOrEmpty(res, null);
}));

module.exports = router;
