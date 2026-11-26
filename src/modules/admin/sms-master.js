'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SMS_Master.cs (class SMS_MasterController, no namespace => /admin/SMS_Master/...)
// Database: affiliate (Db_Affiliate). Table tbl_smsapi; procs USP_SMS_SETTINGCENTER, USP_SMSAPIMASTER.
// sendMessageToMobile.CheckAPI (Controllers/AdminPanel/sendMessageToMobile.cs, no lib) => _shared/batch13-07-common.js CheckAPI.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, nStr, reqInt, col, str, nullRef } = require('./_shared/batch11-common');
const { CheckAPI, jsonOrEmpty } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'SMS_Master';

/** public class sms_master */
const SMS_MASTER_PROPS = ['ID', 'ModuleId', 'Action_Name', 'Sms_Content', 'Sms_Send_Status'];
/** public class VariablMaster */
const VARIABL_MASTER_PROPS = ['var_id', 'actionID', 'var_name', 'var_symbol', 'var_code', 'status'];
// (public class apidata { SAID, Tran_API } - not used by these actions)

// ---------------------------------------------------------------- ActionResult Index(int? page)
// auth (PORT-NOTE: legacy had no session check; admin settings page => adminAuth)
// route-config: "AdminPanel/SMS-Content" -> SMS_Master/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SMS-Content'], adminAuth, asyncHandler(async (req, res) => {
  let page = nInt(req.p.page);
  if (page === null) page = 1;
  const ViewBag = {};
  // Db._TBL_SMSAPI.Where(a => a.ACTIVE == 1).FirstOrDefault()
  const objapidata = await db.queryOne(DB, 'select * from tbl_smsapi where active = 1 limit 1', {});
  if (!objapidata) throw nullRef(); // objapidata.Tran_API on null
  ViewBag.tranApi = col(objapidata, 'Tran_API');
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // USP_SMS_SETTINGCENTER @Status,@ID,@STARTROWINDEX,@MAXROWS,@MODULID,@MODE,@Massage
  const AllSmsCenter = mapRows(await db.proc(DB, 'USP_SMS_SETTINGCENTER', {
    Status: 0, ID: 0, StartRowIndex: page, MaxRows, MODULID: 0, MODE: 1, Massage: '',
  }), SMS_MASTER_PROPS);
  ViewBag.AllSmm = AllSmsCenter;
  return res.json({ view: '~/Views/AdminPanel/SMS_Master/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult sendsmsonmobile(string api, string type)
// auth (PORT-NOTE: legacy had no session check; admin tool => adminAuth)
router.all(`/admin/${C}/sendsmsonmobile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let result = '';
  result = await CheckAPI(nStr(req.p.api), nStr(req.p.type));
  return res.json(result);
}));

// ---------------------------------------------------------------- public string sendsmsonmobilecheck(string api, string type)
// auth (PORT-NOTE: public string method => routable action returning plain text; admin tool => adminAuth)
async function sendsmsonmobilecheck(api, type) {
  let result = '';
  result = await CheckAPI(api, type);
  return result;
}
router.all(`/admin/${C}/sendsmsonmobilecheck{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const result = await sendsmsonmobilecheck(nStr(req.p.api), nStr(req.p.type));
  res.type('text/html').send(result);
}));

// ---------------------------------------------------------------- JsonResult updateAPI(string Tran_API)
// auth (PORT-NOTE: legacy had no session check; updates the SMS API => adminAuth)
router.all(`/admin/${C}/updateAPI{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Tran_API = nStr(req.p.Tran_API);
  let isvalidTranAPI = '';
  isvalidTranAPI = await sendsmsonmobilecheck(Tran_API, '1');
  if (isvalidTranAPI !== 'Valid API') return res.json(isvalidTranAPI);
  // [USP_SMSAPIMASTER] @MODE,@UPDATEDBY,@Tran_API,@STRResult out
  const row = await db.procOne(DB, 'USP_SMSAPIMASTER', { MODE: 2, UPDATEDBY: 0, Tran_API });
  const result = str(col(row, 'STRResult'));
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult SmsVariable(int moduleid, int? page)
// auth (PORT-NOTE: legacy had no session check; admin settings => adminAuth)
router.all(`/admin/${C}/SmsVariable{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const moduleid = reqInt(req.p.moduleid, 'moduleid');
  let page = nInt(req.p.page);
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  // USP_SMS_SETTINGCENTER @STATUS,@ID,@STARTROWINDEX,@MAXROWS,@MODULID,@MODE,@MASSAGE
  const AllSmsCenter = mapRows(await db.proc(DB, 'USP_SMS_SETTINGCENTER', {
    STATUS: 0, ID: 0, STARTROWINDEX: page, MAXROWS: MaxRows, MODULID: moduleid, MODE: 2, MASSAGE: '',
  }), VARIABL_MASTER_PROPS);
  return res.json(AllSmsCenter);
}));

// ---------------------------------------------------------------- JsonResult updatemassage(string Massage, int massageid)
// auth (PORT-NOTE: legacy had no session check; updates SMS content => adminAuth)
// PORT-NOTE: legacy passed "" for the INT params @StartRowIndex/@MaxRows/@MODULID (SQL Server converts '' to 0) => 0 is passed.
router.all(`/admin/${C}/updatemassage{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Massage = nStr(req.p.Massage);
  const massageid = reqInt(req.p.massageid, 'massageid');
  if (Massage === null) Massage = '';
  // (massageid == null on a non-nullable int is always false)
  const rows = await db.proc(DB, 'USP_SMS_SETTINGCENTER', {
    Status: 0, ID: massageid, StartRowIndex: 0, MaxRows: 0, MODULID: 0, MODE: 3, Massage,
  });
  const massage = rows.length ? mapRow(rows[0], VARIABL_MASTER_PROPS) : null; // .FirstOrDefault()
  return jsonOrEmpty(res, massage);
}));

// ---------------------------------------------------------------- JsonResult updatestatus(int Status, int massageid)
// auth (PORT-NOTE: legacy had no session check; updates SMS status => adminAuth)
router.all(`/admin/${C}/updatestatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Status = reqInt(req.p.Status, 'Status');
  const massageid = reqInt(req.p.massageid, 'massageid');
  // (Status == null / massageid == null on non-nullable ints are always false)
  const rows = await db.proc(DB, 'USP_SMS_SETTINGCENTER', {
    Status, ID: massageid, StartRowIndex: 0, MaxRows: 0, MODULID: 0, MODE: 4, Massage: '',
  });
  const smsStatus = rows.length ? mapRow(rows[0], VARIABL_MASTER_PROPS) : null; // .FirstOrDefault()
  return jsonOrEmpty(res, smsStatus);
}));

module.exports = router;
