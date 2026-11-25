'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel$1.cs (class Pending_LinksController)
// Database: affiliate (Db_Affiliate). Logic shared with the twin controller lives in _shared/batch11D_common.js.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { nStr } = require('./_shared/batch11_common');
const { linksIndex, linksExport } = require('./_shared/batch11D_common');

const router = express.Router();
const C = 'Pending_Links';

/** class PendingLinksList */
const PROPS = ['RowNumber', 'HRID', 'Amount', 'Create_Date', 'Expire_Date', 'fromLoginId', 'fromEmailid', 'fromName', 'fromMobile', 'investID', 'giveID', 'Help_Date', 'GHStatus', 'regDate', 'fromRegNo', 'toRegNo', 'toLoginID', 'toEmailid', 'toName', 'toMobile', 'BlockChainAddress', 'btcAmount', 'HRStatus', 'orderID', 'hashcode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Pending-Links" -> Pending_Links/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pending-Links'], adminAuth, asyncHandler(async (req, res) => linksIndex({
  req,
  res,
  setUrl: (r) => { url1 = legacyUrl(r).slice(1); url = '~' + url1; },
  getUrl: () => url,
  proc: 'usp_PendingLinkList',
  props: PROPS,
  exportMaxRows: 999999,
  viewName: '~/Views/AdminPanel/Pending_Links/Index.cshtml',
  withTryCatch: false,
  emptyTotalIsZero: true,
})));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"], returns member data)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await linksExport({
    req, res, url, proc: 'usp_PendingLinkList', props: PROPS, maxRows: 999999, ViewBag: {},
    SearchField: nStr(req.p.SearchField), SearchValue: nStr(req.p.SearchValue), fromDate: nStr(req.p.fromDate), toDate: nStr(req.p.toDate),
  });
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
