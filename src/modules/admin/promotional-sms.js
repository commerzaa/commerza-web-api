'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Promotional_SMS.cs (class Promotional_SMSController => /admin/Promotional_SMS/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nre, nstr, reqInt, toInt32, col, view, mapRows } = require('./_shared/batch02-common');
const { firstCol } = require('./_shared/batch11-common');
const { KIT_MASTER_PROPS, TBL_SMSTEMPLATE_PROPS, SendSMS } = require('./_shared/batch13-02-common');

const router = express.Router();
const C = 'Promotional_SMS';

// ---------------------------------------------------------------- Index(string datetype, string fromDate, string toDate, string ColumnName, string Status, string SearchValue, int? totalcount, string ddlpackage)
// auth (PORT-NOTE: legacy had NO session check; it lists every member mobile number => adminAuth)
// route-config: "AdminPanel/Promotional-SMS" -> Promotional_SMS/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Promotional-SMS'], adminAuth, asyncHandler(async (req, res) => {
  let datetype = nstr(req.p.datetype);
  let fromDate = nstr(req.p.fromDate);
  let toDate = nstr(req.p.toDate);
  let ColumnName = nstr(req.p.ColumnName);
  let Status = nstr(req.p.Status);
  let SearchValue = nstr(req.p.SearchValue);
  let ddlpackage = nstr(req.p.ddlpackage);
  const ViewBag = {};
  let totallist = ''; // private string totallist (per controller instance = per request)
  if (ColumnName === null) ColumnName = '';
  if (datetype === null) datetype = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (Status === null) Status = '';
  if (ddlpackage === null) ddlpackage = '0';
  // [USP_Promotional_SMS] @SEARCHFIELD,@SEARCHVALUE,@fromDate,@Todate,@USERTYPE,@customertype,@kid,@intresult out,@datetype
  const kid = toInt32(ddlpackage);
  totallist = firstCol(await db.proc(DB, 'USP_Promotional_SMS', {
    SEARCHFIELD: ColumnName, SEARCHVALUE: SearchValue, fromDate, Todate: toDate, USERTYPE: Status, customertype: '', kid, datetype,
  }));
  ViewBag.ddlpackage = ddlpackage;
  if (totallist === null || totallist === undefined) {
    totallist = '';
    ViewBag.Totalmobile = '0';
  } else {
    const Allnumber = String(totallist).split(',');
    ViewBag.Totalmobile = Allnumber.length;
    ViewBag.TotalmobileNo = totallist;
  }
  ViewBag.TempleateName = mapRows(await db.query(DB, 'select stid, title, message, updatedon, updatedby, status from tbl_smstemplate where status = 1', {}),
    TBL_SMSTEMPLATE_PROPS);
  ViewBag.kitms = mapRows(await db.query(DB, 'select * from kit_master where status = 1', {}), KIT_MASTER_PROPS);
  return view(res, '~/Views/AdminPanel/Promotional_SMS/Index.cshtml', undefined, ViewBag);
}));

// ---------------------------------------------------------------- public string gettemplate(Int32 tempid)
// auth (PORT-NOTE: legacy had no session check)
router.all(`/admin/${C}/gettemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tempid = reqInt(req.p.tempid, 'tempid');
  const massages = await db.queryOne(DB, 'select stid, message from tbl_smstemplate where stid = @tempid limit 1', { tempid });
  if (!massages) throw nre(); // massages.MESSAGE
  const KitList = col(massages, 'message');
  return res.type('text/html').send(KitList === null || KitList === undefined ? '' : String(KitList));
}));

// ---------------------------------------------------------------- JsonResult sendMassageonmobile(string mobileno, string Message, string ApiType)
// auth (PORT-NOTE: legacy had no session check; sends SMS => adminAuth)
router.all(`/admin/${C}/sendMassageonmobile{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const mobileno = nstr(req.p.mobileno);
  const Message = nstr(req.p.Message);
  const ApiType = nstr(req.p.ApiType);
  let result = '';
  if (Message !== '') {
    try {
      // new Thread(() => result = sendMessageToMobile.SendSMS(mobileno, Message, ApiType)).Start() => fire-and-forget
      setImmediate(() => {
        Promise.resolve()
          .then(() => SendSMS(mobileno, Message, ApiType))
          .catch((e) => console.error('[admin/Promotional_SMS] sms thread failed:', e.message));
      });
      result = 'Success';
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'sendMassageonmobile');
      result = ExpObj.message;
    }
  }
  return res.json(result);
}));

module.exports = router;
