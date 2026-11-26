'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SingleLeg_Download.cs (class SingleLeg_DownloadController => /admin/SingleLeg_Download/...)
// Database: affiliate (Db_Affiliate).
// Coverage: Index ([SessionExpireCheck]) -> route ; ExportReport (public void => routable) -> route + internal function.
// PORT-NOTE: the legacy command texts bind POSITIONALLY to USP_SINGLELEGDOWNLINE (ExportReport used other placeholder names such as
// @levenumber/@side); the values are passed under the proc's real parameter names here.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const B = require('./_shared/batch13-06-common');

const router = express.Router();
const { DB } = B;
const C = 'SingleLeg_Download';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
// (`private List<ForceMatricsList> ExcelList` / `private string regno` were never used.)
let url = '';
let url1 = '';

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()?.userName ?? "" */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  return row ? row.username : '';
}

function downline(p) {
  B.need(p);
  return db.proc(DB, 'USP_SINGLELEGDOWNLINE', p);
}

/** public void ExportReport(int? dynamicpagging, string fromdate, string btnexel, string todate, string SearchValue, string SearchField, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus) */
async function ExportReport(req, res, ViewBag, dynamicpagging, fromdate, btnexel, todate, SearchValue, SearchField, SponserID, page, Name, Side, Level, ActivationStatus) {
  const userid = req.user.emp_id;
  const Filename = 'Single_Matrix_Downline' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const loginid = await rootLoginId();
  const MaxRows = 10000;
  if (page === null) page = 1;
  const ForceMatricsList = mapRows(await downline({
    LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: B.trimS(fromdate),
    TODATE: B.trimS(todate), LEVENUMBERfrom: B.cvtInt(Level === '' ? '0' : Level), SIDE: Side, NAME: '', USERNAME: '', EMAILID: '',
    SPONSERID: B.trimS(SponserID), CheckAdminSide: 0, ActivationStatus: 0, LEVENUMBERto: 0,
  }), B.FORCE_MATRICS_PROPS);
  return B.writeXlsExport({
    req, res, ViewBag, sheet: 'Auto_Matrix_Downline.xls', Filename,
    headers: ['S.No.', 'Name', 'Username', 'Sponsor ', 'Parent', 'Joining Date', 'Activation  Date', 'Level'],
    rows: ForceMatricsList, innerProc: 'ExportReport', outerProc: 'USP_SINGLELEGDOWNLINE',
    cells: (item, w) => {
      w('\n');
      w(B.tab(B.cellStr(item, 'rownumber')) + ' \t');
      w(B.tab(B.cellStr(item, 'Name')) + ' \t');
      w(B.tab(B.cellStr(item, 'userName')) + ' \t');
      w(B.tab(B.cellStr(item, 'spounser_userName')) + ' \t');
      w(B.tab(B.cellStr(item, 'root_userName')) + ' \t');
      w(B.tab(B.cellStr(item, 'RegDate')) + ' \t');
      w(B.tab(B.cellStr(item, 'DOC')) + ' \t');
      w(B.tab(B.cellStr(item, 'EmpLevel')) + ' \t');
    },
  });
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string fromdate, string btnexel, string todate, string SearchValue, string SearchField, string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus)
// auth ([SessionExpireCheck] => adminAuth)
// route-config: "AdminPanel/SingleLeg-Downline" -> SingleLeg_Download/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SingleLeg-Downline'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let fromdate = B.nStr(req.p.fromdate);
  let btnexel = B.nStr(req.p.btnexel);
  let todate = B.nStr(req.p.todate);
  let SearchValue = B.nStr(req.p.SearchValue);
  let SearchField = B.nStr(req.p.SearchField);
  let SponserID = B.nStr(req.p.SponserID);
  let page = B.nInt(req.p.page);
  let Name = B.nStr(req.p.Name);
  let Side = B.nInt(req.p.Side);
  let Level = B.nStr(req.p.Level);
  let ActivationStatus = B.nStr(req.p.ActivationStatus);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (btnexel === null) btnexel = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchField === null) SearchField = '';
  if (SponserID === null) SponserID = '';
  if (Name === null) Name = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (Side === null) Side = 0;
  if (Level === null) Level = '';
  if (ActivationStatus === null) ActivationStatus = '0';
  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  const loginid = await rootLoginId();
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await downline({
    LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue, FROMDATE: fromdate.trim(),
    TODATE: todate.trim(), LEVENUMBERfrom: B.cvtInt(Level === '' ? '0' : Level), SIDE: Side, NAME: Name.trim(), USERNAME: '', EMAILID: '',
    SPONSERID: SponserID.trim(), CheckAdminSide: 0, ActivationStatus: B.cvtInt(ActivationStatus), LEVENUMBERto: 0,
  });
  const ForceMatricsList = mapRows(rows, B.FORCE_MATRICS_PROPS);
  const TotalRecord = B.outIntOf(rows, 'TOTALCOUNT'); // int.Parse(spOutputL.Value.ToString())
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, dynamicpagging, fromdate, btnexel, todate, SearchValue, SearchField, SponserID, page, Name, Side, Level, ActivationStatus);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/SingleLeg_Download/Index.cshtml', Model: ForceMatricsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const v = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, B.nInt(req.p.dynamicpagging), v('fromdate'), v('btnexel'), v('todate'), v('SearchValue'), v('SearchField'),
    v('SponserID'), B.nInt(req.p.page), v('Name'), B.nInt(req.p.Side), v('Level'), v('ActivationStatus'));
  if (!r.sent) res.send('');
}));

module.exports = router;
