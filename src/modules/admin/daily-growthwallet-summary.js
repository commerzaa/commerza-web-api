'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Growthwallet_Summary.cs (class Daily_Growthwallet_SummaryController => /admin/Daily_Growthwallet_Summary/...)
// Database: affiliate (Db_Affiliate). Same C# body as the other Daily_*wallet_Summary controllers except @Mode = "3"
// and the inline USP_GETEXCELPERMISIONSTATUS / USP_EXCEL_LINK ("" => 0) permission block; logic in ./_shared/batch05_dailySummary.js.
const { build } = require('./_shared/batch05-daily-summary');

const C = 'Daily_Growthwallet_Summary';

module.exports = build({
  C,
  mode: '3',
  inlinePerms: true,
  filePrefix: 'Daily_Growthwallet_Summary',
  // ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
  // auth ([SessionExpireCheck])
  // route-config: "AdminPanel/Daily-Growthwallet-Summary" -> Daily_Growthwallet_Summary/Index
  indexPaths: ['/admin/Daily_Growthwallet_Summary/Index{/:id}', '/admin/Daily_Growthwallet_Summary', '/admin/AdminPanel/Daily-Growthwallet-Summary'],
  // ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
  // auth (public method => routable; reads Session["Admin_User"])
  exportPaths: '/admin/Daily_Growthwallet_Summary/ExportReport{/:id}',
});
