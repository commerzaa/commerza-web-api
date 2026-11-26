'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Earnings.cs (EarningsController)
const express = require('express');
const ps = require('./_shared/portal-session');
const asyncHandler = require('../../middleware/asyncHandler');
const { earningHistory } = require('./_shared/batch-04-common');

const router = express.Router();

// auth (legacy: Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: referral/earnings -> Earnings/Index
router.all(['/portal/Earnings/Index{/:id}', '/portal/Earnings', '/portal/referral/earnings{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => {
  // [usp_member_Earning_history] paged history (Member_Master lookup of LOGINID kept, value unused)
  const { Model, ViewBag } = await earningHistory(req);
  res.json({ view: '~/Views/CustomerPanel/Earnings/Index.cshtml', Model, ...ViewBag });
}));

const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const { DB, NRE, mvcStr, toInt32 } = require('./_shared/batch-04-common');

// auth (PORT-NOTE: legacy had NO session check here; it updates a member's DIRECT_INCOME row => protected)
router.all('/portal/Earnings/BtnSubmitRequest{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const DIID = mvcStr(req.p.DIID);
  // "Update DIRECT_INCOME Set IsRequestedForWithDrawal=1,RequestedDate=GETDATE() Where DIID=" + DIID  (parameterised)
  // PORT-NOTE: a non-numeric/missing DIID made the concatenated T-SQL fail (SqlException => HTTP 500); reproduced with an error.
  if (DIID === null || !/^\s*[+-]?\d+\s*$/.test(DIID)) {
    const e = new Error(DIID === null ? "Incorrect syntax near '='." : `Invalid column name '${DIID}'.`);
    e.status = 500;
    throw e;
  }
  const Ret = await db.exec(DB, 'update direct_income set isrequestedforwithdrawal = 1, requesteddate = now() where diid = @diid', { diid: parseInt(DIID, 10) });
  res.json(Ret);
}));

const GetEarningDetails = ['ROWNUMBER', 'EarnedDate', 'MatchingBv', 'EarnedPoints', 'FromUserName', 'IncomeType', 'Payid'];

// auth (legacy cast (Login)Session["Plid"] without a null check)
router.all('/portal/Earnings/GetEarning{/:id}', ps.customerAuth, asyncHandler(async (req, res) => {
  const Earninigdate = mvcStr(req.p.Earninigdate);
  const Mode = mvcStr(req.p.Mode);
  const member_plid = Number(req.user.plid);
  const ddlcustpages = 100;
  const Rows = toInt32(ddlcustpages);
  if (Earninigdate === null) throw NRE(); // Earninigdate.Trim()
  const rows = await db.proc(DB, 'usp_member_earning_history', {
    plid: toInt32(member_plid),
    startrowindex: toInt32('1'),
    maxrows: Rows,
    searchfield: '',
    searchvalue: '',
    fromdate: Earninigdate.trim(),
    todate: '',
    mode: toInt32(Mode),
  });
  res.json(mapRows(rows, GetEarningDetails));
}));

module.exports = router;
