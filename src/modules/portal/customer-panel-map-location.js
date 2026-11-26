'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/MapLocation.cs (class MapLocationsController; DB: Db_Shopping)
// Started from src/modules/merchant/map-location.js; portal differences: view paths under ~/Views/CustomerPanel/, TITLE uses CompanySettings.CompanyName.
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const MapLocation = require('../../lib/portal/MapLocation');
const CS = require('../../lib/portal/CompanySettings');

const CompanySettings = CS.CompanySettings || CS;
const router = express.Router();
const DB = 'shopping';
const P = '/portal/MapLocations';
/** Convert.ToDouble(string) */
const toDouble = (s) => { const t = String(s).trim(); const n = Number(t); if (t === '' || Number.isNaN(n)) throw c.FormatError(); return n; };

// public (legacy: Session["Plid"] == null => PhotoGallery view, no redirect)
// route-config: merchant/map-locations -> MapLocations/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/map-locations'], ps.portalSession, asyncHandler(async (req, res) => {
  if (!ps.isCustomer(req)) {
    return res.json({ view: '~/Views/CustomerPanel/PhotoGallery/Index.cshtml' });
  }
  const Plid = c.toInt32(req.user.plid);
  const r = await db.queryOne(DB, 'select pmid from portal_master where plid = @Plid and active = true limit 1', { Plid });
  const ViewBag = {
    PMID: r && !c.isNull(r.pmid) ? Number(r.pmid) : 0,
    TITLE: 'Edit Businesslisiting Details | ' + CompanySettings.CompanyName + '.BZ',
  };
  return c.viewJson(res, '~/Views/CustomerPanel/MapLocations/Index.cshtml', undefined, ViewBag);
}));

// public (legacy: no session check; read-only)
router.all(`${P}/getmarker{/:id}`, asyncHandler(async (req, res) => {
  const pmidParam = req.p.pmidParam; // allcatid is bound but unused in legacy
  let pmid = 0;
  if (!c.isNull(pmidParam) && pmidParam !== '') pmid = c.toInt32(pmidParam);
  const details1 = [];
  const loc = await db.query(DB, 'select latitude, longitude from locations where pmid = @pmid', { pmid });
  if (loc.length <= 0) {
    details1.push({ latitude: 28.6100, longitute: 77.2300 });
  } else {
    for (const dr of loc) {
      if (c.isNull(dr.latitude) || c.isNull(dr.longitude)) throw c.NRE(); // dr.LATITUDE.ToString()
      details1.push({ latitude: toDouble(dr.latitude), longitute: toDouble(dr.longitude) });
    }
  }
  res.json(details1);
}));

// auth (PORT-NOTE: legacy had no session check; protected because it overwrites any listing's map location by pmid)
router.all(`${P}/setmarker{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let { latitude, lotitude } = req.p;
  const { address, pmidParam } = req.p;
  let pmid = 0;
  if (!c.isNull(pmidParam) && pmidParam !== '') pmid = c.toInt32(pmidParam);
  if (pmid <= 0) return res.json('expired');
  if (c.isNull(latitude) || c.isNull(lotitude)) throw c.NRE();
  if (String(latitude).trim() === '') latitude = '0';
  if (String(lotitude).trim() === '') lotitude = '0';
  const ret = await new MapLocation().UpdateMapLocations(pmid, latitude, lotitude, c.isNull(address) ? null : address);
  res.json(ret);
}));

// public (legacy: no session check)
router.all(`${P}/GetLatLon{/:id}`, asyncHandler(async (req, res) => {
  const CityName = req.p.CityName;
  const url = 'http://maps.google.com/maps/api/geocode/xml?address=' + c.str(CityName) + '&sensor=false';
  // WebRequest.Create escapes the URI like encodeURI
  const r = await axios.get(encodeURI(url), { responseType: 'text', transformResponse: (d) => d });
  // DataSet.ReadXml => Tables["location"].Rows[0]["lat"] / ["lng"]
  const m = /<location>\s*<lat>([^<]*)<\/lat>\s*<lng>([^<]*)<\/lng>\s*<\/location>/i.exec(String(r.data));
  if (!m) throw c.NRE(); // Tables["location"] is null
  res.json(m[1] + '~' + m[2]);
}));

module.exports = router;
