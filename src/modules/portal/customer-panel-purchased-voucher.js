// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Purchased_Voucher.cs (class PurchasedVoucherController => /portal/PurchasedVoucher/...)
// The MVC URL uses the class name (PurchasedVoucher), not the file name.
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, NRE, outInt, optInt, trimChar, view } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/PurchasedVoucher';
/** class PurchasedVoucherlist */
const PURCHASED_VOUCHER_LIST = ['rowNumber', 'OrderDateTime', 'OrderAmount', 'OrderQty', 'MOBILE', 'EMAILID', 'OrderId', 'DenoMination', 'Status',
  'USERNAME', 'TotalRoles', 'COM_Title', 'ProductName', 'ACTIVITYDATETIME', 'Email_Status', 'Sms_Status', 'VoucherNo', 'Voucherguid'];
const str = (v) => (v === undefined || v === '' ? null : v); // MVC string binding

// ---------------------------------------------------------------- Index(string SearchField, ..., int? page, string Orderid, int? ROWNUMBER)
// auth ([DistributerSessionExpireCheck] (no-op) + [SessionExpireCheck])
router.all([`${P}/Index{/:id}`, P], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let SearchField = str(req.p.SearchField); let SearchValue = str(req.p.SearchValue); let status = str(req.p.status);
  let fromDate = str(req.p.fromDate); let toDate = str(req.p.toDate); let Date_ = str(req.p.Date); let RoleMaster = str(req.p.RoleMaster);
  let page = optInt(req.p.page); let Orderid = str(req.p.Orderid); const ROWNUMBER = optInt(req.p.ROWNUMBER);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (Date_ == null) Date_ = '';
  if (RoleMaster == null) RoleMaster = ''; else RoleMaster = trimChar(RoleMaster, '^');
  if (status == null) status = '';
  if (toDate == null) toDate = '';
  if (Orderid == null) Orderid = ''; else Orderid = await UtilityClass.Decryptword(Orderid); // eslint-disable-line no-unused-vars

  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  const LoginId = req.user.loginid;
  if (LoginId === null || LoginId === undefined) throw NRE(); // LoginId.ToString()
  // PORT-NOTE: legacy passed ROWNUMBER.ToString() ("" for null) to the INT parameter @ID; SQL Server converted "" to 0.
  const rows = await db.proc(DB, 'sp_purchase_voucher', {
    StartRowIndex: page, MaxRows, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), status: status.trim(), Rolename: RoleMaster,
    FROMDATE: fromDate.trim(), TODATE: toDate.trim(), ID: ROWNUMBER === null ? 0 : ROWNUMBER, Date: String(Date_), LoginID: String(LoginId),
  });
  const AllVoucherlist = mapRows(rows, PURCHASED_VOUCHER_LIST);
  const TotalRecord = outInt(rows, 'totalcount');
  return view(res, '~/Views/CustomerPanel/Purchased_Voucher/Index.cshtml', AllVoucherlist, {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    OrderType: 'All Orders',
  });
}));

// ---------------------------------------------------------------- GETVOUCHERORDERCONFIERMATION(string OrderId) : ActionResult (Json)
// public (legacy: no session check)
router.all(`${P}/GETVOUCHERORDERCONFIERMATION{/:id}`, asyncHandler(async (req, res) => {
  const OrderId = str(req.p.OrderId);
  const MaxRows = await UtilityClass.GridPageSize();
  let RoleMaster = null;
  if (RoleMaster == null) RoleMaster = ''; else RoleMaster = trimChar(RoleMaster, '^');
  // "... @Rolename,@TotalCount,@OrderId": @TotalCount is passed positionally WITHOUT the OUT keyword, i.e. as NULL input
  const rows = await db.proc(DB, 'sp_voucher_order_confirmation', { StartRowIndex: 1, MaxRows, Rolename: RoleMaster, TotalCount: null, OrderId });
  const AllPurchasedVoucherlist = mapRows(rows, PURCHASED_VOUCHER_LIST);
  res.json(AllPurchasedVoucherlist);
}));

module.exports = router;
