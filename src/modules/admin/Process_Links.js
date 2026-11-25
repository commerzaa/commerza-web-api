'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel$1.cs (class Process_LinksController)
// Database: affiliate (Db_Affiliate). Logic shared with the twin controller lives in _shared/batch11D_common.js.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { nStr } = require('./_shared/batch11_common');
const { linksIndex, linksExport } = require('./_shared/batch11D_common');

const router = express.Router();
const C = 'Process_Links';

/** class ProcessLinkList */
const PROPS = ['RowNumber', 'HRID', 'Amount', 'Create_Date', 'Expire_Date', 'FromLoginId', 'FromEmailId', 'FromName', 'FromMobile', 'InvestID', 'GiveID', 'Help_Date', 'GH_Status', 'RegDate', 'FromRegNo', 'ToRegNo', 'ToLoginID', 'ToEmailId', 'ToName', 'ToMobile', 'BlockChainAddress', 'BtcAmount', 'HRStatus', 'orderID', 'PaySlip', 'Remark', 'hashcode'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

// ---------------------------------------------------------------- Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Process-Links" -> Process_Links/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Process-Links'], adminAuth, asyncHandler(async (req, res) => linksIndex({
  req,
  res,
  setUrl: (r) => { url1 = legacyUrl(r).slice(1); url = '~' + url1; },
  getUrl: () => url,
  proc: 'usp_ProcessLinkList',
  props: PROPS,
  exportMaxRows: 9999999,
  viewName: '~/Views/AdminPanel/Process_Links/Index.cshtml',
  withTryCatch: true,
  emptyTotalIsZero: false,
})));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
// auth (public method => routable in legacy; reads Session["Admin_User"], returns member data)
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await linksExport({
    req, res, url, proc: 'usp_ProcessLinkList', props: PROPS, maxRows: 9999999, ViewBag: {},
    SearchField: nStr(req.p.SearchField), SearchValue: nStr(req.p.SearchValue), fromDate: nStr(req.p.fromDate), toDate: nStr(req.p.toDate),
  });
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
