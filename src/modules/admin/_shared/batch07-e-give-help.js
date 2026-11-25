'use strict';
/**
 * Helpers private to admin port batch07 (fork E): shared body of Give_Help_BTC.cs and Give_Help_Btcauto.cs
 * (Index + ExportReport identical apart from Usp_Give_Help_List paging / @isfirstlinkonly, sheet name and the Date column).
 * Exports: GHL_PROPS, giveHelpList(opts), indexBody(req, res, o), exportBody(req, res, ViewBag, o, SearchField, SearchValue, fromDate, toDate)
 *   o: { view, sheet, url() (static url getter), setUrl(u), exportMaxRows, isfirstlinkonly (undefined => not passed), indexMaxRows(MaxRows) (value sent
 *        as @MaxRows by Index), dateCell(item) }
 * Not a router (lives in _shared/).
 */
const db = require('../../../db');
const config = require('../../../config');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { legacyUrl } = require('./admin-session');
const { pagePermissions, excelLink } = require('./login-log-common');
const B = require('./batch07-common');

const DB = 'affiliate';

/** class GiveHelpList (Controllers/AdminPanel/Give_Help.cs) */
const GHL_PROPS = ['rowNumber', 'GiveID', 'InvestID', 'Help_Date', 'LoginId', 'Name', 'Emailid', 'Mobile', 'UserName', 'SpLoginId', 'SpName',
  'SpEmailid', 'SpMobile', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'Remain_Amount', 'Process_Amount', 'LinkCount', 'CountDown', 'Regno'];

/** dbo.Usp_Give_Help_List @StartRowIndex,@MaxRows,@SearchField,@SearchValue,@fromDate,@ToDate,@message out[,@isfirstlinkonly] */
async function giveHelpList(StartRowIndex, MaxRows, SearchField, SearchValue, fromDate, ToDate, isfirstlinkonly) {
  const p = { StartRowIndex, MaxRows, SearchField, SearchValue, fromDate, ToDate };
  if (isfirstlinkonly !== undefined) p.isfirstlinkonly = isfirstlinkonly;
  return db.proc(DB, 'Usp_Give_Help_List', p);
}

/** public void ExportReport(...) */
async function exportBody(req, res, ViewBag, o, SearchField, SearchValue, fromDate, toDate) {
  const userid = req.user.emp_id;
  const Filename = 'Text_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, o.url(), Filename);
  const GiveHelpList = mapRows(await giveHelpList(1, o.exportMaxRows, SearchField, SearchValue, fromDate, toDate, o.isfirstlinkonly), GHL_PROPS);
  if (GiveHelpList.length > 0) {
    let RowNumber = 1;
    return B.writeXlsExport({
      req, res, ViewBag, sheet: o.sheet, Filename,
      headers: ['S.No.', 'Name', 'Mobile No', 'Email id', 'Sponser By', 'Invest Id', 'Amount', 'Confirm Amount', 'Process Amount', 'Remain Amount', 'Date'],
      rows: GiveHelpList, innerProc: 'AllEPinRequestsList', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n');
        w(B.tab(String(RowNumber)) + ' \t');
        w(B.tab(B.cellStr(item, 'Name')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'Emailid')) + ' \t');
        w(B.tab(B.cellStr(item, 'SpEmailid')) + ' \t');
        w(B.tab(B.cellStr(item, 'InvestID')) + ' \t');
        w(B.tab(B.dec2(item.Help_Amount)) + ' \t');
        w(B.tab(B.dec2(item.Confirm_Amount)) + ' \t');
        w(B.tab(B.dec2(item.Process_Amount)) + ' \t');
        w(B.tab(B.dec2(item.Remain_Amount)) + ' \t');
        w(B.tab(o.dateCell(item)) + ' \t');
        RowNumber += 1;
      },
    });
  }
  return { sent: false };
}

/** ActionResult Index(...) body (after the adminAuth session check). */
async function indexBody(req, res, o) {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let btnexel = B.nStr(req.p.btnexel);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  if (btnexel === null) btnexel = '';
  o.setUrl('~' + legacyUrl(req).slice(1));
  const url = o.url();
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (dynamicpagging === null) {
    // Convert.ToInt16(AppSettings["DynamicPagging"]) (null => 0, invalid => FormatException)
    const value = config.app.DynamicPagging;
    dynamicpagging = B.cvtInt(value === undefined ? null : value);
  }
  // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out (inline)
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  // USP_EXCEL_LINK @url,@ISACTIVE out (CommandTimeout 1000)
  ViewBag.excelactive = await excelLink(url);
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await giveHelpList(page, o.indexMaxRows(MaxRows), SearchField, SearchValue, fromDate, toDate, o.isfirstlinkonly);
  const GiveHelpList = mapRows(rows, GHL_PROPS);
  // string str = spOutput.Value.ToString(); Convert.ToInt32(str.Split('^')[0])  (no try: "" => FormatException)
  // PORT-NOTE: @message OUT read from the first result row (no row => "" => FormatException, as with a DBNull OUT value).
  const str = B.outStr(rows[0], 'message');
  const strArray = str.split('^');
  if (strArray[0].trim() === '') throw new Error('Input string was not in a correct format.');
  const TotalRecord = B.cvtInt(strArray[0]);
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await exportBody(req, res, ViewBag, o, SearchField, SearchValue, fromDate, toDate);
    if (r.sent) return undefined;
  }
  return res.json({ view: o.view, Model: GiveHelpList, ...ViewBag });
}

module.exports = { GHL_PROPS, giveHelpList, indexBody, exportBody };
