'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Wallet_Address.cs (class Member_Wallet_AddressController => /Member_Wallet_Address/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outIntOf, errorView,
} = require('./_shared/batch10-common');
const { dynPaging } = require('./_shared/batch10-a-common');

const router = express.Router();
const C = 'Member_Wallet_Address';

/** class MemberWalletAddress */
const PROPS = ['Name', 'USERNAME', 'MOBILE', 'DOC', 'Address', 'UpdatedDate', 'AddressType'];
/** class MemberBankDetails */
const BANK_PROPS = ['acid', 'regNo', 'accountHolderName', 'accountNo', 'bankName', 'branchName', 'ifscCode', 'SwiftCode', 'active', 'dtm_date',
  'dtm_update_date', 'PancardNo'];

// PORT-NOTE: `private static string url, url1` are static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// DBO.USP_GET_WALLETADDRESS @STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@PAYMODE,@TOTALCOUNT out
const callProc = (STARTROWINDEX, MAXROWS, SEARCHFIELD, SEARCHVALUE, FROMDATE, TODATE, PAYMODE) => db.proc(DB, 'USP_GET_WALLETADDRESS', {
  STARTROWINDEX, MAXROWS, SEARCHFIELD, SEARCHVALUE, FROMDATE, TODATE, PAYMODE,
});

// public void ExportReport(string SearchField, string SearchValue, int? page, string OrderBy, string FROMDATE, string TODATE, int? ddlforpaymentmode)
async function ExportReport(req, res, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ddlforpaymentmode, ViewBag) { // eslint-disable-line no-unused-vars
  const userid = req.user.emp_id;
  const Filename = 'Member_Wallet_Address_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  await UtilityClass.GridPageSize(); // int MaxRows (unused)
  if (SearchField === null || SearchValue === null) { SearchField = ''; SearchValue = ''; }
  if (OrderBy === null) OrderBy = '';
  if (page === null) page = 1;
  const rows = await callProc(1, 9999999, SearchField, SearchValue, FROMDATE, TODATE, ddlforpaymentmode);
  const MemberBtc = mapRows(rows, PROPS);
  if (MemberBtc.length > 0) {
    let sno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Member_Wallet_Address.xls', downloadName: ' Member_Wallet_Address.xls', Filename,
      headers: ['S.No.', 'USERNAME', 'MOBILE', 'Address', 'Updated Date'],
      rows: MemberBtc, innerProc: 'PayitForword_list', outerProc: 'USP_PAID_FORWORDLIST_BYADMIN',
      cells: (item, w) => {
        w('\n');
        w(tab(String(sno)) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'Address')) + ' \t');
        w(tab(cellStr(item, 'UpdatedDate')) + ' \t');
        sno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string SearchField, string SearchValue, int? page, string OrderBy,
//   string FROMDATE, string TODATE, int? ddlforpaymentmode, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Member-Wallet-Address" -> Member_Wallet_Address/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-Wallet-Address'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let ddlforpaymentmode = nInt(req.p.ddlforpaymentmode); if (ddlforpaymentmode === null) ddlforpaymentmode = 0;
  let SearchValue = nStr(req.p.SearchValue); if (SearchValue === null) SearchValue = '';
  let FROMDATE = nStr(req.p.FROMDATE); if (FROMDATE === null) FROMDATE = '';
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = dynPaging();
  let TODATE = nStr(req.p.TODATE); if (TODATE === null) TODATE = '';
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url);
  const ip = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = ip.isactive;
  ViewBag.isedit = ip.isedit;
  try {
    const MaxRows = dynamicpagging;
    let OrderBy = nStr(req.p.OrderBy); if (OrderBy === null) OrderBy = '';
    let page = nInt(req.p.page); if (page === null) page = 1;
    const rows = await callProc(page, MaxRows, SearchField, SearchValue, FROMDATE, TODATE, ddlforpaymentmode);
    const MemberBtc = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'totalcount');
    Object.assign(ViewBag, {
      CurrentPage: page, GridPageSize: MaxRows, dynamicpagging, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchField,
      SearchValue, FROMDATE, TODATE, OrderBy,
    });
    // ISNULL(DTM_DATE,'') on a datetime => 1900-01-01
    const row = mapRows(await db.query(DB, `select coalesce(acid,0) as acid, coalesce(regno,0) as regno, coalesce(accountholdername,'') as accountholdername,
      coalesce(accountno,'') as accountno, coalesce(bankname,'') as bankname, coalesce(branchname,'') as branchname, coalesce(ifsccode,'') as ifsccode,
      coalesce(dtm_date,'1900-01-01'::timestamp) as dtm_date, coalesce(dtm_update_date,'1900-01-01'::timestamp) as dtm_update_date, active,
      coalesce(pancardno,'') as pancardno, coalesce(swiftcode,'') as swiftcode from bank_accounts where active::int = 1`, {}), BANK_PROPS);
    if (row !== null) ViewBag.MemberBankDetails = row;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, SearchField, SearchValue, page, OrderBy, FROMDATE, TODATE, ddlforpaymentmode, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Member_Wallet_Address/Index.cshtml', Model: MemberBtc, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_GET_WALLETADDRESS');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nStr(req.p.SearchField), nStr(req.p.SearchValue), nInt(req.p.page), nStr(req.p.OrderBy),
    nStr(req.p.FROMDATE), nStr(req.p.TODATE), nInt(req.p.ddlforpaymentmode), {});
  if (!r.sent) res.send('');
}));

module.exports = router;
