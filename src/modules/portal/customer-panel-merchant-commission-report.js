// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/MerchantCommissionReport.cs (class MerchantCommissionReportController; DB: Db_Shopping)
// Proc: Usp_GetCommissionReport (@Mode,@PLID,@RECORDCOUNT OUT,@INTRESULT OUT,@STARTROWINDEX,@MAXROWS)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const UtilityClass = require('../../lib/portal/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/MerchantCommissionReport';
// class CommissionReport
const COMMISSION_REPORT = ['ROWNUMBER', 'CATNAME', 'SUBCATNAME', 'ADMINCHARGE', 'DELIEVERYCHARGE', 'HANDLINGCHARGE'];

// auth ([SessionExpireCheck])
// route-config: merchant/commission-chart -> MerchantCommissionReport/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/commission-chart'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  let ObjCommissionReport = [];
  let page = c.bindNullableInt(req, 'page');
  if (page === null) page = 1;
  const MaxRows = c.toInt32(50);
  const rows = await db.proc(DB, 'usp_getcommissionreport', { mode: '1', plid: Plid, startrowindex: page, maxrows: MaxRows });
  ObjCommissionReport = mapRows(rows, COMMISSION_REPORT);
  // PORT-NOTE: @RECORDCOUNT OUT is read from the "recordcount" column of the first row. Legacy Convert.ToInt32(DBNull.ToString())
  // threw a FormatException when the OUT value was NULL; with no rows the value is taken as 0.
  let TotalRecord = 0;
  if (rows.length) {
    const k = Object.keys(rows[0]).find((x) => x.toLowerCase() === 'recordcount');
    TotalRecord = c.toInt32(k === undefined ? null : rows[0][k]);
  }
  const ViewBag = { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() };
  const pageNumber = page; void pageNumber;
  const Noofpage = await UtilityClass.GridNumbersPerPage(); void Noofpage;
  return c.viewJson(res, '~/Views/CustomerPanel/MerchantCommissionReport/Index.cshtml', ObjCommissionReport, ViewBag);
}));

module.exports = router;
