'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MLMwalletstatement.cs
// (class MLMwalletstatementController => /portal/MLMwalletstatement/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, view, outTotal, nInt, nStr, masterpageshow } = require('./_shared/batch-06-common');

const router = express.Router();

/** class MLMwalletstatement */
const MLMWALLETSTATEMENT_PROPS = ['ROW_NUMBER', 'ROWNUMBER', 'AMOUNT', 'Balance', 'DATE', 'PAYMODE', 'BANKNAME', 'IFsC_Code', 'MEM_REMARK', 'Status',
  'TransactionID', 'ReferenceID', 'Type'];

// ---------------------------------------------------------------- Index(string TransID, string fromDate, string toDate, int? page, string Type)
// auth ([DistributerSessionExpireCheck] is a no-op, but the action casts (Login)Session["Plid"] without a null check)
// route-config: "customer/MLM-Statement" -> MLMwalletstatement/Index
router.all(['/portal/MLMwalletstatement/Index{/:id}', '/portal/MLMwalletstatement', '/portal/customer/MLM-Statement'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const ViewBag = { masterpageshow: masterpageshow(req) };
    const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
    const TransID = d('TransID');
    const fromDate = d('fromDate');
    const toDate = d('toDate');
    const Type = d('Type');
    const Plid = Number(req.user.plid);
    const MaxRows = await UtilityClass.GridPageSize();
    let page = nInt(req.p.page);
    if (page === null) page = 1;
    // db.Database.CommandTimeout = 1000
    const rows = await db.proc(DB, 'usp_customermlmwalletstatement', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, TransactionID: TransID, CLID: String(Plid), Type,
    });
    const walletstatement = mapRows(rows, MLMWALLETSTATEMENT_PROPS);
    const TotalRecord = outTotal(rows, 'totalcount');
    Object.assign(ViewBag, {
      QUALIFICATIONlis: '',
      CurrentPage: page,
      MOBILE: '',
      GridPageSize: MaxRows,
      TotalRecord,
      NoPerPage: await UtilityClass.GridNumbersPerPage(),
      SearchField: '',
      SearchValue: '',
      fromDate,
      toDate,
      QUALIFICATION: '',
      userid: '',
      ORDERBY: '',
      Isdownload: '',
    });
    view(res, '~/Views/CustomerPanel/MLMwalletstatement/CustomerAllTicket.cshtml', walletstatement, ViewBag);
  }));

module.exports = router;
