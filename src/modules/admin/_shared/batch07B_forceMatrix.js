'use strict';
/**
 * Shared body of Controllers/AdminPanel/F_MatrixDownload.cs and Force_Matrics_Downline.cs (same structure; differences are options).
 * Exports: FORCE_MATRICS_PROPS, build(opts) -> express.Router
 *   opts: { C, indexPaths[], view, proc (Index proc), exportProc, indexMaxRows ('grid' => UtilityClass.GridPageSize(), 'dyn' => dynamicpagging),
 *           setGridPageSize (ViewBag.GridPageSize), indexName ('' | 'trim' => Name.Trim()), passLevelTo (@LEVENUMBERto passed in Index),
 *           exportPassLevelTo, exportHeaders[], exportEmpLevel (EmpLevel column), outerProc }
 * Not a router file itself (lives in _shared/).
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./adminSession');
const B = require('./batch07_common');

const DB = 'affiliate';

/** class ForceMatricsList (Force_Matrics_Downline.cs) */
const FORCE_MATRICS_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status',
  'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName',
  'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE'];

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault()?.userName ?? "" */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  return row ? B.col(row, 'username') : '';
}

function build(opts) {
  const router = express.Router();
  const { C } = opts;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
  const st = { url: '', url1: '' };

  /** public void ExportReport(int? dynamicpagging, string fromdate, string btnexel, string todate, string SearchValue, string SearchField,
   *  string SponserID, int? page, string Name, int? Side, string Level, string ActivationStatus) */
  async function ExportReport(req, res, ViewBag, a) {
    const userid = req.user.emp_id;
    const Filename = 'Force_Matrix_Downline' + userid + '_' + B.nowStamp();
    await B.excelHistory(userid, st.url, Filename);
    const loginid = await rootLoginId();
    const MaxRows = 10000;
    let { page } = a;
    if (page === null) page = 1;
    if (a.fromdate === null || a.todate === null || a.SponserID === null) throw B.nullRef(); // .Trim() on null
    const params = {
      LOGINID: loginid, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: a.SearchField, SEARCHVALUE: a.SearchValue,
      FROMDATE: a.fromdate.trim(), TODATE: a.todate.trim(), LEVENUMBERfrom: B.cvtInt(a.Level === '' ? '0' : a.Level), SIDE: a.Side,
      NAME: '', USERNAME: '', EMAILID: '', SPONSERID: a.SponserID.trim(), CheckAdminSide: 0, ActivationStatus: 0,
    };
    const list = mapRows(await db.proc(DB, opts.exportProc, params), FORCE_MATRICS_PROPS);
    // (no Count > 0 check in the legacy code: the file is always written)
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Auto_Matrix_Downline.xls', Filename,
      headers: opts.exportHeaders,
      rows: list,
      innerProc: 'ExportReport',
      outerProc: opts.outerProc,
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'rownumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'Name')) + ' \t');
        w(B.tab(B.cellStr(item, 'userName')) + ' \t');
        w(B.tab(B.cellStr(item, 'spounser_userName')) + ' \t');
        w(B.tab(B.cellStr(item, 'root_userName')) + ' \t');
        w(B.tab(B.cellStr(item, 'RegDate')) + ' \t');
        w(B.tab(B.cellStr(item, 'DOC')) + ' \t');
        if (opts.exportEmpLevel) w(B.tab(B.cellStr(item, 'EmpLevel')) + ' \t');
      },
    });
  }

  function readArgs(req) {
    return {
      dynamicpagging: B.nInt(req.p.dynamicpagging), fromdate: B.nStr(req.p.fromdate), btnexel: B.nStr(req.p.btnexel), todate: B.nStr(req.p.todate),
      SearchValue: B.nStr(req.p.SearchValue), SearchField: B.nStr(req.p.SearchField), SponserID: B.nStr(req.p.SponserID), page: B.nInt(req.p.page),
      Name: B.nStr(req.p.Name), Side: B.nInt(req.p.Side), Level: B.nStr(req.p.Level), ActivationStatus: B.nStr(req.p.ActivationStatus),
    };
  }

  // [SessionExpireCheck] Index(...)
  // auth
  router.all(opts.indexPaths, adminAuth, asyncHandler(async (req, res) => {
    const a = readArgs(req);
    st.url1 = legacyUrl(req).slice(1);
    st.url = '~' + st.url1;
    if (a.fromdate === null) a.fromdate = '';
    if (a.todate === null) a.todate = '';
    if (a.btnexel === null) a.btnexel = '';
    if (a.SearchValue === null) a.SearchValue = '';
    if (a.SearchField === null) a.SearchField = '';
    if (a.SponserID === null) a.SponserID = '';
    if (a.Name === null) a.Name = '';
    if (a.dynamicpagging === null) a.dynamicpagging = 100;
    if (a.Side === null) a.Side = 0;
    if (a.Level === null) a.Level = '';
    if (a.ActivationStatus === null) a.ActivationStatus = '0';
    const Empid = req.user.emp_id;
    const ViewBag = {};
    Object.assign(ViewBag, await B.perms(Empid, st.url));
    const loginid = await rootLoginId();
    const MaxRows = opts.indexMaxRows === 'grid' ? await UtilityClass.GridPageSize() : Number(a.dynamicpagging);
    if (a.page === null) a.page = 1;
    const params = {
      LOGINID: loginid, STARTROWINDEX: a.page, MAXROWS: MaxRows, SEARCHFIELD: a.SearchField, SEARCHVALUE: a.SearchValue,
      FROMDATE: a.fromdate.trim(), TODATE: a.todate.trim(), LEVENUMBERfrom: B.cvtInt(a.Level === '' ? '0' : a.Level), SIDE: a.Side,
      NAME: opts.indexName === 'trim' ? a.Name.trim() : '', USERNAME: '', EMAILID: '', SPONSERID: a.SponserID.trim(), CheckAdminSide: 0,
      ActivationStatus: B.cvtInt(a.ActivationStatus),
    };
    if (opts.passLevelTo) params.LEVENUMBERto = 0;
    const rows = await db.proc(DB, opts.proc, params);
    const list = mapRows(rows, FORCE_MATRICS_PROPS);
    // @TOTALCOUNT OUT => result column "totalcount" (int.Parse: DBNull/"" => FormatException)
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    ViewBag.CurrentPage = a.page;
    ViewBag.dynamicpagging = a.dynamicpagging;
    if (opts.setGridPageSize) ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = a.fromdate;
    ViewBag.toDate = a.todate;
    ViewBag.SearchField = a.SearchField;
    ViewBag.SearchValue = a.SearchValue;
    ViewBag.side = a.Side;
    ViewBag.SponserID = a.SponserID;
    ViewBag.Level = a.Level;
    ViewBag.ActivationStatus = a.ActivationStatus;
    if (a.btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, a);
      if (r.sent) return undefined;
    }
    return res.json({ view: opts.view, Model: list, ...ViewBag });
  }));

  // public void ExportReport(...) - routable public method
  // auth (reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, {}, readArgs(req));
    if (!r.sent) res.send(''); // void action => empty response
  }));

  return router;
}

module.exports = { FORCE_MATRICS_PROPS, build };
