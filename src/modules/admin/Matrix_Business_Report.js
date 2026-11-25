'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Matrix_Business_Report.cs (class Matrix_Business_ReportController => /Matrix_Business_Report/...)
// Database: affiliate (Db_Affiliate). Actions: Index, ExportReport, GetAllDownLineMeberByUserName, GetAllLeftSideMemberOrRightSide
// (shared body with Member_Business_Report - see _shared/batch09_business.js). Procs: USP_MEMBER_BUSINESSREPORT, USP_GET_MEMBERBUSINESS.
const { buildBusinessReport } = require('./_shared/batch09_business');

module.exports = buildBusinessReport({
  C: 'Matrix_Business_Report',
  routeConfig: '/admin/AdminPanel/Matrix-Business-Report', // route-config: "AdminPanel/Matrix-Business-Report" -> Matrix_Business_Report/Index
  view: '~/Views/AdminPanel/Matrix_Business_Report/Index.cshtml',
  sheet: 'Matrix_Business_Report.xls',
  withName: false,
  matrix: true,
});
