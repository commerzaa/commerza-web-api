'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\BillingDetails.cs (BillingDetailsController) */
const express = require('express');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/BillingDetails';

const str = (v) => (v === null || v === undefined ? '' : String(v));
const intOrNull = (v) => { if (v === undefined || v === null || v === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const numIfNumeric = (v) => (v !== undefined && v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v);
async function ErrorInsert(e, name, req) {
  try { await new DataUtility().ErrorInsert(0, e.message, name, 0, req.path); } catch (_) { /* ignore */ }
}
// PORT-NOTE: OUT params (@TotalCount ...) of paged procedures are read from the result columns of the proc rows (totalcount).
const outCol = (rows, name) => (rows.length && rows[0][name] !== undefined && rows[0][name] !== null ? rows[0][name] : null);
const totalOf = (rows) => { const t = outCol(rows, 'totalcount'); return t === null || String(t) === '' ? 0 : parseInt(t, 10); };

// auth
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  // legacy server-side logic before the view is commented out; view had no model
  res.json({});
}));

// auth
router.all(`${P}/insertbilling{/:id}`, auth, asyncHandler(async (req, res) => {
  const { bussinessname, contactname, txtphonenumber, address, city, txtpostalcode, state } = req.p;
  const Plid = Number(req.user.plid);
  const cid = await queryOne(DB, 'select cid from portal_login where plid = @p limit 1', { p: Plid });
  if (!cid) throw new TypeError('Object reference not set to an instance of an object.');
  const CID = cid.cid === null || cid.cid === undefined ? 0 : parseInt(cid.cid, 10);
  const out = await procOne(DB, 'usp_createbilling', {
    businessname: bussinessname, slid: Plid, contactname, phonenumber: txtphonenumber, address, city, postalcode: txtpostalcode, state, country: CID,
  });
  const ResValue = parseInt(str(out && out.intresult), 10);
  if (Number.isNaN(ResValue)) throw new Error('Input string was not in a correct format.');
  if (ResValue > 0) {
    await queryOne(DB, "Select coalesce(Phone,'') As Phone,EmailID,UserName From Portal_Login where plid = @p limit 1", { p: Plid }); // GetLoginIdEmail (unused)
    return res.json(ResValue);
  }
  return res.json(0);
}));

module.exports = router;
