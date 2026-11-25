'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/LoginHistory.cs (LoginHistoryController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: LoginHistory -> referral/99iRNiQW1t15cd8CtBtuA67aFNhG6yqLRty (route default Type = 2)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const C = 'LoginHistory';

const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
const P_2FA = ['ROWNUMBER', 'TSTID', 'SECURITYTYPE', 'ACTIVE'];
const P_LOG = ['ROWNUMBER', 'EMP_NAME', 'EMAIL', 'IPADDRESS', 'ISSUCCESS', 'LOGINDATETIME', 'MOBILE', 'OTP', 'PASSWORDATTEMPT'];

// ---- Index ------------------------------------------------------------------------------------------------------
// auth (SessionExpireCheck)
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/99iRNiQW1t15cd8CtBtuA67aFNhG6yqLRty'], auth, asyncHandler(async (req, res) => {
  const { loginhistory } = req.p;
  let { fromDate, toDate, CrDrType, TrType } = req.p;
  let page = optInt(req.p.page);
  let ddlcustpage = optInt(req.p.ddlcustpage);
  const ViewBag = {};
  if (loginhistory !== undefined && loginhistory !== null) ViewBag.loginhistory = 'active';
  if (ddlcustpage === null) ddlcustpage = 100;
  fromDate = nz(fromDate); toDate = nz(toDate); CrDrType = nz(CrDrType);
  if (TrType === undefined || TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  try {
    ViewBag.TwoFADetails = mapRows(await proc(DB, 'usp_get2fasecurity', {}), P_2FA);
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const UserName = req.user.username;
    // PORT-NOTE: @TOTALCOUNT OUT is the "totalcount" column of the first result row (0 when empty)
    const raw = await proc(DB, 'usp_memberloginlog_details', { startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, searchfiel: 'UserName', searchvalue: UserName });
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = totalOf(raw);
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = '';
    ViewBag.SearchValue = '';
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.ddlcustpage = ddlcustpage;
    return res.json({ Model: mapRows(raw, P_LOG), ViewBag });
  } catch (ex) {
    return res.json({ view: '~/Views/PageNotFound/Index.cshtml' });
  }
}));

module.exports = router;
