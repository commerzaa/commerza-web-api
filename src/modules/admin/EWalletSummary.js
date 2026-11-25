'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\EWalletSummary.cs
// (namespace Common.Controllers.AdminPanel, class EWalletSummaryController => /admin/EWalletSummary/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch07_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'EWalletSummary';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class EWalletSummary */
const SUMMARY_PROPS = ['ROWNUMBER', 'Username', 'Name', 'MOBILE', 'EMAILID', 'Activation', 'Registration', 'Credited', 'Used', 'Balance',
  'Requested', 'Pending', 'Rejected', 'ADMINTRAFER'];

/**
 * Decimal OUT SqlParameter declared without Precision/Scale => SqlClient returns it rounded to scale 0.
 * PORT-NOTE: reproduced with Math.round (same convention as batch05). DBNull/missing => undefined.
 */
function scale0(v) {
  if (v === null || v === undefined || v === '') return undefined;
  return Math.round(Number(v));
}
/** Convert.ToInt32(X.Value.ToString() == "" ? "0" : X.Value.ToString()) */
function outIntOr0(row, name, isDecimal) {
  const raw = B.col(row, name);
  const v = isDecimal ? scale0(raw) : raw;
  const s = B.str(v);
  return B.cvtInt(s === '' ? '0' : s);
}

/** DBO.UPS_EWalletSummary @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@fromDate,@toDate,@datetype,@orderbydate,@TotalRecord out,@TotalBalance out,
 *  @USED out,@CREDITED out,@TotalRequested OUT,@TotalPending OUT,@TotalRejected OUT,@ADMINTRANFER OUT */
async function summary(page, MaxRows, Searchfield, Searchvalue, fromDate, toDate, datetype, orderbydate) {
  return db.proc(DB, 'UPS_EWalletSummary', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: Searchfield, SEARCHVALUE: Searchvalue, fromDate, toDate, datetype, orderbydate,
  });
}

