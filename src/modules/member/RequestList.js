'use strict';
// Ported from Member\Controllers\CustomerPanel\RequestList.cs (RequestListController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const guard = [auth, requireType('member')];
const P = '/member/RequestList';
const DB = 'affiliate';
const pick = (r, name) => { const k = Object.keys(r || {}).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };
const outv = (rows, name) => (rows && rows.length ? pick(rows[0], name) : undefined);
const PENDING = ['RowNumber', 'PLID', 'FRID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE', 'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Remark', 'ApprovalDate', 'District', 'Circle', 'Region', 'PYStatus', 'PDate', 'PaymentRequest', 'PaymentApprove', 'AgrementRequest', 'AgremntApproved', 'RequestStatus', 'PaymentStatus', 'AgreementStatus', 'Request_True', 'Payment_True', 'Agreement_True'];

// route-config: referral/cxy1VCGr5YOMslJB0cZseA==LPPL
// auth ([SessionExpireCheck])
router.all([`${P}/Index{/:id}`, '/member/referral/cxy1VCGr5YOMslJB0cZseA==LPPL'], ...guard, asyncHandler(async (req, res) => {
  let { fromDate, toDate } = req.p;
  let page = req.p.page === undefined || req.p.page === null || req.p.page === '' ? null : parseInt(req.p.page, 10);
  if (fromDate === undefined || fromDate === null) fromDate = '';
  if (toDate === undefined || toDate === null) toDate = '';
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    const MaxRows = 100;
    if (page === null) page = 1;
    const rows = await db.proc(DB, 'usp_franchisepending_bymember', { fromDate, toDate, MAXROWS: MaxRows, STARTROWINDEX: page, Plid });
    // PORT-NOTE: @TotalCount OUT read from the "totalcount" column of the first row (0 when absent/NULL, like DBNull)
    const tc = outv(rows, 'totalcount');
    const TotalRecord = tc === undefined || tc === null ? 0 : parseInt(tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    const prows = await db.proc(DB, 'usp_franchiserequest_bymember', { RegNo: Plid });
    const Pending = prows && prows.length ? mapRows([prows[0]], PENDING)[0] : null;
    if (Pending !== null) {
      ViewBag.PackageName = Pending.PackageName;
      ViewBag.ADDRESS = Pending.ADDRESS;
      ViewBag.STATE = Pending.STATE;
      ViewBag.PINCODE = Pending.PINCODE;
      ViewBag.CITY = Pending.CITY;
      ViewBag.District = Pending.District;
      ViewBag.STATUS = Pending.STATUS;
      ViewBag.PYStatus = Pending.PYStatus;
      ViewBag.Remark = Pending.Remark;
      ViewBag.DATE = Pending.DATE;
      ViewBag.Amount = Pending.MRP;
      ViewBag.FRID = Pending.FRID;
      ViewBag.Pending = Pending;
    } else {
      ViewBag.Pending = Pending;
    }
    return res.json({ Model: mapRows(rows, PENDING), ViewBag });
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_FranchisePending_BYMember', 0, req.path); } catch (_) { /* ignore */ }
    return res.json({ redirect: '/page-not-found', ViewBag: { ErrorMessage: ExpObj.message } });
  }
}));

// auth
router.all(`${P}/MEMEBERDETAILS{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const rows = await db.proc(DB, 'usp_memeberdetails', { Plid });
  res.json(mapRows(rows, PENDING));
}));

module.exports = router;
