'use strict';
/**
 * Port of Merchant Panel Controllers/CustomerPanel/CP_RequestListController.cs (CP_RequestListController) - 4 actions
 * Actions: Index, RequestApprove, RejectApprove, UpdateStatus
 * DB: Db_Shopping => 'shopping'. PORT-NOTE: RequestApprove / RejectApprove / UpdateStatus use the cross-database name
 * [db_affiliate].[dbo].* in the legacy SQL (TBL_REPURCHASEDETAILS_TEMP_, InsertRepurchaseRejectDetails), so those statements run on 'affiliate'.
 */
const express = require('express');
const config = require('../../config');
const { queryOne, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const DB_AFF = 'affiliate'; // [db_affiliate]
const C = 'CP_RequestList';
const PROPS = ['ROWNUMBER', 'RDID', 'MEMBERNAME', 'ORDERNUMBER', 'USERNAME', 'CPOINT_AMOUNT', 'REMARK', 'PLID', 'REQUEST_DATE', 'STATUS', 'BILL_AMOUNT', 'BILL_IMAGE'];
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: merchant/getcp-Requestlist
// auth (legacy had no [SessionExpireCheck] but reads Session["Plid"])
router.all([`/merchant/${C}/Index{/:id}`, `/merchant/${C}`, '/merchant/getcp-Requestlist', '/merchant/merchant/getcp-Requestlist'], auth, asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, MerchantName, btnexel, Status } = req.p;
  let page = req.p.page;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (MerchantName == null) MerchantName = '';
  if (Status == null) Status = '0';
  if (Status === 'Pending') Status = '0';
  if (Status === 'Released') Status = '1';
  if (Status === 'Reject') Status = '2';
  const PLID = parseInt(req.user.plid, 10);
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc(DB, 'usp_member_cprequest_to_marchent', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, fromdate: fromDate, todate: toDate, status: Status, plid: PLID,
  });
  const CPrequest = mapRows(rows, PROPS);
  const basePath = String(config.app.cashbackDest || '');
  for (const x of CPrequest) x.BILL_IMAGE = x.BILL_IMAGE ? basePath + x.BILL_IMAGE : '';
  // PORT-NOTE: @TotalCount OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = rows.length ? Number(rows[0].totalcount || 0) : 0;
  const lsit = CPrequest.filter((x) => Number(x.PLID) === PLID);
  res.json({
    view: '~/Views/CP_RequestList/Index.cshtml',
    Model: lsit,
    ViewBag: {
      CurrentPage: page, GridPageSize: MaxRows, SearchField, SearchValue, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    },
  });
}));

// ---- RequestApprove ------------------------------------------------------------------------------------
// auth (legacy: no session check)
router.all(`/merchant/${C}/RequestApprove{/:id}`, auth, asyncHandler(async (req, res) => {
  const rdid = req.p.rdid;
  const data = [];
  const _obj = await queryOne(DB_AFF,
    'SELECT merchantid as plid, bv as cpoint_amount, username as username, remark as remark, orderno as ordernumber FROM tbl_repurchasedetails_temp_ WHERE rdid = @rdid LIMIT 1',
    { rdid });
  if (_obj !== null) {
    data.push({ status: 'true', plid: _obj.plid, Username: _obj.username, amount: _obj.cpoint_amount, remark: _obj.remark, orderid: _obj.ordernumber });
  } else {
    // legacy: accesses _obj.PLID on a null object => NullReferenceException (500)
    throw NRE();
  }
  res.json(data);
}));

// ---- RejectApprove -------------------------------------------------------------------------------------
// auth (legacy: no session check)
router.all(`/merchant/${C}/RejectApprove{/:id}`, auth, asyncHandler(async (req, res) => {
  const { rdid, Reason } = req.p;
  const row = await procOne(DB_AFF, 'insertrepurchaserejectdetails', { rdid, reason: Reason, flag: 1 });
  // PORT-NOTE: @ResultMessage OUT read from the "resultmessage" column of the result row
  if (!row || row.resultmessage === null || row.resultmessage === undefined) throw NRE();
  res.json(String(row.resultmessage));
}));

// ---- UpdateStatus --------------------------------------------------------------------------------------
// auth (legacy: no session check)
router.all(`/merchant/${C}/UpdateStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const i = await exec(DB_AFF, 'UPDATE tbl_repurchasedetails_temp_ SET isprocess = 1, relasedate = now() WHERE rdid = @rdid', { rdid: req.p.rdid });
  res.json(i >= 1 ? 'Approved' : 'Reject');
}));

module.exports = router;
