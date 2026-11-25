'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Merchant_Transfer_Distribute.cs (class Merchant_Transfer_DistributeController => /Merchant_Transfer_Distribute/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { DB, nInt, nStr, outIntOf } = require('./_shared/batch10_common');

const router = express.Router();
const C = 'Merchant_Transfer_Distribute';

/** class Merchant_Transfer_Distribute */
const PROPS = ['ROWNUMBER', 'TOTALPOINT', 'INCOME', 'CPOINT', 'GERNATION', 'PURCHASE', 'REPURCHASE', 'ADMIN', 'DATE', 'MID', 'MERCHANTNAME',
  'ADDRESS', 'MERCHANTMOBILE', 'USERNAME', 'NAME', 'MOBILE', 'EMAILID'];

// ---------------------------------------------------------------- Index(int? page, string SearchField, string searchvalue, string fromDate, string toDate,
//   string wfromDate, string wtoDate, string RequestType, string username, int? ddlcustpage)
// auth (legacy had no session check, but it is an admin report => adminAuth)
// route-config: "AdminPanel/merchant-transfer-distribute" -> Merchant_Transfer_Distribute/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/merchant-transfer-distribute'], adminAuth, asyncHandler(async (req, res) => {
  let ddlcustpage = nInt(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 100;
  let fromDate = nStr(req.p.fromDate); if (fromDate === null) fromDate = '';
  let searchvalue = nStr(req.p.searchvalue); if (searchvalue === null) searchvalue = '';
  let SearchField = nStr(req.p.SearchField); if (SearchField === null) SearchField = '';
  let toDate = nStr(req.p.toDate); if (toDate === null) toDate = '';
  let RequestType = nStr(req.p.RequestType); if (RequestType === null) RequestType = '';
  let username = nStr(req.p.username); if (username === null) username = ''; // (unused afterwards, like legacy)
  let page = nInt(req.p.page);
  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    // SP_userMERTANT_CPPOINTDISTRIBUTE @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,@TODATE,@TOTALCOUNT OUT
    const rows = await db.proc(DB, 'SP_userMERTANT_CPPOINTDISTRIBUTE', {
      REGNO: 0, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField.trim(), SEARCHVALUE: searchvalue.trim(),
      FROMDATE: fromDate.trim(), TODATE: toDate.trim(),
    });
    const liGDWithdrawalRequest = mapRows(rows, PROPS);
    const ViewBag = { fromDate, toDate, searchvalue, RequestType };
    ViewBag.TotalRecord = outIntOf(rows, 'totalcount');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.ddlcustpage = ddlcustpage;
    return res.json({ view: '~/Views/AdminPanel/Merchant_Transfer_Distribute/Index.cshtml', Model: liGDWithdrawalRequest, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    // Response.Redirect("/page-not-found") (then the empty View, never rendered)
    return res.json({ redirect: '/page-not-found' });
  }
}));

module.exports = router;
