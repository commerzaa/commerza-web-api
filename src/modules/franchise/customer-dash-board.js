'use strict';
// Ported from Franchise\Controllers\CustomerPanel\CustomerDashBoard.cs  (database: shopping — Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();
const P = '/franchise/CustomerDashBoard';

const M1 = ['TOTALCREDITED', 'TOTALWITHDRAWAL', 'WALLETBALANCE'];
const M2 = ['STATUS', 'NOOFORDERS'];
const M3 = ['STATENAME', 'SID', 'NOofOrder', 'GeoLocationDetails', 'SCODE'];
const M4 = ['SERVICENAME', 'PACKAGENAME', 'REMAINDAYS'];
const M5 = ['SERVICESNAME', 'TOTALCOMMISSIONRECEIVED'];
const M6 = ['SERVICESNAME', 'TOTALUSED'];
const M7 = ['CATEGORYNAME', 'SUBJECT', 'TICKETNO', 'MESSAGE', 'STATUSNAME', 'IMAGENAME', 'PHONE', 'EMAILID', 'CLID', 'TMID'];
const M8 = ['CREDIT_WALLET', 'USED_WALLET', 'AVAILABLE_WALLET'];
const M9 = ['NEXTPAYOUTDATE'];
const M10 = ['TRANSFERTOBANK', 'AVAILABLEBALANCE'];

function bindDashboard(PLID, mode) {
  return db.proc('shopping', 'usp_binddashboard', { DID: PLID, MODE: String(mode), TICKETSTATUS: '0' });
}

async function Index(req, res) {
  // Session["FavoriteURL"] -> Response.Redirect(...)
  const fav = sessionStore.get(req, 'FavoriteURL');
  if (fav != null) return res.json({ redirect: String(fav) });

  const PLID = parseInt(req.user.did, 10);
  const PMID = parseInt(req.user.pmid, 10); // read but unused in legacy

  const r1 = await bindDashboard(PLID, 1);
  const r2 = await bindDashboard(PLID, 2);
  const r3 = await bindDashboard(PLID, 3);
  const r4 = await bindDashboard(PLID, 4);
  const r5 = await bindDashboard(PLID, 5);
  const r6 = await bindDashboard(PLID, 6);
  const r7 = await bindDashboard(PLID, 7);
  const r8 = await bindDashboard(PLID, 8);
  const r9 = await bindDashboard(PLID, 9);
  const r10 = await bindDashboard(PLID, 10);

  // Model = DASHBOARDMASTER
  res.json({
    Model: {
      objDAHBOARDMODE1: mapRow(r1[0] || null, M1),
      liDAHBOARDMODE2: mapRows(r2, M2),
      liDAHBOARDMODE3: mapRows(r3, M3),
      liDAHBOARDMODE4: mapRows(r4, M4),
      liDAHBOARDMODE5: mapRows(r5, M5),
      liDAHBOARDMODE6: mapRows(r6, M6),
      liDAHBOARDMODE7: mapRows(r7, M7),
      objDAHBOARDMODE8: mapRow(r8[0] || null, M8),
      objDAHBOARDMODE9: mapRow(r9[0] || null, M9),
      objDAHBOARDMODE10: mapRow(r10[0] || null, M10),
    },
  });
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(Index));
// route-config: franchisee/dashBoard
router.all('/franchise/franchisee/dashBoard', auth, asyncHandler(Index));

// auth
router.all(P + '/GetStateData{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const PLID = parseInt(req.user.did, 10);
    const rows = await bindDashboard(PLID, 3);
    return res.json(mapRows(rows, M3));
  } catch (ex) {
    return res.json({}); // Json(JsonRequestBehavior.AllowGet) => null data
  }
}));

// auth
router.all(P + '/DAILYSALESGRAPH{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const rows = await db.proc('shopping', 'usp_dailysalesgraph', { DID: parseInt(req.user.did, 10) });
    return res.json(mapRows(rows, ['Sales', 'Date', 'COLOR']));
  } catch (ex) {
    return res.json({});
  }
}));

// auth
router.all(P + '/DAILYCOMISSIONGRAPH{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const rows = await db.proc('shopping', 'usp_dailycomisisongraph', { DID: parseInt(req.user.did, 10) });
    return res.json(mapRows(rows, ['COMMISSION', 'DATE'])); // ViewBag.VISITORGRAPH is the same list
  } catch (ex) {
    return res.json({});
  }
}));

module.exports = router;
