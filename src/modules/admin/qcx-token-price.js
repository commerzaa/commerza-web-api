'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\QCXTokenPrice.cs (class QCXTokenPriceController => /admin/QCXTokenPrice/...)
// Database: affiliate (Db_Affiliate). Proc: USP_QLX_ETH_CAL_MASTER; table TBL_QLX_ETH_CAL_MASTER_History.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nStr, cvtDec, outStr, nullRef } = require('./_shared/batch12-common');
const { ethPriceUsd, hostIpAddress, omitNull } = require('./_shared/batch13-03-common');

const router = express.Router();
const C = 'QCXTokenPrice';
const VIEW = '~/Views/AdminPanel/QCXTokenPrice/Index.cshtml';

/** class QCXTokenPrice */
const QCX_PROPS = ['Row', 'TQLXMH', 'QLXTOKENPRICE', 'Emp_Name', 'ActivityReport', 'Status', 'QCX', 'ETHCURRENTRATEINUSD'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/QCX-TOKEN-PRICE" -> QCXTokenPrice/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/QCX-TOKEN-PRICE{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  try {
    let coinrate = [];
    // SqlQuery<decimal>("Select QCX From TBL_QLX_ETH_CAL_MASTER_History where Status=1").FirstOrDefault()
    const r = await db.query(DB, 'select qcx from tbl_qlx_eth_cal_master_history where status = 1 limit 1', {});
    if (r.length && (r[0].qcx === null || r[0].qcx === undefined)) throw new Error('The cast to value type \'System.Decimal\' failed because the materialized value is null.');
    ViewBag.COINRATE = r.length ? r[0].qcx : 0;
    // [USP_QLX_ETH_CAL_MASTER] 0,0,0,0,@Mode,0,''  (positional: the 6th literal 0 went to the OUT param @IntResult)
    coinrate = mapRows(await db.proc(DB, 'USP_QLX_ETH_CAL_MASTER', {
      ETHCURRENTRATEUSD: 0, QCX: 0, QCXRATE: 0, UserId: 0, Mode: '2', IPADDRESS: '',
    }), QCX_PROPS);
    const ETH_PRICE_USD = await ethPriceUsd();
    if (ETH_PRICE_USD !== 0) ViewBag.ETH_PRICE_USD = ETH_PRICE_USD;
    return res.json({ view: VIEW, Model: coinrate, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    return res.json({ view: VIEW, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- JsonResult UpdateATCRateAndWithdrawalSettings(string ATCRate, string ATCRates)
// auth (reads Session["Admin_User"].Emp_ID; legacy threw NullReferenceException without a session)
router.all(`/admin/${C}/UpdateATCRateAndWithdrawalSettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ATCRate = nStr(req.p.ATCRate);
  let ATCRates = nStr(req.p.ATCRates);
  if (ATCRates === null) throw nullRef();
  ATCRates = ATCRates.split('USD').join('');
  const ETH_PRICE_USD = await ethPriceUsd();
  // (QCXPRICE calculation is commented out in the legacy code)
  const IpAddress = hostIpAddress();
  const userid = req.user.emp_id;
  const QCXRATE = cvtDec(ATCRates); // Convert.ToDecimal(ATCRates) (evaluated before the proc call)
  // [USP_QLX_ETH_CAL_MASTER] @ETHCURRENTRATEUSD,@QCX,@QCXRATE,@UserId,@Mode,@IntResult OUT,@IPADDRESS
  const row = await db.procOne(DB, 'USP_QLX_ETH_CAL_MASTER', omitNull({
    ETHCURRENTRATEUSD: ETH_PRICE_USD, QCX: ATCRate, QCXRATE, UserId: userid, Mode: '1', IPADDRESS: IpAddress,
  })); // (a null ATCRate is not sent => proc default)
  const OutPutMessage = outStr(row, 'IntResult');
  return res.json(OutPutMessage);
}));

// ---------------------------------------------------------------- JsonResult RateCalculateQCRONBLUR(string currentvalue)
// public (legacy: no session check, no DB access; pure calculation on the public ETH price)
router.all(`/admin/${C}/RateCalculateQCRONBLUR{/:id}`, asyncHandler(async (req, res) => {
  const currentvalue = nStr(req.p.currentvalue);
  const ETH_PRICE_USD = await ethPriceUsd();
  let QCXPRICE = 0;
  if (ETH_PRICE_USD !== 0 && cvtDec(currentvalue) > 0) {
    QCXPRICE = ETH_PRICE_USD / cvtDec(currentvalue);
  }
  return res.json(QCXPRICE);
}));

module.exports = router;
