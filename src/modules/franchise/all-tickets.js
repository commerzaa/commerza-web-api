'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/AllTickets.cs (AllTicketsController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';

const TICKET_PROPS = ['NUMBER', 'TMID', 'TICKETNO', 'CREATEDATE', 'CATEGORYNAME', 'LASTUPDATEDATE', 'SUBJECT', 'STATUS'];

// CONVERT(VARCHAR(11),DATE,106) / CONVERT(VARCHAR(20),LASTUPDATE,106)  => "dd Mon yyyy"
async function allTickets(did) {
  const rows = await query(DB, `SELECT ROW_NUMBER() OVER (ORDER BY lastupdate DESC) AS number,
      tmid, ticketno, to_char(tm."date", 'DD Mon YYYY') AS createdate, categoryname, to_char(lastupdate, 'DD Mon YYYY') AS lastupdatedate,
      subject, sm.name AS status FROM tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm
      ON sm.id = tm.status WHERE fromplid = @did AND accounttype = 3`, { did });
  return mapRows(rows, TICKET_PROPS);
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/all-tickets
// auth
router.all(['/franchise/AllTickets/Index{/:id}', '/franchise/franchisee/all-tickets'], auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.did);
  return res.json({ view: '~/Views/AllTickets/Index.cshtml', Model });
}));

// ---- RefferalIndex -------------------------------------------------------------------------------------
// auth (legacy cast Session["Plid"] without a null check)
router.all('/franchise/AllTickets/RefferalIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.did);
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/ReferralAllTicket.cshtml', Model });
}));

// ---- CustomerIndex -------------------------------------------------------------------------------------
// auth (legacy cast Session["Plid"] without a null check)
router.all('/franchise/AllTickets/CustomerIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.did);
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/CustomerAllTicket.cshtml', Model });
}));

module.exports = router;
