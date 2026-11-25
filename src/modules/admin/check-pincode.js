'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\CheckPincode.cs (class CheckPincodeController => /CheckPincode/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch04-b-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'CheckPincode';

/** class CheckPincodeDetails */
const PROPS = ['ROWNUMBER', 'FRID', 'NAME', 'FRCODE', 'MOBILE', 'EMAILID', 'PLID'];
/** class stock_Payement_Request (Controllers/AdminPanel/Stock_Payement_Request.cs) */
const STOCK_PAY_PROPS = ['RowNumber', 'FPRID', 'USERNAME', 'FRCode', 'Bank', 'ModeName', 'Amount', 'Request_Date', 'status', 'FNAME',
  'EMAILID', 'REMARKS', 'BRANCH', 'IFSC', 'Attachment', 'Refrence'];

// ---------------------------------------------------------------- Index(int? page, string PinCode, string StokiestCode, string UserName)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Check-PinCode" -> CheckPincode/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Check-PinCode'], adminAuth, asyncHandler(async (req, res) => {
  let page = B.ip(req, 'page');
  let PinCode = B.sp(req, 'PinCode');
  let StokiestCode = B.sp(req, 'StokiestCode');
  let UserName = B.sp(req, 'UserName');
  const ViewBag = {};
  if (PinCode === null) {
    PinCode = '';
    ViewBag.Code = 1;
  }
  ViewBag.MPinCode = PinCode;
  const MaxRows = 100;
  if (page === null) page = 1;
  else ViewBag.Code = 0;
  if (StokiestCode === null) StokiestCode = '';
  else ViewBag.Code = 2;
  if (UserName === null) UserName = '';
  const rows = await db.proc(DB, 'USP_GETCHECKPINCODE', {
    PinCode, STARTROWINDEX: page, MAXROWS: 100, USERNAME: UserName, StokiestCode,
  });
  const Obj = mapRows(rows, PROPS);
  const tc = B.str(B.outVal(rows, 'TotalCount'));
  const TotalRecord = B.toInt32(tc === '' ? '0' : tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.Username = UserName;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  return res.json({ view: '~/Views/AdminPanel/CheckPincode/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult GETDetails(int FPRID)
// auth (franchise payment request details; legacy had no session check)
router.all(`/admin/${C}/GETDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FPRID = B.reqNum(req, 'FPRID');
  const Obj = mapRows(await db.proc(DB, 'Usp_Franchise_Payement_Request', {
    STARTROWINDEX: 1, MAXROWS: 100, ModeName: '', USERNAME: '', From: '', To: '', Mode: '2', FPRID,
  }), STOCK_PAY_PROPS);
  return res.json(Obj);
}));

module.exports = router;
