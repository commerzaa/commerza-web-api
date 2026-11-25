'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Give_Help_BTC.cs (class Give_Help_BTCController => /admin/Give_Help_BTC/...)
// Database: affiliate (Db_Affiliate).
//
// Coverage: Index -> route ; ExportReport (public void => routable) -> route + _shared/batch07E_giveHelp.exportBody (used by Index).
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/adminSession');
const B = require('./_shared/batch07_common');
const G = require('./_shared/batch07E_giveHelp');

const router = express.Router();
const C = 'Give_Help_BTC';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';

const opts = {
  view: '~/Views/AdminPanel/Give_Help_BTC/Index.cshtml',
  sheet: 'Secondary_BTC_Link.xls',
  url: () => url,
  setUrl: (u) => { url = u; },
  indexMaxRows: () => '50', // Index passed @MaxRows = "50" (ViewBag.GridPageSize still = dynamicpagging)
  exportMaxRows: 888899999,
  isfirstlinkonly: undefined, // not passed => proc default
  dateCell: (item) => B.cellStr(item, 'Help_Date'), // item.Help_Date.ToString()
};

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, string orderBy, int? page)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Give-Help-BTC" -> Give_Help_BTC/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Give-Help-BTC'], adminAuth, asyncHandler(async (req, res) => {
  // orderBy is overwritten with "" and only forwarded to ExportReport (unused there)
  return G.indexBody(req, res, opts);
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, string orderBy)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await G.exportBody(req, res, {}, opts, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue), B.nStr(req.p.fromDate), B.nStr(req.p.toDate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
