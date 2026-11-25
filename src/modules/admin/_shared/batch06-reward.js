'use strict';
/**
 * Helpers private to admin port batch06: DirectReward.cs and DownlineReward.cs are identical except for names:
 *   procs USP_GETALLREWARD / USP_GETDOWNLINEREWARD, USP_SUBMITDIRECT_REWARD / USP_SUBMITDOWNLINE_REWARD, USP_GETSINGLEREWARDBYID @RBID /
 *   USP_GETSINGLEDOWNLINEREWARDBYID @DRBID, USP_UPDATEREWARDBYID @RBID / USP_UPDATEDOWNLINEREWARDBYID @DRBID, USP_DELETEREWARD_BYID @RBID /
 *   USP_DELETEDOWNLINEREWARD_BYID @DRBID; parameter names @NOOFDIRECT,@LEFTDIRECT,@RIGHTDIRECT / @NOOFDOWNLINE,@LEFTDOWNLINE,@RIGHTDOWNLINE;
 *   action parameter Rbid / Drbid (Update + Delete; GetRewardById keeps Rbid in both); model GetAllReward / GetDownlineReward.
 * Exports: buildRewardRouter(cfg), toDateTime(v)
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const { adminAuth, legacyUrl, errorInsert } = require('./admin-session');
const { nStr, reqInt, reqDec, col, str, cvtInt } = require('./batch06-common');

const DB = 'affiliate';

/** Convert.ToDateTime(string): null => DateTime.MinValue, unparsable => FormatException */
function toDateTime(v) {
  if (v === null || v === undefined) return '0001-01-01 00:00:00';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  return d;
}

/**
 * cfg: { C, friendlyUrl, view, procAll, procSubmit, procGetOne, procUpdate, procDelete, idParam ('RBID'|'DRBID'),
 *        actionIdParam ('Rbid'|'Drbid' for Update/Delete), countNames: ['NOOFDIRECT','LEFTDIRECT','RIGHTDIRECT'], rewardProps }
 */
function buildRewardRouter(cfg) {
  const router = express.Router();
  const { C } = cfg;
  const [N, L, R] = cfg.countNames;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests; `private string regno` is unused.
  const S = { url: '', url1: '' };

  const rewardParams = (p) => ({
    REWARDNAME: nStr(p.Rewadrname),
    [N]: reqInt(p.NoOfDirect, 'NoOfDirect'),
    [L]: reqInt(p.LeftDirect, 'LeftDirect'),
    [R]: reqInt(p.RightDirct, 'RightDirct'),
    TOTALBUSINESS: reqDec(p.TotalBusines, 'TotalBusines'),
    LEFTBUSSINECT: reqDec(p.LeftBusiness, 'LeftBusiness'),
    RIGHTBUSSINESS: reqDec(p.RightBussiness, 'RightBussiness'),
    REWARDAMOUNT: reqDec(p.RewardAmt, 'RewardAmt'),
    ADMINCHARGEPER: reqDec(p.AdminCharge, 'AdminCharge'),
    TDSCHARGEPER: reqDec(p.TDSCharge, 'TDSCharge'),
    WALLETTYPE: reqInt(p.WalletType, 'WalletType'),
    WALLETNAME: nStr(p.WalletName),
    WITHINDAYS: reqInt(p.WithinDays, 'WithinDays'),
    ACTIVE: reqInt(p.Active, 'Active'),
  });
  /** Convert.ToInt32(spOutput.Value.ToString()) (DBNull => "" => FormatException) */
  const intResult = (row) => {
    const v = str(col(row, 'INTRESULT'));
    if (v === '') throw new Error('Input string was not in a correct format.');
    return cvtInt(v);
  };

  // ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string datetype, string orderbydate, string SearchField,
  //   string SearchValue, string VarifiedPanStatus, string fromDate, string toDate, string ddlStatus, string ddlchange, int? ddltype, int? page,
  //   string btnexel, string downlinesearch, int? Side, string activationdate)   (all parameters unused)
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
  // route-config: cfg.friendlyUrl -> <C>/Index
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, `/admin/${cfg.friendlyUrl}`], adminAuth, asyncHandler(async (req, res) => {
    S.url1 = legacyUrl(req).slice(1);
    S.url = '~' + S.url1;
    const Employeeid = req.user.emp_id;
    const ViewBag = {};
    // USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out
    const prow = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: S.url });
    const e = str(col(prow, 'EXCELSTATUS'));
    const i = str(col(prow, 'ISEDIT'));
    ViewBag.isactive = cvtInt(e === '' ? '0' : e);
    ViewBag.isedit = cvtInt(i === '' ? '0' : i);
    const WalletyType = mapRows(await db.proc(DB, 'USP_GETWALLETTYPE', {}), ['TWTID', 'WALLETTYPE']);
    const GetAllReward = mapRows(await db.proc(DB, cfg.procAll, {}), cfg.rewardProps);
    ViewBag.AllReward = GetAllReward;
    res.json({ view: `~/Views/AdminPanel/${cfg.view}/Index.cshtml`, Model: WalletyType, ...ViewBag });
  }));

  // ---------------------------------------------------------------- JsonResult AddDirectReward(string Rewadrname, int NoOfDirect, int LeftDirect, int RightDirct,
  //   decimal TotalBusines, decimal LeftBusiness, decimal RightBussiness, decimal RewardAmt, decimal AdminCharge, decimal TDSCharge, int WalletType,
  //   string WalletName, int WithinDays, int Active, string FromDate, string Todate)
  // auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
  router.all(`/admin/${C}/AddDirectReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const params = rewardParams(req.p); // model binding happens before the action body (500 on missing value types)
    let Result = 0;
    try {
      const row = await db.procOne(DB, cfg.procSubmit, {
        ...params, FROMDATE: toDateTime(nStr(req.p.FromDate)), TODATE: toDateTime(nStr(req.p.Todate)),
      });
      Result = intResult(row);
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, cfg.procSubmitErrName);
    }
    return res.json(Result);
  }));

  // ---------------------------------------------------------------- JsonResult GetRewardById(int Rbid)
  // auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
  router.all(`/admin/${C}/GetRewardById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const Rbid = reqInt(req.p.Rbid, 'Rbid');
    const list = mapRows(await db.proc(DB, cfg.procGetOne, { [cfg.idParam]: Rbid }), cfg.rewardProps);
    res.json(list);
  }));

  // ---------------------------------------------------------------- JsonResult UpdateDirectReward(int <Rbid|Drbid>, string Rewadrname, ... string FromDate, string ToDate)
  // auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
  router.all(`/admin/${C}/UpdateDirectReward{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const id = reqInt(req.p[cfg.actionIdParam], cfg.actionIdParam);
    const params = rewardParams(req.p);
    // no try/catch in legacy => errors are unhandled (500). Note the legacy parameter name @TODAE.
    const row = await db.procOne(DB, cfg.procUpdate, {
      [cfg.idParam]: id, ...params, FROMDATE: toDateTime(nStr(req.p.FromDate)), TODAE: toDateTime(nStr(req.p.ToDate)),
    });
    const Result = intResult(row);
    return res.json(Result);
  }));

  // ---------------------------------------------------------------- JsonResult DeleteRewardById(int <Rbid|Drbid>)
  // auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
  router.all(`/admin/${C}/DeleteRewardById{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const id = reqInt(req.p[cfg.actionIdParam], cfg.actionIdParam);
    await db.procOne(DB, cfg.procDelete, { [cfg.idParam]: id });
    return res.json('');
  }));

  return router;
}

module.exports = { buildRewardRouter, toDateTime };
