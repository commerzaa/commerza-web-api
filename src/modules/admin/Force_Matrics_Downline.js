'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Force_Matrics_Downline.cs (class Force_Matrics_DownlineController => /admin/Force_Matrics_Downline/...)
// Database: affiliate (Db_Affiliate). Body shared with F_MatrixDownload in ./_shared/batch07B_forceMatrix.js.
// Actions: Index (auth; route-config "AdminPanel/Force-Matrics-Downline" -> Force_Matrics_Downline/Index), ExportReport (auth).
// Class ForceMatricsList (defined in this C# file) => FORCE_MATRICS_PROPS in the shared helper.
const { build } = require('./_shared/batch07B_forceMatrix');

const C = 'Force_Matrics_Downline';

module.exports = build({
  C,
  // auth
  // route-config: "AdminPanel/Force-Matrics-Downline" -> Force_Matrics_Downline/Index
  indexPaths: [`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Force-Matrics-Downline'],
  view: '~/Views/AdminPanel/Force_Matrics_Downline/Index.cshtml',
  proc: 'USP_FORCEMATRIXONEBYONEDOWNLINE',
  exportProc: 'USP_FORCEMATRIXONEBYONEDOWNLINE',
  indexMaxRows: 'dyn', // Convert.ToInt32(dynamicpagging)
  setGridPageSize: false, // (commented out in C#)
  indexName: 'trim', // @Name = Name.Trim()
  passLevelTo: false, // @LEVENUMBERto not passed (proc default 0)
  exportHeaders: ['S.No.', 'Name', 'Username', 'Sponsor ', 'Parent', 'Joining Date', 'Activation  Date', 'EmpLevel'],
  exportEmpLevel: true,
  outerProc: 'USP_FORCEMATRIXONEBYONEDOWNLINE',
});
