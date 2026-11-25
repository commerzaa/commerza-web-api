'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\News_Letter_Subscriptions.cs (class News_Letter_SubscriptionsController => /News_Letter_Subscriptions/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nInt, s0, cvtInt, outIntOf } = require('./_shared/batch10-common');

const router = express.Router();
const C = 'News_Letter_Subscriptions';

/** class NewsLetterSubscription */
const PROPS = ['ROWNUMBER', 'nlid', 'emailID', 'date', 'status', 'LastMailDate'];

// ---------------------------------------------------------------- Index(string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/News-Letter-Subscriptions/{id}" -> News_Letter_Subscriptions/Index (id optional)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/News-Letter-Subscriptions{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const SearchField = s0(req.p.SearchField);
  const SearchValue = s0(req.p.SearchValue); // eslint-disable-line no-unused-vars -- legacy passed "" for @SEARCHVALUE
  const fromDate = s0(req.p.fromDate);
  const toDate = s0(req.p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  let page = nInt(req.p.page); if (page === null) page = 1;
  // [Usp_NewLetterSubscriptionList] @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT out
  const rows = await db.proc(DB, 'Usp_NewLetterSubscriptionList', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: '', FROMDATE: fromDate, TODATE: toDate,
  });
  const ObjNewsLetter = mapRows(rows, PROPS);
  const TotalRecord = outIntOf(rows, 'totalcount');
  res.json({
    view: '~/Views/AdminPanel/News_Letter_Subscriptions/Index.cshtml', Model: ObjNewsLetter,
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField,
    fromdate: fromDate, toDate,
  });
}));

// ---------------------------------------------------------------- Delete(string id)
// auth (PORT-NOTE: legacy had NO session check on this data-changing action; protected with adminAuth)
router.all(`/admin/${C}/Delete{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const id = req.p.id === undefined || req.p.id === '' ? null : req.p.id;
  let nlid = 0;
  if (id !== null) nlid = cvtInt(id);
  // Update tbl_NewsLetterEmailID set status = 0 where nlid='<nlid>'  (parameterised)
  await db.exec(DB, 'update tbl_newsletteremailid set status = 0 where nlid = @nlid', { nlid });
  res.json({ redirect: `/${C}/Index` }); // RedirectToAction("Index")
}));

module.exports = router;
