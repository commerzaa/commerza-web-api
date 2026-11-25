'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/AllTickets.cs (AllTicketsController, 4 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, mvcIntN, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'AllTickets';

/** class AllTicketList */
const TICKET_PROPS = ['NUMBER', 'TMID', 'TICKETNO', 'CREATEDATE', 'CATEGORYNAME', 'LASTUPDATEDATE', 'SUBJECT', 'STATUS'];

// CONVERT(VARCHAR(11),DATE,106) / CONVERT(VARCHAR(20),LASTUPDATE,106) => 'dd Mon yyyy'
const D106 = (col) => `to_char(${col}, 'DD Mon YYYY')`;

// ---------------------------------------------------------------- [DistributerSessionExpireCheck] Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"); DistributerSessionExpireCheck has no body in legacy)
// route-config: merchant/all-tickets -> AllTickets/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/all-tickets'], ps.customerAuth, asyncHandler(async (req, res) => {
  const clid = req.user.plid;
  const rows = await db.proc(DB, 'usp_getallticketlist', { clid });
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/Index.cshtml', Model: mapRows(rows, TICKET_PROPS) });
}));

// ---------------------------------------------------------------- RefferalIndex()
// auth (legacy cast (Login)Session["Plid"] without a null check)
// route-config: referral/all-tickets -> AllTickets/RefferalIndex
router.all([`/portal/${C}/RefferalIndex{/:id}`, '/portal/referral/all-tickets'], ps.customerAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `select row_number() over (order by tmid desc) as number,
      tmid, ticketno, ${D106('tm."date"')} as createdate, categoryname, ${D106('lastupdate')} as lastupdatedate,
      subject, sm.name as status from tbl_ticketmaster tm inner join tbl_statusmaster sm
      on sm.id = tm.status where fromplid = @plid and accounttype = 2 order by lastupdate::date desc`, { plid: req.user.plid });
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/ReferralAllTicket.cshtml', Model: mapRows(rows, TICKET_PROPS) });
}));

// ---------------------------------------------------------------- CustomerIndex(int? page)
// auth (legacy cast (Login)Session["Plid"] without a null check)
// route-config: customer/all-tickets -> AllTickets/CustomerIndex
router.all([`/portal/${C}/CustomerIndex{/:id}`, '/portal/customer/all-tickets'], ps.customerAuth, asyncHandler(async (req, res) => {
  let page = mvcIntN(req, 'page');
  const ViewBag = {};
  ViewBag.masterpageshow = ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '';
  const CLID = req.user.plid;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'usp_getcustomerticketslist', { startrowindex: page, maxrows: MaxRows, clid: CLID });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the first result row (0 when the function returns no row).
  const t = outOf(rows, 'totalcount');
  const TotalRecord = t === undefined ? 0 : toInt32(t === null ? '' : String(t));
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/CustomerAllTicket.cshtml', Model: mapRows(rows, TICKET_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- CustomermobileIndex()
// auth (legacy cast (Login)Session["Plid"] without a null check)
// route-config: customer/all-tickets-mobile -> AllTickets/CustomermobileIndex
router.all([`/portal/${C}/CustomermobileIndex{/:id}`, '/portal/customer/all-tickets-mobile'], ps.customerAuth, asyncHandler(async (req, res) => {
  // legacy: ORDER BY LASTUPDATEDATE (the formatted string alias) DESC
  const rows = await db.query(DB, `select distinct
      tmid, ticketno, ${D106('tm."date"')} as createdate, categoryname, ${D106('lastupdate')} as lastupdatedate,
      subject, sm.name as status from tbl_ticketmaster tm inner join tbl_statusmaster sm
      on sm.id = tm.status where fromplid = @plid and accounttype = 2 order by lastupdatedate desc`, { plid: req.user.plid });
  return res.json({ view: '~/Views/CustomerPanel/AllTickets/CustomerAllTicketMobile.cshtml', Model: mapRows(rows, TICKET_PROPS) });
}));

module.exports = router;
