'use strict';
// Ported from Franchise\Controllers\CustomerPanel\User_Category.cs (database: shopping - Franchise DataBaseContext points at Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DAL_BusinessListing = require('../../lib/franchise/DAL_BusinessListing');

const router = express.Router();
const guard = [auth, requireType('franchise')];
const P = '/franchise/User_Category';

// auth
router.all(`${P}/Index{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const out = {};
  const s = sessionStore.get(req, 'Success');
  if (s !== undefined && s !== null) { out.Success = s; sessionStore.set(req, 'Success', null); } // TempData
  const e = sessionStore.get(req, 'Error');
  if (e !== undefined && e !== null) { out.Error = e; sessionStore.set(req, 'Error', null); }
  let CountryId = 0;
  if (req.user) CountryId = Number(req.user.cid);
  const Obj = {};
  Obj.LiGetKeywordForBusinessListing = await DAL_BusinessListing.GetKeyword();
  Obj.LiSTATE = await DAL_BusinessListing.GetSTATE(CountryId);
  Obj.LiCity = await DAL_BusinessListing.GetCity(CountryId);
  res.json({ ...out, Model: Obj });
}));

// auth
router.all(`${P}/SelectedCategory{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const trim = (s) => String(s).replace(/^,+|,+$/g, '');
  if (req.p.Category === undefined || req.p.Category === null) throw new TypeError('Object reference not set to an instance of an object.');
  if (req.p.SubCategory === undefined || req.p.SubCategory === null) throw new TypeError('Object reference not set to an instance of an object.');
  const Category = trim(req.p.Category);
  const SubCategory = trim(req.p.SubCategory);
  // ExecuteSqlCommand returned rows affected (>0 => ok). PORT-NOTE: function result row count used as rows-affected.
  const rows = await db.proc('shopping', 'usp_merchantcat_subcat_keywordmaster',
    { Mode: '1', Plid, TMCSKMID: '0', Category, SubCategory, Keyword: '' });
  res.json(rows.length > 0 ? 'ok' : 'NotOk');
}));

module.exports = router;
