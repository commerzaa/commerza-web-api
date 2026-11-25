'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Shoppingwallet_Summary.cs (class Daily_Shoppingwallet_SummaryController => /admin/Daily_Shoppingwallet_Summary/...)
// Database: affiliate (Db_Affiliate). Same C# body as the other Daily_*wallet_Summary controllers except @Mode = "5"
// (CheckPermissions BAL); logic in ./_shared/batch05_dailySummary.js.
const { build } = require('./_shared/batch05_dailySummary');

const C = 'Daily_Shoppingwallet_Summary';

module.exports = build({
  C,
  mode: '5',
  inlinePerms: false,
  filePrefix: 'Daily_Shoppingwallet_Summary',
  // ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
  // auth ([SessionExpireCheck])
  // route-config: "AdminPanel/Daily-Shoppingwallet-Summary" -> Daily_Shoppingwallet_Summary/Index
  indexPaths: ['/admin/Daily_Shoppingwallet_Summary/Index{/:id}', '/admin/Daily_Shoppingwallet_Summary', '/admin/AdminPanel/Daily-Shoppingwallet-Summary'],
  // ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
  // auth (public method => routable; reads Session["Admin_User"])
  exportPaths: '/admin/Daily_Shoppingwallet_Summary/ExportReport{/:id}',
});
