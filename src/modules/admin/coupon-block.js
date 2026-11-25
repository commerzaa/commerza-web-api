'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Coupon_block.cs (class Coupon_blockController => /admin/Coupon_block/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Coupon_block';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests. (`private string regno` is unused.)
let url = '';
let url1 = '';

/** class Coupon_block / class CouponRequestHistory (identical property lists) */
const COUPON_PROPS = ['ROWNUMBER', 'CRID', 'Name', 'USERNAME', 'Mobile', 'COUPONNO', 'UsedFrom', 'USEDDATE', 'ACTIVE', 'CREATEDATE', 'LEVEL',
  'ISHOLD', 'TYPE', 'REMARK', 'regdate'];

/** public void ExportReport(string SearchField, string SearchValue) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Coupon_Request_History_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); void MaxRows;
  if (SearchValue === null || SearchValue === undefined) throw B.nullRef();
  const Obj = mapRows(await db.proc(DB, 'USP_COUPON_REQUESTHISTORY', {
    STARTROWINDEX: 1, MAXROWS: 999999999, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), FROMDATE: '', TODATE: '', PLID: '0',
    orderbydate: '', Status: '',
  }), COUPON_PROPS);
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Coupon_Request_History.xls', Filename,
      headers: ['S.No.', 'Name', 'UserName', 'MobileNo.', 'CouponNo.', 'UsedBy', 'UsedDate', 'Status'],
      rows: Obj, innerProc: 'Coupon_Request_History', outerProc: 'Usp_TransferFundToUser',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'ROWNUMBER')) + ' \t');
        w(B.tab(B.cellStr(item, 'Name').replace(/ /g, '')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME').replace(/ /g, '')) + ' \t');
        w(B.tab(B.cellStr(item, 'Mobile')) + ' \t');
        w(B.tab(B.cellStr(item, 'COUPONNO')) + ' \t');
        w(B.tab(B.cellStr(item, 'UsedFrom')) + ' \t');
        if (B.netFormat(item.USEDDATE, 'dd-MM-yyyy') === '01-01-1900') w(B.tab('') + ' \t');
        else w(B.tab(B.netFormat(item.USEDDATE, 'dd-MM-yyyy')) + ' \t');
        const active = Number(item.ACTIVE);
        if (active === 1) w(B.tab('Un-used') + ' \t');
        else w(B.tab('Used') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, int? Page, string btnexel, string FromDate, string ToDate, string SearchField, string SearchValue, int? ddlcustpage, string Status)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/voucher-block" -> Coupon_block/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/voucher-block'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  const btnexel = B.nStr(req.p.btnexel);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let Status = B.nStr(req.p.Status);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Plid = 0;
  if (FromDate === null) FromDate = '';
  if (Status === null) Status = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  const Empid = req.user.emp_id;
  const ViewBag = {};
  Object.assign(ViewBag, await B.perms(Empid, url));
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    ViewBag.PLID = Plid;
    const rows = await db.proc(DB, 'USP_COUPON_REQUESTBLOCKHISTORY', {
      STARTROWINDEX: Page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: SearchValue.trim(), FROMDATE: '', TODATE: '', PLID: '0',
      orderbydate, Status,
    });
    const Obj = mapRows(rows, COUPON_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT read from the result row column "totalcount" (no row => 0).
    const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
    ViewBag.CurrentPage = Page; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ToDate = ToDate;
    ViewBag.FromDate = FromDate;
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Coupon_block/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_Fund_History');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml', ErrorMessage: ViewBag.ErrorMessage });
  }
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, {}, B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- [SessionExpireCheck] JsonResult Voucher_Block(int id, int mode)
// auth ([SessionExpireCheck])
router.all(`/admin/${C}/Voucher_Block{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const id = B.reqInt(req.p.id, 'id');
  const mode = B.reqInt(req.p.mode, 'mode');
  const row = await db.procOne(DB, 'VOCHER_BLOCK_UNBLOCK', { ID: id, MODE: mode });
  const result = B.outStr(row, 'strresult');
  return res.json(result);
}));

module.exports = router;