/** public void ExportReport(int? page, string Searchfield, string Searchvalue, string fromDate, string toDate, string datetype, string orderbydate) */
async function ExportReport(req, res, ViewBag, page, Searchfield, Searchvalue, fromDate, toDate, datetype, orderbydate) {
  const userid = req.user.emp_id;
  const Filename = 'E_WalletSummary_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // assigned but unused (MAXROWS = 99999999)
  void MaxRows;
  const rows = await summary(page, 99999999, Searchfield, Searchvalue, fromDate, toDate, datetype, orderbydate);
  const objAllWalletList = mapRows(rows, SUMMARY_PROPS);
  const r0 = rows[0];
  const TotalAllBalance = outIntOr0(r0, 'totalbalance', false);
  const USEDAmount = outIntOr0(r0, 'used', true);
  const TotalCREDITED = outIntOr0(r0, 'credited', true);
  if (objAllWalletList.length > 0) {
    try {
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'E_WalletSummary.xls');
      ViewBag.filepath = filepath;
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      let out = '';
      let closed = false; // StreamWriter closed by the inner catch => every later write throws ObjectDisposedException
      const wr = (x) => { if (closed) throw new Error('Cannot write to a closed TextWriter.'); out += x; };
      for (const h of ['S.No.', 'Username', 'Name', 'MOBILE', 'Requested', 'Pending', 'Rejected', 'Approved', 'Tranfer', 'Used', 'Available']) wr(`${h} \t`);
      for (const item of objAllWalletList) {
        try {
          wr('\n');
          wr(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
          wr(B.tab(B.cellStr(item, 'Username')) + ' \t');
          wr(B.tab(B.cellStr(item, 'Name').replace(/ /g, '')) + ' \t');
          wr(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
          wr(B.tab(B.dec2(item.Requested)) + ' \t');
          wr(B.tab(B.dec2(item.Pending)) + ' \t');
          wr(B.tab(B.dec2(item.Rejected)) + ' \t');
          wr(B.tab(B.dec2(item.Credited)) + ' \t');
          wr(B.tab(B.dec2(item.ADMINTRAFER)) + ' \t');
          wr(B.tab(B.dec2(item.Used)) + ' \t');
          wr(B.tab(B.dec2(item.Balance)) + ' \t');
        } catch (ExpObj) {
          await errorInsert(req, ExpObj, 'E_WalletSummary');
          closed = true;
        }
      }
      wr('\n');
      wr(' \t');
      wr(' \t');
      wr(' \t');
      wr('Total:' + ' \t');
      wr(TotalCREDITED.toFixed(2) + ' \t');
      wr(USEDAmount.toFixed(2) + ' \t');
      wr(TotalAllBalance.toFixed(2) + ' \t');
      fs.writeFileSync(filepath, out);
      // PORT-NOTE: Response.Redirect("~/AllExcelSheets/E_WalletSummary.xls") aborted the thread before File.Copy to ~/DownloadedExcel; content is sent directly.
      const dl = path.join(config.uploadDir, 'DownloadedExcel');
      fs.mkdirSync(dl, { recursive: true });
      const filepath1 = path.join(dl, `${Filename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=E_WalletSummary.xls');
      res.send(out);
      return { sent: true };
    } catch (ExpObj) {
      if (res.headersSent) return { sent: true };
      // PORT-NOTE: legacy wrote the partial file only via StreamWriter; an ObjectDisposedException on the totals row lands here (file left as flushed).
      await errorInsert(req, ExpObj, 'Usp_TransferFundToUser');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, string datetype, string btnexel, string fromDate, string toDate, string Searchfield, string Searchvalue, int? page)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/EWallet-Summary" -> EWalletSummary/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/EWallet-Summary'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let datetype = B.nStr(req.p.datetype);
  let btnexel = B.nStr(req.p.btnexel);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let Searchfield = B.nStr(req.p.Searchfield);
  let Searchvalue = B.nStr(req.p.Searchvalue);
  let page = B.nInt(req.p.page);

  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  if (Searchvalue === null) Searchvalue = '';
  if (Searchfield === null) Searchfield = '';
  if (btnexel === null) btnexel = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (datetype === null) datetype = '';
  const Employeeid = req.user.emp_id;
  // inline USP_GETEXCELPERMISIONSTATUS / USP_EXCEL_LINK (no try/catch in legacy => exceptions propagate)
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);

  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await summary(page, MaxRows, Searchfield, Searchvalue, fromDate, toDate, datetype, orderbydate);
  const objAllWalletList = mapRows(rows, SUMMARY_PROPS);
  const r0 = rows[0];
  const tr = B.str(B.col(r0, 'totalrecord'));
  const TotalRecord = B.cvtInt(tr === '' ? '0' : tr);
  const TotalAllBalance = outIntOr0(r0, 'totalbalance', false);
  ViewBag.TotalAllBalance = TotalAllBalance;
  const USEDAmount = outIntOr0(r0, 'used', true);
  ViewBag.USED = USEDAmount;
  const TotalCREDITED = outIntOr0(r0, 'credited', true);
  for (const [k, c] of [['TotalRequested', 'totalrequested'], ['TotalPending', 'totalpending'], ['TotalRejected', 'totalrejected'], ['ADMINTRANFER', 'admintranfer']]) {
    const v = scale0(B.col(r0, c));
    if (v !== undefined) ViewBag[k] = v; // X.Value.ToString() != "" && X.Value != null
  }
  ViewBag.CREDITED = TotalCREDITED;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.CurrentPage = page;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, page, Searchfield, Searchvalue, fromDate, toDate, datetype, orderbydate);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/EWalletSummary/Index.cshtml', Model: objAllWalletList, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UserSummaryDetails(string Type, string UserName)
// auth (legacy had NO session check; it exposes a member's wallet usage, so it is protected with adminAuth - see report)
router.all(`/admin/${C}/UserSummaryDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let UserName = B.nStr(req.p.UserName);
  let ret = '';
  try {
    UserName = await UtilityClass.Decryptword(UserName);
    // [DBO].[USP_USED_USERWISE_REPORT] @USERNAME,@SHOPPING OUT,@VOUCHERGERNATE OUT,@WITHDRAWAL OUT,@PACKAGEPURCHASE OUT,@INTERNALTRANFER OUT,@DEBITBYADMIN OUT
    const rows = await db.proc(DB, 'USP_USED_USERWISE_REPORT', { USERNAME: UserName });
    // Obj (List<TRANSACTION>) is not used further.
    const r0 = rows[0];
    const dec = (name) => {
      const v = scale0(B.col(r0, name));
      if (v === undefined) throw new Error('Object cannot be cast from DBNull to other types.'); // Convert.ToDecimal(DBNull)
      return v;
    };
    const SHOPPINGS = dec('shopping');
    const VOUCHERGERNATES = dec('vouchergernate');
    const WITHDRAWALS = dec('withdrawal');
    const PACKAGEPURCHASES = dec('packagepurchase');
    const INTERNALTRANFERS = dec('internaltranfer');
    const DEBITBYADMINS = dec('debitbyadmin');
    ret = 'success|^' + SHOPPINGS + '^' + VOUCHERGERNATES + '^' + WITHDRAWALS + '^' + PACKAGEPURCHASES + '^' + INTERNALTRANFERS + '^' + DEBITBYADMINS;
    return res.json(ret);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_TRANSACTION_COUNT');
    ret = String(ExpObj.message);
    return res.json(ret);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? page, string Searchfield, string Searchvalue, string fromDate, string toDate, string datetype, string orderbydate)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nInt(req.p.page), B.nStr(req.p.Searchfield), B.nStr(req.p.Searchvalue), B.nStr(req.p.fromDate),
    B.nStr(req.p.toDate), B.nStr(req.p.datetype), B.nStr(req.p.orderbydate));
  if (!r.sent) res.send(''); // void action => empty response
}));

module.exports = router;
