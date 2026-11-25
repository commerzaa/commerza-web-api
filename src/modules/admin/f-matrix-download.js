'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\F_MatrixDownload.cs (class F_MatrixDownloadController => /admin/F_MatrixDownload/...)
// Database: affiliate (Db_Affiliate). Body shared with Force_Matrics_Downline in ./_shared/batch07B_forceMatrix.js.
// Actions: Index (auth; route-config "AdminPanel/F-MatrixDownline" -> F_MatrixDownload/Index), ExportReport (auth).
const { build } = require('./_shared/batch07-b-force-matrix');

const C = 'F_MatrixDownload';

module.exports = build({
  C,
  // auth
  // route-config: "AdminPanel/F-MatrixDownline" -> F_MatrixDownload/Index
  indexPaths: [`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/F-MatrixDownline'],
  view: '~/Views/AdminPanel/F_MatrixDownload/Index.cshtml',
  proc: 'USP_FORCEMATRIXDOWNLINE',
  exportProc: 'USP_FORCEMATRIXDOWNLINE', // export EF text used positional names (@levenumber...) => bound to @LEVENUMBERfrom etc.
  indexMaxRows: 'grid', // UtilityClass.GridPageSize()
  setGridPageSize: true,
  indexName: '', // @NAME = ""
  passLevelTo: true,
  exportHeaders: ['S.No.', 'Name', 'Username', 'Sponsor ', 'Parent', 'Joining Date', 'Activation  Date', 'Level'],
  exportEmpLevel: false,
  outerProc: 'USP_FORCEMATRIXDOWNLINE',
});
