'use strict';
// Ported from Member\Controllers\CustomerPanel\AllTickets.cs (3 actions) - database: affiliate
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const nz = (v) => (v === undefined || v === null ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
async function errorInsert(err, procName, req) { // legacy DataUtility.ErrorInsert(code, message, procedure, line, url)
  try {
    const DU = require('../../lib/member/DataUtility');
    const ut = typeof DU === 'function' ? new DU() : (DU.DataUtility ? new DU.DataUtility() : DU);
    await ut.ErrorInsert(0, err.message, procName, 0, req.path);
  } catch (e) { console.error(e.message); }
}
const TICKET_PROPS = ['ROWNUMBER', 'TMID', 'TICKETNO', 'DATE', 'CATEGORYNAME', 'LASTUPDATE', 'SUBJECT', 'STATUS', 'ISREADADMIN', 'ISREADMEM'];
// PORT-NOTE: the legacy SELECT aliases NUMBER / CREATEDATE / LASTUPDATEDATE do not match the AllTicketList property names (EF left ROWNUMBER/DATE/LASTUPDATE
// at their defaults); the model-shaped keys are kept and the aliased columns are added alongside so no data is lost.
const ticketModel = (rows) => (rows || []).map((r) => {
  const m = mapRows([r], TICKET_PROPS)[0];
  for (const k of ['number', 'createdate', 'lastupdatedate']) if (k in r) m[k === 'number' ? 'NUMBER' : k === 'createdate' ? 'CREATEDATE' : 'LASTUPDATEDATE'] = r[k];
  return m;
});
const TICKET_SQL = `SELECT ROW_NUMBER() OVER (ORDER BY TM.LASTUPDATE DESC) AS NUMBER,
  TM.TMID,TM.TICKETNO,to_char(TM.DATE,'DD Mon YYYY') AS CREATEDATE,TM.CATEGORYNAME, to_char(TM.LASTUPDATE,'DD Mon YYYY') AS LASTUPDATEDATE,
  TM.SUBJECT,SM.Name AS STATUS`;

// auth
router.all('/member/AllTickets/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const CATEGORYNAME = req.p.CATEGORYNAME; const MSG = req.p.MSG;
  const params = { plid: Number(req.user.plid) };
  let q1 = '';
  if (MSG !== '' && MSG !== null && MSG !== undefined) { q1 = " and TM.SUBJECT like '%' || @msg || '%' "; params.msg = String(MSG); }
  if (CATEGORYNAME !== '' && CATEGORYNAME !== null && CATEGORYNAME !== undefined) { q1 += ' and TM.CATEGORYNAME = @catname'; params.catname = String(CATEGORYNAME); }
  const rows = await db.query(DB, `${TICKET_SQL},TM.ISREADADMIN::int as ISREADADMIN,TM.ISREADMEM::int as ISREADMEM
    FROM TBL_TICKETMASTER TM INNER JOIN TBL_STATUSMASTER SM ON SM.ID::text=TM.STATUS::text Where TM.FROMPLID=@plid ${q1}`, params);
  res.json({ Model: ticketModel(rows) });
}));

// auth
// route-config: referral/ticket-list -> RefferalIndex
router.all(['/member/AllTickets/RefferalIndex{/:id}', '/member/referral/ticket-list'], auth, asyncHandler(async (req, res) => {
  const SearchField = nz(req.p.SearchField); const SearchValue = nz(req.p.SearchValue);
  const fromDate = nz(req.p.fromDate); const toDate = nz(req.p.toDate);
  let dynamicpagging = intOrNull(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const orderbydate = nz(req.p.orderbydate); const ddlPlan = nz(req.p.ddlPlan);
  let ddlcustpage = intOrNull(req.p.ddlcustpage); if (ddlcustpage === null) ddlcustpage = 50;
  const status = req.p.status === undefined || req.p.status === null ? '0' : String(req.p.status);
  let page = intOrNull(req.p.page); if (page === null) page = 1;
  const MaxRows = dynamicpagging;
  const rows = await db.proc(DB, 'USP_ALLTICKET', {
    FROMDATE: fromDate, TODATE: toDate, STATUS: status, SearchField: SearchField.trim(), SearchValue: SearchValue.trim(), STARTROWINDEX: page,
    MAXROWS: MaxRows, FROMPLID: String(req.user.plid), orderbydate,
  });
  const Model = mapRows(rows, TICKET_PROPS);
  const rc = outv(rows, 'RECORDCOUNT');
  const TotalRecord = String(rc) === '' ? 0 : parseInt(String(rc), 10);
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  res.json({
    Model, CurrentPage: page, dynamicpagging, orderbydate, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField, SearchValue, fromDate, toDate, ddlPlan, ddlcustpage,
  });
}));

// auth
router.all('/member/AllTickets/CustomerIndex{/:id}', auth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `${TICKET_SQL}
    FROM TBL_TICKETMASTER TM INNER JOIN TBL_STATUSMASTER SM ON SM.ID::text=TM.STATUS::text Where TM.FROMPLID=@plid`, { plid: Number(req.user.plid) });
  res.json({ Model: ticketModel(rows) });
}));

module.exports = router;
