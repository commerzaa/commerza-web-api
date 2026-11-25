'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Daily_Commissionwallet_Summary.cs (class Daily_Commissionwallet_SummaryController => /admin/Daily_Commissionwallet_Summary/...)
// Database: affiliate (Db_Affiliate). Same C# body as the other Daily_*wallet_Summary controllers except @Mode = "4"
// (CheckPermissions BAL); logic in ./_shared/batch05_dailySummary.js.
const { build } = require('./_shared/batch05_dailySummary');

const C = 'Daily_Commissionwallet_Summary';

module.exports = build({
  C,
  mode: '4',
  inlinePerms: false,
  filePrefix: 'Daily_Commissionwallet_Summary',
  // ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, string From, string To, int? page, int? ddlcustpage, string btnexel)
  // auth ([SessionExpireCheck])
  // route-config: "AdminPanel/Daily-Commissionwallet-Summary" -> Daily_Commissionwallet_Summary/Index
  indexPaths: ['/admin/Daily_Commissionwallet_Summary/Index{/:id}', '/admin/Daily_Commissionwallet_Summary', '/admin/AdminPanel/Daily-Commissionwallet-Summary'],
  // ---------------------------------------------------------------- public void ExportReport(string From, string To, int? page, int? ddlcustpage)
  // auth (public method => routable; reads Session["Admin_User"])
  exportPaths: '/admin/Daily_Commissionwallet_Summary/ExportReport{/:id}',
});
