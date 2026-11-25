'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/AllTickets.cs (AllTicketsController, 3 actions). DB: 'shopping' */
const express = require('express');
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const router = express.Router();
const DB = 'shopping';
const TICKET_PROPS = ['NUMBER', 'TMID', 'TICKETNO', 'CREATEDATE', 'CATEGORYNAME', 'LASTUPDATEDATE', 'SUBJECT', 'STATUS', 'fromregno'];

// CONVERT(VARCHAR(11),DATE,106) / CONVERT(VARCHAR(20),LASTUPDATE,106) => "dd Mon yyyy"
async function allTickets(plid, withFromRegNo) {
  const rows = await query(DB, `SELECT ROW_NUMBER() OVER (ORDER BY lastupdate DESC) AS number,
      tmid, ticketno, to_char(tm."date", 'DD Mon YYYY') AS createdate, categoryname, to_char(lastupdate, 'DD Mon YYYY') AS lastupdatedate,
      subject, sm.name AS status${withFromRegNo ? ', coalesce(fromregno,0) AS fromregno' : ''} FROM tbl_ticketmaster tm INNER JOIN tbl_statusmaster sm
      ON sm.id = tm.status WHERE fromplid = @plid AND accounttype = 1`, { plid });
  return mapRows(rows, TICKET_PROPS);
}

// route-config: merchant/ZclNP0XpNfjuC_plus_mwQ2bBXw== -> Index
// auth
router.all(['/merchant/AllTickets/Index{/:id}', '/merchant/ZclNP0XpNfjuC_plus_mwQ2bBXw=='], auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.plid, true);
  res.json({ view: '~/Views/AllTickets/Index.cshtml', Model });
}));

// auth (legacy cast Session["Plid"] without a null check)
router.all('/merchant/AllTickets/RefferalIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.plid, false);
  res.json({ view: '~/Views/CustomerPanel/AllTickets/ReferralAllTicket.cshtml', Model });
}));

// auth (legacy cast Session["Plid"] without a null check)
router.all('/merchant/AllTickets/CustomerIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const Model = await allTickets(req.user.plid, false);
  res.json({ view: '~/Views/CustomerPanel/AllTickets/CustomerAllTicket.cshtml', Model });
}));

module.exports = router;
