'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\User_Category.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DAL_BusinessListing = require('../../lib/merchant/DAL_BusinessListing');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/User_Category';

// auth ([SessionExpireCheck])
router.all(`${P}/Index{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const out = {};
  const s = sessionStore.get(req, 'Success');
  if (s !== undefined && s !== null) { out.Success = s; sessionStore.set(req, 'Success', null); } // TempData
  const e = sessionStore.get(req, 'Error');
  if (e !== undefined && e !== null) { out.Error = e; sessionStore.set(req, 'Error', null); }
  let CountryId = 0;
  if (req.user) CountryId = Number(req.user.cid);
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword(Number(req.user.plid));
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ ...out, Model: Obj });
}));

// auth ([SessionExpireCheck])
router.all(`${P}/SelectedCategory{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const trim = (s) => String(s).replace(/^,+|,+$/g, '');
  if (req.p.Category === undefined || req.p.Category === null) throw new TypeError('Object reference not set to an instance of an object.');
  if (req.p.SubCategory === undefined || req.p.SubCategory === null) throw new TypeError('Object reference not set to an instance of an object.');
  const Category = trim(req.p.Category);
  const SubCategory = trim(req.p.SubCategory);
  // ExecuteSqlCommand returned rows affected (>0 => ok). PORT-NOTE: function result row count used as rows-affected.
  const rows = await db.proc(DB, 'usp_merchantcat_subcat_keywordmaster',
    { Mode: '1', Plid, TMCSKMID: '0', Category, SubCategory, Keyword: '' });
  res.json(rows.length > 0 ? 'ok' : 'NotOk');
}));

module.exports = router;
