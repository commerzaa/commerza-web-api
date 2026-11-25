'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Business_Report.cs (class Member_Business_ReportController => /Member_Business_Report/...)
// Database: affiliate (Db_Affiliate). Actions: [SessionExpireCheck] Index, ExportReport, GetAllDownLineMeberByUserName, GetAllLeftSideMemberOrRightSide
// (shared body with Matrix_Business_Report - see _shared/batch09_business.js). Also declares class MemberBusinessReport (MEMBER_BUSINESS_REPORT).
const { buildBusinessReport } = require('./_shared/batch09-business');

module.exports = buildBusinessReport({
  C: 'Member_Business_Report',
  routeConfig: '/admin/AdminPanel/Member-Business-Report', // route-config: "AdminPanel/Member-Business-Report" -> Member_Business_Report/Index
  view: '~/Views/AdminPanel/Member_Business_Report/Index.cshtml',
  sheet: 'Member_Business_Report.xls',
  withName: true,
  matrix: false,
});
