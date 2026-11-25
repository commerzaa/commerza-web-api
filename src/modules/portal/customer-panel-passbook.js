'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/PassbookController.cs
// (class PassbookController => /portal/Passbook/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CutomerWalletProcess = require('../../lib/portal/CustomerWalletProcess');
const ps = require('./_shared/portal-session');
const { DB, view, outVal, outTotal, str, nInt, masterpageshow, toInt32 } = require('./_shared/batch-06-common');

const router = express.Router();

/** class TBL_CUSTOMERWALLET_STATEMENTS_LIST */
const STATEMENTS_LIST_PROPS = ['ROWNUMBER', 'CLID', 'PROCESSDATE', 'CRDRTYPE', 'CRAMT', 'DRAMT', 'OLD_BALANCE', 'BALANCE', 'REMARKS', 'TRACENO',
  'STATUS', 'TCWSID'];

// ---------------------------------------------------------------- Index(int? page)
// public route with optional session ([DistributerSessionExpireCheck] is a no-op; Session["Plid"] == null => Redirect("/"))
// route-config: "customer/passbook" -> Passbook/Index
router.all(['/portal/Passbook/Index{/:id}', '/portal/Passbook', '/portal/customer/passbook{/:id}'], ps.portalSession,
  asyncHandler(async (req, res) => {
    const ViewBag = { masterpageshow: masterpageshow(req) };
    if (!ps.isCustomer(req)) {
      return res.json({ redirect: '/' });
    }
    let page = nInt(req.p.page);
    if (page === null) page = 1;
    const Plid = Number(req.user.plid);
    const MaxRows = await UtilityClass.GridPageSize();
    let customerWallet_Statements = [];
    if (Plid !== 0) {
      ViewBag.UserWallet = await CutomerWalletProcess.GetUserWalletBalance(toInt32(Plid));
      const rows = await db.proc(DB, 'usp_getcustomerwallet_statements', { CLID: Plid, STARTROWINDEX: page, MAXROWS: MaxRows });
      customerWallet_Statements = mapRows(rows, STATEMENTS_LIST_PROPS);
      const TotalRecord = outTotal(rows, 'totalcount');
      ViewBag.CurrentPage = page;
      ViewBag.GridPageSize = MaxRows;
      ViewBag.TotalRecord = TotalRecord;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    }
    return view(res, '~/Views/CustomerPanel/Passbook/Index.cshtml', customerWallet_Statements, ViewBag);
  }));

// ---------------------------------------------------------------- GenerateClamied(string Remarks, string Transactionid) : JsonResult
// auth (unguarded (Login)Session["Plid"] cast)
router.all('/portal/Passbook/GenerateClamied{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const Clid = Number(req.user.plid);
  const row = await db.procOne(DB, 'usp_create_customer_recharge_claims', {
    MODE: 1, CLID: Clid, TRANSACTIONID: req.p.Transactionid === undefined ? null : req.p.Transactionid,
    REMARKS: req.p.Remarks === undefined ? null : req.p.Remarks,
  });
  const Result = str(outVal(row, 'strresult'));
  res.json(Result);
}));

module.exports = router;
