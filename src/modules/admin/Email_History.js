'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Email_History.cs (class Email_HistoryController, no namespace => /Email_History/...)
// Database: affiliate (Db_Affiliate). Procs USP_MANAGEEMAILHISTORY, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const {
  nInt, nStr, col, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dynPaging, intParse,
} = require('./_shared/batch06_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Email_History';

/** public class EMAILHISTORY */
const EMAILHISTORY_PROPS = ['ROWNUMBER', 'EHID', 'FromEmailid', 'ToEmailid', 'DATE', 'TIME', 'Subject', 'MESSAGE', 'STATUS'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** [USP_MANAGEEMAILHISTORY] @SHID,@FROMEMAILID,@TOEMAILD,@SUBJECT,@MESSAGE,@STATUS,@MODE,@fromDate,@ToDate,@STARTROWINDEX,@MAXROWS,@ORDERBYFIELD,
 *  @INTRESULT OUT,@TOTALSEND OUT,@TOTALFAILED OUT */
const history = (FROMEMAILID, TOEMAILD, STATUS, fromDate, ToDate, STARTROWINDEX, MAXROWS, ORDERBYFIELD) => db.proc(DB, 'USP_MANAGEEMAILHISTORY', {
  SHID: '1', FROMEMAILID, TOEMAILD, SUBJECT: '', MESSAGE: '', STATUS, MODE: '2', fromDate, ToDate, STARTROWINDEX, MAXROWS, ORDERBYFIELD,
});

/** public void ExportReport(string fromDate, string toDate, string FromEmailid, string ToEmailid, int? Status, string OrderBy) */
async function ExportReport(req, res, fromDate, toDate, FromEmailid, ToEmailid, Status, OrderBy, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Email_History' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await history(FromEmailid, ToEmailid, Status, fromDate, toDate, 1, 9999999, OrderBy), EMAILHISTORY_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'Email_History.xls', Filename, ViewBag, rows: list, downloadName: ' Email_History.xls',
      headers: ['S.No.', 'Date', 'Time', 'Subject', 'Message', 'From E-Mail ID', 'To E-Mail ID', 'STATUS'],
      innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        for (const k of ['ROWNUMBER', 'DATE', 'TIME', 'Subject', 'MESSAGE', 'FromEmailid', 'ToEmailid']) w(tab(cellStr(item, k)) + ' \t');
        const statuss = Number(item.STATUS);
        if (statuss === 1) w(tab('Send') + ' \t');
        else w(tab('Failed') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string fromDate, string toDate, string FromEmailid, string btnexel,
//   string ToEmailid, int? page, int? ddlcustpage, int? Status, string OrderBy)
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/Email-History" -> Email_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Email-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let fromDate = nStr(req.p.fromDate);
  let toDate = nStr(req.p.toDate);
  let FromEmailid = nStr(req.p.FromEmailid);
  let btnexel = nStr(req.p.btnexel);
  let ToEmailid = nStr(req.p.ToEmailid);
  let page = nInt(req.p.page);
  let ddlcustpage = nInt(req.p.ddlcustpage);
  let Status = nInt(req.p.Status);
  let OrderBy = nStr(req.p.OrderBy);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  const perm = await inlinePerms(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;
  if (OrderBy === null) OrderBy = 'DESC';
  if (FromEmailid === null) FromEmailid = '';
  if (ToEmailid === null) ToEmailid = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ddlcustpage === null) ddlcustpage = 50; // eslint-disable-line no-unused-vars
  if (Status === null) Status = -1;
  if (btnexel === null) btnexel = '';
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const rows = await history(FromEmailid.trim(), ToEmailid.trim(), Status, fromDate, toDate, page, MaxRows, OrderBy);
    const list = mapRows(rows, EMAILHISTORY_PROPS);
    const r0 = rows[0];
    const TotalRecord = intParse(col(r0, 'INTRESULT'));
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.dynamicpagging = dynamicpagging;
    if (Status === 2) {
      ViewBag.TotalSUCESS = 0; // Convert.ToInt32(TOTALSEND.Value = 0)
    } else {
      ViewBag.TotalSUCESS = intParse(col(r0, 'TOTALSEND'));
    }
    ViewBag.TotalFAIELD = intParse(col(r0, 'TOTALFAILED'));
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.FROMEMAILID = FromEmailid;
    ViewBag.TOEMAILID = ToEmailid;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.count = Status;
    ViewBag.OrderBy = OrderBy;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, fromDate, toDate, FromEmailid, ToEmailid, Status, OrderBy, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Email_History/Index.cshtml', Model: list, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_MANAGEEMAILHISTORY');
    return res.json({ view: '~/Views/AdminPanel/Email_History/Index.cshtml', ...ViewBag });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string FromEmailid, string ToEmailid, int? Status, string OrderBy)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.FromEmailid), nStr(req.p.ToEmailid),
    nInt(req.p.Status), nStr(req.p.OrderBy), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

module.exports = router;
