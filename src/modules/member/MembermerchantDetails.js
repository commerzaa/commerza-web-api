'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\MembermerchantDetails.cs (MembermerchantDetailsController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/MembermerchantDetails';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };
const P_MM = ['RowNumber', 'DATE', 'REMARKS', 'AMOUNT', 'MerchantName', 'MerchantLoginid', 'MerchantEmailid'];

// route-config: referral/self-merchant-details
// auth
router.all([`${P}/Index{/:id}`, '/member/referral/self-merchant-details'], auth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let page = intOrNull(req.p.page);
  let ddlcustpage = intOrNull(req.p.ddlcustpage);
  let { SearchField, SearchValue, RoleMaster, fromDate, toDate } = req.p;
  // Session Login.MOBILE (JWT field 'mobile', fallback member_master)
  let mobile = req.user.mobile;
  if (mobile === undefined) {
    const mm = await queryOne(DB, 'select mobile from member_master where regno = @p limit 1', { p: Number(req.user.plid) });
    mobile = mm ? mm.mobile : null;
  }
  ViewBag.mobile = mobile;
  if (ddlcustpage === null) ddlcustpage = 100;
  if (SearchField === undefined || SearchField === null) SearchField = '';
  if (SearchValue === undefined || SearchValue === null) SearchValue = '';
  if (RoleMaster === undefined || RoleMaster === null) RoleMaster = '';
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  const MaxRows = UtilityClass.GridPageSize();
  if (page === null) page = 1;
  let AllFreeEpinList = [];
  try {
    const Plid = Number(req.user.plid);
    const rows = await proc(DB, 'usp_merchanttranfer_details', {
      regno: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(),
      rolename: RoleMaster.trim(), fromdate: fromDate.trim(), todate: toDate.trim(),
    });
    AllFreeEpinList = mapRows(rows, P_MM);
    const tc = outCol(rows, 'totalcount');
    if (tc === null) throw new Error('Input string was not in a correct format.'); // int.Parse(spOutput.Value.ToString())
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = parseInt(tc, 10);
    ViewBag.NoPerPage = UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
  } catch (ExpObj) {
    await ErrorInsert(ExpObj, 'insert_email_newsletter', req);
  }
  res.json({ Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
