'use strict';
// Ported from Franchise\Controllers\CustomerPanel\MapLocation.cs (controller class MapLocationsController; database: shopping)
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const MapLocation = require('../../lib/franchise/MapLocation');

const router = express.Router();
const P = '/franchise/MapLocations';
const toInt32 = (s) => { const t = String(s).trim(); if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.'); return parseInt(t, 10); };
const toDouble = (s) => { const n = Number(String(s).trim()); if (String(s).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = parseInt(req.user.did, 10);
  const r = await db.queryOne('shopping', 'select pmid from distributor_master where plid=@plid and active=true limit 1', { plid: Plid });
  const ViewBag = { PMID: r ? r.pmid : 0, TITLE: 'Edit Businesslisiting Details | Jawria.BZ' };
  res.json({ ViewBag, ...ViewBag });
}));

// auth
router.all(P + '/getmarker{/:id}', auth, asyncHandler(async (req, res) => {
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  if (pmidParam != null && pmidParam !== '') pmid = toInt32(pmidParam);
  const details1 = [];
  const loc = await db.query('shopping', 'select latitude, longitude from locations where pmid=@pmid', { pmid });
  if (loc.length <= 0) {
    details1.push({ latitude: 28.6100, longitute: 77.2300 });
  } else {
    for (const dr of loc) {
      details1.push({ latitude: toDouble(dr.latitude), longitute: toDouble(dr.longitude) });
    }
  }
  res.json(details1);
}));

// auth
router.all(P + '/setmarker{/:id}', auth, asyncHandler(async (req, res) => {
  let { latitude, lotitude, address, pmidParam } = req.p;
  let pmid = 0;
  if (pmidParam != null && pmidParam !== '') pmid = toInt32(pmidParam);
  if (pmid <= 0) return res.json('expired');
  if (latitude.trim() === '') latitude = '0';
  if (lotitude.trim() === '') lotitude = '0';
  const ret = await new MapLocation().UpdateMapLocations(pmid, latitude, lotitude, address);
  res.json(ret);
}));

// auth
router.all(P + '/GetLatLon{/:id}', auth, asyncHandler(async (req, res) => {
  const CityName = req.p.CityName;
  const url = 'http://maps.google.com/maps/api/geocode/xml?address=' + CityName + '&sensor=false';
  const r = await axios.get(url, { responseType: 'text', transformResponse: (d) => d });
  const m = /<location>\s*<lat>([^<]*)<\/lat>\s*<lng>([^<]*)<\/lng>\s*<\/location>/i.exec(String(r.data));
  if (!m) throw new Error('Object reference not set to an instance of an object.'); // Tables["location"] null
  res.json(m[1] + '~' + m[2]);
}));

module.exports = router;
