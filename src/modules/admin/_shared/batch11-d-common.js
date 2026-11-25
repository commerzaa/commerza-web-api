'use strict';
/**
 * Helpers private to admin port batch11 part D (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: linksIndex(opts), linksExport(opts)
 *   (shared logic of Pending_Links.cs / Process_Links.cs: the two controllers are line-for-line identical except proc, model and the
 *    Index try/catch, which the opts carry)
 */
const config = require('../../../config');
const db = require('../../../db');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const {
  DB, nInt, nStr, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, cellStr, tab, outOf,
} = require('./batch11-common');

/**
 * public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate)
 * opts: { req, res, url, proc, props, maxRows, ViewBag, SearchField, SearchValue, fromDate, toDate }
 */
async function linksExport(o) {
  const { req, res, ViewBag } = o;
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + nowStamp();
  await excelHistory(userid, o.url, Filename);
  const rows = await db.proc(DB, o.proc, {
    StartRowIndex: 1, MaxRows: o.maxRows, SearchField: o.SearchField, SearchValue: o.SearchValue, fromDate: o.fromDate, ToDate: o.toDate,
  });
  const PLObj = mapRows(rows, o.props);
  if (PLObj.length > 0) {
    let RowNumber = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Manual.xls', Filename,
      headers: ['S.No.', 'Order ID', 'BTC Address', 'Hash Code', 'Date'],
      rows: PLObj,
      innerProc: 'AllEPinRequestsList',
      outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(tab(String(RowNumber)) + ' \t');
        w(tab(cellStr(item, 'orderID')) + ' \t');
        w(tab(cellStr(item, 'BlockChainAddress')) + ' \t');
        w(tab(cellStr(item, 'hashcode')) + ' \t');
        w(tab(cellStr(item, 'Create_Date')) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

/**
 * public ActionResult Index(int? dynamicpagging, string btnexel, string SearchField, string SearchValue, string fromDate, string toDate, int? page)
 * opts: { req, res, setUrl(u), getUrl(), proc, props, exportMaxRows, viewName, withTryCatch (Process_Links), emptyTotalIsZero (Pending_Links) }
 */
async function linksIndex(o) {
  const { req, res } = o;
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let btnexel = nStr(req.p.btnexel);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let page = nInt(req.p.page);
  const ViewBag = {};
  // (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin") handled by adminAuth)
  if (btnexel === null) btnexel = '';
  o.setUrl(req);
  const url = o.getUrl();
  const Employeeid = req.user.emp_id;
  if (dynamicpagging === null) dynamicpagging = cvtInt(config.app.DynamicPagging); // Convert.ToInt16(AppSettings["DynamicPagging"])
  const p = await inlinePerms(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (SearchField === null) SearchField = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (page === null) page = 1;
  let PLObj = [];
  const body = async () => {
    const MaxRows = Number(dynamicpagging);
    const rows = await db.proc(DB, o.proc, {
      StartRowIndex: page, MaxRows, SearchField, SearchValue, fromDate, ToDate: toDate,
    });
    PLObj = mapRows(rows, o.props);
    const s = outOf(rows, 'SpOutputCount');
    let TotalRecord;
    if (o.emptyTotalIsZero) {
      TotalRecord = parseInt(s === '' ? '0' : s, 10);
    } else {
      // int.Parse(spOutput.Value.ToString()) - PORT-NOTE: with no rows PG cannot return the OUT value => 0 (legacy got the count)
      TotalRecord = s === '' ? 0 : parseInt(s, 10);
      if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
    }
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.dynamicpagging = dynamicpagging;
  };
  if (o.withTryCatch) {
    try {
      await body();
    } catch (Exp) {
      // PORT-NOTE: legacy Response.Redirect("/page-not-found") ended the request (ThreadAbortException) before its ErrorInsert
      // block ("USP_EmployeeLedgerDetails") could run; the ErrorInsert is therefore not executed here either.
      return res.json({ redirect: '/page-not-found' });
    }
  } else {
    await body();
  }
  if (btnexel === 'Export Excel') {
    const r = await linksExport({
      req, res, url: o.getUrl(), proc: o.proc, props: o.props, maxRows: o.exportMaxRows, ViewBag, SearchField, SearchValue, fromDate, toDate,
    });
    if (r.sent) return undefined;
  }
  return res.json({ view: o.viewName, Model: PLObj, ...ViewBag });
}

module.exports = { linksIndex, linksExport };
